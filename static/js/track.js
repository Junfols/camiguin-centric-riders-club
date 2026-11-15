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

    // Polyline
    if (booking.pickup_lat && booking.dropoff_lat) {
      routeLine = L.polyline(
        [
          [booking.pickup_lat, booking.pickup_lng],
          [booking.dropoff_lat, booking.dropoff_lng],
        ],
        { color: "#f97316", weight: 4, dashArray: "6, 8", opacity: 0.8 }
      ).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
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
        .bindPopup(`<strong>${escapeHtml(riderName || "Club Rider")}</strong><br>Aktibo nga nagbiyahe`);
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
          statusPill.textContent = "⏳ Nangita pa og Magdawat nga Rider...";
        } else if (b.status === "accepted") {
          statusPill.textContent = "🛵 Gidawat na! Padulong na ang Rider sa Pickup...";
        } else if (b.status === "in_progress") {
          statusPill.textContent = "🚀 In Transit / Padulong na sa Hatdanan...";
        } else if (b.status === "completed") {
          statusPill.textContent = "✓ Nahatud na! Salamat sa pagsalig sa CCRC.";
        } else if (b.status === "cancelled") {
          statusPill.textContent = "✕ Na-cancel ang booking.";
        }
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
          liveDistanceIndicator.innerHTML = `📍 Gilay-on sa Rider gikan sa Pickup: <strong>~${data.distance_to_pickup_km} km</strong>`;
        } else if (b.status === "in_progress" && data.distance_to_dropoff_km !== null) {
          liveDistanceIndicator.innerHTML = `📍 Gilay-on sa Rider gikan sa Hatdanan: <strong>~${data.distance_to_dropoff_km} km</strong>`;
        } else if (b.status === "completed") {
          liveDistanceIndicator.innerHTML = `✓ <strong>Malampusong Nahatud</strong>`;
        }
      }
    } catch (_) {}
  }

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    // Start polling every 3 seconds
    setInterval(pollLiveStatus, 3000);
  });
})();
