(function () {
  "use strict";

  const booking = window.INITIAL_BOOKING;
  if (!booking) return;

  const mapEl = document.getElementById("tracking-map");
  const statusPill = document.getElementById("track-status-pill");
  const assignedRiderCard = document.getElementById("assigned-rider-card");
  const riderNameEl = document.getElementById("rider-name");
  const riderBikeText = document.getElementById("rider-bike-text");
  const riderAvatar = document.getElementById("rider-avatar");
  const riderCallBtn = document.getElementById("rider-call-btn");
  const riderSmsBtn = document.getElementById("rider-sms-btn");
  const liveDistanceIndicator = document.getElementById("live-distance-indicator");

  let map;
  let pickupMarker = null;
  let dropoffMarker = null;
  let riderMarker = null;
  let routeLine = null;

  function initMap() {
    if (!mapEl || typeof L === "undefined") return;

    map = L.map(mapEl).setView([9.2000, 124.7200], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Green Pickup Pin
    if (booking.pickup_lat && booking.pickup_lng) {
      const greenIcon = L.divIcon({
        className: "custom-pin",
        html: `<div style="background:#16a34a;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;">🟢</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      pickupMarker = L.marker([booking.pickup_lat, booking.pickup_lng], { icon: greenIcon })
        .addTo(map)
        .bindPopup(`<strong>Pickup:</strong><br>${escapeHtml(booking.pickup_address)}`);
    }

    // Red Dropoff Pin
    if (booking.dropoff_lat && booking.dropoff_lng) {
      const redIcon = L.divIcon({
        className: "custom-pin",
        html: `<div style="background:#dc2626;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;">🏁</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      dropoffMarker = L.marker([booking.dropoff_lat, booking.dropoff_lng], { icon: redIcon })
        .addTo(map)
        .bindPopup(`<strong>Dropoff:</strong><br>${escapeHtml(booking.dropoff_address)}`);
    }

    // Polyline (Road Route)
    if (booking.pickup_lat && booking.dropoff_lat) {
      const pLat = booking.pickup_lat;
      const pLng = booking.pickup_lng;
      const dLat = booking.dropoff_lat;
      const dLng = booking.dropoff_lng;

      routeLine = L.polyline(
        [
          [pLat, pLng],
          [dLat, dLng],
        ],
        { color: "#f97316", weight: 3, dashArray: "4, 6", opacity: 0.6 }
      ).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

      // Fetch actual road path from OSRM
      fetch(`https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.code === "Ok" && data.routes && data.routes.length > 0) {
            const roadCoords = data.routes[0].geometry.coordinates.map((pt) => [pt[1], pt[0]]);
            if (routeLine) map.removeLayer(routeLine);
            routeLine = L.polyline(roadCoords, {
              color: "#ea580c",
              weight: 5,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
          }
        })
        .catch(() => {});
    }

    // Rider Icon (if rider coordinates exist)
    if (booking.rider_lat && booking.rider_lng) {
      updateRiderMarker(booking.rider_lat, booking.rider_lng, booking.rider_name);
    }
  }

  function updateRiderMarker(lat, lng, riderName) {
    if (!map) return;
    const bikeIcon = L.divIcon({
      className: "rider-pulse-marker",
      html: `
        <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(249,115,22,0.4);animation:pulse-dot 1.5s infinite;"></div>
          <div style="position:relative;background:#f97316;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🛵</div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (!riderMarker) {
      riderMarker = L.marker([lat, lng], { icon: bikeIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`<strong>${escapeHtml(riderName || "Club Rider")}</strong><br>Active on trip`);
    } else {
      riderMarker.setLatLng([lat, lng]);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function pollLiveStatus() {
    try {
      const res = await fetch(`/api/bookings/track/${encodeURIComponent(booking.booking_code)}`);
      if (!res.ok) return;
      const data = await res.json();
      const b = data.booking;
      if (!b) return;

      // Update status pill
      if (statusPill) {
        statusPill.className = `status-pill status-${b.status}`;
        if (b.status === "broadcast") {
          statusPill.textContent = "⏳ Waiting for an available rider to accept...";
        } else if (b.status === "accepted") {
          statusPill.textContent = "🛵 Accepted! Rider is heading to pickup point...";
        } else if (b.status === "in_progress") {
          statusPill.textContent = "🚀 In Transit / Heading to destination...";
        } else if (b.status === "completed") {
          statusPill.textContent = "✓ Delivered! Thank you for using CCRC.";
        } else if (b.status === "cancelled") {
          statusPill.textContent = "✕ Booking has been cancelled.";
        }
      }

      // Update Stepper Bar
      const stepB = document.getElementById("step-broadcast");
      const stepA = document.getElementById("step-accepted");
      const stepT = document.getElementById("step-transit");
      const stepC = document.getElementById("step-complete");

      if (stepB && stepA && stepT && stepC) {
        stepB.style.borderBottomColor = ["broadcast", "accepted", "in_progress", "completed"].includes(b.status) ? "#ea580c" : "#cbd5e1";
        stepA.style.borderBottomColor = ["accepted", "in_progress", "completed"].includes(b.status) ? "#ea580c" : "#cbd5e1";
        stepT.style.borderBottomColor = ["in_progress", "completed"].includes(b.status) ? "#ea580c" : "#cbd5e1";
        stepC.style.borderBottomColor = b.status === "completed" ? "#16a34a" : "#cbd5e1";
      }

      // Auto-show review section upon trip completion
      const reviewCard = document.getElementById("review-card");
      if (b.status === "completed" && reviewCard) {
        reviewCard.classList.remove("hidden");
      }

      // Update Rider Card
      if (b.rider_id && assignedRiderCard) {
        assignedRiderCard.classList.remove("hidden");
        if (riderNameEl) riderNameEl.textContent = b.rider_name || "Club Rider";
        if (riderAvatar) riderAvatar.textContent = (b.rider_name || "R")[0].toUpperCase();
        if (riderBikeText) {
          riderBikeText.innerHTML = `${escapeHtml(b.rider_bike || "")} &bull; Plate: <strong>${escapeHtml(b.rider_plate || "")}</strong>`;
        }
        if (riderCallBtn && b.rider_phone) riderCallBtn.href = `tel:${b.rider_phone}`;
        if (riderSmsBtn && b.rider_phone) riderSmsBtn.href = `sms:${b.rider_phone}`;
      }

      // Update Live GPS coordinates of rider
      if (b.rider_lat && b.rider_lng) {
        updateRiderMarker(b.rider_lat, b.rider_lng, b.rider_name);
      }

      // Update distance indicator
      if (liveDistanceIndicator) {
        if (b.status === "accepted" && data.distance_to_pickup_km !== null) {
          liveDistanceIndicator.innerHTML = `📍 Rider distance from Pickup: <strong>~${data.distance_to_pickup_km} km</strong>`;
        } else if (b.status === "in_progress" && data.distance_to_dropoff_km !== null) {
          liveDistanceIndicator.innerHTML = `📍 Rider distance from Destination: <strong>~${data.distance_to_dropoff_km} km</strong>`;
        } else if (b.status === "completed") {
          liveDistanceIndicator.innerHTML = `✓ <strong>Successfully Delivered</strong>`;
        }
      }
    } catch (_) {}
  }

  // -------------------------------------------------------------------------
  // Safety & Sharing Actions
  // -------------------------------------------------------------------------
  const shareBtn = document.getElementById("share-ride-btn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const shareUrl = window.location.href;
      const shareTitle = `Track my Camiguin Rider (${booking.booking_code})`;
      const shareText = `Track my live motorcycle ride/delivery on Camiguin Island in real-time: ${shareUrl}`;

      if (navigator.share) {
        try {
          await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        } catch (_) {}
      } else {
        try {
          await navigator.clipboard.writeText(shareUrl);
          alert("📋 Live tracking link copied to clipboard! Share it with family or friends via SMS or Messenger.");
        } catch (_) {
          prompt("Copy your live tracking link:", shareUrl);
        }
      }
    });
  }

  // SOS Emergency Modal
  const sosBtn = document.getElementById("sos-btn");
  const sosModal = document.getElementById("sos-modal");
  const closeSosBtn = document.getElementById("close-sos-btn");

  if (sosBtn && sosModal) {
    sosBtn.addEventListener("click", () => sosModal.classList.remove("hidden"));
    if (closeSosBtn) closeSosBtn.addEventListener("click", () => sosModal.classList.add("hidden"));
  }

  // Official Receipt Modal
  const printReceiptBtn = document.getElementById("print-receipt-btn");
  const receiptModal = document.getElementById("receipt-modal");
  const closeReceiptBtn = document.getElementById("close-receipt-btn");

  if (printReceiptBtn && receiptModal) {
    printReceiptBtn.addEventListener("click", () => receiptModal.classList.remove("hidden"));
    if (closeReceiptBtn) closeReceiptBtn.addEventListener("click", () => receiptModal.classList.add("hidden"));
  }

  // -------------------------------------------------------------------------
  // Star Rating & Review Form
  // -------------------------------------------------------------------------
  const starBtns = document.querySelectorAll(".star-btn");
  const starValInput = document.getElementById("selected-star-val");
  const ratingForm = document.getElementById("rating-form");
  const reviewSuccessMsg = document.getElementById("review-success-msg");

  if (starBtns.length > 0 && starValInput) {
    starBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.getAttribute("data-star"), 10);
        starValInput.value = val;
        starBtns.forEach((b) => {
          const s = parseInt(b.getAttribute("data-star"), 10);
          b.style.color = s <= val ? "#f59e0b" : "#cbd5e1";
        });
      });
    });
  }

  if (ratingForm) {
    ratingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rating = parseInt(starValInput ? starValInput.value : "5", 10);
      const comment = (document.getElementById("review-comment-input") || {}).value || "";
      const submitBtn = document.getElementById("submit-review-btn");

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving review...";
      }

      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: booking.id,
            rider_id: booking.rider_id,
            customer_name: booking.customer_name,
            rating: rating,
            comment: comment.trim(),
          }),
        });

        if (res.ok) {
          ratingForm.classList.add("hidden");
          if (reviewSuccessMsg) reviewSuccessMsg.classList.remove("hidden");
        } else {
          alert("Could not submit review at this time.");
        }
      } catch (err) {
        alert("Error saving review: " + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Rider Review →";
        }
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    setInterval(pollLiveStatus, 3000);
  });
})();
