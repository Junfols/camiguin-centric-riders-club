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

  // Camiguin Island Knowledge Base (Auto-resolves typed places to coordinates)
  const CAMIGUIN_PLACES = [
    { name: "Baylao, Mambajao", keywords: ["baylao", "bailao"], lat: 9.2415, lng: 124.6910 },
    { name: "Jollibee Camiguin, Mambajao", keywords: ["jollibee", "jolibee", "joli", "jolli"], lat: 9.2488, lng: 124.6980 },
    { name: "Gaisano Capital Camiguin", keywords: ["gaisano", "gaisano capital"], lat: 9.2475, lng: 124.6995 },
    { name: "Davilett Store, Mambajao", keywords: ["davilett", "davi"], lat: 9.2482, lng: 124.6978 },
    { name: "Nene Uy Store, Mambajao", keywords: ["nene uy", "nene"], lat: 9.2480, lng: 124.6976 },
    { name: "7-Eleven Mambajao", keywords: ["7-eleven", "7-11", "711", "seven eleven"], lat: 9.2487, lng: 124.6979 },
    { name: "Mambajao Public Market", keywords: ["market", "merkado", "palengke", "mambajao market"], lat: 9.2483, lng: 124.6975 },
    { name: "Mambajao Town Plaza", keywords: ["mambajao plaza", "plaza", "municipal hall"], lat: 9.2485, lng: 124.6972 },
    { name: "Balbagon Port (FastCat)", keywords: ["balbagon", "balbagon port", "fastcat"], lat: 9.2561, lng: 124.7175 },
    { name: "Benoni Port / Ferry Wharf, Mahinog", keywords: ["benoni", "benoni port", "benoni wharf", "wharf", "port"], lat: 9.1306, lng: 124.7937 },
    { name: "Camiguin Airport", keywords: ["airport", "tugpahanan"], lat: 9.2530, lng: 124.7061 },
    { name: "Camiguin General Hospital", keywords: ["hospital", "cgh", "clinic"], lat: 9.2495, lng: 124.7020 },
    { name: "Provincial Capitol, Mambajao", keywords: ["capitol", "kapitolyo"], lat: 9.2510, lng: 124.7040 },
    { name: "Paras Beach Resort, Yumbing", keywords: ["paras", "paras beach"], lat: 9.2553, lng: 124.6468 },
    { name: "Balyali Beach Resort, Yumbing", keywords: ["balyali", "balyali resort"], lat: 9.2588, lng: 124.6432 },
    { name: "White Island Boat Jump-off", keywords: ["white island", "jump-off"], lat: 9.2538, lng: 124.6532 },
    { name: "Katibawasan Falls", keywords: ["katibawasan", "katibawasan falls"], lat: 9.2152, lng: 124.7188 },
    { name: "Ardent Hot Spring", keywords: ["ardent", "ardent hot spring"], lat: 9.2380, lng: 124.6610 },
    { name: "Sunken Cemetery, Catarman", keywords: ["sunken", "sunken cemetery"], lat: 9.2010, lng: 124.6300 },
    { name: "Old Church Ruins, Catarman", keywords: ["church ruins", "guiob", "gui-ob"], lat: 9.2050, lng: 124.6320 },
    { name: "Tuasan Falls, Catarman", keywords: ["tuasan", "tuasan falls"], lat: 9.1700, lng: 124.6750 },
    { name: "Sto. Niño Cold Spring, Catarman", keywords: ["cold spring", "sto nino", "sto. nino"], lat: 9.1550, lng: 124.6550 },
    { name: "Mantigue Island Jump-off, Mahinog", keywords: ["mantigue", "san roque"], lat: 9.1720, lng: 124.7850 },
    { name: "Taguines Lagoon, Mahinog", keywords: ["taguines", "taguines lagoon"], lat: 9.1290, lng: 124.7910 },
    { name: "Tongatok Cliff Resort", keywords: ["tongatok", "tongatok cliff"], lat: 9.2505, lng: 124.6341 },
    { name: "Lanzones Resort, Mambajao", keywords: ["lanzones", "lanzones resort"], lat: 9.2390, lng: 124.6970 },
    { name: "Camiguin Highland Resort", keywords: ["highland", "highland resort", "sorosoro", "soro-soro", "soro'soro"], lat: 9.2310, lng: 124.6890 },
    { name: "Agoho, Mambajao", keywords: ["agoho"], lat: 9.2450, lng: 124.6620 },
    { name: "Yumbing, Mambajao", keywords: ["yumbing"], lat: 9.2553, lng: 124.6468 },
    { name: "Kuguita, Mambajao", keywords: ["kuguita"], lat: 9.2490, lng: 124.6850 },
    { name: "Poblacion Mambajao", keywords: ["poblacion mambajao", "poblacion", "centro"], lat: 9.2483, lng: 124.6975 },
    { name: "Poblacion Mahinog", keywords: ["mahinog", "poblacion mahinog"], lat: 9.1530, lng: 124.7850 },
    { name: "Poblacion Catarman", keywords: ["catarman", "poblacion catarman"], lat: 9.1280, lng: 124.6450 },
    { name: "Poblacion Sagay", keywords: ["sagay", "poblacion sagay"], lat: 9.1020, lng: 124.7210 },
    { name: "Poblacion Guinsiliban", keywords: ["guinsiliban", "poblacion guinsiliban"], lat: 9.0940, lng: 124.7780 }
  ];

  function matchCamiguinPlace(str) {
    if (!str) return null;
    const s = str.trim().toLowerCase();
    // 1. Exact match
    for (const p of CAMIGUIN_PLACES) {
      if (s === p.name.toLowerCase()) return p;
      for (const k of p.keywords) {
        if (s === k) return p;
      }
    }
    // 2. Word/Substring match
    for (const p of CAMIGUIN_PLACES) {
      for (const k of p.keywords) {
        if (s.includes(k) || k.includes(s)) return p;
      }
      if (p.name.toLowerCase().includes(s)) return p;
    }
    return null;
  }

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

  // Handle typing inside Pickup and Dropoff inputs
  function handleTypedAddress(isPickup) {
    const input = isPickup ? pickupInput : dropoffInput;
    const text = input.value.trim();
    if (text.length >= 2) {
      const found = matchCamiguinPlace(text);
      if (found) {
        if (isPickup) {
          pickupLatInput.value = found.lat;
          pickupLngInput.value = found.lng;
          if (pickupMarker) {
            pickupMarker.setLatLng([found.lat, found.lng]);
          } else if (map) {
            setPickupPoint(found.lat, found.lng, null);
          }
        } else {
          dropoffLatInput.value = found.lat;
          dropoffLngInput.value = found.lng;
          if (dropoffMarker) {
            dropoffMarker.setLatLng([found.lat, found.lng]);
          } else if (map) {
            setDropoffPoint(found.lat, found.lng, null);
          }
        }
        updateRouteLine();
      }
    }
    recalculateFare();
  }

  let typeTimer = null;
  if (pickupInput) {
    pickupInput.addEventListener("input", () => {
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => handleTypedAddress(true), 250);
    });
    pickupInput.addEventListener("change", () => handleTypedAddress(true));
  }

  if (dropoffInput) {
    dropoffInput.addEventListener("input", () => {
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => handleTypedAddress(false), 250);
    });
    dropoffInput.addEventListener("change", () => handleTypedAddress(false));
  }

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
  }

  let currentRoadKm = null;
  let osrmAbortCtrl = null;

  async function updateRouteLine() {
    if (!map) return;
    const pLat = parseFloat(pickupLatInput.value);
    const pLng = parseFloat(pickupLngInput.value);
    const dLat = parseFloat(dropoffLatInput.value);
    const dLng = parseFloat(dropoffLngInput.value);

    if (pLat && pLng && dLat && dLng) {
      if (routeLine) map.removeLayer(routeLine);

      // 1. Initial dashed connecting line as immediate feedback
      routeLine = L.polyline([[pLat, pLng], [dLat, dLng]], {
        color: "#f97316",
        weight: 3,
        dashArray: "4, 6",
        opacity: 0.5,
      }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

      // 2. Query OSRM to get the actual road path ("kalsada mismo kung asa ni agi")
      if (osrmAbortCtrl) {
        osrmAbortCtrl.abort();
      }
      osrmAbortCtrl = new AbortController();

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl, { signal: osrmAbortCtrl.signal });
        if (res.ok) {
          const osrmData = await res.json();
          if (osrmData && osrmData.code === "Ok" && osrmData.routes && osrmData.routes.length > 0) {
            const bestRoute = osrmData.routes[0];
            const roadCoords = bestRoute.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
            const roadMeters = bestRoute.distance;
            const roadKmVal = parseFloat((roadMeters / 1000.0).toFixed(2));
            currentRoadKm = roadKmVal;

            if (routeLine) map.removeLayer(routeLine);
            // Draw real road polyline snapping to Camiguin highway and local streets
            routeLine = L.polyline(roadCoords, {
              color: "#ea580c",
              weight: 5,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

            // Recalculate fare using the exact road distance
            recalculateFare(roadKmVal);
            return;
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.log("OSRM client fallback to server road engine");
        }
      }
    }

    recalculateFare();
  }

  async function recalculateFare(overrideRoadKm) {
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
    const roadKmToSend = typeof overrideRoadKm === "number" ? overrideRoadKm : currentRoadKm;

    try {
      const res = await fetch("/api/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_lat: pLat || null,
          pickup_lng: pLng || null,
          dropoff_lat: dLat || null,
          dropoff_lng: dLng || null,
          road_km: roadKmToSend,
          pickup_address: pickupInput ? pickupInput.value.trim() : "",
          dropoff_address: dropoffInput ? dropoffInput.value.trim() : "",
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
        if (fareKmDisplay) fareKmDisplay.textContent = `~${data.estimated_km} km (Road Distance)`;

        // If backend resolved coordinates that were missing, update markers & inputs
        let hasNewCoords = false;
        if (data.resolved_pickup && (!pLat || !pLng)) {
          pickupLatInput.value = data.resolved_pickup.lat;
          pickupLngInput.value = data.resolved_pickup.lng;
          if (pickupMarker) {
            pickupMarker.setLatLng([data.resolved_pickup.lat, data.resolved_pickup.lng]);
          } else if (map) {
            setPickupPoint(data.resolved_pickup.lat, data.resolved_pickup.lng, null);
          }
          hasNewCoords = true;
        }
        if (data.resolved_dropoff && (!dLat || !dLng)) {
          dropoffLatInput.value = data.resolved_dropoff.lat;
          dropoffLngInput.value = data.resolved_dropoff.lng;
          if (dropoffMarker) {
            dropoffMarker.setLatLng([data.resolved_dropoff.lat, data.resolved_dropoff.lng]);
          } else if (map) {
            setDropoffPoint(data.resolved_dropoff.lat, data.resolved_dropoff.lng, null);
          }
          hasNewCoords = true;
        }

        // If backend sent route coordinates (from server-side road engine) and frontend hasn't drawn yet
        if (data.route_coords && data.route_coords.length > 0 && (!currentRoadKm || hasNewCoords)) {
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
        road_km: currentRoadKm,
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
