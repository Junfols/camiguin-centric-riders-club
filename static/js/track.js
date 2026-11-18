(function () {
  "use strict";

  const booking = window.INITIAL_BOOKING;
  if (!booking) return;

  // Persist active booking so customer can always find it if they quit the app
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
  const inappCallRiderBtn = document.getElementById("inapp-call-rider-btn");
  const chatInappCallBtn = document.getElementById("chat-inapp-call-btn");
  const chatVoiceBtn = document.getElementById("chat-voice-btn");
  const chatVoiceBar = document.getElementById("chat-voice-recording-bar");
  const chatVoiceTimer = document.getElementById("chat-voice-timer");
  const chatVoiceCancelBtn = document.getElementById("chat-voice-cancel-btn");
  const chatVoiceSendBtn = document.getElementById("chat-voice-send-btn");
  const liveDistanceIndicator = document.getElementById("live-distance-indicator");

  function syncCustomerVoiceCallContext(b) {
    if (!b) return;
    const canCall = Boolean(b.rider_id && ["accepted", "in_progress"].includes(b.status));
    if (inappCallRiderBtn) {
      inappCallRiderBtn.classList.toggle("hidden", !canCall);
    }
    if (chatInappCallBtn) {
      chatInappCallBtn.classList.toggle("hidden", !canCall);
    }
    if (window.CCRCVoiceCall && typeof window.CCRCVoiceCall.configure === "function") {
      window.CCRCVoiceCall.configure({
        role: "customer",
        bookingRef: b.booking_code,
        bookingCode: b.booking_code,
        peerName: b.rider_name || "Club Rider",
        peerPhone: b.rider_phone || "",
        peerRoleLabel: "Club Rider",
        canCall: canCall,
        onFallbackVoiceNote: () => {
          const section = document.getElementById("chat-section");
          if (section) section.scrollIntoView({ behavior: "smooth", block: "center" });
          if (chatVoiceBtn) chatVoiceBtn.focus();
        },
      });
    }
  }

  if (inappCallRiderBtn) {
    inappCallRiderBtn.addEventListener("click", () => {
      if (window.CCRCVoiceCall) window.CCRCVoiceCall.startCall();
    });
  }
  if (chatInappCallBtn) {
    chatInappCallBtn.addEventListener("click", () => {
      if (window.CCRCVoiceCall) window.CCRCVoiceCall.startCall();
    });
  }

  let map;
  let pickupMarker = null;
  let dropoffMarker = null;
  let riderMarker = null;
  let routeLine = null;
  let streetLayer = null;
  let satGroup = null;
  let currentTileLayer = "street";
  let lastRiderPosition = null;
  let lastPickupCoords = (booking.pickup_lat && booking.pickup_lng)
    ? { lat: Number(booking.pickup_lat), lng: Number(booking.pickup_lng) }
    : null;
  let currentRiderBearing = 0;
  let livePollTimer = null;
  let chatPollTimer = null;

  function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  function refreshTrackingRoute(pLat, pLng, dLat, dLng) {
    if (!map || !pLat || !pLng || !dLat || !dLng) return;

    // Initial bold red line while road geometry loads
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline(
      [
        [pLat, pLng],
        [dLat, dLng],
      ],
      { color: "#ef4444", weight: 5, opacity: 0.9 }
    ).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    // Fetch actual road path from backend road engine
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
            color: "#ef4444", // BOLD RED LINE
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

    // 1. Street Layer
    streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    // 2. Satellite Hybrid (Esri World Imagery + Places & Boundaries)
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

    // Track Layer Switcher
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

    // Recenter Button
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

    // Fullscreen Toggle
    const fsBtn = document.getElementById("track-fullscreen-btn");
    const container = document.getElementById("tracking-map-container");
    if (fsBtn && container) {
      fsBtn.addEventListener("click", () => {
        const isFs = container.classList.toggle("is-fullscreen");
        fsBtn.innerHTML = isFs ? "<span>✕</span>" : "<span>⛶</span>";
        setTimeout(() => map.invalidateSize(), 200);
      });
    }

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
      refreshTrackingRoute(booking.pickup_lat, booking.pickup_lng, booking.dropoff_lat, booking.dropoff_lng);
    }

    // Rider Icon (if rider coordinates exist)
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
        .bindPopup(`<strong>${escapeHtml(riderName || "Club Rider")}</strong><br>On the way to location`);
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

      // Sync progress stepper steps
      const stepBroadcast = document.getElementById("step-broadcast");
      const stepAccepted = document.getElementById("step-accepted");
      const stepTransit = document.getElementById("step-transit");
      const stepCompleted = document.getElementById("step-completed");
      if (stepBroadcast) stepBroadcast.classList.toggle("active", ["broadcast", "accepted", "in_progress", "completed"].includes(b.status));
      if (stepAccepted) stepAccepted.classList.toggle("active", ["accepted", "in_progress", "completed"].includes(b.status));
      if (stepTransit) stepTransit.classList.toggle("active", ["in_progress", "completed"].includes(b.status));
      if (stepCompleted) stepCompleted.classList.toggle("active", b.status === "completed");

      // Sync hidden review rider ID & chat status subtitle dynamically
      const reviewRiderInput = document.getElementById("review-rider-id");
      if (reviewRiderInput) {
        reviewRiderInput.value = b.rider_id ? String(b.rider_id) : "";
      }
      const chatStatusText = document.getElementById("chat-rider-status-text");
      if (chatStatusText) {
        chatStatusText.textContent = b.rider_name
          ? `Direct in-app messaging with ${b.rider_name}`
          : "Waiting for an available CCRC rider to accept...";
      }

      // Sync emergency handover / transfer banner
      const transferBanner = document.getElementById("track-transfer-banner");
      const transferBannerText = document.getElementById("track-transfer-banner-text");
      if (transferBanner && transferBannerText) {
        const tCount = Number(b.transfer_count || 0);
        if (tCount > 0) {
          const fromName = b.transferred_from_rider_name || "Previous rider";
          const reasonPart = b.transfer_reason ? ` (${b.transfer_reason})` : "";
          if (b.status === "broadcast" && !b.rider_id) {
            transferBannerText.textContent = `${fromName} requested an emergency rider transfer${reasonPart}. Finding the nearest available club rider now...`;
          } else if (b.rider_name) {
            transferBannerText.textContent = `Transferred from ${fromName} to rescue rider ${b.rider_name}${reasonPart}.`;
          } else {
            transferBannerText.textContent = `Transferred to a rescue rider${reasonPart}.`;
          }
          transferBanner.classList.remove("hidden");
        } else {
          transferBanner.classList.add("hidden");
        }
      }

      // Update status pill
      if (statusPill) {
        statusPill.className = `status-pill status-${b.status}`;
        if (b.status === "broadcast") {
          statusPill.textContent = Number(b.transfer_count || 0) > 0
            ? "🚨 Finding nearest rescue rider to take over your trip..."
            : "⏳ Waiting for an available rider to accept...";
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
          if (reviewCard) reviewCard.classList.remove("hidden");
        } else if (b.status === "cancelled") {
          statusPill.textContent = "✕ Booking has been cancelled.";
          const backWrap = document.getElementById("track-completed-back-wrap");
          if (backWrap) backWrap.classList.remove("hidden");
        }
      }

      // Update pickup pin & road route if handover location changed
      if (b.pickup_lat && b.pickup_lng && map) {
        const newPLat = Number(b.pickup_lat);
        const newPLng = Number(b.pickup_lng);
        const changedPickup = !lastPickupCoords
          || Math.abs(newPLat - lastPickupCoords.lat) > 0.00005
          || Math.abs(newPLng - lastPickupCoords.lng) > 0.00005;
        if (changedPickup) {
          lastPickupCoords = { lat: newPLat, lng: newPLng };
          if (pickupMarker) {
            pickupMarker.setLatLng([newPLat, newPLng]);
          }
          if (b.dropoff_lat && b.dropoff_lng) {
            refreshTrackingRoute(newPLat, newPLng, Number(b.dropoff_lat), Number(b.dropoff_lng));
          }
        }
      }

      // Update Rider Card (or hide & clear marker when re-broadcasted)
      const riderRatingWrap = document.getElementById("rider-rating-wrap");
      if (b.rider_id && assignedRiderCard) {
        assignedRiderCard.classList.remove("hidden");
        if (riderNameEl) riderNameEl.textContent = b.rider_name || "Club Rider";
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
        if (riderRatingWrap) {
          riderRatingWrap.innerHTML = `★ <strong>${escapeHtml(String(b.rider_rating || 5.0))}</strong> (Verified CCRC Member)`;
        }
        if (riderCallBtn && b.rider_phone) riderCallBtn.href = `tel:${b.rider_phone}`;
        if (riderSmsBtn && b.rider_phone) riderSmsBtn.href = `sms:${b.rider_phone}`;
      } else if (!b.rider_id) {
        if (assignedRiderCard) assignedRiderCard.classList.add("hidden");
        if (riderMarker && map) {
          map.removeLayer(riderMarker);
          riderMarker = null;
          lastRiderPosition = null;
        }
      }

      // Update Live GPS coordinates of rider
      if (b.rider_id && b.rider_lat && b.rider_lng) {
        updateRiderMarker(b.rider_lat, b.rider_lng, b.rider_name, b.rider_speed || 0, b.rider_heading || 0);
      }

      // Update distance indicator
      if (liveDistanceIndicator) {
        if (b.status === "broadcast") {
          liveDistanceIndicator.innerHTML = Number(b.transfer_count || 0) > 0
            ? `🚨 <strong>Finding nearest replacement rider...</strong>`
            : `📡 <strong>Waiting for rider acceptance...</strong>`;
        } else if (b.status === "accepted" && data.distance_to_pickup_km !== null) {
          liveDistanceIndicator.innerHTML = `📍 Rider distance from Pickup: <strong>~${data.distance_to_pickup_km} km</strong>`;
        } else if (b.status === "in_progress" && data.distance_to_dropoff_km !== null) {
          liveDistanceIndicator.innerHTML = `📍 Rider distance from Destination: <strong>~${data.distance_to_dropoff_km} km</strong>`;
        } else if (b.status === "completed") {
          liveDistanceIndicator.innerHTML = `✓ <strong>Successfully Delivered</strong>`;
        } else if (b.status === "cancelled") {
          liveDistanceIndicator.innerHTML = `✕ <strong>Trip Cancelled</strong>`;
        }
      }

      syncCustomerVoiceCallContext(b);

      if (b.status === "completed" || b.status === "cancelled") {
        if (livePollTimer) {
          clearInterval(livePollTimer);
          livePollTimer = null;
        }
        if (chatPollTimer) {
          clearInterval(chatPollTimer);
          chatPollTimer = null;
        }
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
    if (!chatMessagesBox) return;
    if (msg.id && chatMessagesBox.querySelector(`[data-msg-id="${msg.id}"]`)) return;
    if (chatEmptyHint) chatEmptyHint.style.display = "none";

    const isSystem = msg.sender_role === "system";
    const wrap = document.createElement("div");
    wrap.className = `chat-bubble-wrap ${isSystem ? "system" : (isSelf ? "self" : "other")}`;
    if (msg.id) wrap.dataset.msgId = String(msg.id);

    const sender = isSystem
      ? (msg.sender_name || "CCRC Dispatch")
      : (isSelf ? "You" : (msg.sender_name || "Club Rider"));
    const roleIcon = isSystem ? "🚨" : (isSelf ? "👤" : "🛵");
    const timeStr = msg.created_at ? msg.created_at.slice(11, 16) : "";

    let bodyHtml = "";
    const safeMediaUrl = typeof msg.media_url === "string" && msg.media_url.startsWith("/") ? msg.media_url : "";
    if (msg.msg_type === "voice" && safeMediaUrl) {
      const rawDur = Number(msg.media_duration || 0);
      const durMins = Math.floor(rawDur / 60);
      const durSecs = Math.round(rawDur % 60);
      const durLabel = rawDur > 0 ? ` (${durMins}:${String(durSecs).padStart(2, "0")})` : "";
      bodyHtml = `
        <div class="chat-voice-bubble-body">
          <span class="chat-voice-label"><span>🎤 Voice Message</span>${escapeHtml(durLabel)}</span>
          <audio controls preload="metadata" src="${escapeHtml(safeMediaUrl)}" class="chat-voice-player"></audio>
        </div>
      `;
    } else {
      bodyHtml = escapeHtml(msg.message);
    }

    wrap.innerHTML = `
      <span class="chat-sender-label">${roleIcon} ${escapeHtml(sender)}</span>
      <div class="chat-bubble">
        ${bodyHtml}
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
            if (!isSelf && msg.sender_name !== "CCRC Call") hasIncomingFromOther = true;
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

  if (chatVoiceBtn && window.CCRCVoiceCall && typeof window.CCRCVoiceCall.bindVoiceRecorder === "function") {
    window.CCRCVoiceCall.bindVoiceRecorder({
      triggerBtn: chatVoiceBtn,
      barEl: chatVoiceBar,
      timerEl: chatVoiceTimer,
      cancelBtn: chatVoiceCancelBtn,
      sendBtn: chatVoiceSendBtn,
      getUploadUrl: () => `/api/chat/${encodeURIComponent(booking.booking_code)}/voice?after=${lastMessageId}`,
      onUploaded: (data) => {
        const list = (data && Array.isArray(data.messages) && data.messages.length > 0)
          ? data.messages
          : (data && data.message ? [data.message] : []);
        for (const m of list) {
          if (m && m.id > lastMessageId) {
            lastMessageId = m.id;
            appendChatMessage(m, m.sender_role === "customer");
          }
        }
      },
    });
  }

  // Share Live GPS
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

  // Emergency SOS Modal
  const openSosBtn = document.getElementById("open-sos-btn");
  const closeSosBtn = document.getElementById("close-sos-btn");
  const sosModal = document.getElementById("sos-modal");
  if (openSosBtn && sosModal) {
    openSosBtn.addEventListener("click", () => sosModal.classList.remove("hidden"));
  }
  if (closeSosBtn && sosModal) {
    closeSosBtn.addEventListener("click", () => sosModal.classList.add("hidden"));
  }

  // Digital Receipt Modal
  const openReceiptBtn = document.getElementById("view-receipt-btn");
  const closeReceiptBtn = document.getElementById("close-receipt-btn");
  const receiptModal = document.getElementById("receipt-modal");
  if (openReceiptBtn && receiptModal) {
    openReceiptBtn.addEventListener("click", () => receiptModal.classList.remove("hidden"));
  }
  if (closeReceiptBtn && receiptModal) {
    closeReceiptBtn.addEventListener("click", () => receiptModal.classList.add("hidden"));
  }

  // 5-Star Rating Picker
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

  // Review Form Submit
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
            reviewFeedback.innerHTML = `✓ Thank you very much! Your review has been submitted.<br><div style="margin-top:10px;"><a href="/" class="btn btn-sm btn-primary" style="background:#16a34a;border:none;padding:8px 18px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;color:white;">← Back to Dashboard</a></div>`;
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

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    pollChatMessages();
    syncCustomerVoiceCallContext(booking);
    if (booking.status !== "completed" && booking.status !== "cancelled") {
      livePollTimer = setInterval(pollLiveStatus, 3000);
      chatPollTimer = setInterval(pollChatMessages, 2500);
    }
  });
})();
