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
  let streetLayer = null;
  let satGroup = null;
  let currentTileLayer = "street";
  let lastRiderPosition = null;
  let currentRiderBearing = 0;

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

      // Fetch actual road path from backend road engine
      fetch(`/api/road-route?p_lat=${pLat}&p_lng=${pLng}&d_lat=${dLat}&d_lng=${dLng}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.code === "Ok" && data.route_coords && data.route_coords.length > 0) {
            const roadCoords = data.route_coords.map((pt) => [pt[1], pt[0]]);
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

      // Update Rider Card
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
        if (riderCallBtn && b.rider_phone) riderCallBtn.href = `tel:${b.rider_phone}`;
        if (riderSmsBtn && b.rider_phone) riderSmsBtn.href = `sms:${b.rider_phone}`;
      }

      // Update Live GPS coordinates of rider
      if (b.rider_lat && b.rider_lng) {
        updateRiderMarker(b.rider_lat, b.rider_lng, b.rider_name, b.rider_speed || 0, b.rider_heading || 0);
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

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    // Start polling every 3 seconds
    setInterval(pollLiveStatus, 3000);
    // Poll chat messages every 2.5 seconds
    pollChatMessages();
    chatPollTimer = setInterval(pollChatMessages, 2500);
  });
})();
