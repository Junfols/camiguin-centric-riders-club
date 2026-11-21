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


  // ---------------------------------------------------------------------------
  // Multi-Rider Group Tracking, Chat Switcher & Per-Rider Free In-App Voice Call
  // ---------------------------------------------------------------------------
  let activeSlotBooking = Object.assign({}, booking);
  let latestGroupBookings = [];
  let extraGroupRiderMarkers = {};

  function getActiveBookingRef() {
    return (activeSlotBooking && activeSlotBooking.booking_code) || booking.booking_code;
  }

  window.switchActiveGroupSlot = function(slotCode) {
    if (!slotCode) return;
    const found = latestGroupBookings.find((gb) => gb.booking_code === slotCode);
    if (!found) return;
    const changed = activeSlotBooking.booking_code !== found.booking_code;
    activeSlotBooking = Object.assign({}, found);
    if (changed) {
      lastMessageId = 0;
      if (chatMessagesBox) {
        chatMessagesBox.innerHTML = "";
        if (chatEmptyHint) {
          chatEmptyHint.style.display = "block";
          chatMessagesBox.appendChild(chatEmptyHint);
        }
      }
      pollChatMessages();
    }
    const chatSub = document.getElementById("chat-rider-status-text");
    if (chatSub) {
      chatSub.textContent = found.rider_name
        ? `Direct in-app messaging with Rider #${found.rider_slot || 1}: ${found.rider_name}`
        : `Waiting for Rider #${found.rider_slot || 1} to join...`;
    }
    renderSingleAssignedRiderCard(activeSlotBooking);
    syncCustomerVoiceCall(activeSlotBooking);
    renderGroupRidersPanel(latestGroupBookings);
    if (found.rider_lat && found.rider_lng && map) {
      map.flyTo([found.rider_lat, found.rider_lng], 15, { duration: 0.8 });
    }
  };

  window.callSpecificGroupRider = function(slotCode) {
    window.switchActiveGroupSlot(slotCode);
    setTimeout(() => {
      if (window.CCRCVoiceCall) {
        window.CCRCVoiceCall.startCall();
      }
    }, 80);
  };

  function renderSingleAssignedRiderCard(b) {
    if (b && b.rider_id) {
      const revRiderInput = document.getElementById("review-rider-id");
      if (revRiderInput) revRiderInput.value = b.rider_id;
      const revBookingInput = document.getElementById("review-booking-id");
      if (revBookingInput && b.id) revBookingInput.value = b.id;
    }
    if (!assignedRiderCard) return;
    const isMultiRiderGroup =
      (Array.isArray(latestGroupBookings) && latestGroupBookings.length > 1) ||
      Number((b && b.group_size) || 1) > 1;
    if (isMultiRiderGroup) {
      assignedRiderCard.classList.add("hidden");
      return;
    }
    if (b && b.rider_id) {
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
    } else {
      assignedRiderCard.classList.add("hidden");
    }
  }

  function renderGroupRidersPanel(groupList) {
    const panel = document.getElementById("group-riders-panel");
    const slotsContainer = document.getElementById("group-riders-slots-list");
    const assignedLbl = document.getElementById("group-assigned-label");
    const totalLbl = document.getElementById("group-total-label");
    const grpBadge = document.getElementById("group-code-badge");
    const legacyDupCards = document.getElementById("all-accepted-riders-cards");
    if (legacyDupCards) {
      legacyDupCards.innerHTML = "";
      legacyDupCards.classList.add("hidden");
    }
    if (!panel || !slotsContainer) return;

    if (!groupList || groupList.length <= 1) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    const assignedCount = groupList.filter((g) => Boolean(g.rider_id)).length;
    if (assignedLbl) assignedLbl.textContent = assignedCount;
    if (totalLbl) totalLbl.textContent = groupList.length;
    if (grpBadge && groupList[0].group_code) grpBadge.textContent = groupList[0].group_code;

    slotsContainer.innerHTML = groupList.map((gb) => {
      const slotNum = gb.rider_slot || 1;
      const isSelected = gb.booking_code === getActiveBookingRef();
      const hasRider = Boolean(gb.rider_id);
      const borderStyle = isSelected ? "2px solid #2563eb" : "1.5px solid #bfdbfe";
      const bgStyle = isSelected ? "#ffffff" : "#f8fafc";
      const shadowStyle = isSelected
        ? "0 4px 12px rgba(37,99,235,0.14)"
        : "0 2px 6px rgba(15,23,42,0.05)";

      if (!hasRider) {
        return `
          <div style="background:${bgStyle};border:${borderStyle};border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:${shadowStyle};">
            <div style="width:46px;height:46px;border-radius:50%;background:#e2e8f0;color:#64748b;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.15rem;">
              ⏳
            </div>
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="background:#64748b;color:#fff;font-size:0.7rem;font-weight:800;padding:2px 8px;border-radius:999px;">Rider #${slotNum}</span>
                <strong style="font-size:0.92rem;color:#475569;">Waiting for rider to accept...</strong>
              </div>
              <div style="font-size:0.75rem;color:#94a3b8;font-family:monospace;margin-top:2px;">${escapeHtml(gb.booking_code)}</div>
            </div>
          </div>
        `;
      }

      const canCallSlot = ["accepted", "in_progress"].includes(gb.status);
      const isSlotCompleted = gb.status === "completed";
      const slotRated = isSlotCompleted && isSlotAlreadyReviewed(gb);
      const avatarContent = gb.rider_avatar
        ? `<img src="${escapeHtml(gb.rider_avatar)}" alt="${escapeHtml(gb.rider_name || '')}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : escapeHtml((gb.rider_name || "R")[0].toUpperCase());

      const statusHtml = isSlotCompleted
        ? `<span style="color:#15803d;font-weight:700;">✓ Completed</span>`
        : (gb.status === "in_progress"
          ? `<span style="color:#0284c7;font-weight:700;">🚀 In Transit</span>`
          : `<span style="color:#15803d;font-weight:700;">🛵 Accepted &bull; Heading to Pickup</span>`);

      const primaryActionBtn = canCallSlot
        ? `<button type="button" onclick="event.stopPropagation();window.callSpecificGroupRider('${escapeHtml(gb.booking_code)}');" class="btn btn-primary btn-sm" style="background:#16a34a;border-color:#16a34a;font-weight:700;padding:9px 10px;border-radius:9px;cursor:pointer;">🔊 Free In-App Call</button>`
        : (isSlotCompleted
          ? (slotRated
            ? `<button type="button" disabled onclick="event.stopPropagation();" class="btn btn-sm" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;font-weight:700;padding:9px 10px;border-radius:9px;">⭐ Rated${getSlotReviewRating(gb) ? ` (${getSlotReviewRating(gb)}/5)` : " ✓"}</button>`
            : `<button type="button" onclick="event.stopPropagation();window.openRatingModalForGroup('${escapeHtml(gb.booking_code)}');" class="btn btn-primary btn-sm" style="background:#f97316;border-color:#ea580c;font-weight:700;padding:9px 10px;border-radius:9px;cursor:pointer;">⭐ Rate Rider #${slotNum}</button>`)
          : `<button type="button" disabled onclick="event.stopPropagation();" class="btn btn-sm" style="background:#e2e8f0;color:#64748b;border:none;font-weight:700;padding:9px 10px;border-radius:9px;">🔊 Call</button>`);

      return `
        <div onclick="window.switchActiveGroupSlot('${escapeHtml(gb.booking_code)}')" style="background:${bgStyle};border:${borderStyle};border-radius:12px;padding:12px 14px;box-shadow:${shadowStyle};cursor:pointer;transition:border-color 0.15s ease;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:48px;height:48px;border-radius:50%;background:#ffedd5;color:#ea580c;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid ${isSelected ? "#2563eb" : "#fdba74"};">
              ${avatarContent}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="background:#1d4ed8;color:#fff;font-size:0.7rem;font-weight:800;padding:2px 8px;border-radius:999px;">Rider #${slotNum}</span>
                <strong style="font-size:0.96rem;color:#0f172a;word-break:break-word;">${escapeHtml(gb.rider_name || "Club Rider")}</strong>
                ${isSelected ? `<span style="background:#2563eb;color:#fff;font-size:0.66rem;padding:2px 7px;border-radius:999px;font-weight:700;">Active Chat</span>` : ""}
              </div>
              <div style="font-size:0.81rem;color:#475569;margin-top:3px;">
                🏍️ ${escapeHtml(gb.rider_bike || "Motorcycle")} &bull; Plate: <strong>${escapeHtml(gb.rider_plate || "N/A")}</strong>
              </div>
              <div style="font-size:0.76rem;margin-top:2px;">
                ${statusHtml}
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
            ${primaryActionBtn}
            <a href="sms:${escapeHtml(gb.rider_phone || "")}" onclick="event.stopPropagation();" class="btn btn-outline btn-sm" style="text-align:center;font-weight:700;padding:9px 10px;border-radius:9px;text-decoration:none;background:#ffffff;">💬 Send SMS</a>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderAllAcceptedRiderCards() {
    const legacyDupCards = document.getElementById("all-accepted-riders-cards");
    if (legacyDupCards) {
      legacyDupCards.innerHTML = "";
      legacyDupCards.classList.add("hidden");
    }
  }

    function syncExtraGroupMapMarkers(groupList) {
    if (!map || typeof L === "undefined") return;
    const activeCodes = new Set();
    (groupList || []).forEach((gb) => {
      if (gb.booking_code === getActiveBookingRef()) return;
      if (gb.rider_id && gb.rider_lat && gb.rider_lng) {
        activeCodes.add(gb.booking_code);
        const slotNum = gb.rider_slot || 1;
        const iconHtml = `
          <div class="rider-3d-wrap">
            <div class="rider-3d-avatar" style="background:#2563eb;border:2px solid #fff;" title="Rider #${slotNum}: ${escapeHtml(gb.rider_name || '')}">
              <span style="font-size:0.78rem;font-weight:900;color:#fff;">#${slotNum}</span>
            </div>
          </div>
        `;
        const gIcon = L.divIcon({
          className: "ccrc-rider-3d-marker",
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        if (!extraGroupRiderMarkers[gb.booking_code]) {
          extraGroupRiderMarkers[gb.booking_code] = L.marker([gb.rider_lat, gb.rider_lng], { icon: gIcon, zIndexOffset: 950 })
            .addTo(map)
            .bindPopup(`<strong>Rider #${slotNum}: ${escapeHtml(gb.rider_name || "Club Rider")}</strong><br>${escapeHtml(gb.rider_plate || "")}`);
        } else {
          extraGroupRiderMarkers[gb.booking_code].setLatLng([gb.rider_lat, gb.rider_lng]);
        }
      }
    });
    Object.keys(extraGroupRiderMarkers).forEach((code) => {
      if (!activeCodes.has(code)) {
        map.removeLayer(extraGroupRiderMarkers[code]);
        delete extraGroupRiderMarkers[code];
      }
    });
  }

  async function pollLiveStatus() {
    try {
      const res = await fetch(`/api/bookings/track/${encodeURIComponent(booking.booking_code)}`);
      if (!res.ok) return;
      const data = await res.json();
      const b = data.booking;
      if (!b) return;

      latestPrimaryBooking = Object.assign({}, b);
      latestGroupBookings = Array.isArray(data.group_bookings) ? data.group_bookings : [];

      const allKnownSlots = latestGroupBookings.length > 0 ? latestGroupBookings : [b];
      allKnownSlots.forEach((slot) => {
        if (slot && slot.is_reviewed) {
          markSlotReviewedLocally(slot, slot.review_rating || 5);
        }
      });

      const hasAnyOngoingSlot = allKnownSlots.some((slot) =>
        ["broadcast", "accepted", "in_progress"].includes(slot.status)
      );
      if (!hasAnyOngoingSlot && (b.status === "completed" || b.status === "cancelled")) {
        try { localStorage.removeItem("ccrc_active_booking"); } catch (_) {}
      } else if (b.status !== "completed" && b.status !== "cancelled") {
        try { localStorage.setItem("ccrc_active_booking", b.booking_code); } catch (_) {}
      }

      if (latestGroupBookings.length > 1) {
        const matched = latestGroupBookings.find((gb) => gb.booking_code === activeSlotBooking.booking_code);
        if (matched) {
          activeSlotBooking = Object.assign({}, matched);
        } else {
          const firstAssigned = latestGroupBookings.find((gb) => Boolean(gb.rider_id));
          activeSlotBooking = Object.assign({}, firstAssigned || b);
        }
      } else {
        activeSlotBooking = Object.assign({}, b);
      }

      if (statusPill) {
        const completedCount = allKnownSlots.filter((s) => s.status === "completed").length;
        const isGroupAllCompleted = latestGroupBookings.length > 1 && completedCount > 0 && !hasAnyOngoingSlot;
        statusPill.className = `status-pill status-${isGroupAllCompleted ? "completed" : b.status}`;
        if (isGroupAllCompleted) {
          statusPill.textContent = `✓ All ${completedCount} Riders Delivered! Thank you for using CCRC.`;
        } else if (b.status === "broadcast") {
          statusPill.textContent = "⏳ Waiting for an available rider to accept...";
        } else if (b.status === "accepted") {
          statusPill.textContent = "🛵 Accepted! Rider is heading to pickup point...";
        } else if (b.status === "in_progress") {
          statusPill.textContent = "🚀 In Transit / Heading to destination...";
        } else if (b.status === "completed") {
          statusPill.textContent = latestGroupBookings.length > 1 && hasAnyOngoingSlot
            ? `✓ ${completedCount}/${latestGroupBookings.length} Riders Delivered! Waiting for remaining rider...`
            : "✓ Delivered! Thank you for using CCRC.";
        } else if (b.status === "cancelled") {
          statusPill.textContent = "✕ Booking has been cancelled.";
        }
      }

      const anyCompletedSlot = allKnownSlots.some((s) => s.status === "completed");
      if (anyCompletedSlot) {
        const backWrap = document.getElementById("track-completed-back-wrap");
        if (backWrap && !hasAnyOngoingSlot) backWrap.classList.remove("hidden");
        const deliveredCard = document.getElementById("delivered-actions-card");
        if (deliveredCard && !hasAnyOngoingSlot) deliveredCard.classList.remove("hidden");
      }

      renderGroupRidersPanel(latestGroupBookings);
      renderAllAcceptedRiderCards(latestGroupBookings);
      renderSingleAssignedRiderCard(activeSlotBooking);
      syncCustomerVoiceCall(activeSlotBooking);
      syncMultiRiderReviewUI(b);

      const focusRider = activeSlotBooking.rider_id ? activeSlotBooking : b;
      if (focusRider.rider_lat && focusRider.rider_lng) {
        updateRiderMarker(focusRider.rider_lat, focusRider.rider_lng, focusRider.rider_name, focusRider.rider_speed || 0, focusRider.rider_heading || 0);
      }
      syncExtraGroupMapMarkers(latestGroupBookings);

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

      const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
      if (b.rider_name) setT("modal-rider-name", b.rider_name);
      if (b.rider_plate) {
        setT("modal-rider-plate", b.rider_plate);
        const plateRow = document.getElementById("modal-rider-plate-row");
        if (plateRow) plateRow.classList.remove("hidden");
      }
      {
        const fareN = Number(b.fare_amount) || 0;
        const boughtN = Number(b.purchase_amount) || 0;
        const f = (n, d) => n.toLocaleString("en-PH", { minimumFractionDigits: d, maximumFractionDigits: d });
        if (boughtN > 0) {
          setT("modal-fare-only", f(fareN, 0));
          setT("modal-purchase-amount", f(boughtN, 2));
          setT("modal-total-fare", f(fareN + boughtN, 2));
          document.getElementById("modal-fare-row")?.classList.remove("hidden");
          document.getElementById("modal-purchase-row")?.classList.remove("hidden");
        } else {
          setT("modal-total-fare", f(fareN, 0));
        }
      }
      const purchaseBox = document.getElementById("track-purchase-box");
      const purchaseVal = Number(b.purchase_amount) || 0;
      if (purchaseBox && purchaseVal > 0) {
        const fareVal = Number(b.fare_amount) || 0;
        const fmt = (n, d) => n.toLocaleString("en-PH", { minimumFractionDigits: d, maximumFractionDigits: d });
        const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        setTxt("track-purchase-amount", fmt(purchaseVal, 2));
        setTxt("track-purchase-fare", fmt(fareVal, 0));
        setTxt("track-purchase-total", fmt(fareVal + purchaseVal, 2));
        purchaseBox.classList.remove("hidden");
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
      const res = await fetch(`/api/chat/${encodeURIComponent(getActiveBookingRef())}/messages?after=${lastMessageId}`);
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
      const res = await fetch(`/api/chat/${encodeURIComponent(getActiveBookingRef())}/messages`, {
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

  // ---------------------------------------------------------------------------
  // Multi-Rider & Single-Rider Rating System (Auto-Popup Modal + Inline Card)
  // Supports 1..10 riders: batch submits all completed riders in one tap, and
  // automatically re-prompts when a 2nd/3rd rider completes later.
  // ---------------------------------------------------------------------------
  const rateRiderModal = document.getElementById("rate-rider-modal");
  const modalRidersContainer = document.getElementById("modal-riders-rating-container");
  const modalRatedSummary = document.getElementById("modal-rated-summary");
  const modalPendingNote = document.getElementById("modal-pending-riders-note");
  const modalReviewForm = document.getElementById("modal-review-form");
  const modalReviewFeedback = document.getElementById("modal-review-feedback");
  const modalSubmitBtn = document.getElementById("modal-submit-review-btn");
  const closeRateModalBtn = document.getElementById("close-rate-modal-btn");
  const skipRateModalBtn = document.getElementById("modal-skip-review-btn");

  const inlineReviewCard = document.getElementById("review-submission-card");
  const inlineRidersContainer = document.getElementById("inline-riders-rating-container");
  const inlineRatedSummary = document.getElementById("inline-rated-summary");
  const inlinePendingNote = document.getElementById("inline-pending-riders-note");
  const inlineReviewForm = document.getElementById("track-review-form");
  const inlineReviewFeedback = document.getElementById("review-feedback-msg");
  const inlineSubmitBtn = document.getElementById("submit-review-btn");

  let latestPrimaryBooking = Object.assign({}, booking);
  const locallyReviewedSlots = new Map();
  const promptedSlotCodes = new Set();
  let lastRenderedInlineSig = "";
  let lastRenderedModalSig = "";

  const STAR_LABELS = {
    1: "★ Poor",
    2: "★★ Fair",
    3: "★★★ Good",
    4: "★★★★ Very Good",
    5: "★★★★★ Excellent Service!"
  };

  const COMPLIMENT_CHIPS = [
    { label: "😊 Buotan kaayo", text: "Buotan ug matinahuron kaayo! 😊" },
    { label: "🛵 Safe mo-drive", text: "Safe ug maayo mo-drive! 🛵" },
    { label: "⚡ Paspas niabot", text: "Paspas niabot sa pickup! ⚡" },
    { label: "✨ Limpyo ang motor", text: "Limpyo ug komportable ang motor! ✨" }
  ];

  function getSlotStorageKey(slot) {
    return slot && slot.booking_code ? `ccrc_rated_${slot.booking_code}` : "";
  }

  function markSlotReviewedLocally(slot, ratingVal) {
    if (!slot || !slot.booking_code) return;
    const cleanRating = Math.max(1, Math.min(5, parseInt(ratingVal || "5", 10) || 5));
    locallyReviewedSlots.set(slot.booking_code, cleanRating);
    slot.is_reviewed = true;
    slot.review_rating = cleanRating;
    try {
      localStorage.setItem(getSlotStorageKey(slot), String(cleanRating));
    } catch (_) {}
  }

  function isSlotAlreadyReviewed(slot) {
    if (!slot) return false;
    if (slot.is_reviewed) return true;
    if (slot.booking_code && locallyReviewedSlots.has(slot.booking_code)) return true;
    const key = getSlotStorageKey(slot);
    if (key) {
      try {
        const stored = localStorage.getItem(key);
        if (stored && stored !== "0") return true;
      } catch (_) {}
    }
    return false;
  }

  function getSlotReviewRating(slot) {
    if (!slot) return null;
    if (slot.review_rating) return Number(slot.review_rating);
    if (slot.booking_code && locallyReviewedSlots.has(slot.booking_code)) {
      return locallyReviewedSlots.get(slot.booking_code);
    }
    const key = getSlotStorageKey(slot);
    if (key) {
      try {
        const stored = parseInt(localStorage.getItem(key) || "0", 10);
        if (stored >= 1 && stored <= 5) return stored;
      } catch (_) {}
    }
    return null;
  }

  function getAllTripSlots(primaryBooking) {
    if (Array.isArray(latestGroupBookings) && latestGroupBookings.length > 0) {
      return latestGroupBookings;
    }
    const ref = primaryBooking || latestPrimaryBooking || booking;
    return ref ? [ref] : [];
  }

  function getRatingPartition(primaryBooking, focusSlotCode) {
    const allSlots = getAllTripSlots(primaryBooking);
    const completedAssigned = allSlots.filter(
      (s) => s && s.status === "completed" && Boolean(s.rider_id)
    );
    const reviewed = completedAssigned.filter((s) => isSlotAlreadyReviewed(s));
    let unreviewed = completedAssigned.filter((s) => !isSlotAlreadyReviewed(s));
    if (focusSlotCode && unreviewed.length > 1) {
      unreviewed = unreviewed.slice().sort((a, b) => {
        if (a.booking_code === focusSlotCode) return -1;
        if (b.booking_code === focusSlotCode) return 1;
        return Number(a.rider_slot || 1) - Number(b.rider_slot || 1);
      });
    }
    const pendingInTransit = allSlots.filter(
      (s) => s && ["broadcast", "accepted", "in_progress"].includes(s.status)
    );
    return { allSlots, completedAssigned, reviewed, unreviewed, pendingInTransit };
  }

  function buildRatedSummaryHtml(reviewedSlots) {
    return reviewedSlots.map((r, idx) => {
      const slotNum = r.rider_slot || (idx + 1);
      const starsNum = getSlotReviewRating(r) || 5;
      const starsStr = "★".repeat(starsNum) + "☆".repeat(5 - starsNum);
      const slotPrefix = (Number(r.group_size || 1) > 1 || latestGroupBookings.length > 1) ? `Rider #${slotNum}: ` : "";
      return `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:0.8rem;">
          <span style="color:#166534;font-weight:700;">✓ ${escapeHtml(slotPrefix)}${escapeHtml(r.rider_name || "Club Rider")}</span>
          <span style="color:#d97706;font-weight:800;white-space:nowrap;">${starsStr} (${starsNum}/5)</span>
        </div>
      `;
    }).join("");
  }

  function buildRiderRatingCardsHtml(ridersList, prefix) {
    const isGroup = latestGroupBookings.length > 1 || ridersList.length > 1;
    return ridersList.map((r, idx) => {
      const slotNum = r.rider_slot || (idx + 1);
      const riderName = r.rider_name || `Rider #${slotNum}`;
      const avatarHtml = r.rider_avatar
        ? `<img src="${escapeHtml(r.rider_avatar)}" alt="${escapeHtml(riderName)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : escapeHtml(riderName.charAt(0).toUpperCase());
      const slotBadge = isGroup
        ? `<span style="background:#1d4ed8;color:#fff;font-size:0.68rem;font-weight:800;padding:2px 7px;border-radius:999px;">Rider #${slotNum}</span>`
        : "";
      const chipsHtml = COMPLIMENT_CHIPS.map((c) => `
        <button type="button" class="m-chip-btn" data-chip="${escapeHtml(c.text)}" style="background:#fff7ed;border:1px solid #fdba74;color:#c2410c;border-radius:999px;padding:4px 9px;font-size:0.72rem;font-weight:600;cursor:pointer;">
          ${escapeHtml(c.label)}
        </button>
      `).join("");

      return `
        <div class="multi-rider-rating-card" data-booking-id="${escapeHtml(String(r.id))}" data-booking-code="${escapeHtml(r.booking_code || "")}" data-rider-id="${escapeHtml(String(r.rider_id))}" data-rider-name="${escapeHtml(riderName)}" style="background:#fffaf5;border:1.5px solid #fed7aa;border-radius:14px;padding:12px 14px;text-align:center;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;text-align:left;">
            <div style="width:42px;height:42px;border-radius:50%;background:#ffedd5;color:#ea580c;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid #fdba74;">
              ${avatarHtml}
            </div>
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                ${slotBadge}
                <strong style="font-size:0.95rem;color:#0f172a;">${escapeHtml(riderName)}</strong>
              </div>
              <div style="font-size:0.76rem;color:#475569;margin-top:1px;">
                🏍️ ${escapeHtml(r.rider_bike || "Motorcycle")}${r.rider_plate ? ` &bull; Plate: <strong>${escapeHtml(r.rider_plate)}</strong>` : ""}
              </div>
            </div>
          </div>

          <div class="multi-star-picker" style="display:flex;justify-content:center;gap:8px;font-size:2.2rem;cursor:pointer;margin-bottom:4px;user-select:none;">
            <span class="m-star-item" data-value="1" style="color:#f59e0b;transition:transform 0.1s;">★</span>
            <span class="m-star-item" data-value="2" style="color:#f59e0b;transition:transform 0.1s;">★</span>
            <span class="m-star-item" data-value="3" style="color:#f59e0b;transition:transform 0.1s;">★</span>
            <span class="m-star-item" data-value="4" style="color:#f59e0b;transition:transform 0.1s;">★</span>
            <span class="m-star-item" data-value="5" style="color:#f59e0b;transition:transform 0.1s;">★</span>
          </div>
          <div class="multi-star-label" style="font-size:0.8rem;font-weight:700;color:#d97706;margin-bottom:8px;">★★★★★ Excellent Service!</div>
          <input type="hidden" class="multi-selected-rating" name="${prefix}_rating_${escapeHtml(String(r.id))}" value="5">

          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-bottom:8px;">
            ${chipsHtml}
          </div>

          <textarea class="multi-review-comment" rows="2" maxlength="500" placeholder="Feedback or compliment for ${escapeHtml(riderName)} (optional)..." style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:0.84rem;resize:none;box-sizing:border-box;background:#ffffff;"></textarea>
        </div>
      `;
    }).join("");
  }

  function bindInteractiveRatingCards(containerEl) {
    if (!containerEl || containerEl.dataset.ratingDelegated === "1") return;
    containerEl.dataset.ratingDelegated = "1";

    containerEl.addEventListener("click", (e) => {
      const starEl = e.target.closest(".m-star-item");
      if (starEl) {
        const card = starEl.closest(".multi-rider-rating-card");
        if (!card) return;
        const val = parseInt(starEl.getAttribute("data-value") || "5", 10);
        const hiddenInput = card.querySelector(".multi-selected-rating");
        const labelEl = card.querySelector(".multi-star-label");
        if (hiddenInput) hiddenInput.value = String(val);
        if (labelEl) labelEl.textContent = STAR_LABELS[val] || "";
        card.querySelectorAll(".m-star-item").forEach((st) => {
          const v = parseInt(st.getAttribute("data-value") || "1", 10);
          st.style.color = v <= val ? "#f59e0b" : "#cbd5e1";
          st.style.transform = v === val ? "scale(1.16)" : "scale(1)";
        });
        return;
      }

      const chipBtn = e.target.closest(".m-chip-btn");
      if (chipBtn) {
        const card = chipBtn.closest(".multi-rider-rating-card");
        if (!card) return;
        const txt = chipBtn.getAttribute("data-chip") || "";
        const commentBox = card.querySelector(".multi-review-comment");
        if (!commentBox || !txt) return;
        if (!commentBox.value.includes(txt)) {
          commentBox.value = commentBox.value ? `${commentBox.value.trim()} ${txt}` : txt;
        }
        chipBtn.style.background = "#fed7aa";
      }
    });
  }

  bindInteractiveRatingCards(modalRidersContainer);
  bindInteractiveRatingCards(inlineRidersContainer);

  function collectRatingsFromContainer(containerEl) {
    if (!containerEl) return [];
    const cards = containerEl.querySelectorAll(".multi-rider-rating-card");
    const items = [];
    cards.forEach((card) => {
      const bookingId = parseInt(card.getAttribute("data-booking-id") || "0", 10);
      const bookingCode = card.getAttribute("data-booking-code") || "";
      const riderId = parseInt(card.getAttribute("data-rider-id") || "0", 10);
      const riderName = card.getAttribute("data-rider-name") || "Club Rider";
      const rating = parseInt(card.querySelector(".multi-selected-rating")?.value || "5", 10);
      const comment = (card.querySelector(".multi-review-comment")?.value || "").trim();
      if (bookingId && riderId) {
        items.push({
          booking_id: bookingId,
          booking_code: bookingCode,
          rider_id: riderId,
          rider_name: riderName,
          rating: Math.max(1, Math.min(5, rating || 5)),
          comment: comment,
          customer_name: latestPrimaryBooking.customer_name || booking.customer_name || "Passenger"
        });
      }
    });
    return items;
  }

  function renderPendingNote(noteEl, pendingSlots) {
    if (!noteEl) return;
    if (pendingSlots.length > 0) {
      const names = pendingSlots.map((s) => s.rider_name ? `Rider #${s.rider_slot || 1} (${s.rider_name})` : `Rider #${s.rider_slot || 1}`).join(", ");
      noteEl.textContent = `⏳ ${names} is still in transit — you will be able to rate them automatically once they arrive!`;
      noteEl.classList.remove("hidden");
    } else {
      noteEl.classList.add("hidden");
      noteEl.textContent = "";
    }
  }

  function renderInlineReviewSection(primaryBooking, forceRerender) {
    if (!inlineReviewCard || !inlineRidersContainer) return;
    const { reviewed, unreviewed, pendingInTransit } = getRatingPartition(primaryBooking);

    if (unreviewed.length === 0 && reviewed.length === 0) {
      inlineReviewCard.classList.add("hidden");
      return;
    }

    const sig = `${unreviewed.map((s) => s.id).join(",")}|${reviewed.map((s) => `${s.id}:${getSlotReviewRating(s)}`).join(",")}|${pendingInTransit.length}`;
    if (!forceRerender && sig === lastRenderedInlineSig) {
      return;
    }
    lastRenderedInlineSig = sig;

    inlineReviewCard.classList.remove("hidden");

    const titleEl = document.getElementById("inline-review-title");
    const subEl = document.getElementById("inline-review-subtitle");
    if (unreviewed.length > 1) {
      if (titleEl) titleEl.textContent = `Rate Your ${unreviewed.length} Island Riders`;
      if (subEl) subEl.textContent = "Give individual stars and feedback for each rider below:";
    } else if (unreviewed.length === 1) {
      if (titleEl) titleEl.textContent = `Rate ${unreviewed[0].rider_name || "Your Island Rider"}`;
      if (subEl) subEl.textContent = "How was your ride experience across Camiguin?";
    } else {
      if (titleEl) titleEl.textContent = "Thank You for Rating!";
      if (subEl) subEl.textContent = "All completed riders on this trip have been rated.";
    }

    if (inlineRatedSummary) {
      if (reviewed.length > 0) {
        inlineRatedSummary.innerHTML = buildRatedSummaryHtml(reviewed);
        inlineRatedSummary.classList.remove("hidden");
      } else {
        inlineRatedSummary.innerHTML = "";
        inlineRatedSummary.classList.add("hidden");
      }
    }

    if (unreviewed.length > 0) {
      inlineRidersContainer.innerHTML = buildRiderRatingCardsHtml(unreviewed, "inline");
      if (inlineSubmitBtn) {
        inlineSubmitBtn.style.display = "";
        inlineSubmitBtn.disabled = false;
        inlineSubmitBtn.textContent = unreviewed.length > 1
          ? `Submit Ratings for ${unreviewed.length} Riders ⭐ →`
          : "Submit Rating ⭐ →";
      }
      if (inlineReviewFeedback) inlineReviewFeedback.classList.add("hidden");
    } else {
      inlineRidersContainer.innerHTML = "";
      if (inlineSubmitBtn) inlineSubmitBtn.style.display = "none";
      if (inlineReviewFeedback) {
        const backBtnHtml = pendingInTransit.length === 0
          ? `<div style="margin-top:10px;"><a href="/" class="btn btn-sm btn-primary" style="background:#16a34a;border:none;padding:8px 18px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;color:white;">← Balik sa Dashboard</a></div>`
          : "";
        inlineReviewFeedback.innerHTML = `✓ Salamat kaayo! All completed rider ratings have been saved.${backBtnHtml}`;
        inlineReviewFeedback.classList.remove("hidden");
      }
    }

    renderPendingNote(inlinePendingNote, pendingInTransit);
  }

  function openRatingPopup(primaryBooking, opts) {
    const options = opts || {};
    if (!rateRiderModal || !modalRidersContainer) return;

    const { reviewed, unreviewed, pendingInTransit } = getRatingPartition(
      primaryBooking,
      options.focusSlotCode
    );
    if (unreviewed.length === 0) return;

    const isModalAlreadyOpen = !rateRiderModal.classList.contains("hidden") && rateRiderModal.style.display !== "none";
    const newlyCompletedUnprompted = unreviewed.filter((s) => !promptedSlotCodes.has(s.booking_code));

    if (!options.manual) {
      if (newlyCompletedUnprompted.length === 0) return;
      const incomingSig = `${unreviewed.map((s) => s.id).join(",")}|${reviewed.map((s) => s.id).join(",")}`;
      if (isModalAlreadyOpen && incomingSig === lastRenderedModalSig) return;
    }

    unreviewed.forEach((s) => {
      if (s.booking_code) promptedSlotCodes.add(s.booking_code);
    });
    lastRenderedModalSig = `${unreviewed.map((s) => s.id).join(",")}|${reviewed.map((s) => s.id).join(",")}`;

    const modalTitle = document.getElementById("modal-rate-title");
    const modalSub = document.getElementById("modal-rate-subtitle");
    if (unreviewed.length > 1) {
      if (modalTitle) modalTitle.textContent = `Trip Completed! Rate All ${unreviewed.length} Riders`;
      if (modalSub) modalSub.textContent = "Palihug i-rate ang tagsa-tagsa ka rider sa imong group ride:";
    } else {
      const onlyRider = unreviewed[0];
      if (modalTitle) modalTitle.textContent = "Trip Completed! Rate Your Rider";
      if (modalSub) {
        modalSub.innerHTML = `How was your trip with <strong id="modal-rate-rider-name">${escapeHtml(onlyRider.rider_name || "Kuya Rider")}</strong>?`;
      }
    }

    if (modalRatedSummary) {
      if (reviewed.length > 0) {
        modalRatedSummary.innerHTML = buildRatedSummaryHtml(reviewed);
        modalRatedSummary.classList.remove("hidden");
      } else {
        modalRatedSummary.innerHTML = "";
        modalRatedSummary.classList.add("hidden");
      }
    }

    modalRidersContainer.innerHTML = buildRiderRatingCardsHtml(unreviewed, "modal");
    renderPendingNote(modalPendingNote, pendingInTransit);

    if (modalReviewFeedback) modalReviewFeedback.classList.add("hidden");
    if (modalSubmitBtn) {
      modalSubmitBtn.style.display = "";
      modalSubmitBtn.disabled = false;
      modalSubmitBtn.textContent = unreviewed.length > 1
        ? `Submit Ratings for ${unreviewed.length} Riders ⭐ →`
        : "Submit Rating ⭐ →";
    }
    if (skipRateModalBtn) {
      skipRateModalBtn.style.display = "";
      skipRateModalBtn.textContent = "Maybe Later (Close)";
    }

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
    renderInlineReviewSection(latestPrimaryBooking, true);
    const { unreviewed } = getRatingPartition(latestPrimaryBooking);
    if (inlineReviewCard && unreviewed.length > 0) {
      inlineReviewCard.classList.remove("hidden");
      inlineReviewCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function syncMultiRiderReviewUI(primaryBooking) {
    renderInlineReviewSection(primaryBooking, false);
    openRatingPopup(primaryBooking, { manual: false });
  }

  window.openRatingModalForGroup = function(slotCode) {
    openRatingPopup(latestPrimaryBooking, { manual: true, focusSlotCode: slotCode || "" });
  };

  if (closeRateModalBtn) closeRateModalBtn.addEventListener("click", closeRatingPopup);
  if (skipRateModalBtn) skipRateModalBtn.addEventListener("click", closeRatingPopup);

  async function submitBatchRatings(containerEl, submitBtnEl, feedbackEl, isModal) {
    const items = collectRatingsFromContainer(containerEl);
    if (items.length === 0) {
      alert("No completed rider available to rate yet.");
      return;
    }

    const origBtnText = submitBtnEl ? submitBtnEl.textContent : "Submit Rating ⭐ →";
    if (submitBtnEl) {
      submitBtnEl.disabled = true;
      submitBtnEl.textContent = items.length > 1 ? `Submitting ${items.length} ratings...` : "Submitting...";
    }

    try {
      const payload = items.length === 1
        ? {
            booking_id: items[0].booking_id,
            rider_id: items[0].rider_id,
            rating: items[0].rating,
            comment: items[0].comment,
            customer_name: items[0].customer_name
          }
        : {
            customer_name: items[0].customer_name,
            reviews: items.map((it) => ({
              booking_id: it.booking_id,
              rider_id: it.rider_id,
              rating: it.rating,
              comment: it.comment,
              customer_name: it.customer_name
            }))
          };

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if ((res.ok && data.success) || res.status === 409) {
        const allSlots = getAllTripSlots(latestPrimaryBooking);
        items.forEach((it) => {
          const matchedSlot = allSlots.find(
            (s) => Number(s.id) === it.booking_id || (it.booking_code && s.booking_code === it.booking_code)
          );
          if (matchedSlot) {
            markSlotReviewedLocally(matchedSlot, it.rating);
          } else if (it.booking_code) {
            markSlotReviewedLocally({ booking_code: it.booking_code }, it.rating);
          }
        });

        const { pendingInTransit } = getRatingPartition(latestPrimaryBooking);
        const savedMsg = items.length > 1
          ? `✓ Salamat kaayo! Saved ratings for all ${items.length} riders.`
          : `✓ Thank you! Your ${items[0].rating}-Star rating for ${escapeHtml(items[0].rider_name)} has been saved.`;

        if (feedbackEl) {
          const actionHtml = pendingInTransit.length === 0
            ? `<div style="margin-top:12px;"><a href="/" class="btn btn-sm btn-primary" style="background:#ea580c;border:none;padding:9px 20px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block;color:white;">🏠 Back to Dashboard</a></div>`
            : `<div style="margin-top:10px;font-size:0.8rem;color:#9a3412;">We will notify you to rate the remaining rider as soon as they arrive.</div>`;
          feedbackEl.innerHTML = `${savedMsg}${actionHtml}`;
          feedbackEl.classList.remove("hidden");
        }
        if (submitBtnEl) submitBtnEl.style.display = "none";
        if (isModal && skipRateModalBtn) {
          skipRateModalBtn.textContent = "Close";
        }

        renderGroupRidersPanel(latestGroupBookings);
        renderAllAcceptedRiderCards(latestGroupBookings);
        renderInlineReviewSection(latestPrimaryBooking, true);
      } else {
        alert(data.error || "Could not submit review.");
        if (submitBtnEl) {
          submitBtnEl.disabled = false;
          submitBtnEl.textContent = origBtnText;
        }
      }
    } catch (_) {
      alert("Network error submitting review.");
      if (submitBtnEl) {
        submitBtnEl.disabled = false;
        submitBtnEl.textContent = origBtnText;
      }
    }
  }

  if (modalReviewForm) {
    modalReviewForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitBatchRatings(modalRidersContainer, modalSubmitBtn, modalReviewFeedback, true);
    });
  }

  if (inlineReviewForm) {
    inlineReviewForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitBatchRatings(inlineRidersContainer, inlineSubmitBtn, inlineReviewFeedback, false);
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    syncCustomerVoiceCall(booking);

    if (riderCallBtn) {
      riderCallBtn.addEventListener("click", (e) => {
        if (window.CCRCVoiceCall) {
          e.preventDefault();
          window.CCRCVoiceCall.startCall();
        }
      });
    }

    pollLiveStatus();
    setInterval(pollLiveStatus, 3000);
    pollChatMessages();
    chatPollTimer = setInterval(pollChatMessages, 2500);
  });
})();
