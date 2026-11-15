(function () {
  "use strict";

  // Elements
  const serviceTabs = document.querySelectorAll(".service-tab-btn");
  const serviceTypeInput = document.getElementById("service-type-input");
  const pickupInput = document.getElementById("pickup-address");
  const pickupLatInput = document.getElementById("pickup-lat");
  const pickupLngInput = document.getElementById("pickup-lng");
  const dropoffInput = document.getElementById("dropoff-address");
  const dropoffLatInput = document.getElementById("dropoff-lat");
  const dropoffLngInput = document.getElementById("dropoff-lng");
  const budgetGroup = document.getElementById("budget-group");
  const notesLabel = document.getElementById("notes-label");
  const fareDisplay = document.getElementById("fare-display");
  const fareKmDisplay = document.getElementById("fare-km-display");
  const fareHintText = document.getElementById("fare-hint-text");
  const bookingForm = document.getElementById("booking-request-form");
  const submitBtn = document.getElementById("submit-booking-btn");
  const errorMsg = document.getElementById("form-error-msg");
  const landmarkChips = document.getElementById("quick-landmark-chips");
  const locatePickupGpsBtn = document.getElementById("locate-pickup-gps-btn");
  const locateDropoffGpsBtn = document.getElementById("locate-dropoff-gps-btn");
  const targetModeButtons = document.querySelectorAll("[data-target-mode]");
  const successModal = document.getElementById("broadcast-success-modal");
  const modalBookingCode = document.getElementById("modal-booking-code");
  const modalTrackLink = document.getElementById("modal-track-link");

  // Options & Matrix Modal
  const optLargeStore = document.getElementById("opt-large-store");
  const optExtraStores = document.getElementById("opt-extra-stores");
  const optHinterland = document.getElementById("opt-hinterland");
  const estimatedBudgetInput = document.getElementById("estimated-budget");
  const openMatrixBtn = document.getElementById("open-matrix-btn");
  const closeMatrixBtn = document.getElementById("close-matrix-btn");
  const fareMatrixModal = document.getElementById("fare-matrix-modal");

  let map;
  let pickupMarker = null;
  let dropoffMarker = null;
  let routeLine = null;
  let currentTargetMode = "pickup"; // 'pickup' or 'dropoff'

  // Service Type Switcher
  serviceTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      serviceTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const service = tab.getAttribute("data-service");
      serviceTypeInput.value = service;

      if (service === "pabili") {
        if (budgetGroup) budgetGroup.classList.remove("hidden");
        if (notesLabel) notesLabel.textContent = "Shopping List & Store Names *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Buy For Me fee.";
      } else if (service === "pasugo") {
        if (budgetGroup) budgetGroup.classList.add("hidden");
        if (notesLabel) notesLabel.textContent = "Parcel Description / Cargo Details *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Courier delivery fee.";
      } else if (service === "pabayad") {
        if (budgetGroup) budgetGroup.classList.remove("hidden");
        if (notesLabel) notesLabel.textContent = "Payment Details / Port Cargo Claim Number *";
        if (fareHintText) fareHintText.textContent = "Official Tariff: Base meter (₱40 for 2km + ₱18/km) + ₱20 Port claim fee.";
      } else {
        if (budgetGroup) budgetGroup.classList.add("hidden");
        if (notesLabel) notesLabel.textContent = "Special Requests / Landmark Note";
        if (fareHintText) fareHintText.textContent = "Official Tariff: 1-2 km = ₱40 base, ₱18 per succeeding km.";
      }
      recalculateFare();
    });
  });

  // Re-calculate when options change
  [optLargeStore, optExtraStores, optHinterland, estimatedBudgetInput].forEach((el) => {
    if (el) {
      el.addEventListener("change", recalculateFare);
      el.addEventListener("input", recalculateFare);
    }
  });

  // Matrix Modal Controls
  if (openMatrixBtn && fareMatrixModal) {
    openMatrixBtn.addEventListener("click", () => {
      fareMatrixModal.classList.remove("hidden");
    });
  }
  if (closeMatrixBtn && fareMatrixModal) {
    closeMatrixBtn.addEventListener("click", () => {
      fareMatrixModal.classList.add("hidden");
    });
  }
  if (fareMatrixModal) {
    fareMatrixModal.addEventListener("click", (e) => {
      if (e.target === fareMatrixModal) fareMatrixModal.classList.add("hidden");
    });
  }

  // Target Mode Toggles (Pickup vs Dropoff)
  targetModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      targetModeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTargetMode = btn.getAttribute("data-target-mode");
    });
  });

  // Map Initialization (Camiguin Center)
  function initMap() {
    const mapEl = document.getElementById("booking-map");
    if (!mapEl || typeof L === "undefined") return;

    map = L.map(mapEl).setView([9.2000, 124.7200], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Click on map to place pin
    map.on("click", (e) => {
      const lat = parseFloat(e.latlng.lat.toFixed(5));
      const lng = parseFloat(e.latlng.lng.toFixed(5));

      if (currentTargetMode === "pickup") {
        setPickupPoint(lat, lng, `Pinned Pickup (${lat}, ${lng})`);
        // Auto-switch to dropoff after placing pickup
        if (!dropoffLatInput.value) {
          targetModeButtons.forEach((b) => b.classList.toggle("active", b.getAttribute("data-target-mode") === "dropoff"));
          currentTargetMode = "dropoff";
        }
      } else {
        setDropoffPoint(lat, lng, `Pinned Dropoff (${lat}, ${lng})`);
      }
    });
  }

  function setPickupPoint(lat, lng, label) {
    pickupLatInput.value = lat;
    pickupLngInput.value = lng;
    if (label) pickupInput.value = label;

    if (!pickupMarker) {
      const greenIcon = L.divIcon({
        className: "custom-pin",
        html: `<div style="background:#16a34a;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;">🟢</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      pickupMarker = L.marker([lat, lng], { icon: greenIcon, draggable: true }).addTo(map);
      pickupMarker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        setPickupPoint(parseFloat(pos.lat.toFixed(5)), parseFloat(pos.lng.toFixed(5)), null);
      });
    } else {
      pickupMarker.setLatLng([lat, lng]);
    }

    updateRouteLine();
    recalculateFare();
  }

  function setDropoffPoint(lat, lng, label) {
    dropoffLatInput.value = lat;
    dropoffLngInput.value = lng;
    if (label) dropoffInput.value = label;

    if (!dropoffMarker) {
      const redIcon = L.divIcon({
        className: "custom-pin",
        html: `<div style="background:#dc2626;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;">🏁</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      dropoffMarker = L.marker([lat, lng], { icon: redIcon, draggable: true }).addTo(map);
      dropoffMarker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        setDropoffPoint(parseFloat(pos.lat.toFixed(5)), parseFloat(pos.lng.toFixed(5)), null);
      });
    } else {
      dropoffMarker.setLatLng([lat, lng]);
    }

    updateRouteLine();
    recalculateFare();
  }

  function updateRouteLine() {
    if (!map) return;
    const pLat = parseFloat(pickupLatInput.value);
    const pLng = parseFloat(pickupLngInput.value);
    const dLat = parseFloat(dropoffLatInput.value);
    const dLng = parseFloat(dropoffLngInput.value);

    if (pLat && pLng && dLat && dLng) {
      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.polyline([[pLat, pLng], [dLat, dLng]], {
        color: "#f97316",
        weight: 4,
        dashArray: "6, 8",
        opacity: 0.85,
      }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
    }
  }

  async function recalculateFare() {
    const pLat = parseFloat(pickupLatInput.value);
    const pLng = parseFloat(pickupLngInput.value);
    const dLat = parseFloat(dropoffLatInput.value);
    const dLng = parseFloat(dropoffLngInput.value);
    const service = serviceTypeInput.value;
    const isLarge = optLargeStore ? optLargeStore.checked : false;
    const extraStores = optExtraStores ? parseInt(optExtraStores.value || "0", 10) : 0;
    const isHinterland = optHinterland ? optHinterland.checked : false;
    const budgetVal = estimatedBudgetInput ? parseFloat(estimatedBudgetInput.value || 0) : 0;
    const isBulky = budgetVal >= 2000;

    try {
      const res = await fetch("/api/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_lat: pLat || null,
          pickup_lng: pLng || null,
          dropoff_lat: dLat || null,
          dropoff_lng: dLng || null,
          service_type: service,
          is_large_store: isLarge,
          extra_stores_count: extraStores,
          is_bulky_or_high_value: isBulky,
          is_hinterland: isHinterland,
        }),
      });
      const data = await res.json();
      if (data && data.fare_amount) {
        if (fareDisplay) fareDisplay.textContent = Math.round(data.fare_amount);
        if (fareKmDisplay) fareKmDisplay.textContent = `~${data.estimated_km} km`;
      }
    } catch (_) {}
  }

  // Quick Landmark Chips
  if (landmarkChips) {
    landmarkChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip-btn");
      if (!chip) return;
      const name = chip.getAttribute("data-name");
      const lat = parseFloat(chip.getAttribute("data-lat"));
      const lng = parseFloat(chip.getAttribute("data-lng"));

      if (currentTargetMode === "pickup") {
        setPickupPoint(lat, lng, name);
        if (!dropoffLatInput.value) {
          targetModeButtons.forEach((b) => b.classList.toggle("active", b.getAttribute("data-target-mode") === "dropoff"));
          currentTargetMode = "dropoff";
        }
      } else {
        setDropoffPoint(lat, lng, name);
      }
    });
  }

  // GPS Locate Pickup
  if (locatePickupGpsBtn) {
    locatePickupGpsBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
      }
      locatePickupGpsBtn.textContent = "📍 Locating GPS...";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locatePickupGpsBtn.textContent = "📍 My Current GPS";
          const lat = parseFloat(pos.coords.latitude.toFixed(5));
          const lng = parseFloat(pos.coords.longitude.toFixed(5));
          setPickupPoint(lat, lng, "My Current GPS Location");
          if (map) map.setView([lat, lng], 14);
        },
        () => {
          locatePickupGpsBtn.textContent = "📍 My Current GPS";
          alert("Unable to retrieve GPS coordinates. Please grant Location permission.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // Default initial points in Mambajao
  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    setPickupPoint(9.2483, 124.6975, "Mambajao Public Market");
    setDropoffPoint(9.2553, 124.6468, "Paras Beach Resort (Yumbing)");
  });

  // Booking Form Submission
  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorMsg) {
        errorMsg.classList.add("hidden");
        errorMsg.textContent = "";
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Broadcasting booking to riders...";

      const budgetVal = estimatedBudgetInput ? parseFloat(estimatedBudgetInput.value || 0) : 0;
      const payload = {
        service_type: serviceTypeInput.value,
        pickup_address: pickupInput.value.trim(),
        pickup_lat: pickupLatInput.value ? parseFloat(pickupLatInput.value) : null,
        pickup_lng: pickupLngInput.value ? parseFloat(pickupLngInput.value) : null,
        dropoff_address: dropoffInput.value.trim(),
        dropoff_lat: dropoffLatInput.value ? parseFloat(dropoffLatInput.value) : null,
        dropoff_lng: dropoffLngInput.value ? parseFloat(dropoffLngInput.value) : null,
        customer_name: document.getElementById("customer-name").value.trim(),
        customer_phone: document.getElementById("customer-phone").value.trim(),
        item_notes: document.getElementById("item-notes").value.trim(),
        estimated_budget: budgetVal,
        is_large_store: optLargeStore ? optLargeStore.checked : false,
        extra_stores_count: optExtraStores ? parseInt(optExtraStores.value || "0", 10) : 0,
        is_hinterland: optHinterland ? optHinterland.checked : false,
        is_bulky_or_high_value: budgetVal >= 2000,
      };

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Could not process booking.");
        }

        const b = data.booking;
        if (modalBookingCode) modalBookingCode.textContent = b.booking_code;
        if (modalTrackLink) modalTrackLink.href = data.tracking_url;
        if (successModal) successModal.classList.remove("hidden");
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = err.message;
          errorMsg.classList.remove("hidden");
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Broadcast Booking to Active Riders 🛵 →";
      }
    });
  }
})();
