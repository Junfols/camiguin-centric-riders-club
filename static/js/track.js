(function () {
  "use strict";

  const booking = window.INITIAL_BOOKING;
  if (!booking) return;

  const tTrack = (str) => (typeof window.ccrcT === "function" ? window.ccrcT(str) : str);
  const trackLookupCode = window.TRACK_LOOKUP_CODE || booking.group_code || booking.booking_code;
  let groupBookings = (Array.isArray(window.INITIAL_GROUP_BOOKINGS) && window.INITIAL_GROUP_BOOKINGS.length)
    ? window.INITIAL_GROUP_BOOKINGS
    : [booking];
  let groupSummary = window.INITIAL_GROUP_SUMMARY || null;
  let currentChatBookingCode = booking.booking_code;

  function hasAnyActiveSlot(list, focused) {
    const arr = (Array.isArray(list) && list.length) ? list : [focused];
    return arr.some((s) => s && !["completed", "cancelled"].includes(String(s.status || "").toLowerCase()));
  }

  function persistActiveBookingStorage(focused, summary, list) {
    try {
      const hasActive = summary
        ? Number(summary.active_count || 0) > 0
        : hasAnyActiveSlot(list, focused);
      if (!hasActive) {
        localStorage.removeItem("ccrc_active_booking");
      } else {
        const storageCode = (summary && summary.group_code)
          ? summary.group_code
          : (focused && focused.group_code && Number(focused.group_size || 1) > 1
            ? focused.group_code
            : (trackLookupCode || (focused && focused.booking_code) || ""));
        if (storageCode) {
          localStorage.setItem("ccrc_active_booking", storageCode);
        }
        if (focused && focused.customer_phone) {
          localStorage.setItem("ccrc_customer_phone", focused.customer_phone);
          if (!localStorage.getItem("ccrc_customer_session")) {
            localStorage.setItem("ccrc_customer_session", JSON.stringify({
              phone: focused.customer_phone,
              name: focused.customer_name || "Passenger",
              is_verified: focused.customer_verified || 1
            }));
          }
        }
        if (focused && focused.customer_name) {
          localStorage.setItem("ccrc_customer_name", focused.customer_name);
        }
      }
    } catch (_) {}
  }

  // Persist active booking so customer can always find it if they quit the app
  persistActiveBookingStorage(booking, groupSummary, groupBookings);

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
  const groupSlotMarkers = new Map();
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

    // Rider Icon & Sibling Group Pins
    syncFocusedMapMarkers(booking, groupBookings);
  }

  function updateRiderMarker(lat, lng, riderName, speed = 0, serverHeading = 0, slotNum = null) {
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

    const popupLabel = slotNum
      ? `<strong>Rider #${Number(slotNum)}: ${escapeHtml(riderName || "Club Rider")}</strong><br>On the way to location`
      : `<strong>${escapeHtml(riderName || "Club Rider")}</strong><br>On the way to location`;

    if (!riderMarker) {
      riderMarker = L.marker([lat, lng], { icon: bikeIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(popupLabel);
    } else {
      riderMarker.setIcon(bikeIcon);
      riderMarker.setLatLng([lat, lng]);
      riderMarker.setPopupContent(popupLabel);
    }
  }

  function syncFocusedMapMarkers(b, allSlots) {
    if (!map || !b) return;

    // Update pickup / dropoff markers & road route if changed (e.g. emergency handover or slot switch)
    if (b.pickup_lat && b.pickup_lng) {
      const newPLat = Number(b.pickup_lat);
      const newPLng = Number(b.pickup_lng);
      const changedPickup = !lastPickupCoords
        || Math.abs(newPLat - lastPickupCoords.lat) > 0.00005
        || Math.abs(newPLng - lastPickupCoords.lng) > 0.00005;
      if (changedPickup) {
        lastPickupCoords = { lat: newPLat, lng: newPLng };
        if (pickupMarker) {
          pickupMarker.setLatLng([newPLat, newPLng]);
          pickupMarker.setPopupContent(`<strong>Pickup:</strong><br>${escapeHtml(b.pickup_address || "")}`);
        }
        if (dropoffMarker && b.dropoff_lat && b.dropoff_lng) {
          dropoffMarker.setLatLng([Number(b.dropoff_lat), Number(b.dropoff_lng)]);
          dropoffMarker.setPopupContent(`<strong>Dropoff:</strong><br>${escapeHtml(b.dropoff_address || "")}`);
        }
        if (b.dropoff_lat && b.dropoff_lng) {
          refreshTrackingRoute(newPLat, newPLng, Number(b.dropoff_lat), Number(b.dropoff_lng));
        }
      }
    }

    // Focused slot rider marker
    const totalGroupSlots = Array.isArray(allSlots) ? allSlots.length : 1;
    const focusedSlotNum = totalGroupSlots > 1 ? Number(b.rider_slot || 1) : null;
    if (b.rider_id && b.rider_lat && b.rider_lng && b.status !== "cancelled") {
      updateRiderMarker(b.rider_lat, b.rider_lng, b.rider_name, b.rider_speed || 0, b.rider_heading || 0, focusedSlotNum);
    } else {
      if (riderMarker) {
        map.removeLayer(riderMarker);
        riderMarker = null;
        lastRiderPosition = null;
      }
    }

    // Sibling group rider pins on the same map
    const seenCodes = new Set();
    if (Array.isArray(allSlots) && allSlots.length > 1) {
      allSlots.forEach((s, idx) => {
        if (!s || s.booking_code === b.booking_code) return;
        if (!s.rider_id || !s.rider_lat || !s.rider_lng || s.status === "cancelled") return;
        const lat = Number(s.rider_lat);
        const lng = Number(s.rider_lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        seenCodes.add(s.booking_code);
        const sNum = Number(s.rider_slot || idx + 1);
        const pinIcon = L.divIcon({
          className: "ccrc-group-slot-marker",
          html: `<div class="group-map-slot-pin status-${escapeHtml(s.status || "accepted")}" title="Rider ${sNum}: ${escapeHtml(s.rider_name || "Club Rider")}">#${sNum}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const popHtml = `<strong>Rider #${sNum}: ${escapeHtml(s.rider_name || "Club Rider")}</strong><br><small>${escapeHtml(formatSlotStateLabel(s.status))}</small>`;

        if (groupSlotMarkers.has(s.booking_code)) {
          const m = groupSlotMarkers.get(s.booking_code);
          m.setLatLng([lat, lng]);
          m.setIcon(pinIcon);
          m.setPopupContent(popHtml);
        } else {
          const m = L.marker([lat, lng], { icon: pinIcon, zIndexOffset: 750 })
            .addTo(map)
            .bindPopup(popHtml);
          m.on("click", () => selectGroupSlot(s.booking_code));
          groupSlotMarkers.set(s.booking_code, m);
        }
      });
    }

    for (const [code, marker] of groupSlotMarkers.entries()) {
      if (!seenCodes.has(code)) {
        map.removeLayer(marker);
        groupSlotMarkers.delete(code);
      }
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

  function formatSlotStateLabel(st) {
    const status = String(st || "").toLowerCase();
    if (status === "broadcast") return "⏳ Open";
    if (status === "accepted") return "🛵 Assigned";
    if (status === "in_progress") return "🚀 Transit";
    if (status === "completed") return "✅ Done";
    return "✕ Cancelled";
  }

  function syncSlotHeaderAndDetails(b) {
    if (!b) return;
    const isGroup = groupBookings.length > 1 || Boolean(groupSummary && groupSummary.total_riders > 1);
    const totalRiders = (groupSummary && groupSummary.total_riders) ? Number(groupSummary.total_riders) : groupBookings.length;
    const grpCode = (groupSummary && groupSummary.group_code) || b.group_code || trackLookupCode;

    const activeSlotPill = document.getElementById("track-active-slot-pill");
    if (activeSlotPill) {
      if (isGroup) {
        activeSlotPill.textContent = `Rider ${Number(b.rider_slot || 1)} of ${totalRiders} • ${grpCode}`;
        activeSlotPill.classList.remove("hidden");
      } else {
        activeSlotPill.classList.add("hidden");
      }
    }

    const codePill = document.getElementById("track-booking-code-pill");
    if (codePill) codePill.textContent = b.booking_code || "";

    const headerTitle = document.getElementById("track-header-title");
    if (headerTitle) {
      const svc = String(b.service_type || "pahatud");
      const capSvc = svc.charAt(0).toUpperCase() + svc.slice(1);
      headerTitle.textContent = `${capSvc} — ${b.dropoff_address || ""}`;
    }

    const headerMeta = document.getElementById("track-header-meta");
    if (headerMeta) {
      const fareStr = Math.round(Number(b.fare_amount || 0)).toLocaleString();
      let html = `Fare: <strong>₱${fareStr}</strong> &bull; Distance: <strong>${escapeHtml(String(b.estimated_km || 0))} km</strong>`;
      if (Number(b.estimated_budget || 0) > 0) {
        html += ` &bull; Shopping Budget: <strong>₱${Math.round(Number(b.estimated_budget)).toLocaleString()}</strong>`;
      }
      if (b.payment_method) {
        html += ` &bull; Payment: <strong style="text-transform:uppercase;">${escapeHtml(String(b.payment_method))}</strong>`;
      }
      headerMeta.innerHTML = html;
    }

    const cancelOpenBtn = document.getElementById("track-cancel-open-slot-btn");
    if (cancelOpenBtn) {
      cancelOpenBtn.classList.toggle("hidden", b.status !== "broadcast");
    }

    const backWrap = document.getElementById("track-completed-back-wrap");
    if (backWrap) {
      backWrap.classList.toggle("hidden", !["completed", "cancelled"].includes(b.status));
    }

    const deliveredCard = document.getElementById("delivered-actions-card");
    if (deliveredCard) {
      deliveredCard.classList.toggle("hidden", b.status !== "completed");
    }

    const reviewCard = document.getElementById("review-submission-card");
    if (reviewCard) {
      reviewCard.classList.toggle("hidden", b.status !== "completed");
    }

    const reviewSlotTitle = document.getElementById("review-slot-title");
    if (reviewSlotTitle) {
      reviewSlotTitle.textContent = isGroup
        ? `Rate Rider ${Number(b.rider_slot || 1)}${b.rider_name ? ` (${b.rider_name})` : ""}`
        : tTrack("Rate Your Island Rider");
    }

    const reviewBookingInput = document.getElementById("review-booking-id");
    if (reviewBookingInput) reviewBookingInput.value = b.id ? String(b.id) : "";
    const reviewRiderInput = document.getElementById("review-rider-id");
    if (reviewRiderInput) reviewRiderInput.value = b.rider_id ? String(b.rider_id) : "";

    const reviewDoneBox = document.getElementById("review-already-done-box");
    const reviewFormEl = document.getElementById("track-review-form");
    const reviewSubmitBtn = document.getElementById("submit-review-btn");
    const reviewFeedbackEl = document.getElementById("review-feedback-msg");
    const isReviewed = Boolean(b.already_reviewed);
    if (reviewDoneBox) {
      if (isReviewed) {
        if (!reviewDoneBox.querySelector("#review-already-done-msg")) {
          reviewDoneBox.innerHTML = `<p class="text-muted" style="font-size:0.85rem;margin:0 0 12px;">${tTrack("Your rating and feedback have been recorded.")}</p><div id="review-already-done-msg" style="margin-top:8px;font-weight:600;color:#16a34a;font-size:0.88rem;">${tTrack("✓ Thank you very much! Your review has already been submitted.")}<br><div style="margin-top:10px;"><a href="/" class="btn btn-sm btn-primary" style="background:#16a34a;border:none;padding:8px 18px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;color:white;">&larr; ${tTrack("Back to Dashboard")}</a></div></div>`;
        }
        reviewDoneBox.classList.remove("hidden");
      } else {
        if (reviewDoneBox.innerHTML) reviewDoneBox.innerHTML = "";
        reviewDoneBox.classList.add("hidden");
      }
    }
    if (reviewFormEl) reviewFormEl.classList.toggle("hidden", isReviewed);
    if (!isReviewed) {
      if (reviewSubmitBtn) {
        reviewSubmitBtn.disabled = false;
        reviewSubmitBtn.style.display = "";
      }
      if (reviewFeedbackEl) reviewFeedbackEl.classList.add("hidden");
    }

    // Sync Digital Receipt Modal for focused slot
    const rCode = document.getElementById("receipt-booking-code");
    const rPass = document.getElementById("receipt-passenger-name");
    const rSvc = document.getElementById("receipt-service-type");
    const rDist = document.getElementById("receipt-distance-km");
    const rPay = document.getElementById("receipt-payment-method");
    const rPromoRow = document.getElementById("receipt-promo-row");
    const rPromoLabel = document.getElementById("receipt-promo-label");
    const rPromoVal = document.getElementById("receipt-promo-val");
    const rFareLabel = document.getElementById("receipt-fare-label");
    const rFareAmt = document.getElementById("receipt-fare-amount");

    if (rCode) rCode.textContent = b.booking_code || "";
    if (rPass) rPass.textContent = b.customer_name || "";
    if (rSvc) rSvc.textContent = b.service_type || "";
    if (rDist) rDist.textContent = `${b.estimated_km || 0} km`;
    if (rPay) rPay.textContent = String(b.payment_method || "CASH").toUpperCase();
    if (rPromoRow) rPromoRow.classList.toggle("hidden", !b.promo_code);
    if (rPromoLabel) rPromoLabel.textContent = `Voucher (${b.promo_code || ""}):`;
    if (rPromoVal) rPromoVal.textContent = `-₱${Math.round(Number(b.discount_amount || 0)).toLocaleString()}`;
    if (rFareLabel) rFareLabel.textContent = isGroup ? tTrack("Slot Fare:") : tTrack("Total Fare:");
    if (rFareAmt) rFareAmt.textContent = `₱${Math.round(Number(b.fare_amount || 0)).toLocaleString()}`;

    // Sync Trip Details Card
    const dSvc = document.getElementById("trip-detail-service");
    const dPick = document.getElementById("trip-detail-pickup");
    const dDrop = document.getElementById("trip-detail-dropoff");
    const dNotesWrap = document.getElementById("trip-detail-notes-wrap");
    const dNotes = document.getElementById("trip-detail-notes");
    const dCust = document.getElementById("trip-detail-customer");
    if (dSvc) dSvc.textContent = b.service_type || "";
    if (dPick) dPick.textContent = b.pickup_address || "";
    if (dDrop) dDrop.textContent = b.dropoff_address || "";
    if (dNotesWrap) dNotesWrap.classList.toggle("hidden", !b.item_notes);
    if (dNotes) dNotes.textContent = b.item_notes ? `“${b.item_notes}”` : "";
    if (dCust) dCust.textContent = `${b.customer_name || ""} (${b.customer_phone || ""})`;
  }

  function renderGroupUI(focused, allSlots, summary) {
    const card = document.getElementById("group-summary-card");
    if (!card) return;

    const list = Array.isArray(allSlots) ? allSlots : [];
    if (list.length <= 1) {
      card.classList.add("hidden");
      return;
    }

    card.classList.remove("hidden");
    const grpCode = (summary && summary.group_code) || (focused && focused.group_code) || trackLookupCode;
    const totalRiders = (summary && summary.total_riders) ? Number(summary.total_riders) : list.length;
    const assignedCount = (summary && summary.assigned_count !== undefined)
      ? Number(summary.assigned_count)
      : list.filter((s) => s && s.rider_id && s.status !== "cancelled").length;
    const totalFare = (summary && summary.total_fare !== undefined)
      ? (Number(summary.cancelled_count || 0) > 0 && summary.active_total_fare !== undefined
        ? Number(summary.active_total_fare)
        : Number(summary.total_fare))
      : list.filter((s) => s && s.status !== "cancelled").reduce((sum, s) => sum + Number(s.fare_amount || 0), 0);

    const codeLabel = document.getElementById("group-code-label");
    const progressPill = document.getElementById("group-progress-pill");
    const totalFareEl = document.getElementById("group-total-fare");
    const tabsWrap = document.getElementById("group-slot-tabs");
    const overviewWrap = document.getElementById("group-slots-overview");

    if (codeLabel) codeLabel.textContent = grpCode;
    if (progressPill) progressPill.textContent = `${assignedCount} / ${totalRiders} Riders Assigned`;
    if (totalFareEl) totalFareEl.textContent = `₱${Math.round(totalFare).toLocaleString()}`;

    const focusedCode = focused ? focused.booking_code : "";

    if (tabsWrap) {
      tabsWrap.innerHTML = list.map((s, idx) => {
        const slotNum = Number(s.rider_slot || idx + 1);
        const st = String(s.status || "broadcast").toLowerCase();
        const isActive = s.booking_code === focusedCode;
        return `
          <button type="button" class="group-slot-tab ${isActive ? "active" : ""} slot-status-${escapeHtml(st)}" data-slot-code="${escapeHtml(s.booking_code)}">
            <span class="slot-tab-num">Rider ${slotNum}</span>
            <span class="slot-tab-state">${escapeHtml(tTrack(formatSlotStateLabel(st)))}</span>
          </button>
        `;
      }).join("");
    }

    if (overviewWrap) {
      overviewWrap.innerHTML = list.map((s, idx) => {
        const slotNum = Number(s.rider_slot || idx + 1);
        const st = String(s.status || "broadcast").toLowerCase();
        const isActive = s.booking_code === focusedCode;
        const stPretty = st.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const riderLabel = s.rider_name ? s.rider_name : tTrack("Waiting for rider");
        const payStatPretty = String(s.payment_status || "pending").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const gcashExtra = String(s.payment_method || "").toLowerCase() === "gcash"
          ? ` &bull; 💙 ${escapeHtml(payStatPretty)}`
          : "";

        return `
          <div class="group-slot-row ${isActive ? "is-focused" : ""}" data-slot-code="${escapeHtml(s.booking_code)}">
            <div class="group-slot-row-main">
              <div class="group-slot-row-title">
                <strong>Rider ${slotNum}</strong>
                <span class="slot-code-mono">${escapeHtml(s.booking_code)}</span>
                <span class="badge slot-status-badge status-${escapeHtml(st)}">${escapeHtml(stPretty)}</span>
              </div>
              <div class="group-slot-row-sub">
                ${escapeHtml(riderLabel)} &bull; ₱${Math.round(Number(s.fare_amount || 0)).toLocaleString()}${gcashExtra}
              </div>
            </div>
            <div class="group-slot-row-actions">
              <button type="button" class="btn btn-sm btn-outline group-focus-slot-btn" data-slot-code="${escapeHtml(s.booking_code)}">Focus</button>
              ${st === "broadcast" ? `<button type="button" class="btn btn-sm btn-cancel-open-slot group-cancel-slot-btn" data-booking-id="${s.id}" data-slot-code="${escapeHtml(s.booking_code)}">✕ Cancel Open Slot</button>` : ""}
            </div>
          </div>
        `;
      }).join("");
    }
  }

  function applyFocusedBooking(b, metaData = null) {
    if (!b) return;

    const switchedSlot = currentChatBookingCode !== b.booking_code;
    if (switchedSlot) {
      currentChatBookingCode = b.booking_code;
      lastMessageId = 0;
      if (chatMessagesBox) {
        chatMessagesBox.innerHTML = "";
        if (chatEmptyHint) {
          chatEmptyHint.style.display = "block";
          chatMessagesBox.appendChild(chatEmptyHint);
        }
      }
      if (chatVoiceBar) chatVoiceBar.classList.add("hidden");
      lastGcashPaymentStatus = String(b.payment_status || "pending").toLowerCase();
      if (gcashCustomerFeedback) gcashCustomerFeedback.classList.add("hidden");
      if (gcashRefInput) {
        delete gcashRefInput.dataset.dirty;
        gcashRefInput.value = b.payment_ref ? String(b.payment_ref) : "";
      }
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

    // Sync chat status subtitle dynamically
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
      } else if (b.status === "cancelled") {
        statusPill.textContent = "✕ Booking has been cancelled.";
      }
    }

    // Update Rider Card
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
    } else if (!b.rider_id && assignedRiderCard) {
      assignedRiderCard.classList.add("hidden");
    }

    syncFocusedMapMarkers(b, groupBookings);

    // Update distance indicator
    const distPickup = metaData && metaData.distance_to_pickup_km !== undefined
      ? metaData.distance_to_pickup_km
      : (b.distance_to_pickup_km !== undefined ? b.distance_to_pickup_km : null);
    const distDropoff = metaData && metaData.distance_to_dropoff_km !== undefined
      ? metaData.distance_to_dropoff_km
      : (b.distance_to_dropoff_km !== undefined ? b.distance_to_dropoff_km : null);

    if (liveDistanceIndicator) {
      if (b.status === "broadcast") {
        liveDistanceIndicator.innerHTML = Number(b.transfer_count || 0) > 0
          ? `🚨 <strong>Finding nearest replacement rider...</strong>`
          : `📡 <strong>Waiting for rider acceptance...</strong>`;
      } else if (b.status === "accepted" && distPickup !== null && distPickup !== undefined) {
        liveDistanceIndicator.innerHTML = `📍 Rider distance from Pickup: <strong>~${distPickup} km</strong>`;
      } else if (b.status === "in_progress" && distDropoff !== null && distDropoff !== undefined) {
        liveDistanceIndicator.innerHTML = `📍 Rider distance from Destination: <strong>~${distDropoff} km</strong>`;
      } else if (b.status === "completed") {
        liveDistanceIndicator.innerHTML = `✓ <strong>Successfully Delivered</strong>`;
      } else if (b.status === "cancelled") {
        liveDistanceIndicator.innerHTML = `✕ <strong>Trip Cancelled</strong>`;
      }
    }

    Object.assign(booking, b);
    syncSlotHeaderAndDetails(booking);
    renderGroupUI(booking, groupBookings, groupSummary);
    syncGcashPaymentUI(booking);
    syncCustomerVoiceCallContext(booking);

    if (switchedSlot) {
      pollChatMessages();
    }
  }

  function selectGroupSlot(slotCode, skipPoll = false) {
    if (!slotCode) return;
    const found = groupBookings.find((s) => s && s.booking_code === slotCode);
    if (!found) return;

    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("slot", slotCode);
      window.history.replaceState({}, "", nextUrl.toString());
    } catch (_) {}

    applyFocusedBooking(found, null);
    if (map && found.rider_id && found.rider_lat && found.rider_lng) {
      map.panTo([Number(found.rider_lat), Number(found.rider_lng)]);
    }
    if (!skipPoll) {
      pollLiveStatus();
    }
  }

  async function cancelOpenSlot(bookingId, slotCode) {
    if (!bookingId) return;
    if (!confirm(tTrack("Cancel this open unassigned rider slot? Only open slots waiting for a rider can be cancelled."))) {
      return;
    }
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || tTrack("Could not cancel open slot."));
        return;
      }
      if (data.job) {
        const idx = groupBookings.findIndex((s) => s && Number(s.id) === Number(data.job.id));
        if (idx !== -1) {
          groupBookings[idx] = Object.assign({}, groupBookings[idx], data.job);
        }
        if (Number(booking.id) === Number(data.job.id)) {
          Object.assign(booking, data.job);
        }
      }
      await pollLiveStatus();
    } catch (_) {
      alert(tTrack("Network error cancelling open slot."));
    }
  }

  const groupTabsWrap = document.getElementById("group-slot-tabs");
  if (groupTabsWrap) {
    groupTabsWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".group-slot-tab");
      if (!btn) return;
      const code = btn.getAttribute("data-slot-code");
      if (code) selectGroupSlot(code);
    });
  }

  const groupOverviewWrap = document.getElementById("group-slots-overview");
  if (groupOverviewWrap) {
    groupOverviewWrap.addEventListener("click", (e) => {
      const focusBtn = e.target.closest(".group-focus-slot-btn");
      if (focusBtn) {
        const code = focusBtn.getAttribute("data-slot-code");
        if (code) selectGroupSlot(code);
        return;
      }
      const cancelBtn = e.target.closest(".group-cancel-slot-btn");
      if (cancelBtn) {
        const bId = cancelBtn.getAttribute("data-booking-id");
        const code = cancelBtn.getAttribute("data-slot-code");
        cancelOpenSlot(bId, code);
      }
    });
  }

  const trackCancelOpenSlotBtn = document.getElementById("track-cancel-open-slot-btn");
  if (trackCancelOpenSlotBtn) {
    trackCancelOpenSlotBtn.addEventListener("click", () => {
      cancelOpenSlot(booking.id, booking.booking_code);
    });
  }

  async function pollLiveStatus() {
    try {
      const res = await fetch(
        `/api/bookings/track/${encodeURIComponent(trackLookupCode)}?slot=${encodeURIComponent(booking.booking_code)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const b = data.booking;
      if (!b) return;

      if (Array.isArray(data.group_bookings) && data.group_bookings.length > 0) {
        groupBookings = data.group_bookings;
      }
      groupSummary = data.group_summary || null;

      if (data.already_reviewed !== undefined) {
        b.already_reviewed = Boolean(data.already_reviewed);
      }

      persistActiveBookingStorage(b, groupSummary, groupBookings);
      applyFocusedBooking(b, data);

      if (!hasAnyActiveSlot(groupBookings, b)) {
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
      const shareCode = (groupSummary && groupSummary.group_code) || booking.group_code || booking.booking_code;
      const shareData = {
        title: "Track my CCRC Ride in Camiguin",
        text: `Track my live habal-habal express ride on Camiguin Island (${shareCode}):`,
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
          booking.already_reviewed = true;
          const reviewedSlot = groupBookings.find((s) => s && Number(s.id) === Number(bookingId));
          if (reviewedSlot) reviewedSlot.already_reviewed = true;
          const reviewDoneBox = document.getElementById("review-already-done-box");
          if (reviewDoneBox) {
            reviewDoneBox.innerHTML = `<p class="text-muted" style="font-size:0.85rem;margin:0 0 12px;">${tTrack("Your rating and feedback have been recorded.")}</p><div id="review-already-done-msg" style="margin-top:8px;font-weight:600;color:#16a34a;font-size:0.88rem;">${tTrack("✓ Thank you very much! Your review has already been submitted.")}<br><div style="margin-top:10px;"><a href="/" class="btn btn-sm btn-primary" style="background:#16a34a;border:none;padding:8px 18px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;color:white;">&larr; ${tTrack("Back to Dashboard")}</a></div></div>`;
            reviewDoneBox.classList.remove("hidden");
          }
          reviewForm.classList.add("hidden");
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

  // ---------------------------------------------------------------------------
  // Official GCash App Launch, QR Display & Customer Payment Reporting
  // ---------------------------------------------------------------------------
  const gcashCard = document.getElementById("gcash-payment-card");
  const gcashStatusBadge = document.getElementById("gcash-track-status-badge");
  const gcashAmountDue = document.getElementById("gcash-amount-due");
  const gcashWaitingRiderMsg = document.getElementById("gcash-waiting-rider-msg");
  const gcashRecipientSection = document.getElementById("gcash-rider-recipient-section");
  const gcashRiderName = document.getElementById("gcash-rider-name");
  const gcashRiderNumber = document.getElementById("gcash-rider-number");
  const copyRiderGcashBtn = document.getElementById("copy-rider-gcash-btn");
  const gcashQrImgWrap = document.getElementById("gcash-qr-img-wrap");
  const gcashRiderQrImg = document.getElementById("gcash-rider-qr-img");
  const downloadRiderQrBtn = document.getElementById("download-rider-qr-btn");
  const gcashNoQrHint = document.getElementById("gcash-no-qr-hint");
  const openOfficialGcashBtn = document.getElementById("open-official-gcash-btn");
  const gcashSentFormWrap = document.getElementById("gcash-sent-form-wrap");
  const gcashSentForm = document.getElementById("gcash-sent-form");
  const gcashRefInput = document.getElementById("gcash-ref-input");
  const markGcashSentBtn = document.getElementById("mark-gcash-sent-btn");
  const gcashCustomerFeedback = document.getElementById("gcash-customer-feedback");
  const gcashPaidBanner = document.getElementById("gcash-paid-banner");
  const gcashPaidRefText = document.getElementById("gcash-paid-ref-text");

  const tGcash = (str) => (typeof window.ccrcT === "function" ? window.ccrcT(str) : str);
  let lastGcashPaymentStatus = String(booking.payment_status || "pending").toLowerCase();

  function showGcashCustomerFeedback(msg, isError) {
    if (!gcashCustomerFeedback) return;
    gcashCustomerFeedback.textContent = msg;
    gcashCustomerFeedback.style.background = isError ? "#fee2e2" : "#dbeafe";
    gcashCustomerFeedback.style.color = isError ? "#b91c1c" : "#1e40af";
    gcashCustomerFeedback.style.border = isError ? "1px solid #fca5a5" : "1px solid #93c5fd";
    gcashCustomerFeedback.classList.remove("hidden");
  }

  async function copyRiderGcashNumber(silent) {
    const rawNum = String(booking.rider_gcash_number || booking.rider_phone || "").trim();
    if (!rawNum) return false;
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(rawNum);
        copied = true;
      }
    } catch (_) {
      copied = false;
    }
    if (!copied) {
      try {
        const tmp = document.createElement("textarea");
        tmp.value = rawNum;
        tmp.setAttribute("readonly", "");
        tmp.style.cssText = "position:fixed;left:-9999px;opacity:0;";
        document.body.appendChild(tmp);
        tmp.select();
        copied = document.execCommand("copy");
        document.body.removeChild(tmp);
      } catch (_) {
        copied = false;
      }
    }
    if (!silent && copyRiderGcashBtn) {
      const orig = copyRiderGcashBtn.textContent;
      copyRiderGcashBtn.textContent = copied ? tGcash("✓ Copied!") : rawNum;
      setTimeout(() => {
        if (copyRiderGcashBtn) copyRiderGcashBtn.textContent = orig;
      }, 1800);
    }
    return copied;
  }

  function syncGcashPaymentUI(b) {
    if (!b || !gcashCard) return;
    const isGcash = String(b.payment_method || "").toLowerCase() === "gcash";
    const isCancelled = String(b.status || "").toLowerCase() === "cancelled";
    gcashCard.classList.toggle("hidden", !isGcash || isCancelled);
    if (!isGcash || isCancelled) return;

    const pStat = String(b.payment_status || "pending").toLowerCase();
    const prevStat = lastGcashPaymentStatus;
    lastGcashPaymentStatus = pStat;

    if (prevStat !== "paid" && pStat === "paid") {
      playChatBeep();
    }

    if (gcashAmountDue) {
      gcashAmountDue.textContent = `₱${Math.round(Number(b.fare_amount || 0)).toLocaleString()}`;
    }

    if (gcashStatusBadge) {
      if (pStat === "paid") {
        gcashStatusBadge.className = "gcash-status-pill paid";
        gcashStatusBadge.textContent = tGcash("✅ GCash Verified & Paid");
      } else if (pStat === "customer_sent") {
        gcashStatusBadge.className = "gcash-status-pill sent";
        gcashStatusBadge.textContent = tGcash("📲 Sent — Awaiting Rider Confirmation");
      } else {
        gcashStatusBadge.className = "gcash-status-pill pending";
        gcashStatusBadge.textContent = tGcash("⏳ Waiting for GCash Payment");
      }
    }

    const hasRider = Boolean(b.rider_id);
    if (gcashWaitingRiderMsg) gcashWaitingRiderMsg.classList.toggle("hidden", hasRider);
    if (gcashRecipientSection) gcashRecipientSection.classList.toggle("hidden", !hasRider);

    if (hasRider) {
      if (gcashRiderName) gcashRiderName.textContent = b.rider_name || "Club Rider";
      if (gcashRiderNumber) {
        gcashRiderNumber.textContent = b.rider_gcash_number || b.rider_phone || "No number listed";
      }
      const qrUrl = String(b.rider_gcash_qr || "").trim();
      if (qrUrl) {
        if (gcashQrImgWrap) gcashQrImgWrap.classList.remove("hidden");
        if (gcashNoQrHint) gcashNoQrHint.classList.add("hidden");
        if (gcashRiderQrImg && gcashRiderQrImg.getAttribute("src") !== qrUrl) {
          gcashRiderQrImg.src = qrUrl;
        }
        if (downloadRiderQrBtn) {
          downloadRiderQrBtn.href = qrUrl;
          downloadRiderQrBtn.setAttribute("download", `CCRC-GCash-QR-${b.booking_code || "RIDE"}.png`);
        }
      } else {
        if (gcashQrImgWrap) gcashQrImgWrap.classList.add("hidden");
        if (gcashNoQrHint) gcashNoQrHint.classList.remove("hidden");
      }
    }

    if (gcashSentFormWrap) {
      const showSentForm = hasRider && pStat !== "paid" && b.status !== "completed";
      gcashSentFormWrap.classList.toggle("hidden", !showSentForm);
    }

    if (gcashRefInput) {
      if (prevStat === "customer_sent" && pStat === "pending" && !b.payment_ref) {
        gcashRefInput.value = "";
        delete gcashRefInput.dataset.dirty;
        showGcashCustomerFeedback(
          tGcash("Trip transferred to a new rider. Please pay using the new rider's GCash details above."),
          false
        );
      } else if (
        document.activeElement !== gcashRefInput
        && !gcashRefInput.dataset.dirty
        && !gcashRefInput.value
        && b.payment_ref
      ) {
        gcashRefInput.value = String(b.payment_ref);
      }
    }

    if (markGcashSentBtn && !markGcashSentBtn.disabled) {
      markGcashSentBtn.textContent = pStat === "customer_sent"
        ? tGcash("🔄 Update Reference No.")
        : tGcash("✓ I've Sent GCash Payment");
    }

    if (gcashPaidBanner) {
      gcashPaidBanner.classList.toggle("hidden", pStat !== "paid");
    }
    if (gcashPaidRefText) {
      gcashPaidRefText.textContent = b.payment_ref ? ` (Ref: ${b.payment_ref})` : "";
    }
  }

  function openOfficialGcashApp() {
    copyRiderGcashNumber(true);
    const ua = navigator.userAgent || "";
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const riderNum = String(booking.rider_gcash_number || booking.rider_phone || "").trim();
    const fareVal = Math.round(Number(booking.fare_amount || 0));

    if (isAndroid) {
      showGcashCustomerFeedback(
        riderNum
          ? `${tGcash("Opening Official GCash...")} ${tGcash("Rider GCash number copied:")} ${riderNum} (₱${fareVal.toLocaleString()})`
          : `${tGcash("Opening Official GCash...")} (₱${fareVal.toLocaleString()})`,
        false
      );
      window.location.href =
        "intent://#Intent;package=com.globe.gcash.android;scheme=gcash;" +
        "S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.globe.gcash.android;end";
      return;
    }

    if (isIOS) {
      showGcashCustomerFeedback(
        riderNum
          ? `${tGcash("Opening Official GCash...")} ${tGcash("Rider GCash number copied:")} ${riderNum} (₱${fareVal.toLocaleString()})`
          : `${tGcash("Opening Official GCash...")} (₱${fareVal.toLocaleString()})`,
        false
      );
      const startTs = Date.now();
      window.location.href = "gcash://";
      setTimeout(() => {
        if (!document.hidden && Date.now() - startTs < 2400) {
          showGcashCustomerFeedback(
            tGcash("If GCash did not open automatically, switch to the GCash app manually or install it from the App Store link above."),
            false
          );
        }
      }, 1600);
      return;
    }

    showGcashCustomerFeedback(
      riderNum
        ? `${tGcash("Open the official GCash app on your phone and scan the QR code above or send")} ₱${fareVal.toLocaleString()} ${tGcash("to")} ${riderNum} (${tGcash("copied!")}).`
        : `${tGcash("Open the official GCash app on your phone and scan the rider's QR code above.")}`,
      false
    );
  }

  if (copyRiderGcashBtn) {
    copyRiderGcashBtn.addEventListener("click", () => copyRiderGcashNumber(false));
  }
  if (openOfficialGcashBtn) {
    openOfficialGcashBtn.addEventListener("click", openOfficialGcashApp);
  }
  if (gcashRefInput) {
    gcashRefInput.addEventListener("input", () => {
      gcashRefInput.dataset.dirty = "1";
    });
  }
  if (gcashSentForm) {
    gcashSentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!markGcashSentBtn) return;
      const origText = markGcashSentBtn.textContent;
      const refVal = (gcashRefInput ? gcashRefInput.value : "").trim();
      markGcashSentBtn.disabled = true;
      markGcashSentBtn.textContent = tGcash("Sending...");

      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(booking.booking_code)}/gcash/customer-sent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_ref: refVal }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Could not report GCash payment.");
        }
        if (gcashRefInput) delete gcashRefInput.dataset.dirty;
        if (data.booking) {
          Object.assign(booking, data.booking);
          const idx = groupBookings.findIndex((s) => s && s.booking_code === data.booking.booking_code);
          if (idx !== -1) {
            groupBookings[idx] = Object.assign({}, groupBookings[idx], data.booking);
          }
          renderGroupUI(booking, groupBookings, groupSummary);
          syncGcashPaymentUI(data.booking);
        }
        showGcashCustomerFeedback(
          data.message || tGcash("GCash payment notice sent to your rider for confirmation!"),
          false
        );
      } catch (err) {
        showGcashCustomerFeedback(err.message || "Could not report GCash payment.", true);
      } finally {
        if (markGcashSentBtn) {
          markGcashSentBtn.disabled = false;
          const pStat = String(booking.payment_status || "pending").toLowerCase();
          markGcashSentBtn.textContent = pStat === "customer_sent"
            ? tGcash("🔄 Update Reference No.")
            : tGcash("✓ I've Sent GCash Payment");
        } else if (origText) {
          // no-op
        }
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    syncSlotHeaderAndDetails(booking);
    renderGroupUI(booking, groupBookings, groupSummary);
    pollChatMessages();
    syncGcashPaymentUI(booking);
    syncCustomerVoiceCallContext(booking);
    if (hasAnyActiveSlot(groupBookings, booking)) {
      livePollTimer = setInterval(pollLiveStatus, 3000);
      chatPollTimer = setInterval(pollChatMessages, 2500);
    }
  });
})();
