(function () {
  "use strict";

  const booking = window.INITIAL_BOOKING;
  if (!booking) return;

  try {
    if (booking.status === "completed" || booking.status === "cancelled") {
      localStorage.removeItem("ccrc_active_booking");
    } else {
      localStorage.setItem("ccrc_active_booking", booking.booking_code);
      if (booking.customer_phone) {
        localStorage.setItem("ccrc_customer_phone", booking.customer_phone);
        if (!localStorage.getItem("ccrc_customer_session")) {
          localStorage.setItem("ccrc_customer_session", JSON.stringify({
            phone: booking.customer_phone,
            name: booking.customer_name || "Passenger",
            is_verified: booking.customer_verified || 1
          }));
        }
      }
      if (booking.customer_name) localStorage.setItem("ccrc_customer_name", booking.customer_name);
    }
  } catch (_) {}

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
  let streetLayer = null;
  let satGroup = null;
  let currentTileLayer = "street";
  let lastRiderPosition = null;
  let currentRiderBearing = 0;

  function syncCustomerVoiceCall(b) {
    if (!window.CCRCVoiceCall || !b) return;
    const canCall = Boolean(b.rider_id && ["accepted", "in_progress"].includes(b.status));
    window.CCRCVoiceCall.configure({
      role: "customer",
      bookingRef: b.booking_code,
      bookingCode: b.booking_code,
      peerName: b.rider_name || "Club Rider",
      peerPhone: b.rider_phone || "",
      peerRoleLabel: "CCRC Assigned Rider",
      canCall: canCall,
      onFallbackVoiceNote: () => {
        if (chatInputField) chatInputField.focus();
      }
    });
  }

  function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  function initMap() {
    if (!mapEl || typeof L === "undefined") return;

    const CAMIGUIN_BOUNDS = [
      [9.0500, 124.5800],
      [9.2900, 124.8300]
    ];

    map = L.map(mapEl, {
      zoomControl: true,
      minZoom: 11,
      maxZoom: 19,
      maxBounds: CAMIGUIN_BOUNDS,
      maxBoundsViscosity: 1.0,
      bounceAtZoomLimits: true
    }).fitBounds(CAMIGUIN_BOUNDS);

    streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    const satImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri',
    });
    const satLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      pane: "overlayPane",
    });
    satGroup = L.layerGroup([satImagery, satLabels]);

    streetLayer.addTo(map);

    document.querySelectorAll("[data-track-layer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const layerType = btn.getAttribute("data-track-layer");
        if (layerType === currentTileLayer) return;
        if (layerType === "satellite") {
          map.removeLayer(streetLayer);
          satGroup.addTo(map);
          currentTileLayer = "satellite";
        } else {
          map.removeLayer(satGroup);
          streetLayer.addTo(map);
          currentTileLayer = "street";
        }
        document.querySelectorAll("[data-track-layer]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-track-layer") === layerType);
        });
      });
    });

    const recenterBtn = document.getElementById("track-recenter-btn");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => {
        if (lastRiderPosition && map) {
          map.flyTo([lastRiderPosition.lat, lastRiderPosition.lng], 15, { duration: 1.0 });
        } else if (routeLine && map) {
          map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
        }
      });
    }

    const fsBtn = document.getElementById("track-fullscreen-btn");
    const container = document.getElementById("tracking-map-container");
    if (fsBtn && container) {
      fsBtn.addEventListener("click", () => {
        const isFs = container.classList.toggle("is-fullscreen");
        fsBtn.innerHTML = isFs ? "<span>✕</span>" : "<span>⛶</span>";
        setTimeout(() => map.invalidateSize(), 200);
      });
    }

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

    if (booking.pickup_lat && booking.dropoff_lat) {
      const pLat = booking.pickup_lat;
      const pLng = booking.pickup_lng;
      const dLat = booking.dropoff_lat;
      const dLng = booking.dropoff_lng;

      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.polyline(
        [
          [pLat, pLng],
          [dLat, dLng],
        ],
        { color: "#ef4444", weight: 5, opacity: 0.9 }
      ).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

      fetch(`/api/road-route?p_lat=${pLat}&p_lng=${pLng}&d_lat=${dLat}&d_lng=${dLng}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.code === "Ok" && data.route_coords && data.route_coords.length > 0) {
            const roadCoords = data.route_coords.map((pt) => {
              const n1 = parseFloat(pt[0]);
              const n2 = parseFloat(pt[1]);
              if (n1 > 50 && n2 < 50) return [n2, n1];
              return [n1, n2];
            });
            if (routeLine) map.removeLayer(routeLine);
            routeLine = L.polyline(roadCoords, {
              color: "#ef4444",
              weight: 5,
              opacity: 1.0,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
          }
        })
        .catch(() => {});
    }

    if (booking.rider_lat && booking.rider_lng) {
      updateRiderMarker(booking.rider_lat, booking.rider_lng, booking.rider_name);
    }
  }

  function updateRiderMarker(lat, lng, riderName, speed = 0, serverHeading = 0) {
    if (!map) return;

    if (serverHeading && serverHeading > 0) {
      currentRiderBearing = Math.round(serverHeading);
    } else if (lastRiderPosition) {
      const distDelta = Math.hypot(lat - lastRiderPosition.lat, lng - lastRiderPosition.lng);
      if (distDelta > 0.00006) {
        currentRiderBearing = Math.round(calculateBearing(lastRiderPosition.lat, lastRiderPosition.lng, lat, lng));
      }
    }
    lastRiderPosition = { lat, lng };

    const speedDisplay = (speed && speed > 2) ? `${Math.round(speed)} km/h` : '';

    const bikeIcon = L.divIcon({
      className: "ccrc-rider-3d-marker",
      html: `
        <div class="rider-3d-wrap">
          <div class="rider-radar-pulse"></div>
          <div class="rider-heading-cone" style="transform: rotate(${currentRiderBearing}deg);"></div>
          <div class="rider-3d-avatar" title="${escapeHtml(riderName || 'Club Rider')}">
            <span>🏍️</span>
          </div>
          ${speedDisplay ? `<span class="rider-speed-badge">${speedDisplay}</span>` : ''}
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    if (!riderMarker) {
      riderMarker = L.marker([lat, lng], { icon: bikeIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`<strong>${escapeHtml(riderName || "Club Rider")}</strong><br>Padung sa lokasyon`);
    } else {
      riderMarker.setIcon(bikeIcon);
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

      if (b.status === "completed" || b.status === "cancelled") {
        try { localStorage.removeItem("ccrc_active_booking"); } catch (_) {}
      } else {
        try { localStorage.setItem("ccrc_active_booking", b.booking_code); } catch (_) {}
      }

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
          const backWrap = document.getElementById("track-completed-back-wrap");
          if (backWrap) backWrap.classList.remove("hidden");
          const deliveredCard = document.getElementById("delivered-actions-card");
          if (deliveredCard) deliveredCard.classList.remove("hidden");
          const reviewCard = document.getElementById("review-submission-card");
          if (reviewCard && !ratingAlreadySubmitted) reviewCard.classList.remove("hidden");
          openRatingPopup(b);
        } else if (b.status === "cancelled") {
          statusPill.textContent = "✕ Booking has been cancelled.";
        }
      }

      if (b.rider_id && assignedRiderCard) {
        assignedRiderCard.classList.remove("hidden");
        if (riderNameEl) riderNameEl.textContent = b.rider_name || "Club Rider";
        const revRiderInput = document.getElementById("review-rider-id");
        if (revRiderInput && b.rider_id) revRiderInput.value = b.rider_id;
        if (riderAvatar) {
          if (b.rider_avatar) {
            riderAvatar.innerHTML = `<img src="${escapeHtml(b.rider_avatar)}" alt="${escapeHtml(b.rider_name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
          } else {
            riderAvatar.textContent = (b.rider_name || "R")[0].toUpperCase();
          }
        }
        if (riderBikeText) {
          riderBikeText.innerHTML = `${escapeHtml(b.rider_bike || "")} &bull; Plate: <strong>${escapeHtml(b.rider_plate || "")}</strong>`;
        }
        if (riderCallBtn && b.rider_phone) riderCallBtn.href = `tel:${b.rider_phone}`;
        if (riderSmsBtn && b.rider_phone) riderSmsBtn.href = `sms:${b.rider_phone}`;
      }

      syncCustomerVoiceCall(b);

      if (b.rider_lat && b.rider_lng) {
        updateRiderMarker(b.rider_lat, b.rider_lng, b.rider_name, b.rider_speed || 0, b.rider_heading || 0);
      }

      if (liveDistanceIndicator) {
        if (b.status === "accepted" && data.distance_to_pickup_km !== null) {
          liveDistanceIndicator.innerHTML = `📍 Rider distance from Pickup: <strong>~${data.distance_to_pickup_km} km</strong>`;
        } else if (b.status === "in_progress" && data.distance_to_dropoff_km !== null) {
          liveDistanceIndicator.innerHTML = `📍 Rider distance from Destination: <strong>~${data.distance_to_dropoff_km} km</strong>`;
        } else if (b.status === "completed") {
          liveDistanceIndicator.innerHTML = `✓ <strong>Successfully Delivered</strong>`;
        }
      }

      const trackReceiptItem = document.getElementById("track-receipt-item");
      const trackReceiptLink = document.getElementById("track-receipt-link");
      const trackReceiptImg = document.getElementById("track-receipt-img");
      const modalReceiptWrap = document.getElementById("modal-receipt-img-wrap");
      const modalReceiptLink = document.getElementById("modal-receipt-img-link");
      const modalReceiptImg = document.getElementById("modal-receipt-img");

      if (b.receipt_url) {
        if (trackReceiptItem) trackReceiptItem.classList.remove("hidden");
        if (trackReceiptLink) trackReceiptLink.href = b.receipt_url;
        if (trackReceiptImg) trackReceiptImg.src = b.receipt_url;
        if (modalReceiptWrap) modalReceiptWrap.classList.remove("hidden");
        if (modalReceiptLink) modalReceiptLink.href = b.receipt_url;
        if (modalReceiptImg) modalReceiptImg.src = b.receipt_url;
      }
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Live Chat System (Customer Side)
  // ---------------------------------------------------------------------------
  const chatMessagesBox = document.getElementById("chat-messages-box");
  const chatForm = document.getElementById("chat-form");
  const chatInputField = document.getElementById("chat-input-field");
  const chatEmptyHint = document.getElementById("chat-empty-hint");
  const cannedButtons = document.querySelectorAll("#customer-canned-replies .canned-btn");
  let lastMessageId = 0;
  let chatPollTimer = null;

  function playChatBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      if ("vibrate" in navigator) {
        navigator.vibrate([60, 40, 60]);
      }
    } catch (_) {}
  }

  function appendChatMessage(msg, isSelf) {
    if (chatEmptyHint) chatEmptyHint.style.display = "none";

    const wrap = document.createElement("div");
    wrap.className = `chat-bubble-wrap ${isSelf ? "self" : "other"}`;

    const sender = isSelf ? "You" : (msg.sender_name || "Kuya Rider");
    const roleIcon = isSelf ? "👤" : "🛵";
    const timeStr = msg.created_at ? msg.created_at.slice(11, 16) : "";

    wrap.innerHTML = `
      <span class="chat-sender-label">${roleIcon} ${escapeHtml(sender)}</span>
      <div class="chat-bubble">
        ${escapeHtml(msg.message)}
        <span class="chat-time">${timeStr}</span>
      </div>
    `;

    chatMessagesBox.appendChild(wrap);
    chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
  }

  async function pollChatMessages() {
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(booking.booking_code)}/messages?after=${lastMessageId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.messages && data.messages.length > 0) {
        let hasIncomingFromOther = false;
        for (const msg of data.messages) {
          if (msg.id > lastMessageId) {
            lastMessageId = msg.id;
            const isSelf = (msg.sender_role === "customer");
            appendChatMessage(msg, isSelf);
            if (!isSelf) hasIncomingFromOther = true;
          }
        }
        if (hasIncomingFromOther) {
          playChatBeep();
        }
      }
    } catch (_) {}
  }

  async function sendCustomerMessage(text) {
    if (!text || !text.trim()) return;
    const msgText = text.trim();
    if (chatInputField) chatInputField.value = "";

    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(booking.booking_code)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_role: "customer",
          sender_name: booking.customer_name || "Customer",
          message: msgText,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.message) {
          if (data.message.id > lastMessageId) {
            lastMessageId = data.message.id;
            appendChatMessage(data.message, true);
          }
        }
      }
    } catch (_) {}
  }

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (chatInputField) {
        sendCustomerMessage(chatInputField.value);
      }
    });
  }

  cannedButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const msg = btn.getAttribute("data-msg");
      if (msg) sendCustomerMessage(msg);
    });
  });

  const shareBtn = document.getElementById("share-gps-btn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const shareData = {
        title: "Track my CCRC Ride in Camiguin",
        text: `Track my live habal-habal express ride on Camiguin Island (${booking.booking_code}):`,
        url: window.location.href,
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (_) {}
      } else {
        try {
          await navigator.clipboard.writeText(window.location.href);
          alert("Tracking link copied to clipboard!");
        } catch (_) {
          prompt("Copy your tracking link:", window.location.href);
        }
      }
    });
  }

  const openSosBtn = document.getElementById("open-sos-btn");
  const closeSosBtn = document.getElementById("close-sos-btn");
  const sosModal = document.getElementById("sos-modal");
  if (openSosBtn && sosModal) {
    openSosBtn.addEventListener("click", () => sosModal.classList.remove("hidden"));
  }
  if (closeSosBtn && sosModal) {
    closeSosBtn.addEventListener("click", () => sosModal.classList.add("hidden"));
  }

  const openReceiptBtn = document.getElementById("view-receipt-btn");
  const closeReceiptBtn = document.getElementById("close-receipt-btn");
  const receiptModal = document.getElementById("receipt-modal");
  if (openReceiptBtn && receiptModal) {
    openReceiptBtn.addEventListener("click", () => receiptModal.classList.remove("hidden"));
  }
  if (closeReceiptBtn && receiptModal) {
    closeReceiptBtn.addEventListener("click", () => receiptModal.classList.add("hidden"));
  }

  const starPicker = document.getElementById("star-picker");
  const selectedRatingInput = document.getElementById("selected-rating");
  if (starPicker && selectedRatingInput) {
    const stars = starPicker.querySelectorAll(".star-item");
    stars.forEach(s => {
      s.addEventListener("click", () => {
        const val = parseInt(s.getAttribute("data-value") || "5", 10);
        selectedRatingInput.value = val;
        stars.forEach(st => {
          const v = parseInt(st.getAttribute("data-value") || "1", 10);
          st.style.color = (v <= val) ? "#f59e0b" : "#cbd5e1";
        });
      });
    });
  }

  const reviewForm = document.getElementById("track-review-form");
  const reviewFeedback = document.getElementById("review-feedback-msg");
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const riderId = document.getElementById("review-rider-id")?.value;
      const bookingId = document.getElementById("review-booking-id")?.value;
      const rating = selectedRatingInput?.value || "5";
      const comment = document.getElementById("review-comment")?.value || "";

      if (!riderId) {
        alert("Rider not yet assigned for this ride.");
        return;
      }

      try {
        const btn = document.getElementById("submit-review-btn");
        if (btn) btn.disabled = true;
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rider_id: parseInt(riderId, 10),
            booking_id: parseInt(bookingId, 10),
            rating: parseInt(rating, 10),
            comment: comment,
            customer_name: booking.customer_name || "Passenger"
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (reviewFeedback) {
            reviewFeedback.innerHTML = `✓ Salamat kaayo! Your review has been submitted.<br><div style="margin-top:10px;"><a href="/" class="btn btn-sm btn-primary" style="background:#16a34a;border:none;padding:8px 18px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;color:white;">← Balik sa Dashboard</a></div>`;
            reviewFeedback.classList.remove("hidden");
          }
          if (btn) btn.style.display = "none";
        } else {
          alert(data.error || "Could not submit review.");
          if (btn) btn.disabled = false;
        }
      } catch (err) {
        alert("Network error submitting review.");
        const btn = document.getElementById("submit-review-btn");
        if (btn) btn.disabled = false;
      }
    });
  }


  // ---------------------------------------------------------------------------
  // Immediate Post-Trip Rating Modal (Auto-opens on completion so customer never forgets)
  // ---------------------------------------------------------------------------
  const rateRiderModal = document.getElementById("rate-rider-modal");
  const modalStarPicker = document.getElementById("modal-star-picker");
  const modalSelectedRating = document.getElementById("modal-selected-rating");
  const modalStarLabel = document.getElementById("modal-star-label");
  const modalReviewComment = document.getElementById("modal-review-comment");
  const modalReviewForm = document.getElementById("modal-review-form");
  const modalReviewFeedback = document.getElementById("modal-review-feedback");
  const closeRateModalBtn = document.getElementById("close-rate-modal-btn");
  const skipRateModalBtn = document.getElementById("modal-skip-review-btn");

  let ratingPromptShownForBooking = false;
  let ratingAlreadySubmitted = false;

  const STAR_LABELS = {
    1: "★ Poor",
    2: "★★ Fair",
    3: "★★★ Good",
    4: "★★★★ Very Good",
    5: "★★★★★ Excellent Service!"
  };

  function openRatingPopup(b) {
    if (!rateRiderModal || ratingAlreadySubmitted || ratingPromptShownForBooking) return;
    if (!b || b.status !== "completed" || !b.rider_id) return;
    const storageFlag = `ccrc_rated_${b.booking_code}`;
    try {
      if (localStorage.getItem(storageFlag) === "1") {
        ratingAlreadySubmitted = true;
        return;
      }
    } catch (_) {}

    ratingPromptShownForBooking = true;
    const nameEl = document.getElementById("modal-rate-rider-name");
    if (nameEl && b.rider_name) nameEl.textContent = b.rider_name;
    const revRiderInput = document.getElementById("review-rider-id");
    if (revRiderInput && b.rider_id) revRiderInput.value = b.rider_id;

    rateRiderModal.classList.remove("hidden");
    rateRiderModal.style.display = "flex";
    if ("vibrate" in navigator) {
      try { navigator.vibrate([120, 60, 120]); } catch (_) {}
    }
  }

  function closeRatingPopup() {
    if (!rateRiderModal) return;
    rateRiderModal.classList.add("hidden");
    rateRiderModal.style.display = "none";
    const inlineReviewCard = document.getElementById("review-submission-card");
    if (inlineReviewCard && !ratingAlreadySubmitted) {
      inlineReviewCard.classList.remove("hidden");
      inlineReviewCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (closeRateModalBtn) closeRateModalBtn.addEventListener("click", closeRatingPopup);
  if (skipRateModalBtn) skipRateModalBtn.addEventListener("click", closeRatingPopup);

  if (modalStarPicker && modalSelectedRating) {
    const mStars = modalStarPicker.querySelectorAll(".m-star-item");
    mStars.forEach((s) => {
      s.addEventListener("click", () => {
        const val = parseInt(s.getAttribute("data-value") || "5", 10);
        modalSelectedRating.value = val;
        if (modalStarLabel) modalStarLabel.textContent = STAR_LABELS[val] || "";
        mStars.forEach((st) => {
          const v = parseInt(st.getAttribute("data-value") || "1", 10);
          st.style.color = (v <= val) ? "#f59e0b" : "#cbd5e1";
          st.style.transform = (v === val) ? "scale(1.18)" : "scale(1)";
        });
      });
    });
  }

  document.querySelectorAll("#modal-compliment-chips .m-chip-btn").forEach((chip) => {
    chip.addEventListener("click", () => {
      const txt = chip.getAttribute("data-chip") || "";
      if (!modalReviewComment || !txt) return;
      if (!modalReviewComment.value.includes(txt)) {
        modalReviewComment.value = modalReviewComment.value
          ? `${modalReviewComment.value.trim()} ${txt}`
          : txt;
      }
      chip.style.background = "#fed7aa";
    });
  });

  if (modalReviewForm) {
    modalReviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const riderId = document.getElementById("review-rider-id")?.value || booking.rider_id;
      const bookingId = document.getElementById("review-booking-id")?.value || booking.id;
      const rating = modalSelectedRating?.value || "5";
      const comment = modalReviewComment?.value || "";

      if (!riderId) {
        alert("Rider not assigned for this ride.");
        return;
      }

      const btn = document.getElementById("modal-submit-review-btn");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Submitting...";
      }

      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rider_id: parseInt(riderId, 10),
            booking_id: parseInt(bookingId, 10),
            rating: parseInt(rating, 10),
            comment: comment,
            customer_name: booking.customer_name || "Passenger"
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          ratingAlreadySubmitted = true;
          try { localStorage.setItem(`ccrc_rated_${booking.booking_code}`, "1"); } catch (_) {}
          if (modalReviewFeedback) {
            modalReviewFeedback.innerHTML = `✓ Thank you! Your ${rating}-Star rating has been saved.<br><div style="margin-top:12px;"><a href="/" class="btn btn-sm btn-primary" style="background:#ea580c;border:none;padding:9px 20px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block;color:white;">🏠 Back to Dashboard</a></div>`;
            modalReviewFeedback.classList.remove("hidden");
          }
          if (btn) btn.style.display = "none";
          if (skipRateModalBtn) skipRateModalBtn.style.display = "none";
          const inlineCard = document.getElementById("review-submission-card");
          if (inlineCard) inlineCard.classList.add("hidden");
        } else {
          if (res.status === 409) {
            ratingAlreadySubmitted = true;
            try { localStorage.setItem(`ccrc_rated_${booking.booking_code}`, "1"); } catch (_) {}
            closeRatingPopup();
            return;
          }
          alert(data.error || "Could not submit review.");
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Submit Rating ⭐ →";
          }
        }
      } catch (_) {
        alert("Network error submitting review.");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Submit Rating ⭐ →";
        }
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    syncCustomerVoiceCall(booking);
    if (booking && booking.status === "completed") {
      openRatingPopup(booking);
    }

    if (riderCallBtn) {
      riderCallBtn.addEventListener("click", (e) => {
        if (window.CCRCVoiceCall) {
          e.preventDefault();
          window.CCRCVoiceCall.startCall();
        }
      });
    }

    setInterval(pollLiveStatus, 3000);
    pollChatMessages();
    chatPollTimer = setInterval(pollChatMessages, 2500);
  });
})();
