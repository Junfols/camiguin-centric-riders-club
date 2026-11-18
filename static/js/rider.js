(function () {
  "use strict";

  // Elements
  const authSection = document.getElementById("rider-auth-section");
  const dashSection = document.getElementById("rider-dashboard-section");
  const loginForm = document.getElementById("rider-login-form");
  const registerForm = document.getElementById("rider-register-form");
  const switchToRegisterBtn = document.getElementById("switch-to-register-btn");
  const switchToLoginBtn = document.getElementById("switch-to-login-btn");
  const loginErrorMsg = document.getElementById("login-error-msg");
  const registerErrorMsg = document.getElementById("register-error-msg");

  const dashRiderName = document.getElementById("dash-rider-name");
  const dashRiderBike = document.getElementById("dash-rider-bike");
  const onlineToggle = document.getElementById("rider-online-toggle");
  const onlineStatusText = document.getElementById("online-status-text");
  const gpsStatusLabel = document.getElementById("gps-status-label");
  const forceGpsBtn = document.getElementById("force-gps-btn");
  const logoutBtn = document.getElementById("rider-logout-btn");

  const activeJobBox = document.getElementById("rider-active-job-box");
  const activeJobCode = document.getElementById("active-job-code");
  const activeJobTitle = document.getElementById("active-job-title");
  const activeJobFare = document.getElementById("active-job-fare");
  const activeJobPickup = document.getElementById("active-job-pickup");
  const activeJobDropoff = document.getElementById("active-job-dropoff");
  const activeJobNotes = document.getElementById("active-job-notes");
  const activeJobNotesWrap = document.getElementById("active-job-notes-wrap");
  const activeJobBudget = document.getElementById("active-job-budget");
  const activeJobCustomer = document.getElementById("active-job-customer");
  const activeJobCallBtn = document.getElementById("active-job-call-btn");
  const navPickupBtn = document.getElementById("nav-pickup-btn");
  const navDropoffBtn = document.getElementById("nav-dropoff-btn");
  const jobInProgressBtn = document.getElementById("job-in-progress-btn");
  const jobCompleteBtn = document.getElementById("job-complete-btn");

  const jobsFeedList = document.getElementById("available-jobs-feed");
  const jobsCountPill = document.getElementById("jobs-count-pill");
  const refreshJobsBtn = document.getElementById("refresh-jobs-btn");

  let currentRider = null;
  let activeJob = null;
  let knownJobIds = new Set();
  let pollInterval = null;
  let gpsWatchId = null;
  let lastReminderChimeTime = 0;

  const STORAGE_KEY = "ccrc_rider_session";

  function getStoredRider() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function setStoredRider(r) {
    if (r) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Switch between Login, Register, and Forgot Password Forms
  const forgotForm = document.getElementById("rider-forgot-form");
  const switchToForgotBtn = document.getElementById("switch-to-forgot-btn");
  const switchForgotToLoginBtn = document.getElementById("switch-forgot-to-login-btn");
  const forgotStatusMsg = document.getElementById("forgot-status-msg");

  if (switchToRegisterBtn) {
    switchToRegisterBtn.addEventListener("click", () => {
      loginForm.classList.add("hidden");
      if (forgotForm) forgotForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
    });
  }
  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener("click", () => {
      registerForm.classList.add("hidden");
      if (forgotForm) forgotForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    });
  }
  if (switchToForgotBtn) {
    switchToForgotBtn.addEventListener("click", () => {
      loginForm.classList.add("hidden");
      registerForm.classList.add("hidden");
      if (forgotForm) {
        forgotForm.classList.remove("hidden");
        // Pre-fill phone if user already entered it in login
        const loginPhoneVal = document.getElementById("login-phone")?.value.trim();
        const forgotPhoneInput = document.getElementById("forgot-phone");
        if (loginPhoneVal && forgotPhoneInput && !forgotPhoneInput.value) {
          forgotPhoneInput.value = loginPhoneVal;
        }
      }
    });
  }
  if (switchForgotToLoginBtn) {
    switchForgotToLoginBtn.addEventListener("click", () => {
      if (forgotForm) forgotForm.classList.add("hidden");
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    });
  }

  // Rider Forgot Password Handler
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!forgotStatusMsg) return;
      forgotStatusMsg.classList.add("hidden");
      forgotStatusMsg.textContent = "";

      const phone = document.getElementById("forgot-phone")?.value.trim() || "";
      const identifier = document.getElementById("forgot-identifier")?.value.trim() || "";
      const newPwd = document.getElementById("forgot-new-pwd")?.value || "";
      const confirmPwd = document.getElementById("forgot-confirm-pwd")?.value || "";
      const resetBtn = document.getElementById("rider-reset-btn");

      if (newPwd !== confirmPwd) {
        forgotStatusMsg.style.background = "#fee2e2";
        forgotStatusMsg.style.color = "#991b1b";
        forgotStatusMsg.style.border = "1px solid #fca5a5";
        forgotStatusMsg.textContent = "Dili pareho ang bag-ong password ug ang confirmation password.";
        forgotStatusMsg.classList.remove("hidden");
        return;
      }

      resetBtn.disabled = true;
      resetBtn.textContent = "Ginasusi ug gina-save...";

      try {
        const res = await fetch("/api/rider/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone,
            identifier: identifier,
            new_password: newPwd,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to reset password.");
        }

        forgotStatusMsg.style.background = "#dcfce7";
        forgotStatusMsg.style.color = "#166534";
        forgotStatusMsg.style.border = "1px solid #86efac";
        forgotStatusMsg.innerHTML = "✅ <strong>Malampuson!</strong> " + (data.message || "Na-reset na ang imong password.") + "<br><small>Ibalik na tika sa Log In...</small>";
        forgotStatusMsg.classList.remove("hidden");

        // Prefill login phone
        const loginPhoneInput = document.getElementById("login-phone");
        if (loginPhoneInput) loginPhoneInput.value = phone;

        setTimeout(() => {
          forgotForm.classList.add("hidden");
          loginForm.classList.remove("hidden");
          forgotStatusMsg.classList.add("hidden");
          const loginPwd = document.getElementById("login-password");
          if (loginPwd) loginPwd.focus();
        }, 1800);
      } catch (err) {
        forgotStatusMsg.style.background = "#fee2e2";
        forgotStatusMsg.style.color = "#991b1b";
        forgotStatusMsg.style.border = "1px solid #fca5a5";
        forgotStatusMsg.textContent = err.message;
        forgotStatusMsg.classList.remove("hidden");
      } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = "I-save ang Bag-ong Password →";
      }
    });
  }

  // Login Handler
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginErrorMsg.classList.add("hidden");
      loginErrorMsg.textContent = "";

      const phone = document.getElementById("login-phone").value.trim();
      const password = document.getElementById("login-password").value.trim();
      const btn = document.getElementById("rider-login-btn");
      btn.disabled = true;
      btn.textContent = "Logging in...";

      try {
        const res = await fetch("/api/rider/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 403 && data.pending) {
            loginErrorMsg.style.color = "#854d0e";
            loginErrorMsg.style.backgroundColor = "#fef9c3";
            loginErrorMsg.style.borderColor = "#facc15";
            loginErrorMsg.innerHTML = "⏳ <strong>ACCOUNT PENDING APPROVAL</strong><br>" + (data.error || "Palihug bisitaha ang CCRC Club Admin sa personal dala ang imong Driver's License, OR/CR, ug motor aron ma-inspeksyon ug ma-activate ang imong account.");
            loginErrorMsg.classList.remove("hidden");
            return;
          }
          throw new Error(data.error || "Login failed");
        }

        setStoredRider(data.rider);
        initRiderSession(data.rider);
      } catch (err) {
        loginErrorMsg.style.color = "";
        loginErrorMsg.style.backgroundColor = "";
        loginErrorMsg.style.borderColor = "";
        loginErrorMsg.textContent = err.message;
        loginErrorMsg.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "Log In as Rider →";
      }
    });
  }


  // Photo Upload & Client-side Auto-Compression
  let currentAvatarBase64 = "";
  const regPhotoInput = document.getElementById("reg-photo");
  const photoPreviewImg = document.getElementById("photo-preview-img");
  const photoPlaceholderIcon = document.getElementById("photo-placeholder-icon");

  if (regPhotoInput) {
    regPhotoInput.addEventListener("change", function () {
      const file = this.files && this.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const maxDim = 500;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          currentAvatarBase64 = canvas.toDataURL("image/jpeg", 0.85);

          if (photoPreviewImg) {
            photoPreviewImg.src = currentAvatarBase64;
            photoPreviewImg.classList.remove("hidden");
          }
          if (photoPlaceholderIcon) {
            photoPlaceholderIcon.classList.add("hidden");
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Register Handler
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      registerErrorMsg.classList.add("hidden");
      registerErrorMsg.textContent = "";

      const licenseVal = (document.getElementById("reg-license") ? document.getElementById("reg-license").value.trim().toUpperCase() : "");
      if (!licenseVal) {
        registerErrorMsg.textContent = "Please enter your Driver's License Number.";
        registerErrorMsg.classList.remove("hidden");
        return;
      }

      if (!currentAvatarBase64) {
        registerErrorMsg.textContent = "Please upload a clear profile picture (face photo).";
        registerErrorMsg.classList.remove("hidden");
        return;
      }

      const payload = {
        name: document.getElementById("reg-name").value.trim(),
        phone: document.getElementById("reg-phone").value.trim(),
        email: (document.getElementById("reg-email") ? document.getElementById("reg-email").value.trim().toLowerCase() : ""),
        license_no: licenseVal,
        bike_model: document.getElementById("reg-bike").value.trim(),
        plate_number: document.getElementById("reg-plate").value.trim(),
        municipality: document.getElementById("reg-mun").value,
        password: document.getElementById("reg-password").value,
        avatar_base64: currentAvatarBase64,
      };

      const btn = document.getElementById("rider-register-btn");
      btn.disabled = true;
      btn.textContent = "Registering...";

      try {
        const res = await fetch("/api/rider/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");

        if (data.pending) {
          alert("✅ Malampusong napasa ang imong Rider Application!\n\nStatus: PENDING APPROVAL\n\nPalihug bisitaha ang CCRC Club Admin sa personal dala ang imong:\n1. Driver's License\n2. OR/CR sa Motor\n3. Imong Motorsiklo para sa physical inspection\n\nInig ma-aprobahan na sa Admin, pwede na ka maka-log in dinhi.");
          // Switch to login tab and pre-fill phone
          registerForm.classList.add("hidden");
          loginForm.classList.remove("hidden");
          const loginPhoneInput = document.getElementById("login-phone");
          if (loginPhoneInput) {
            loginPhoneInput.value = payload.phone;
          }
          if (loginErrorMsg) {
            loginErrorMsg.style.color = "#854d0e";
            loginErrorMsg.style.backgroundColor = "#fef9c3";
            loginErrorMsg.style.borderColor = "#facc15";
            loginErrorMsg.innerHTML = "⏳ <strong>Application Submitted (PENDING APPROVAL)</strong><br>Palihug bisitaha ang CCRC Club Admin sa personal dala ang imong Driver's License, OR/CR, ug motor aron ma-inspeksyon ug ma-activate.";
            loginErrorMsg.classList.remove("hidden");
          }
          return;
        }

        setStoredRider(data.rider);
        initRiderSession(data.rider);
      } catch (err) {
        registerErrorMsg.textContent = err.message;
        registerErrorMsg.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "Register as CCRC Rider";
      }
    });
  }

  // Unified Logout Handler
  async function handleRiderLogout() {
    if (confirm("Are you sure you want to log out of your Rider Account?")) {
      setStoredRider(null);
      document.documentElement.classList.remove("is-rider-session");
      document.body.classList.remove("rider-logged-in");
      if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
      if (pollInterval) clearInterval(pollInterval);
      try {
        await fetch("/api/rider/logout", { method: "POST" });
      } catch (_) {}
      window.location.href = "/";
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleRiderLogout);
  }
  const bottomNavLogout = document.getElementById("bottom-nav-rider-logout");
  if (bottomNavLogout) {
    bottomNavLogout.addEventListener("click", handleRiderLogout);
  }
  const headerNavLogout = document.getElementById("header-rider-logout-btn");
  if (headerNavLogout) {
    headerNavLogout.addEventListener("click", handleRiderLogout);
  }
  const bottomRiderRefresh = document.getElementById("bottom-rider-refresh-btn");
  if (bottomRiderRefresh) {
    bottomRiderRefresh.addEventListener("click", fetchAvailableJobs);
  }

  function initRiderSession(rider) {
    currentRider = rider;
    document.documentElement.classList.add("is-rider-session");
    document.body.classList.add("rider-logged-in");

    // Strictly hide "Book a Ride" and Customer Sign In from nav & header when rider is logged in
    document.querySelectorAll(".nav-book-item, #nav-book-link, #bottom-nav-book, #customer-signin-btn, #customer-logged-pill").forEach((el) => {
      el.style.setProperty("display", "none", "important");
      el.classList.add("hidden");
    });

    const bLogout = document.getElementById("bottom-nav-rider-logout");
    if (bLogout) bLogout.classList.remove("hidden");
    const hLogout = document.getElementById("header-rider-logout-btn");
    if (hLogout) hLogout.classList.remove("hidden");

    authSection.classList.add("hidden");
    dashSection.classList.remove("hidden");

    dashRiderName.textContent = rider.name;
    dashRiderBike.textContent = `${rider.bike_model} • Plate: ${rider.plate_number} • ${rider.municipality}`;

    const dashLicense = document.getElementById("dash-rider-license");
    if (dashLicense) {
      dashLicense.textContent = rider.license_no ? `License: ${rider.license_no}` : "";
    }
    const dashAvatar = document.getElementById("dash-rider-avatar-img");
    if (dashAvatar) {
      if (rider.avatar_url) {
        dashAvatar.src = rider.avatar_url;
        dashAvatar.classList.remove("hidden");
      } else {
        dashAvatar.classList.add("hidden");
      }
    }

    // Online switch state
    onlineToggle.checked = rider.is_online === 1;
    updateOnlineBadge(rider.is_online === 1);

    // Start background GPS transmitter
    startGpsBeacon();

    // Check active job and start polling available jobs
    checkActiveJob();
    fetchAvailableJobs();
    fetchCoRiders();
    loadRiderTransactions();

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      if (onlineToggle.checked) {
        fetchAvailableJobs();
        fetchCoRiders();
        checkActiveJob();
      }
    }, 3500);
  }

  // Online / Offline Toggle
  if (onlineToggle) {
    onlineToggle.addEventListener("change", async () => {
      const isOnline = onlineToggle.checked;
      updateOnlineBadge(isOnline);
      if (isOnline && "Notification" in window && Notification.permission === "default") {
        try { Notification.requestPermission(); } catch(_) {}
      }
      try {
        await fetch("/api/rider/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rider_id: currentRider.id, is_online: isOnline }),
        });
        if (isOnline) {
          fetchAvailableJobs();
          checkActiveJob();
        } else {
          jobsFeedList.innerHTML = `<div class="empty-state">You are currently OFFLINE. Turn the switch above ON to receive booking requests in Camiguin.</div>`;
          jobsCountPill.textContent = "0";
        }
      } catch (_) {}
    });
  }

  function updateOnlineBadge(isOnline) {
    if (isOnline) {
      onlineStatusText.textContent = "🟢 ONLINE";
      onlineStatusText.style.color = "#047857";
    } else {
      onlineStatusText.textContent = "⚪ OFFLINE";
      onlineStatusText.style.color = "#64748b";
    }
  }

  // Background GPS Transmitter
  function startGpsBeacon() {
    if (!navigator.geolocation || !currentRider) return;

    function sendLocation(lat, lng, speed, heading) {
      gpsStatusLabel.textContent = `Live GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)} (Active)`;
      if (currentRider) {
        currentRider.last_lat = lat;
        currentRider.last_lng = lng;
      }
      updateRiderLiveMarkerOnJobMap(lat, lng, speed, heading);
      fetch("/api/rider/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rider_id: currentRider.id,
          lat: lat,
          lng: lng,
          speed: speed || 0,
          heading: heading || 0,
          booking_id: activeJob ? activeJob.id : null,
        }),
      }).catch(() => {});
    }

    gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.speed,
          pos.coords.heading
        );
      },
      () => {
        gpsStatusLabel.textContent = "GPS Warning: Please enable Location on your phone.";
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
    );
  }

  if (forceGpsBtn) {
    forceGpsBtn.addEventListener("click", () => {
      if (!navigator.geolocation) return;
      forceGpsBtn.textContent = "Syncing...";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          forceGpsBtn.textContent = "Sync GPS";
          gpsStatusLabel.textContent = `GPS Synced: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
          if (currentRider) {
            currentRider.last_lat = pos.coords.latitude;
            currentRider.last_lng = pos.coords.longitude;
          }
          updateRiderLiveMarkerOnJobMap(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.heading);
        },
        () => {
          forceGpsBtn.textContent = "Sync GPS";
          alert("Could not retrieve GPS coordinates. Please grant Location permission.");
        }
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Rider Active Job Interactive Live Map (Pareha sa Customer Track Map)
  // ---------------------------------------------------------------------------
  let riderJobMap = null;
  let riderJobPickupMarker = null;
  let riderJobDropoffMarker = null;
  let riderJobRiderMarker = null;
  let riderJobRouteLine = null;
  let riderJobStreetLayer = null;
  let riderJobSatGroup = null;
  let riderJobCurrentLayer = "street";
  let lastRiderGpsPos = null;
  let currentRiderBearing = 0;
  let currentJobIdOnMap = null;

  function calculateRiderBearing(lat1, lng1, lat2, lng2) {
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(dLng);
    let brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }

  function initRiderJobMap() {
    const mapEl = document.getElementById("rider-job-map");
    if (!mapEl || riderJobMap || typeof L === "undefined") return;

    const CAMIGUIN_BOUNDS = [
      [9.0500, 124.5800],
      [9.2900, 124.8300]
    ];

    riderJobMap = L.map(mapEl, {
      zoomControl: true,
      minZoom: 11,
      maxZoom: 19,
      maxBounds: CAMIGUIN_BOUNDS,
      maxBoundsViscosity: 1.0,
      bounceAtZoomLimits: true
    }).fitBounds(CAMIGUIN_BOUNDS);

    // 1. Street Layer (OpenStreetMap)
    riderJobStreetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    // 2. Satellite Layer (Esri World Imagery + Labels)
    const satImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri',
    });
    const satLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      pane: "overlayPane",
    });
    riderJobSatGroup = L.layerGroup([satImagery, satLabels]);

    riderJobStreetLayer.addTo(riderJobMap);

    // Layer Switcher Buttons
    document.querySelectorAll("[data-rider-job-layer]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const layerType = btn.getAttribute("data-rider-job-layer");
        if (layerType === riderJobCurrentLayer) return;
        if (layerType === "satellite") {
          riderJobMap.removeLayer(riderJobStreetLayer);
          riderJobSatGroup.addTo(riderJobMap);
          riderJobCurrentLayer = "satellite";
        } else {
          riderJobMap.removeLayer(riderJobSatGroup);
          riderJobStreetLayer.addTo(riderJobMap);
          riderJobCurrentLayer = "street";
        }
        document.querySelectorAll("[data-rider-job-layer]").forEach((b) => {
          const isActive = b.getAttribute("data-rider-job-layer") === layerType;
          b.classList.toggle("active", isActive);
          if (isActive) {
            b.style.background = "#f97316";
            b.style.color = "#fff";
          } else {
            b.style.background = "transparent";
            b.style.color = "#475569";
          }
        });
      });
    });

    // Recenter GPS Button
    const recenterBtn = document.getElementById("rider-job-recenter-btn");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!riderJobMap) return;
        if (lastRiderGpsPos) {
          riderJobMap.flyTo([lastRiderGpsPos.lat, lastRiderGpsPos.lng], 16, { duration: 0.8 });
        } else if (currentRider && currentRider.last_lat && currentRider.last_lng) {
          riderJobMap.flyTo([currentRider.last_lat, currentRider.last_lng], 16, { duration: 0.8 });
        } else if (riderJobRouteLine) {
          riderJobMap.fitBounds(riderJobRouteLine.getBounds(), { padding: [40, 40] });
        }
      });
    }

    // Fit Route Button
    const fitRouteBtn = document.getElementById("rider-job-fit-route-btn");
    if (fitRouteBtn) {
      fitRouteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!riderJobMap) return;
        if (riderJobRouteLine) {
          riderJobMap.fitBounds(riderJobRouteLine.getBounds(), { padding: [40, 40] });
        } else if (activeJob && activeJob.pickup_lat && activeJob.dropoff_lat) {
          const bounds = L.latLngBounds(
            [activeJob.pickup_lat, activeJob.pickup_lng],
            [activeJob.dropoff_lat, activeJob.dropoff_lng]
          );
          riderJobMap.fitBounds(bounds, { padding: [40, 40] });
        }
      });
    }

    // Fullscreen Toggle Button
    const fsBtn = document.getElementById("rider-job-fullscreen-btn");
    const container = document.getElementById("rider-job-map-container");
    if (fsBtn && container) {
      fsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isFs = container.classList.toggle("is-fullscreen");
        fsBtn.innerHTML = isFs ? "<span>✕</span>" : "<span>⛶</span>";
        setTimeout(() => {
          if (riderJobMap) riderJobMap.invalidateSize();
        }, 200);
      });
    }
  }

  function updateRiderLiveMarkerOnJobMap(lat, lng, speed = 0, serverHeading = 0) {
    if (!lat || !lng) return;
    if (!riderJobMap) return;

    if (serverHeading && serverHeading > 0) {
      currentRiderBearing = Math.round(serverHeading);
    } else if (lastRiderGpsPos) {
      const distDelta = Math.hypot(lat - lastRiderGpsPos.lat, lng - lastRiderGpsPos.lng);
      if (distDelta > 0.00006) {
        currentRiderBearing = Math.round(calculateRiderBearing(lastRiderGpsPos.lat, lastRiderGpsPos.lng, lat, lng));
      }
    }
    lastRiderGpsPos = { lat, lng, speed, heading: currentRiderBearing };

    const speedDisplay = (speed && speed > 2) ? `${Math.round(speed)} km/h` : '';

    const bikeIcon = L.divIcon({
      className: "ccrc-rider-3d-marker",
      html: `
        <div class="rider-3d-wrap">
          <div class="rider-radar-pulse"></div>
          <div class="rider-heading-cone" style="transform: rotate(${currentRiderBearing}deg);"></div>
          <div class="rider-3d-avatar" title="${escapeHtml(currentRider?.name || 'Ikaw (Rider)')}">
            <span>🏍️</span>
          </div>
          ${speedDisplay ? `<span class="rider-speed-badge">${speedDisplay}</span>` : ''}
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    if (!riderJobRiderMarker) {
      riderJobRiderMarker = L.marker([lat, lng], { icon: bikeIcon, zIndexOffset: 1000 })
        .addTo(riderJobMap)
        .bindPopup(`<strong>🛵 ${escapeHtml(currentRider?.name || 'Ikaw (Rider)')}</strong><br>Imong live GPS lokasyon`);
    } else {
      riderJobRiderMarker.setIcon(bikeIcon);
      riderJobRiderMarker.setLatLng([lat, lng]);
    }
  }

  function renderJobOnRiderMap(job) {
    if (!job) {
      if (riderJobPickupMarker && riderJobMap) { riderJobMap.removeLayer(riderJobPickupMarker); riderJobPickupMarker = null; }
      if (riderJobDropoffMarker && riderJobMap) { riderJobMap.removeLayer(riderJobDropoffMarker); riderJobDropoffMarker = null; }
      if (riderJobRouteLine && riderJobMap) { riderJobMap.removeLayer(riderJobRouteLine); riderJobRouteLine = null; }
      currentJobIdOnMap = null;
      return;
    }

    initRiderJobMap();
    if (!riderJobMap) return;

    // Invalidate map size so tiles load properly
    setTimeout(() => {
      if (riderJobMap) riderJobMap.invalidateSize();
    }, 150);

    const hasNewJob = currentJobIdOnMap !== job.id;
    currentJobIdOnMap = job.id;

    // Check if coordinates need resolving
    if ((!job.pickup_lat || !job.dropoff_lat) && (job.pickup_address || job.dropoff_address)) {
      fetch("/api/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_address: job.pickup_address,
          dropoff_address: job.dropoff_address,
          service_type: job.service_type || "pahatud",
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.resolved_pickup && data.resolved_dropoff) {
            job.pickup_lat = data.resolved_pickup.lat;
            job.pickup_lng = data.resolved_pickup.lng;
            job.dropoff_lat = data.resolved_dropoff.lat;
            job.dropoff_lng = data.resolved_dropoff.lng;
            renderJobOnRiderMap(job);
          }
        })
        .catch(() => {});
    }

    // 1. Pickup Pin (Green 🟢)
    if (job.pickup_lat && job.pickup_lng) {
      const greenIcon = L.divIcon({
        className: "custom-pin",
        html: `<div style="background:#16a34a;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,0.35);border:2.5px solid #fff;">🟢</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      if (!riderJobPickupMarker) {
        riderJobPickupMarker = L.marker([job.pickup_lat, job.pickup_lng], { icon: greenIcon })
          .addTo(riderJobMap)
          .bindPopup(`<strong>🟢 Pickup / Tindahan:</strong><br>${escapeHtml(job.pickup_address)}`);
      } else {
        riderJobPickupMarker.setLatLng([job.pickup_lat, job.pickup_lng]);
        riderJobPickupMarker.setPopupContent(`<strong>🟢 Pickup / Tindahan:</strong><br>${escapeHtml(job.pickup_address)}`);
      }
    }

    // 2. Dropoff Pin (Red 🏁)
    if (job.dropoff_lat && job.dropoff_lng) {
      const redIcon = L.divIcon({
        className: "custom-pin",
        html: `<div style="background:#dc2626;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,0.35);border:2.5px solid #fff;">🏁</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      if (!riderJobDropoffMarker) {
        riderJobDropoffMarker = L.marker([job.dropoff_lat, job.dropoff_lng], { icon: redIcon })
          .addTo(riderJobMap)
          .bindPopup(`<strong>🏁 Dropoff / Destinasyon:</strong><br>${escapeHtml(job.dropoff_address)}`);
      } else {
        riderJobDropoffMarker.setLatLng([job.dropoff_lat, job.dropoff_lng]);
        riderJobDropoffMarker.setPopupContent(`<strong>🏁 Dropoff / Destinasyon:</strong><br>${escapeHtml(job.dropoff_address)}`);
      }
    }

    // 3. Road Route Polyline (Bold Red Line)
    if (job.pickup_lat && job.dropoff_lat && (hasNewJob || !riderJobRouteLine)) {
      const pLat = job.pickup_lat;
      const pLng = job.pickup_lng;
      const dLat = job.dropoff_lat;
      const dLng = job.dropoff_lng;

      // Temporary straight line while fetching road path
      if (riderJobRouteLine) riderJobMap.removeLayer(riderJobRouteLine);
      riderJobRouteLine = L.polyline(
        [
          [pLat, pLng],
          [dLat, dLng],
        ],
        { color: "#ef4444", weight: 5, opacity: 0.9 }
      ).addTo(riderJobMap);
      riderJobMap.fitBounds(riderJobRouteLine.getBounds(), { padding: [40, 40] });

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
            if (riderJobRouteLine) riderJobMap.removeLayer(riderJobRouteLine);
            riderJobRouteLine = L.polyline(roadCoords, {
              color: "#ef4444",
              weight: 5,
              opacity: 1.0,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(riderJobMap);
            riderJobMap.fitBounds(riderJobRouteLine.getBounds(), { padding: [40, 40] });
          }
          if (data && data.distance_km) {
            const distInfo = document.getElementById("rider-job-distance-info");
            if (distInfo) {
              const km = Number(data.distance_km).toFixed(1);
              const mins = Math.max(2, Math.round((data.distance_km / 30) * 60));
              distInfo.textContent = `📍 ${km} km (~${mins} mins biyahe)`;
            }
          }
        })
        .catch(() => {});
    }

    // 4. Update Rider live GPS marker if position is already known
    if (lastRiderGpsPos) {
      updateRiderLiveMarkerOnJobMap(lastRiderGpsPos.lat, lastRiderGpsPos.lng, lastRiderGpsPos.speed, lastRiderGpsPos.heading);
    } else if (currentRider && currentRider.last_lat && currentRider.last_lng) {
      updateRiderLiveMarkerOnJobMap(currentRider.last_lat, currentRider.last_lng, 0, 0);
    }

    // Prompt immediate GPS fix if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (currentRider) {
            currentRider.last_lat = pos.coords.latitude;
            currentRider.last_lng = pos.coords.longitude;
          }
          updateRiderLiveMarkerOnJobMap(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.heading);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
      );
    }
  }

  // Render Active Job Card
  function renderActiveJobCard(job) {
    if (!job) {
      if (activeJobBox) activeJobBox.classList.add("hidden");
      resetRiderChat(null);
      renderJobOnRiderMap(null);
      return;
    }
    resetRiderChat(job);

    if (activeJobBox) activeJobBox.classList.remove("hidden");
    if (activeJobCode) activeJobCode.textContent = job.booking_code;
    if (activeJobTitle) activeJobTitle.textContent = `${job.service_type.toUpperCase()} • ${job.dropoff_address}`;
    if (activeJobFare) activeJobFare.textContent = `Fare to Collect: ₱${Math.round(job.fare_amount)}`;
    if (activeJobPickup) activeJobPickup.textContent = job.pickup_address;
    if (activeJobDropoff) activeJobDropoff.textContent = job.dropoff_address;
    if (activeJobCustomer) activeJobCustomer.textContent = `${job.customer_name} (${job.customer_phone})`;
    const custBadgeEl = document.getElementById("active-job-customer-badge");
    if (custBadgeEl) {
      if (job.customer_verified) {
        custBadgeEl.innerHTML = `<span class="badge" style="background:#dcfce7;color:#15803d;font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:10px;border:1px solid #86efac;display:inline-flex;align-items:center;gap:4px;">🛡️ Verified Passenger ✓ ${job.customer_total_rides > 0 ? `(${job.customer_total_rides} completed trips)` : ''}</span>`;
      } else if (job.customer_total_rides > 0) {
        custBadgeEl.innerHTML = `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:0.75rem;padding:2px 8px;border-radius:10px;">👍 Repeat Passenger (${job.customer_total_rides} rides)</span>`;
      } else {
        custBadgeEl.innerHTML = `<span class="badge" style="background:#fef3c7;color:#b45309;font-size:0.75rem;padding:2px 8px;border-radius:10px;">👤 First-Time Passenger</span>`;
      }
    }
    if (activeJobCallBtn) activeJobCallBtn.href = `tel:${job.customer_phone}`;

    // Scheduled badge or Ongoing badge
    const badgeEl = document.getElementById("active-job-status-badge");
    if (badgeEl) {
      if (job.scheduled_at) {
        badgeEl.textContent = `📅 Advance Trip (${job.scheduled_at.replace('T', ' ')})`;
        badgeEl.className = "badge badge-primary";
      } else {
        badgeEl.textContent = "Ongoing Active Trip";
        badgeEl.className = "badge badge-success";
      }
    }

    // Navigation links
    if (navPickupBtn) {
      if (job.pickup_lat && job.pickup_lng) {
        navPickupBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${job.pickup_lat},${job.pickup_lng}`;
        navPickupBtn.classList.remove("hidden");
      } else {
        navPickupBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.pickup_address)}`;
      }
    }

    if (navDropoffBtn) {
      if (job.dropoff_lat && job.dropoff_lng) {
        navDropoffBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${job.dropoff_lat},${job.dropoff_lng}`;
        navDropoffBtn.classList.remove("hidden");
      } else {
        navDropoffBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.dropoff_address)}`;
      }
    }

    // Notes
    if (activeJobNotesWrap && activeJobNotes) {
      if (job.item_notes) {
        activeJobNotes.textContent = job.item_notes;
        if (activeJobBudget) {
          if (job.estimated_budget && job.estimated_budget > 0) {
            activeJobBudget.textContent = `Shopping Budget to Advance: ₱${job.estimated_budget}`;
          } else {
            activeJobBudget.textContent = "";
          }
        }
        activeJobNotesWrap.classList.remove("hidden");
      } else {
        activeJobNotesWrap.classList.add("hidden");
      }
    }

    // Action Step Buttons
    if (jobInProgressBtn && jobCompleteBtn) {
      if (job.status === "accepted") {
        jobInProgressBtn.classList.remove("hidden");
        jobCompleteBtn.classList.add("hidden");
      } else if (job.status === "in_progress") {
        jobInProgressBtn.classList.add("hidden");
        jobCompleteBtn.classList.remove("hidden");
      }
    }

    // Interactive Live GPS Route Map for Active Job
    renderJobOnRiderMap(job);
  }

  // Check Active Job
  async function checkActiveJob() {
    if (!currentRider) return;
    try {
      const res = await fetch(`/api/rider/active-job?rider_id=${currentRider.id}`);
      const data = await res.json();
      activeJob = data.job;
      const scheduledJobs = data.scheduled_jobs || [];

      // Render Scheduled Jobs Card & Reminder
      renderScheduledJobs(scheduledJobs);

      renderActiveJobCard(activeJob);
    } catch (_) {}
  }

  function renderScheduledJobs(jobs) {
    const card = document.getElementById("rider-scheduled-card");
    const countEl = document.getElementById("rider-scheduled-count");
    const listEl = document.getElementById("rider-scheduled-list");
    const banner = document.getElementById("advance-reminder-banner");
    const bannerTitle = document.getElementById("reminder-banner-title");
    const bannerSub = document.getElementById("reminder-banner-sub");
    const bannerBtn = document.getElementById("reminder-start-btn");

    if (!card || !listEl) return;

    if (!jobs || !jobs.length) {
      card.classList.add("hidden");
      if (banner) banner.classList.add("hidden");
      return;
    }

    card.classList.remove("hidden");
    if (countEl) countEl.textContent = jobs.length;

    let dueSoonJob = null;
    listEl.innerHTML = jobs.map(j => {
      let timeStr = j.scheduled_at;
      try {
        timeStr = new Date(j.scheduled_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
      } catch(_) {}

      const mins = j.minutes_left;
      let countdownBadge = "";
      if (mins !== null && mins !== undefined) {
        if (mins <= 0) {
          countdownBadge = `<span style="background:#dc2626;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:700;">🚨 DUE NOW</span>`;
          dueSoonJob = j;
        } else if (mins <= 30) {
          countdownBadge = `<span style="background:#ea580c;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:700;">⏰ Due in ${mins} mins</span>`;
          if (!dueSoonJob) dueSoonJob = j;
        } else {
          const hours = Math.floor(mins / 60);
          const remMins = mins % 60;
          countdownBadge = `<span style="background:#0284c7;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;">📅 in ${hours > 0 ? hours + 'h ' : ''}${remMins}m</span>`;
        }
      }

      return `
        <div style="background:white;padding:12px;border:1px solid #cbd5e1;border-radius:10px;display:grid;gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-family:monospace;font-size:0.95rem;">${escapeHtml(j.booking_code)}</strong>
              <span class="badge badge-accent" style="font-size:0.75rem;margin-left:4px;">${escapeHtml(j.service_type.toUpperCase())}</span>
            </div>
            ${countdownBadge}
          </div>
          <div style="font-size:0.84rem;color:#334155;">
            <div>📅 <strong>Pickup Time:</strong> ${timeStr}</div>
            <div>🟢 <strong>From:</strong> ${escapeHtml(j.pickup_address)}</div>
            <div>🏁 <strong>To:</strong> ${escapeHtml(j.dropoff_address)}</div>
            <div>👤 <strong>Passenger:</strong> ${escapeHtml(j.customer_name)} (${escapeHtml(j.customer_phone)})</div>
            <div style="font-weight:700;color:var(--primary);margin-top:2px;">Fare: ₱${Math.round(j.fare_amount)}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <a href="tel:${escapeHtml(j.customer_phone)}" class="btn btn-sm btn-outline" style="padding:4px 10px;font-size:0.78rem;">📞 Call</a>
            <a href="sms:${escapeHtml(j.customer_phone)}" class="btn btn-sm btn-outline" style="padding:4px 10px;font-size:0.78rem;">💬 SMS</a>
            <button type="button" class="btn btn-sm btn-primary" style="padding:4px 12px;font-size:0.78rem;margin-left:auto;" onclick="startScheduledJobNow(${j.id})">
              🚀 Start Trip Now
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Trigger Notification & Alarm if any job is due within 30 minutes!
    if (dueSoonJob && banner) {
      banner.classList.remove("hidden");
      if (bannerTitle) bannerTitle.textContent = `🚨 UPCOMING ADVANCE TRIP: ${dueSoonJob.booking_code}!`;
      if (bannerSub) bannerSub.textContent = `Pickup at ${dueSoonJob.pickup_address} ${dueSoonJob.minutes_left > 0 ? `in ~${dueSoonJob.minutes_left} minutes!` : 'NOW!'} Customer: ${dueSoonJob.customer_name}`;
      if (bannerBtn) bannerBtn.onclick = () => startScheduledJobNow(dueSoonJob.id);

      // Sound chime every 4 minutes if due soon
      const nowTs = Date.now();
      if (nowTs - lastReminderChimeTime > 240000) {
        lastReminderChimeTime = nowTs;
        if (window.playDispatchChime) window.playDispatchChime();
        if (navigator.vibrate) try { navigator.vibrate([300, 150, 300, 150, 500]); } catch(_) {}
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`CCRC Reminder: Advance Trip in ${dueSoonJob.minutes_left} mins!`, {
              body: `${dueSoonJob.booking_code} pickup at ${dueSoonJob.pickup_address} for ${dueSoonJob.customer_name}`,
              icon: "/static/icons/logo.png"
            });
          } catch(_) {}
        }
      }
    } else if (banner) {
      banner.classList.add("hidden");
    }
  }

  window.startScheduledJobNow = async function(bookingId) {
    if (!currentRider) return;
    if (!confirm("Are you ready to activate this scheduled trip now?")) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/start-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider_id: currentRider.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        checkActiveJob();
      } else {
        alert(data.error || "Could not activate trip.");
      }
    } catch (_) {
      alert("Network error activating trip.");
    }
  };

  // Step Progress Actions
  if (jobInProgressBtn) {
    jobInProgressBtn.addEventListener("click", async () => {
      if (!activeJob) return;
      const origText = jobInProgressBtn.textContent;
      jobInProgressBtn.disabled = true;
      jobInProgressBtn.textContent = "Updating status...";
      try {
        const res = await fetch(`/api/bookings/${activeJob.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_progress" }),
        });
        if (res.ok) {
          checkActiveJob();
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || "Could not update trip status.");
          jobInProgressBtn.textContent = origText;
        }
      } catch (_) {
        alert("Network error updating trip status. Please try again.");
        jobInProgressBtn.textContent = origText;
      } finally {
        jobInProgressBtn.disabled = false;
      }
    });
  }

  if (jobCompleteBtn) {
    jobCompleteBtn.addEventListener("click", async () => {
      if (!activeJob) return;
      if (!confirm("Are you sure this trip is completed and fare has been received?")) return;
      const origText = jobCompleteBtn.textContent;
      jobCompleteBtn.disabled = true;
      jobCompleteBtn.textContent = "Completing trip...";
      try {
        const res = await fetch(`/api/bookings/${activeJob.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
        if (res.ok) {
          alert("✓ Trip successfully marked as Completed! Thank you for your service.");
          activeJob = null;
          activeJobBox.classList.add("hidden");
          renderJobOnRiderMap(null);
          fetchAvailableJobs();
          loadRiderTransactions();
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || "Could not complete trip.");
          jobCompleteBtn.textContent = origText;
        }
      } catch (_) {
        alert("Network error completing trip. Please try again.");
        jobCompleteBtn.textContent = origText;
      } finally {
        jobCompleteBtn.disabled = false;
      }
    });
  }

  // Rider View Receipt Listener
  const riderViewReceiptBtn = document.getElementById("rider-view-receipt-btn");
  const riderReceiptModal = document.getElementById("rider-receipt-modal");
  if (riderViewReceiptBtn && riderReceiptModal) {
    riderViewReceiptBtn.addEventListener("click", () => {
      if (!activeJob) {
        alert("No active trip found.");
        return;
      }
      const codeEl = document.getElementById("r-modal-code");
      const custEl = document.getElementById("r-modal-customer");
      const srvEl = document.getElementById("r-modal-service");
      const kmEl = document.getElementById("r-modal-km");
      const payEl = document.getElementById("r-modal-payment");
      const totEl = document.getElementById("r-modal-total");

      if (codeEl) codeEl.textContent = activeJob.booking_code || "CCRC-0000";
      if (custEl) custEl.textContent = `${activeJob.customer_name || ''} (${activeJob.customer_phone || ''})`;
      if (srvEl) srvEl.textContent = (activeJob.service_type || "pahatud").toUpperCase();
      if (kmEl) kmEl.textContent = `${activeJob.estimated_km || 0} km`;
      if (payEl) payEl.textContent = (activeJob.payment_method || "CASH").toUpperCase();
      if (totEl) totEl.textContent = `₱${Number(activeJob.fare_amount || 0).toLocaleString()}`;
      
      const promoRow = document.getElementById("r-modal-promo-row");
      const promoDiscount = document.getElementById("r-modal-discount");
      if (activeJob.discount_amount && activeJob.discount_amount > 0) {
        if (promoDiscount) promoDiscount.textContent = `-₱${activeJob.discount_amount}`;
        promoRow?.classList.remove("hidden");
      } else {
        promoRow?.classList.add("hidden");
      }
      riderReceiptModal.classList.remove("hidden");
    });
  }

  // Rider Transactions & Earnings Ledger
  async function loadRiderTransactions() {
    if (!currentRider) return;
    try {
      const res = await fetch(`/api/rider/transactions?rider_id=${currentRider.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const todayEl = document.getElementById("rider-today-earnings");
      const alltimeEl = document.getElementById("rider-alltime-earnings");
      const countEl = document.getElementById("rider-txns-count");

      if (todayEl) todayEl.textContent = `₱${data.today_earnings.toFixed(2)}`;
      if (alltimeEl) alltimeEl.textContent = `₱${data.all_time_earnings.toFixed(2)}`;
      if (countEl) countEl.textContent = data.total_transactions;

      const bodyEl = document.getElementById("rider-txns-modal-body");
      if (bodyEl) {
        if (!data.transactions.length) {
          bodyEl.innerHTML = `<div class="text-muted" style="text-align:center;padding:24px;">No completed transactions recorded yet.<br>Complete trips to build your earnings record!</div>`;
          return;
        }
        bodyEl.innerHTML = `
          <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">
            <div><strong>Today:</strong> <span style="color:#16a34a;font-weight:700;">₱${data.today_earnings.toFixed(2)}</span></div>
            <div class="text-muted"><strong>Total:</strong> ₱${data.all_time_earnings.toFixed(2)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${data.transactions.map(t => `
              <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:700;color:#0f172a;">${escapeHtml(t.booking_code)} &bull; ${escapeHtml(t.service_type.toUpperCase())}</div>
                  <div class="text-muted" style="font-size:0.78rem;">Passenger: ${escapeHtml(t.customer_name)} ${t.customer_verified ? '🛡️✓' : ''}</div>
                  <div class="text-muted" style="font-size:0.75rem;">${t.created_at ? t.created_at.slice(0, 16).replace('T', ' ') : ''} &bull; <span style="text-transform:uppercase;">${escapeHtml(t.payment_method || 'CASH')}</span></div>
                </div>
                <div style="text-align:right;">
                  <strong style="color:var(--primary);font-size:1.05rem;">₱${Math.round(t.amount)}</strong>
                  <div><span class="badge ${t.status === 'completed' ? 'badge-success' : 'badge-warning'}" style="font-size:0.7rem;">${escapeHtml(t.status)}</span></div>
                </div>
              </div>
            `).join("")}
          </div>
        `;
      }
    } catch (_) {}
  }

  const openRiderTxnsBtn = document.getElementById("open-rider-txns-btn");
  const riderTxnsModal = document.getElementById("rider-transactions-modal");
  if (openRiderTxnsBtn && riderTxnsModal) {
    openRiderTxnsBtn.addEventListener("click", () => {
      loadRiderTransactions();
      riderTxnsModal.classList.remove("hidden");
    });
  }

  // Available Jobs Polling & Sound Chime Alert
  async function fetchAvailableJobs() {
    if (!onlineToggle.checked) return;
    try {
      const res = await fetch("/api/rider/available-jobs");
      if (!res.ok) return;
      const data = await res.json();
      const jobs = data.jobs || [];

      jobsCountPill.textContent = jobs.length;

      // Check if new incoming job arrived -> Play Sound Alert!
      let hasNewJob = false;
      jobs.forEach((j) => {
        if (!knownJobIds.has(j.id)) {
          hasNewJob = true;
          knownJobIds.add(j.id);
        }
      });

      if (hasNewJob && window.playDispatchChime) {
        window.playDispatchChime();
      }

      if (!jobs.length) {
        jobsFeedList.innerHTML = `
          <div class="empty-state">
            <span style="font-size:2rem;display:block;margin-bottom:6px;">📡</span>
            No bookings currently waiting in Camiguin.<br>
            <small class="text-muted">Your phone will chime with a sound alert when a customer books!</small>
          </div>
        `;
        return;
      }

      jobsFeedList.innerHTML = jobs
        .map(
          (j) => `
            <div class="job-card" data-job-id="${j.id}">
              <div class="job-card-top">
                <span class="badge badge-accent">${escapeHtml(j.service_type.toUpperCase())}</span>
                <span class="job-fare-tag">₱${Math.round(j.fare_amount)}</span>
              </div>
              <div class="job-route-preview">
                <div>🟢 <strong>From:</strong> ${escapeHtml(j.pickup_address)}</div>
                <div>🏁 <strong>To:</strong> ${escapeHtml(j.dropoff_address)}</div>
                ${j.scheduled_at ? `<div style="background:#eff6ff;color:#1d4ed8;padding:4px 8px;border-radius:6px;font-size:0.8rem;font-weight:700;margin-top:6px;">📅 Scheduled Pickup: ${new Date(j.scheduled_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>` : ""}
                ${j.payment_method ? `<div style="font-size:0.78rem;color:#475569;margin-top:2px;">💳 Payment: <strong style="text-transform:uppercase;">${escapeHtml(j.payment_method)}</strong></div>` : ""}
                ${j.item_notes ? `<div style="margin-top:4px;color:#64748b;font-size:0.82rem;">🛒 <em>&ldquo;${escapeHtml(j.item_notes)}&rdquo;</em></div>` : ""}
                ${j.estimated_budget ? `<div style="color:#d97706;font-size:0.8rem;font-weight:700;">Advance Cash: ₱${j.estimated_budget}</div>` : ""}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;gap:8px;">
                <div>
                  <div class="text-muted" style="font-size:0.82rem;font-weight:600;">👤 ${escapeHtml(j.customer_name)}</div>
                  ${j.customer_verified ? `
                    <span class="badge" style="background:#dcfce7;color:#15803d;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px;border:1px solid #86efac;display:inline-flex;align-items:center;gap:4px;margin-top:2px;">
                      🛡️ Verified Passenger ✓ ${j.customer_total_rides > 0 ? `(${j.customer_total_rides} completed)` : ''}
                    </span>
                  ` : (j.customer_total_rides > 0 ? `
                    <span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:0.72rem;padding:2px 6px;border-radius:8px;margin-top:2px;">
                      👍 Repeat Passenger (${j.customer_total_rides} rides)
                    </span>
                  ` : `
                    <span class="badge" style="background:#fef3c7;color:#b45309;font-size:0.72rem;padding:2px 6px;border-radius:8px;margin-top:2px;">
                      👤 First-Time Passenger
                    </span>
                  `)}
                </div>
                <button type="button" class="btn btn-primary btn-sm accept-job-btn" data-id="${j.id}">
                  Accept This Booking 🛵
                </button>
              </div>
            </div>
          `
        )
        .join("");
    } catch (_) {}
  }

  // Accept Booking Action
  if (jobsFeedList) {
    jobsFeedList.addEventListener("click", async (e) => {
      const btn = e.target.closest(".accept-job-btn");
      if (!btn || !currentRider) return;

      const jobId = btn.getAttribute("data-id");
      btn.disabled = true;
      btn.textContent = "Accepting...";

      try {
        const res = await fetch(`/api/bookings/${jobId}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rider_id: currentRider.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Could not claim booking.");
        }

        if (window.playDispatchChime) window.playDispatchChime();
        if (data.job) {
          activeJob = data.job;
          renderActiveJobCard(data.job);
        }
        checkActiveJob();
        fetchAvailableJobs();
      } catch (err) {
        alert(err.message);
        fetchAvailableJobs();
      }
    });
  }

  if (refreshJobsBtn) {
    refreshJobsBtn.addEventListener("click", fetchAvailableJobs);
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
  // Rider Live Chat with Customer
  // ---------------------------------------------------------------------------
  const riderChatBox = document.getElementById("rider-chat-messages-box");
  const riderChatForm = document.getElementById("rider-chat-form");
  const riderChatInput = document.getElementById("rider-chat-input-field");
  const riderChatCustName = document.getElementById("rider-chat-cust-name");
  const riderChatEmptyHint = document.getElementById("rider-chat-empty-hint");
  const riderCannedBtns = document.querySelectorAll("#rider-canned-replies .canned-btn");
  let riderLastMessageId = 0;
  let riderChatPollTimer = null;
  let currentActiveJobId = null;

  function playRiderBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 60, 100]);
      }
    } catch (_) {}
  }

  function appendRiderChatMessage(msg, isSelf) {
    if (riderChatEmptyHint) riderChatEmptyHint.style.display = "none";

    const wrap = document.createElement("div");
    wrap.className = `chat-bubble-wrap ${isSelf ? "self" : "other"}`;

    const sender = isSelf ? "You (Rider)" : (msg.sender_name || "Customer");
    const roleIcon = isSelf ? "🛵" : "👤";
    const timeStr = msg.created_at ? msg.created_at.slice(11, 16) : "";

    wrap.innerHTML = `
      <span class="chat-sender-label">${roleIcon} ${escapeHtml(sender)}</span>
      <div class="chat-bubble">
        ${escapeHtml(msg.message)}
        <span class="chat-time">${timeStr}</span>
      </div>
    `;

    riderChatBox.appendChild(wrap);
    riderChatBox.scrollTop = riderChatBox.scrollHeight;
  }

  async function pollRiderChat() {
    if (!activeJob) return;
    try {
      const res = await fetch(`/api/chat/${activeJob.id}/messages?after=${riderLastMessageId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.messages && data.messages.length > 0) {
        let hasIncomingFromCustomer = false;
        for (const msg of data.messages) {
          if (msg.id > riderLastMessageId) {
            riderLastMessageId = msg.id;
            const isSelf = (msg.sender_role === "rider");
            appendRiderChatMessage(msg, isSelf);
            if (!isSelf) hasIncomingFromCustomer = true;
          }
        }
        if (hasIncomingFromCustomer) {
          playRiderBeep();
        }
      }
    } catch (_) {}
  }

  async function sendRiderMessage(text) {
    if (!text || !text.trim() || !activeJob) return;
    const msgText = text.trim();
    if (riderChatInput) riderChatInput.value = "";

    try {
      const res = await fetch(`/api/chat/${activeJob.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_role: "rider",
          sender_name: currentRider ? currentRider.name : "Kuya Rider",
          message: msgText,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.message) {
          if (data.message.id > riderLastMessageId) {
            riderLastMessageId = data.message.id;
            appendRiderChatMessage(data.message, true);
          }
        }
      }
    } catch (_) {}
  }

  if (riderChatForm) {
    riderChatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (riderChatInput) sendRiderMessage(riderChatInput.value);
    });
  }

  riderCannedBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const msg = btn.getAttribute("data-msg");
      if (msg) sendRiderMessage(msg);
    });
  });

  function resetRiderChat(job) {
    if (!job) {
      if (riderChatPollTimer) clearInterval(riderChatPollTimer);
      return;
    }
    if (currentActiveJobId !== job.id) {
      currentActiveJobId = job.id;
      riderLastMessageId = 0;
      if (riderChatBox) riderChatBox.innerHTML = "";
      if (riderChatEmptyHint) {
        riderChatEmptyHint.style.display = "block";
        riderChatBox.appendChild(riderChatEmptyHint);
      }
      if (riderChatCustName) riderChatCustName.textContent = job.customer_name || "Passenger";
    }
    pollRiderChat();
    if (!riderChatPollTimer) {
      riderChatPollTimer = setInterval(pollRiderChat, 2500);
    }
  }


  // ---------------------------------------------------------------------------
  // Fellow Online Riders (Kauban nga Online) Roster & Radar Map
  // ---------------------------------------------------------------------------
  const coRidersList = document.getElementById("co-riders-list");
  const coRidersCountPill = document.getElementById("co-riders-count-pill");
  const toggleRadarMapBtn = document.getElementById("toggle-radar-map-btn");
  const radarMapContainer = document.getElementById("radar-map-container");
  const radarMapEl = document.getElementById("co-riders-radar-map");

  let radarMap = null;
  let radarMarkers = {};

  let radarStreetLayer = null;
  let radarSatGroup = null;
  let radarCurrentLayer = "street";

  function initRadarMap() {
    if (!radarMapEl || radarMap || typeof L === "undefined") return;
    const CAMIGUIN_BOUNDS = [
      [9.0500, 124.5800],
      [9.2900, 124.8300]
    ];

    radarMap = L.map(radarMapEl, {
      minZoom: 11,
      maxZoom: 19,
      maxBounds: CAMIGUIN_BOUNDS,
      maxBoundsViscosity: 1.0,
      bounceAtZoomLimits: true
    }).fitBounds(CAMIGUIN_BOUNDS);

    radarStreetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    });

    const satImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri',
    });
    const satLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      pane: "overlayPane",
    });
    radarSatGroup = L.layerGroup([satImagery, satLabels]);

    radarStreetLayer.addTo(radarMap);

    // Radar Layer Switcher Buttons
    document.querySelectorAll("[data-radar-layer]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const layerType = btn.getAttribute("data-radar-layer");
        if (layerType === radarCurrentLayer) return;
        if (layerType === "satellite") {
          radarMap.removeLayer(radarStreetLayer);
          radarSatGroup.addTo(radarMap);
          radarCurrentLayer = "satellite";
        } else {
          radarMap.removeLayer(radarSatGroup);
          radarStreetLayer.addTo(radarMap);
          radarCurrentLayer = "street";
        }
        document.querySelectorAll("[data-radar-layer]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-radar-layer") === layerType);
        });
      });
    });

    // Radar Recenter Button
    const recenterBtn = document.getElementById("radar-recenter-btn");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (radarMap) {
          if (currentRider && currentRider.last_lat && currentRider.last_lng) {
            radarMap.flyTo([currentRider.last_lat, currentRider.last_lng], 14, { duration: 1.0 });
          } else {
            radarMap.flyTo([9.2000, 124.7200], 11, { duration: 1.0 });
          }
        }
      });
    }
  }

  if (toggleRadarMapBtn && radarMapContainer) {
    toggleRadarMapBtn.addEventListener("click", () => {
      const isHidden = radarMapContainer.classList.contains("hidden");
      if (isHidden) {
        radarMapContainer.classList.remove("hidden");
        toggleRadarMapBtn.textContent = "✕ Close Map";
        initRadarMap();
        setTimeout(() => {
          if (radarMap) radarMap.invalidateSize();
        }, 150);
      } else {
        radarMapContainer.classList.add("hidden");
        toggleRadarMapBtn.textContent = "🗺️ Radar Map";
      }
    });
  }

  async function fetchCoRiders() {
    if (!currentRider) return;
    try {
      const res = await fetch(`/api/rider/co-riders?rider_id=${currentRider.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = data.co_riders || [];

      if (coRidersCountPill) {
        coRidersCountPill.textContent = `${list.length} Online`;
      }

      if (!coRidersList) return;

      if (list.length === 0) {
        coRidersList.innerHTML = `
          <div class="empty-state" style="padding:1rem;">
            <span class="text-muted">Ikaw pa lang ang online rider karon. Paabota ang imong mga kauban!</span>
          </div>
        `;
        return;
      }

      coRidersList.innerHTML = list.map((r) => {
        const isSelf = r.is_self;
        const avatarHtml = r.avatar_url
          ? `<img src="${escapeHtml(r.avatar_url)}" alt="${escapeHtml(r.name)}" class="co-rider-avatar">`
          : `<div class="co-rider-avatar-placeholder">🛵</div>`;

        const selfBadge = isSelf ? `<span class="badge badge-accent" style="font-size:0.7rem;padding:2px 7px;">Ikaw</span>` : '';
        const town = escapeHtml(r.municipality || 'Camiguin');
        const phoneBtn = (!isSelf && r.phone)
          ? `<a href="tel:${escapeHtml(r.phone)}" class="btn btn-sm btn-outline" style="font-size:0.75rem;padding:4px 9px;" title="Call Rider">📞 Tawag</a>`
          : '';

        return `
          <div class="co-rider-item ${isSelf ? 'is-self' : ''}">
            ${avatarHtml}
            <div class="co-rider-info">
              <div class="co-rider-name-row">
                <span class="co-rider-name">${escapeHtml(r.name)}</span>
                ${selfBadge}
              </div>
              <div class="co-rider-sub">
                🏍️ ${escapeHtml(r.bike_model)} &bull; Plate: <strong>${escapeHtml(r.plate_number)}</strong>
              </div>
              <span class="co-rider-town">📍 ${town}</span>
            </div>
            <div class="co-rider-actions">
              ${phoneBtn}
            </div>
          </div>
        `;
      }).join("");

      // Update Radar Map Pins if map initialized
      if (radarMap) {
        const activeIds = new Set();
        list.forEach((r) => {
          if (r.last_lat && r.last_lng) {
            activeIds.add(r.id);
            const isSelf = r.is_self;
            const iconHtml = isSelf
              ? `<div style="background:#f97316;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🛵</div>`
              : `<div style="background:#16a34a;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🟢</div>`;

            const customIcon = L.divIcon({
              className: "co-rider-radar-pin",
              html: iconHtml,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            });

            if (!radarMarkers[r.id]) {
              radarMarkers[r.id] = L.marker([r.last_lat, r.last_lng], { icon: customIcon })
                .addTo(radarMap)
                .bindPopup(`<strong>${escapeHtml(r.name)}</strong><br>${escapeHtml(r.bike_model)} (${escapeHtml(r.plate_number)})<br>📍 ${escapeHtml(r.municipality)}`);
            } else {
              radarMarkers[r.id].setLatLng([r.last_lat, r.last_lng]);
            }
          }
        });

        // Remove old markers
        Object.keys(radarMarkers).forEach((id) => {
          if (!activeIds.has(parseInt(id))) {
            radarMap.removeLayer(radarMarkers[id]);
            delete radarMarkers[id];
          }
        });
      }
    } catch (_) {}
  }

  // On Load: Check stored session
  window.addEventListener("DOMContentLoaded", () => {
    const saved = getStoredRider();
    if (saved) {
      initRiderSession(saved);
    }
  });
})();
