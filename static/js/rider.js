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

  // Switch between Login and Register Forms
  if (switchToRegisterBtn) {
    switchToRegisterBtn.addEventListener("click", () => {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
    });
  }
  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener("click", () => {
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
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
        if (!res.ok) throw new Error(data.error || "Login failed");

        if (data.pending) {
          alert(data.message || "Registration submitted! Your application is now PENDING APPROVAL by the Club Admin.");
          // Switch to login tab
          registerForm.classList.add("hidden");
          loginForm.classList.remove("hidden");
          return;
        }
        setStoredRider(data.rider);
        initRiderSession(data.rider);
      } catch (err) {
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

    // Strictly hide "Book a Ride" from nav & header when rider is logged in
    document.querySelectorAll(".nav-book-item, #nav-book-link, #bottom-nav-book").forEach((el) => {
      el.style.display = "none";
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

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      if (onlineToggle.checked) {
        fetchAvailableJobs();
        if (activeJob) checkActiveJob();
      }
    }, 3500);
  }

  // Online / Offline Toggle
  if (onlineToggle) {
    onlineToggle.addEventListener("change", async () => {
      const isOnline = onlineToggle.checked;
      updateOnlineBadge(isOnline);
      try {
        await fetch("/api/rider/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rider_id: currentRider.id, is_online: isOnline }),
        });
        if (isOnline) {
          fetchAvailableJobs();
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
        },
        () => {
          forceGpsBtn.textContent = "Sync GPS";
          alert("Could not retrieve GPS coordinates. Please grant Location permission.");
        }
      );
    });
  }

  // Check Active Job
  async function checkActiveJob() {
    if (!currentRider) return;
    try {
      const res = await fetch(`/api/rider/active-job?rider_id=${currentRider.id}`);
      const data = await res.json();
      activeJob = data.job;

      if (!activeJob) {
        activeJobBox.classList.add("hidden");
        resetRiderChat(null);
        return;
      }
      resetRiderChat(activeJob);

      activeJobBox.classList.remove("hidden");
      activeJobCode.textContent = activeJob.booking_code;
      activeJobTitle.textContent = `${activeJob.service_type.toUpperCase()} • ${activeJob.dropoff_address}`;
      activeJobFare.textContent = `Fare to Collect: ₱${Math.round(activeJob.fare_amount)}`;
      activeJobPickup.textContent = activeJob.pickup_address;
      activeJobDropoff.textContent = activeJob.dropoff_address;
      activeJobCustomer.textContent = `${activeJob.customer_name} (${activeJob.customer_phone})`;
      activeJobCallBtn.href = `tel:${activeJob.customer_phone}`;

      // Navigation links
      if (activeJob.pickup_lat && activeJob.pickup_lng) {
        navPickupBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${activeJob.pickup_lat},${activeJob.pickup_lng}`;
        navPickupBtn.classList.remove("hidden");
      } else {
        navPickupBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeJob.pickup_address)}`;
      }

      if (activeJob.dropoff_lat && activeJob.dropoff_lng) {
        navDropoffBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${activeJob.dropoff_lat},${activeJob.dropoff_lng}`;
        navDropoffBtn.classList.remove("hidden");
      } else {
        navDropoffBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeJob.dropoff_address)}`;
      }

      // Notes
      if (activeJob.item_notes) {
        activeJobNotes.textContent = activeJob.item_notes;
        if (activeJob.estimated_budget && activeJob.estimated_budget > 0) {
          activeJobBudget.textContent = `Shopping Budget to Advance: ₱${activeJob.estimated_budget}`;
        } else {
          activeJobBudget.textContent = "";
        }
        activeJobNotesWrap.classList.remove("hidden");
      } else {
        activeJobNotesWrap.classList.add("hidden");
      }

      // Action Step Buttons
      if (activeJob.status === "accepted") {
        jobInProgressBtn.classList.remove("hidden");
        jobCompleteBtn.classList.add("hidden");
      } else if (activeJob.status === "in_progress") {
        jobInProgressBtn.classList.add("hidden");
        jobCompleteBtn.classList.remove("hidden");
      }
    } catch (_) {}
  }

  // Step Progress Actions
  if (jobInProgressBtn) {
    jobInProgressBtn.addEventListener("click", async () => {
      if (!activeJob) return;
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
        }
      } catch (_) {}
      jobInProgressBtn.disabled = false;
    });
  }

  if (jobCompleteBtn) {
    jobCompleteBtn.addEventListener("click", async () => {
      if (!activeJob) return;
      if (!confirm("Are you sure this trip is completed and fare has been received?")) return;
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
          fetchAvailableJobs();
        }
      } catch (_) {}
      jobCompleteBtn.disabled = false;
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
                ${j.item_notes ? `<div style="margin-top:4px;color:#64748b;font-size:0.82rem;">🛒 <em>&ldquo;${escapeHtml(j.item_notes)}&rdquo;</em></div>` : ""}
                ${j.estimated_budget ? `<div style="color:#d97706;font-size:0.8rem;font-weight:700;">Advance Cash: ₱${j.estimated_budget}</div>` : ""}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                <span class="text-muted" style="font-size:0.8rem;">👤 ${escapeHtml(j.customer_name)}</span>
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
        alert("🎉 Success! You have accepted this booking. Please proceed with the trip.");
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

  // On Load: Check stored session
  window.addEventListener("DOMContentLoaded", () => {
    const saved = getStoredRider();
    if (saved) {
      initRiderSession(saved);
    }
  });
})();
