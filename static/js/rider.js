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
  const activeJobGroupBadge = document.getElementById("active-job-group-badge");
  const activeJobGroupBanner = document.getElementById("active-job-group-banner");
  const activeJobTitle = document.getElementById("active-job-title");
  const activeJobFare = document.getElementById("active-job-fare");
  const activeJobPickup = document.getElementById("active-job-pickup");
  const activeJobDropoff = document.getElementById("active-job-dropoff");
  const activeJobNotes = document.getElementById("active-job-notes");
  const activeJobNotesWrap = document.getElementById("active-job-notes-wrap");
  const activeJobBudget = document.getElementById("active-job-budget");
  const activeJobCustomer = document.getElementById("active-job-customer");
  const activeJobCallBtn = document.getElementById("active-job-call-btn");
  const activeJobInappCallBtn = document.getElementById("active-job-inapp-call-btn");
  const riderChatInappCallBtn = document.getElementById("rider-chat-inapp-call-btn");
  const riderChatVoiceBtn = document.getElementById("rider-chat-voice-btn");
  const riderChatVoiceBar = document.getElementById("rider-chat-voice-recording-bar");
  const riderChatVoiceTimer = document.getElementById("rider-chat-voice-timer");
  const riderChatVoiceCancelBtn = document.getElementById("rider-chat-voice-cancel-btn");
  const riderChatVoiceSendBtn = document.getElementById("rider-chat-voice-send-btn");
  const riderChatPhotoBtn = document.getElementById("rider-chat-photo-btn");
  const riderChatPhotoInput = document.getElementById("rider-chat-photo-input");
  const riderChatPhotoPreviewBar = document.getElementById("rider-chat-photo-preview-bar");
  const riderChatPhotoPreviewThumb = document.getElementById("rider-chat-photo-preview-thumb");
  const riderChatPhotoCaptionInput = document.getElementById("rider-chat-photo-caption-input");
  const riderChatPhotoCancelBtn = document.getElementById("rider-chat-photo-cancel-btn");
  const riderChatPhotoSendBtn = document.getElementById("rider-chat-photo-send-btn");
  let pendingRiderChatPhotoDataUrl = "";
  let isSendingRiderChatPhoto = false;

  function clearRiderChatPhotoPreview() {
    pendingRiderChatPhotoDataUrl = "";
    if (riderChatPhotoInput) riderChatPhotoInput.value = "";
    if (riderChatPhotoCaptionInput) riderChatPhotoCaptionInput.value = "";
    if (riderChatPhotoPreviewThumb) riderChatPhotoPreviewThumb.removeAttribute("src");
    if (riderChatPhotoPreviewBar) riderChatPhotoPreviewBar.classList.add("hidden");
    if (riderChatPhotoSendBtn) {
      riderChatPhotoSendBtn.disabled = false;
      riderChatPhotoSendBtn.textContent = (typeof window.ccrcT === "function") ? window.ccrcT("Send Photo ✈️") : "Send Photo ✈️";
    }
  }
  const navPickupBtn = document.getElementById("nav-pickup-btn");
  const navDropoffBtn = document.getElementById("nav-dropoff-btn");
  const jobInProgressBtn = document.getElementById("job-in-progress-btn");
  const jobCompleteBtn = document.getElementById("job-complete-btn");
  const jobTransferBtn = document.getElementById("job-transfer-btn");
  const jobTransferTopBtn = document.getElementById("job-transfer-top-btn");
  const jobGcashTopBtn = document.getElementById("job-gcash-top-btn");
  const activeJobGcashBox = document.getElementById("active-job-gcash-box");
  const activeJobGcashStatusPill = document.getElementById("active-job-gcash-status-pill");
  const activeJobGcashAmount = document.getElementById("active-job-gcash-amount");
  const activeJobGcashRef = document.getElementById("active-job-gcash-ref");
  const jobShowGcashQrBtn = document.getElementById("job-show-gcash-qr-btn");
  const riderGcashGateHint = document.getElementById("rider-gcash-gate-hint");

  const gcashSetupModal = document.getElementById("rider-gcash-setup-modal");
  const openGcashSetupBtn = document.getElementById("open-rider-gcash-setup-btn");
  const gcashSetupForm = document.getElementById("rider-gcash-setup-form");
  const gcashSetupNumberInput = document.getElementById("gcash-setup-number");
  const gcashSetupQrFileInput = document.getElementById("gcash-setup-qr-file");
  const gcashSetupQrPreview = document.getElementById("gcash-setup-qr-preview");
  const gcashSetupQrPlaceholder = document.getElementById("gcash-setup-qr-placeholder");
  const gcashSetupClearQrBtn = document.getElementById("gcash-setup-clear-qr-btn");
  const gcashSetupMsg = document.getElementById("gcash-setup-msg");
  const gcashSetupSaveBtn = document.getElementById("gcash-setup-save-btn");

  const gcashQrModal = document.getElementById("rider-gcash-qr-modal");
  const rGcashConfirmBtn = document.getElementById("r-gcash-confirm-btn");
  const rGcashConfirmRefInput = document.getElementById("r-gcash-confirm-ref");
  const rGcashOfflineChk = document.getElementById("r-gcash-offline-chk");
  const rGcashConfirmError = document.getElementById("r-gcash-confirm-error");
  const rGcashQuickUploadBtn = document.getElementById("r-gcash-quick-upload-btn");

  const transferModal = document.getElementById("rider-transfer-modal");
  const transferModalSubtitle = document.getElementById("transfer-modal-job-subtitle");
  const transferReasonSelect = document.getElementById("transfer-reason-select");
  const transferNoteInput = document.getElementById("transfer-note-input");
  const transferUpdateGpsChk = document.getElementById("transfer-update-gps-chk");
  const transferGoOfflineChk = document.getElementById("transfer-go-offline-chk");
  const transferStatusError = document.getElementById("transfer-status-error");
  const transferCoridersList = document.getElementById("transfer-coriders-list");
  const transferRefreshCoridersBtn = document.getElementById("transfer-refresh-coriders-btn");
  const transferRebroadcastBtn = document.getElementById("transfer-rebroadcast-btn");

  const jobsFeedList = document.getElementById("available-jobs-feed");
  const jobsCountPill = document.getElementById("jobs-count-pill");
  const refreshJobsBtn = document.getElementById("refresh-jobs-btn");

  const tRider = (str) => (typeof window.ccrcT === "function" ? window.ccrcT(str) : str);

  let currentRider = null;
  let activeJob = null;
  let currentScheduledJobs = [];
  let transferTargetJob = null;
  let transferHighlightRiderId = null;
  let cachedCoRiders = [];
  let knownJobKeys = new Set();
  let prevActiveJobKey = null;
  let prevGcashPayStatus = null;
  let reopenQrAfterSetup = false;
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

  function readQrImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Invalid image file. Please select a PNG, JPG, or WebP screenshot."));
        img.onload = () => {
          const maxDim = 900;
          let w = img.width || 600;
          let h = img.height || 600;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.max(1, Math.round((h * maxDim) / w));
              w = maxDim;
            } else {
              w = Math.max(1, Math.round((w * maxDim) / h));
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          let dataUrl = canvas.toDataURL("image/png");
          if (dataUrl.length > 2_300_000) {
            dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          }
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function syncRiderVoiceCallContext() {
    const liveJob = (currentRider && activeJob && ["accepted", "in_progress"].includes(activeJob.status))
      ? activeJob
      : null;
    const schedJob = (!liveJob && currentRider && currentScheduledJobs && currentScheduledJobs.length > 0 && ["accepted", "in_progress"].includes(currentScheduledJobs[0].status))
      ? currentScheduledJobs[0]
      : null;
    const targetJob = liveJob || schedJob;
    const canCall = Boolean(targetJob);

    if (activeJobInappCallBtn) {
      activeJobInappCallBtn.classList.toggle("hidden", !liveJob);
    }
    if (riderChatInappCallBtn) {
      riderChatInappCallBtn.classList.toggle("hidden", !liveJob);
    }
    if (window.CCRCVoiceCall && typeof window.CCRCVoiceCall.configure === "function") {
      window.CCRCVoiceCall.configure({
        role: "rider",
        riderId: currentRider ? currentRider.id : null,
        bookingRef: targetJob ? targetJob.id : null,
        bookingCode: targetJob ? (targetJob.booking_code || "") : "",
        peerName: targetJob ? (targetJob.customer_name || "Passenger") : "Passenger",
        peerPhone: targetJob ? (targetJob.customer_phone || "") : "",
        peerRoleLabel: "Passenger",
        canCall: canCall,
        onFallbackVoiceNote: () => {
          const card = document.querySelector(".rider-chat-card");
          if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
          if (riderChatVoiceBtn) riderChatVoiceBtn.focus();
        },
      });
    }
  }

  window.startCoRiderInAppCall = function (riderId, name, phone, town) {
    if (window.CCRCVoiceCall && typeof window.CCRCVoiceCall.startRiderCall === "function") {
      window.CCRCVoiceCall.startRiderCall(riderId, name, phone, town);
    }
  };

  if (activeJobInappCallBtn) {
    activeJobInappCallBtn.addEventListener("click", () => {
      if (window.CCRCVoiceCall) window.CCRCVoiceCall.startCall();
    });
  }
  if (riderChatInappCallBtn) {
    riderChatInappCallBtn.addEventListener("click", () => {
      if (window.CCRCVoiceCall) window.CCRCVoiceCall.startCall();
    });
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
        forgotStatusMsg.textContent = "New password and confirmation password do not match.";
        forgotStatusMsg.classList.remove("hidden");
        return;
      }

      resetBtn.disabled = true;
      resetBtn.textContent = "Verifying and saving...";

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
        forgotStatusMsg.innerHTML = "✅ <strong>Success!</strong> " + (data.message || "Your password has been reset.") + "<br><small>Redirecting you to Log In...</small>";
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
        resetBtn.textContent = "Save New Password →";
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
            loginErrorMsg.innerHTML = "⏳ <strong>ACCOUNT PENDING APPROVAL</strong><br>" + (data.error || "Please visit the CCRC Club Admin in person with your Driver's License, OR/CR, and motorcycle for inspection and account activation.");
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

  // Optional Registration GCash QR Upload (sharp resolution)
  let regGcashQrBase64 = "";
  const regGcashQrInput = document.getElementById("reg-gcash-qr-file");
  const regGcashQrPreview = document.getElementById("reg-gcash-qr-preview");
  const regGcashQrPlaceholder = document.getElementById("reg-gcash-qr-placeholder");

  if (regGcashQrInput) {
    regGcashQrInput.addEventListener("change", async function () {
      const file = this.files && this.files[0];
      if (!file) {
        regGcashQrBase64 = "";
        if (regGcashQrPreview) regGcashQrPreview.classList.add("hidden");
        if (regGcashQrPlaceholder) regGcashQrPlaceholder.classList.remove("hidden");
        return;
      }
      try {
        regGcashQrBase64 = await readQrImageAsDataUrl(file);
        if (regGcashQrPreview) {
          regGcashQrPreview.src = regGcashQrBase64;
          regGcashQrPreview.classList.remove("hidden");
        }
        if (regGcashQrPlaceholder) regGcashQrPlaceholder.classList.add("hidden");
      } catch (err) {
        regGcashQrBase64 = "";
        alert(err.message || "Could not load QR image.");
      }
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
        gcash_number: (document.getElementById("reg-gcash-number")?.value || "").trim(),
      };
      if (regGcashQrBase64) {
        payload.gcash_qr_base64 = regGcashQrBase64;
      }

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
          alert("✅ Your Rider Application has been submitted!\n\nStatus: PENDING APPROVAL\n\nPlease visit the CCRC Club Admin in person with your:\n1. Driver's License\n2. Motorcycle OR/CR\n3. Motorcycle for physical inspection\n\nOnce approved by Admin, you can log in here.");
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
            loginErrorMsg.innerHTML = "⏳ <strong>Application Submitted (PENDING APPROVAL)</strong><br>Please visit the CCRC Club Admin in person with your Driver's License, OR/CR, and motorcycle for inspection and activation.";
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

  let sessionExpiredHandled = false;

  function handleExpiredRiderSession() {
    if (sessionExpiredHandled) return;
    sessionExpiredHandled = true;
    if (gpsWatchId) {
      try { navigator.geolocation.clearWatch(gpsWatchId); } catch (_) {}
      gpsWatchId = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    resetRiderChat(null);
    activeJob = null;
    currentScheduledJobs = [];
    transferTargetJob = null;
    transferHighlightRiderId = null;
    cachedCoRiders = [];
    prevActiveJobKey = null;
    prevGcashPayStatus = null;
    knownJobKeys.clear();
    if (transferModal) transferModal.classList.add("hidden");
    if (gcashSetupModal) gcashSetupModal.classList.add("hidden");
    if (gcashQrModal) gcashQrModal.classList.add("hidden");
    currentRider = null;
    syncRiderVoiceCallContext();
    setStoredRider(null);
    document.documentElement.classList.remove("is-rider-session");
    document.body.classList.remove("rider-logged-in");
    if (dashSection) dashSection.classList.add("hidden");
    if (authSection) authSection.classList.remove("hidden");
    const bLogout = document.getElementById("bottom-nav-rider-logout");
    if (bLogout) bLogout.classList.add("hidden");
    const hLogout = document.getElementById("header-rider-logout-btn");
    if (hLogout) hLogout.classList.add("hidden");
    if (loginErrorMsg) {
      loginErrorMsg.style.color = "";
      loginErrorMsg.style.backgroundColor = "";
      loginErrorMsg.style.borderColor = "";
      loginErrorMsg.textContent = "Your rider session has expired. Please log in again.";
      loginErrorMsg.classList.remove("hidden");
    }
  }

  // Unified Logout Handler
  async function handleRiderLogout() {
    if (confirm("Are you sure you want to log out of your Rider Account?")) {
      setStoredRider(null);
      document.documentElement.classList.remove("is-rider-session");
      document.body.classList.remove("rider-logged-in");
      if (gpsWatchId) {
        try { navigator.geolocation.clearWatch(gpsWatchId); } catch (_) {}
        gpsWatchId = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      resetRiderChat(null);
      activeJob = null;
      currentScheduledJobs = [];
      transferTargetJob = null;
      transferHighlightRiderId = null;
      cachedCoRiders = [];
      prevActiveJobKey = null;
      prevGcashPayStatus = null;
      knownJobKeys.clear();
      if (transferModal) transferModal.classList.add("hidden");
      if (gcashSetupModal) gcashSetupModal.classList.add("hidden");
      if (gcashQrModal) gcashQrModal.classList.add("hidden");
      currentRider = null;
      syncRiderVoiceCallContext();
      try {
        await fetch("/api/rider/logout", { method: "POST" });
      } catch (_) {}
      window.location.href = "/";
    }
  }

  window.ccrcRiderLogout = handleRiderLogout;

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleRiderLogout);
  }
  const bottomRiderRefresh = document.getElementById("bottom-rider-refresh-btn");
  if (bottomRiderRefresh) {
    bottomRiderRefresh.addEventListener("click", fetchAvailableJobs);
  }

  function renderRiderGcashProfileCard() {
    if (!currentRider) return;
    const thumbEl = document.getElementById("dash-gcash-qr-thumb");
    const fallbackEl = document.getElementById("dash-gcash-qr-fallback");
    const statusEl = document.getElementById("dash-gcash-status-text");

    const qrUrl = String(currentRider.gcash_qr_url || "").trim();
    const gNum = String(currentRider.gcash_number || "").trim();

    if (thumbEl && fallbackEl) {
      if (qrUrl) {
        if (thumbEl.getAttribute("src") !== qrUrl) {
          thumbEl.src = qrUrl;
        }
        thumbEl.classList.remove("hidden");
        fallbackEl.classList.add("hidden");
      } else {
        thumbEl.classList.add("hidden");
        thumbEl.removeAttribute("src");
        fallbackEl.classList.remove("hidden");
      }
    }

    if (statusEl) {
      if (qrUrl && gNum) {
        statusEl.textContent = `${tRider("Ready ✓ GCash:")} ${gNum} • ${tRider("QR code uploaded")}`;
      } else if (qrUrl) {
        statusEl.textContent = tRider("QR code uploaded ✓ — Add your GCash mobile number so customers can copy it.");
      } else if (gNum) {
        statusEl.textContent = `${tRider("GCash Number:")} ${gNum} — ${tRider("Please upload your GCash QR code image.")}`;
      } else {
        statusEl.textContent = tRider("No GCash QR uploaded yet — upload your QR so customers can pay via GCash.");
      }
    }
  }

  function initRiderSession(rider) {
    sessionExpiredHandled = false;
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
    const dashClubId = document.getElementById("dash-rider-club-id");
    if (dashClubId && rider.id) {
      dashClubId.textContent = `CCRC-${String(Number(rider.id) || 0).padStart(4, "0")}`;
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

    renderRiderGcashProfileCard();

    // Online switch state
    onlineToggle.checked = rider.is_online === 1;
    updateOnlineBadge(rider.is_online === 1);

    // Start background GPS transmitter
    startGpsBeacon();

    // Activate voice call polling (including Rider-to-Rider incoming calls)
    syncRiderVoiceCallContext();

    // Check active job and start polling available jobs
    checkActiveJob();
    fetchAvailableJobs();
    fetchCoRiders();
    loadRiderTransactions();
    loadRiderReviews();

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      checkActiveJob();
      fetchCoRiders();
      if (onlineToggle.checked) {
        fetchAvailableJobs();
      }
    }, 3500);
  }

  async function loadRiderReviews() {
    if (!currentRider || !currentRider.id) return;
    const badgeEl = document.getElementById("dash-rider-rating-badge");
    const summaryPill = document.getElementById("rider-reviews-summary-pill");
    const listEl = document.getElementById("rider-reviews-list");
    try {
      const res = await fetch(`/api/reviews/${currentRider.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const avg = Number(data.rating_avg || currentRider.rating_avg || 5.0).toFixed(1);
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (badgeEl) badgeEl.textContent = `⭐ ${avg}`;
      if (summaryPill) summaryPill.textContent = `⭐ ${avg} (${reviews.length} review${reviews.length === 1 ? "" : "s"})`;
      if (!listEl) return;

      listEl.innerHTML = "";
      if (reviews.length === 0) {
        const empty = document.createElement("div");
        empty.className = "text-muted";
        empty.style.cssText = "font-size:0.85rem;padding:8px 0;";
        empty.textContent = "No customer reviews yet. Complete trips to start receiving 5-star ratings!";
        listEl.appendChild(empty);
        return;
      }

      reviews.forEach((rv) => {
        const item = document.createElement("div");
        item.style.cssText = "background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;";
        const topRow = document.createElement("div");
        topRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;";
        const nameEl = document.createElement("strong");
        nameEl.style.fontSize = "0.86rem";
        nameEl.textContent = rv.customer_name || "Island Passenger";
        const starsEl = document.createElement("span");
        starsEl.style.cssText = "color:#d97706;font-weight:700;font-size:0.82rem;";
        const count = Math.max(1, Math.min(5, Number(rv.rating || 5)));
        starsEl.textContent = "★".repeat(count) + "☆".repeat(5 - count);
        topRow.appendChild(nameEl);
        topRow.appendChild(starsEl);
        item.appendChild(topRow);

        if (rv.comment) {
          const commentEl = document.createElement("div");
          commentEl.style.cssText = "font-size:0.84rem;color:#334155;line-height:1.4;";
          commentEl.textContent = rv.comment;
          item.appendChild(commentEl);
        }

        if (rv.created_at) {
          const dateEl = document.createElement("div");
          dateEl.className = "text-muted";
          dateEl.style.cssText = "font-size:0.74rem;margin-top:4px;";
          dateEl.textContent = String(rv.created_at).slice(0, 16).replace("T", " ");
          item.appendChild(dateEl);
        }
        listEl.appendChild(item);
      });
    } catch (_) {}
  }

  // Online / Offline Toggle
  if (onlineToggle) {
    onlineToggle.addEventListener("change", async () => {
      if (!currentRider) return;
      const isOnline = onlineToggle.checked;
      updateOnlineBadge(isOnline);
      if (isOnline && "Notification" in window && Notification.permission === "default") {
        try { Notification.requestPermission(); } catch(_) {}
      }
      try {
        const res = await fetch("/api/rider/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rider_id: currentRider.id, is_online: isOnline }),
        });
        if (res.status === 401) {
          onlineToggle.checked = !isOnline;
          updateOnlineBadge(!isOnline);
          handleExpiredRiderSession();
          return;
        }
        if (!res.ok) {
          onlineToggle.checked = !isOnline;
          updateOnlineBadge(!isOnline);
          return;
        }
        if (currentRider) {
          currentRider.is_online = isOnline ? 1 : 0;
          setStoredRider(currentRider);
        }
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
      if (!currentRider) return;
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
      })
        .then((res) => {
          if (res.status === 401) handleExpiredRiderSession();
        })
        .catch(() => {});
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
          <div class="rider-3d-avatar" title="${escapeHtml(currentRider?.name || 'You (Rider)')}">
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
        .bindPopup(`<strong>🛵 ${escapeHtml(currentRider?.name || 'You (Rider)')}</strong><br>Your live GPS location`);
    } else {
      riderJobRiderMarker.setIcon(bikeIcon);
      riderJobRiderMarker.setLatLng([lat, lng]);
    }
  }

  function calculateHaversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371.0;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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

    const jobMapKey = `${job.id}:${job.pickup_lat || ""},${job.pickup_lng || ""}`;
    const hasNewJob = currentJobIdOnMap !== jobMapKey;
    currentJobIdOnMap = jobMapKey;

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
          const rKm = data && (data.road_km ?? data.distance_km);
          if (rKm) {
            const distInfo = document.getElementById("rider-job-distance-info");
            if (distInfo) {
              const km = Number(rKm).toFixed(1);
              const mins = Math.max(2, Math.round((rKm / 30) * 60));
              distInfo.textContent = `📍 ${km} km (~${mins} mins trip)`;
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

  function syncActiveJobGcashState(job) {
    if (!job) {
      if (jobGcashTopBtn) jobGcashTopBtn.classList.add("hidden");
      if (activeJobGcashBox) activeJobGcashBox.classList.add("hidden");
      if (riderGcashGateHint) riderGcashGateHint.classList.add("hidden");
      if (jobCompleteBtn) {
        jobCompleteBtn.classList.remove("btn-complete-locked");
        if (!jobCompleteBtn.disabled) {
          jobCompleteBtn.textContent = tRider("✓ Delivered (Mark as Completed)");
        }
      }
      if (gcashQrModal && !reopenQrAfterSetup) {
        gcashQrModal.classList.add("hidden");
      }
      return;
    }

    const isGcash = String(job.payment_method || "").toLowerCase() === "gcash";
    const pStat = String(job.payment_status || "pending").toLowerCase();
    const isPaid = pStat === "paid";
    const isLocked = isGcash && !isPaid;

    if (jobGcashTopBtn) {
      jobGcashTopBtn.classList.toggle("hidden", !isGcash);
    }
    if (activeJobGcashBox) {
      activeJobGcashBox.classList.toggle("hidden", !isGcash);
    }

    if (isGcash) {
      if (activeJobGcashAmount) {
        activeJobGcashAmount.textContent = `₱${Math.round(Number(job.fare_amount || 0)).toLocaleString()}`;
      }
      if (activeJobGcashStatusPill) {
        if (isPaid) {
          activeJobGcashStatusPill.className = "gcash-status-pill paid";
          activeJobGcashStatusPill.textContent = tRider("✅ GCash Paid & Confirmed");
        } else if (pStat === "customer_sent") {
          activeJobGcashStatusPill.className = "gcash-status-pill sent";
          activeJobGcashStatusPill.textContent = tRider("📲 Customer Sent — Verify Now");
        } else {
          activeJobGcashStatusPill.className = "gcash-status-pill pending";
          activeJobGcashStatusPill.textContent = tRider("⏳ Waiting Customer GCash");
        }
      }
      if (activeJobGcashRef) {
        if (job.payment_ref) {
          activeJobGcashRef.textContent = `Ref: ${job.payment_ref}`;
          activeJobGcashRef.classList.remove("hidden");
        } else {
          activeJobGcashRef.textContent = "Ref: -";
          activeJobGcashRef.classList.add("hidden");
        }
      }
      if (jobShowGcashQrBtn) {
        if (isPaid) {
          jobShowGcashQrBtn.textContent = tRider("✓ GCash Verified (View QR)");
        } else if (pStat === "customer_sent") {
          jobShowGcashQrBtn.textContent = tRider("✓ Verify Customer GCash / QR");
        } else {
          jobShowGcashQrBtn.textContent = tRider("📱 Show My GCash QR");
        }
      }
    }

    if (jobCompleteBtn) {
      jobCompleteBtn.classList.toggle("btn-complete-locked", isLocked);
      if (!jobCompleteBtn.disabled) {
        jobCompleteBtn.textContent = isLocked
          ? tRider("🔒 Locked Until GCash Paid (Show QR / Confirm)")
          : tRider("✓ Delivered (Mark as Completed)");
      }
    }
    if (riderGcashGateHint) {
      riderGcashGateHint.classList.toggle("hidden", !(isLocked && job.status === "in_progress"));
    }
  }

  // Render Active Job Card
  function renderActiveJobCard(job) {
    if (!job) {
      if (activeJobBox) activeJobBox.classList.add("hidden");
      if (activeJobGroupBadge) activeJobGroupBadge.classList.add("hidden");
      if (activeJobGroupBanner) {
        activeJobGroupBanner.classList.add("hidden");
        activeJobGroupBanner.innerHTML = "";
      }
      if (jobTransferTopBtn) jobTransferTopBtn.classList.add("hidden");
      if (jobTransferBtn) jobTransferBtn.classList.add("hidden");
      syncActiveJobGcashState(null);
      if (transferModal && (!transferTargetJob || !transferTargetJob._fromScheduledList)) {
        transferModal.classList.add("hidden");
      }
      resetRiderChat(null);
      renderJobOnRiderMap(null);
      renderCoRidersList(cachedCoRiders);
      syncRiderVoiceCallContext();
      return;
    }
    resetRiderChat(job);

    if (activeJobBox) activeJobBox.classList.remove("hidden");
    if (activeJobCode) activeJobCode.textContent = job.booking_code;

    const groupSize = Number(job.group_size || 1);
    const isGroup = groupSize > 1 && Boolean(job.group_code);
    const slotNum = Number(job.rider_slot || 1);
    if (activeJobGroupBadge) {
      if (isGroup) {
        activeJobGroupBadge.textContent = `👥 Group ${job.group_code} • Rider ${slotNum}/${groupSize}`;
        activeJobGroupBadge.classList.remove("hidden");
      } else {
        activeJobGroupBadge.classList.add("hidden");
      }
    }
    if (activeJobGroupBanner) {
      if (isGroup) {
        const joinedCount = Number(job.group_assigned_count || 1);
        const totalGroupFare = Math.round(Number(job.group_total_fare || Number(job.fare_amount || 0) * groupSize)).toLocaleString();
        activeJobGroupBanner.innerHTML = `Group Code: <strong>${escapeHtml(job.group_code)}</strong> &bull; Rider <strong>${slotNum} of ${groupSize}</strong> &bull; Joined: <strong>${joinedCount}/${groupSize}</strong> &bull; Your Slot Fare: <strong>₱${Math.round(Number(job.fare_amount || 0)).toLocaleString()}</strong> <small>(Group Total: ₱${totalGroupFare})</small>`;
        activeJobGroupBanner.classList.remove("hidden");
      } else {
        activeJobGroupBanner.classList.add("hidden");
        activeJobGroupBanner.innerHTML = "";
      }
    }

    const transferAlert = document.getElementById("active-job-transfer-alert");
    const transferMeta = document.getElementById("active-job-transfer-meta");
    if (transferAlert && transferMeta) {
      if (Number(job.transfer_count || 0) > 0) {
        const fromName = job.transferred_from_rider_name || "a fellow rider";
        const reasonPart = job.transfer_reason ? ` (${job.transfer_reason})` : "";
        transferMeta.textContent = `Handed over from ${fromName}${reasonPart}. Fare stays ₱${Math.round(job.fare_amount)}.`;
        transferAlert.classList.remove("hidden");
      } else {
        transferAlert.classList.add("hidden");
      }
    }

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
    const canTransferActive = ["accepted", "in_progress"].includes(job.status);
    if (jobTransferBtn) {
      jobTransferBtn.classList.toggle("hidden", !canTransferActive);
    }
    if (jobTransferTopBtn) {
      jobTransferTopBtn.classList.toggle("hidden", !canTransferActive);
    }

    syncActiveJobGcashState(job);

    // Interactive Live GPS Route Map for Active Job
    renderJobOnRiderMap(job);
    renderCoRidersList(cachedCoRiders);
    syncRiderVoiceCallContext();
  }

  // Check Active Job
  async function checkActiveJob() {
    if (!currentRider) return;
    try {
      const res = await fetch(`/api/rider/active-job?rider_id=${currentRider.id}`);
      if (res.status === 401) {
        handleExpiredRiderSession();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.authenticated === false) {
        handleExpiredRiderSession();
        return;
      }
      if (data.rider && currentRider) {
        currentRider = Object.assign({}, currentRider, data.rider);
        setStoredRider(currentRider);
        renderRiderGcashProfileCard();
      }
      const nextJob = data.job;
      const nextKey = nextJob ? `${nextJob.id}:${nextJob.transfer_count || 0}:${nextJob.status}` : null;
      const isIncomingTransfer = Boolean(
        nextJob
        && Number(nextJob.transfer_count || 0) > 0
        && nextKey !== prevActiveJobKey
        && (!activeJob || activeJob.id !== nextJob.id || Number(activeJob.transfer_count || 0) !== Number(nextJob.transfer_count || 0))
      );
      const nextPayKey = nextJob
        ? `${nextJob.id}:${String(nextJob.payment_status || "pending").toLowerCase()}`
        : null;
      const becameCustomerSent = Boolean(
        nextJob
        && String(nextJob.payment_method || "").toLowerCase() === "gcash"
        && String(nextJob.payment_status || "").toLowerCase() === "customer_sent"
        && nextPayKey !== prevGcashPayStatus
      );
      prevGcashPayStatus = nextPayKey;
      prevActiveJobKey = nextKey;
      activeJob = nextJob;
      const scheduledJobs = data.scheduled_jobs || [];
      currentScheduledJobs = scheduledJobs;

      // Render Scheduled Jobs Card & Reminder
      renderScheduledJobs(scheduledJobs);

      renderActiveJobCard(activeJob);

      if (gcashQrModal && !gcashQrModal.classList.contains("hidden")) {
        if (activeJob && String(activeJob.payment_method || "").toLowerCase() === "gcash") {
          renderRiderGcashQrModal();
        } else if (!reopenQrAfterSetup) {
          gcashQrModal.classList.add("hidden");
        }
      }

      if (becameCustomerSent) {
        playRiderBeep();
      }

      if (isIncomingTransfer) {
        if (window.playDispatchChime) window.playDispatchChime();
        if ("vibrate" in navigator) {
          try { navigator.vibrate([120, 60, 120, 60, 180]); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  const scheduledListEl = document.getElementById("rider-scheduled-list");
  if (scheduledListEl) {
    scheduledListEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".scheduled-transfer-btn");
      if (!btn) return;
      const bId = Number(btn.getAttribute("data-booking-id"));
      const target = currentScheduledJobs.find((item) => Number(item.id) === bId);
      if (target) {
        openEmergencyTransferModal(Object.assign({ _fromScheduledList: true }, target), null);
      }
    });
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

      const groupSize = Number(j.group_size || 1);
      const isGroup = groupSize > 1 && Boolean(j.group_code);
      return `
        <div style="background:white;padding:12px;border:1px solid #cbd5e1;border-radius:10px;display:grid;gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <strong style="font-family:monospace;font-size:0.95rem;">${escapeHtml(j.booking_code)}</strong>
              <span class="badge badge-accent" style="font-size:0.75rem;">${escapeHtml(j.service_type.toUpperCase())}</span>
              ${isGroup ? `<span class="badge" style="background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;font-size:0.72rem;font-weight:700;">👥 ${escapeHtml(j.group_code)} &bull; Rider ${Number(j.rider_slot || 1)}/${groupSize}</span>` : ""}
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
          <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;align-items:center;">
            <a href="tel:${escapeHtml(j.customer_phone)}" class="btn btn-sm btn-outline" style="padding:4px 10px;font-size:0.78rem;">📞 Call</a>
            <a href="sms:${escapeHtml(j.customer_phone)}" class="btn btn-sm btn-outline" style="padding:4px 10px;font-size:0.78rem;">💬 SMS</a>
            <button type="button" class="btn btn-sm btn-transfer-emergency scheduled-transfer-btn" data-booking-id="${j.id}" style="padding:4px 10px;font-size:0.78rem;">
              🔄 Transfer to Rider
            </button>
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
              icon: "/static/icons/logo.png?v=3"
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
        if (res.status === 401) {
          handleExpiredRiderSession();
          return;
        }
        if (res.ok) {
          checkActiveJob();
          fetchCoRiders();
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || "Could not update trip status.");
        }
      } catch (_) {
        alert("Network error updating trip status. Please try again.");
      } finally {
        jobInProgressBtn.textContent = origText;
        jobInProgressBtn.disabled = false;
      }
    });
  }

  if (jobCompleteBtn) {
    jobCompleteBtn.addEventListener("click", async () => {
      if (!activeJob) return;
      const isGcash = String(activeJob.payment_method || "").toLowerCase() === "gcash";
      const pStat = String(activeJob.payment_status || "pending").toLowerCase();
      if (isGcash && pStat !== "paid") {
        openRiderGcashQrModal();
        return;
      }
      if (!confirm("Are you sure this trip is completed and fare has been received?")) return;
      jobCompleteBtn.disabled = true;
      jobCompleteBtn.textContent = "Completing trip...";
      try {
        const res = await fetch(`/api/bookings/${activeJob.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
        if (res.status === 401) {
          handleExpiredRiderSession();
          return;
        }
        if (res.ok) {
          alert("✓ Trip successfully marked as Completed! Thank you for your service.");
          activeJob = null;
          prevActiveJobKey = null;
          prevGcashPayStatus = null;
          activeJobBox.classList.add("hidden");
          syncActiveJobGcashState(null);
          resetRiderChat(null);
          renderJobOnRiderMap(null);
          checkActiveJob();
          fetchAvailableJobs();
          fetchCoRiders();
          loadRiderTransactions();
          loadRiderReviews();
        } else {
          const errData = await res.json().catch(() => ({}));
          if (errData && errData.requires_gcash_payment) {
            await checkActiveJob();
            openRiderGcashQrModal();
            return;
          }
          alert(errData.error || "Could not complete trip.");
        }
      } catch (_) {
        alert("Network error completing trip. Please try again.");
      } finally {
        const lockedNow = Boolean(
          activeJob
          && String(activeJob.payment_method || "").toLowerCase() === "gcash"
          && String(activeJob.payment_status || "pending").toLowerCase() !== "paid"
        );
        jobCompleteBtn.classList.toggle("btn-complete-locked", lockedNow);
        jobCompleteBtn.textContent = lockedNow
          ? tRider("🔒 Locked Until GCash Paid (Show QR / Confirm)")
          : tRider("✓ Delivered (Mark as Completed)");
        jobCompleteBtn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Rider Official GCash QR Setup & Collect Payment Modal Workflows
  // ---------------------------------------------------------------------------
  let setupQrPendingBase64 = null;
  let setupQrPendingClear = false;

  function showGcashSetupMessage(text, isError) {
    if (!gcashSetupMsg) return;
    if (!text) {
      gcashSetupMsg.classList.add("hidden");
      gcashSetupMsg.textContent = "";
      return;
    }
    gcashSetupMsg.classList.remove("hidden");
    gcashSetupMsg.style.background = isError ? "#fee2e2" : "#dcfce7";
    gcashSetupMsg.style.color = isError ? "#991b1b" : "#166534";
    gcashSetupMsg.style.border = isError ? "1px solid #fca5a5" : "1px solid #86efac";
    gcashSetupMsg.textContent = text;
  }

  function renderGcashSetupPreview(qrSrc) {
    const cleanSrc = String(qrSrc || "").trim();
    if (gcashSetupQrPreview && gcashSetupQrPlaceholder) {
      if (cleanSrc) {
        gcashSetupQrPreview.src = cleanSrc;
        gcashSetupQrPreview.classList.remove("hidden");
        gcashSetupQrPlaceholder.classList.add("hidden");
      } else {
        gcashSetupQrPreview.classList.add("hidden");
        gcashSetupQrPreview.removeAttribute("src");
        gcashSetupQrPlaceholder.classList.remove("hidden");
      }
    }
    if (gcashSetupClearQrBtn) {
      gcashSetupClearQrBtn.classList.toggle("hidden", !cleanSrc);
    }
  }

  function openRiderGcashSetupModal(fromQrModal = false) {
    if (!currentRider || !gcashSetupModal) return;
    reopenQrAfterSetup = Boolean(fromQrModal);
    setupQrPendingBase64 = null;
    setupQrPendingClear = false;
    if (gcashSetupQrFileInput) gcashSetupQrFileInput.value = "";
    if (gcashSetupNumberInput) {
      gcashSetupNumberInput.value = currentRider.gcash_number || currentRider.phone || "";
    }
    showGcashSetupMessage("", false);
    renderGcashSetupPreview(currentRider.gcash_qr_url || "");
    gcashSetupModal.classList.remove("hidden");
  }

  if (openGcashSetupBtn) {
    openGcashSetupBtn.addEventListener("click", () => openRiderGcashSetupModal(false));
  }
  if (rGcashQuickUploadBtn) {
    rGcashQuickUploadBtn.addEventListener("click", () => {
      if (gcashQrModal) gcashQrModal.classList.add("hidden");
      openRiderGcashSetupModal(true);
    });
  }
  if (gcashSetupQrFileInput) {
    gcashSetupQrFileInput.addEventListener("change", async function () {
      const file = this.files && this.files[0];
      if (!file) return;
      showGcashSetupMessage("", false);
      try {
        setupQrPendingBase64 = await readQrImageAsDataUrl(file);
        setupQrPendingClear = false;
        renderGcashSetupPreview(setupQrPendingBase64);
      } catch (err) {
        setupQrPendingBase64 = null;
        showGcashSetupMessage(err.message || "Could not load QR image.", true);
      }
    });
  }
  if (gcashSetupClearQrBtn) {
    gcashSetupClearQrBtn.addEventListener("click", () => {
      setupQrPendingBase64 = null;
      setupQrPendingClear = true;
      if (gcashSetupQrFileInput) gcashSetupQrFileInput.value = "";
      renderGcashSetupPreview("");
    });
  }
  if (gcashSetupForm) {
    gcashSetupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentRider || !gcashSetupSaveBtn) return;
      const gcashNumVal = (gcashSetupNumberInput ? gcashSetupNumberInput.value : "").trim();
      const payload = { gcash_number: gcashNumVal };
      if (setupQrPendingClear) {
        payload.clear_qr = true;
      } else if (setupQrPendingBase64) {
        payload.gcash_qr_base64 = setupQrPendingBase64;
      }

      const origText = gcashSetupSaveBtn.textContent;
      gcashSetupSaveBtn.disabled = true;
      gcashSetupSaveBtn.textContent = tRider("Saving...");
      showGcashSetupMessage("", false);

      try {
        const res = await fetch("/api/rider/gcash-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 401) {
          if (gcashSetupModal) gcashSetupModal.classList.add("hidden");
          reopenQrAfterSetup = false;
          handleExpiredRiderSession();
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Could not save GCash details.");
        }
        if (data.rider) {
          currentRider = Object.assign({}, currentRider, data.rider);
          setStoredRider(currentRider);
        }
        renderRiderGcashProfileCard();
        setupQrPendingBase64 = null;
        setupQrPendingClear = false;
        showGcashSetupMessage(data.message || "GCash QR & payment details saved!", false);

        if (reopenQrAfterSetup && activeJob) {
          reopenQrAfterSetup = false;
          if (gcashSetupModal) gcashSetupModal.classList.add("hidden");
          openRiderGcashQrModal();
        } else {
          setTimeout(() => {
            if (gcashSetupModal) gcashSetupModal.classList.add("hidden");
          }, 800);
        }
      } catch (err) {
        showGcashSetupMessage(err.message || "Could not save GCash details.", true);
      } finally {
        gcashSetupSaveBtn.disabled = false;
        gcashSetupSaveBtn.textContent = origText;
      }
    });
  }

  function renderRiderGcashQrModal() {
    if (!gcashQrModal || !activeJob || !currentRider) return;
    const codeEl = document.getElementById("r-gcash-booking-code");
    const custEl = document.getElementById("r-gcash-cust-name");
    const amtEl = document.getElementById("r-gcash-amount");
    const pillEl = document.getElementById("r-gcash-status-pill");
    const refEl = document.getElementById("r-gcash-ref-display");
    const qrBoxEl = document.getElementById("r-gcash-qr-box");
    const qrImgEl = document.getElementById("r-gcash-qr-img");
    const numDispEl = document.getElementById("r-gcash-number-display");
    const missingBoxEl = document.getElementById("r-gcash-missing-box");
    const missingNumEl = document.getElementById("r-gcash-missing-number");
    const confirmSectionEl = document.getElementById("r-gcash-confirm-section");
    const offlineWrapEl = document.getElementById("r-gcash-offline-wrap");
    const paidDoneBoxEl = document.getElementById("r-gcash-paid-done-box");

    if (codeEl) {
      const gSize = Number(activeJob.group_size || 1);
      codeEl.textContent = gSize > 1
        ? `${activeJob.booking_code || "CCRC-0000"} (Rider ${Number(activeJob.rider_slot || 1)}/${gSize})`
        : (activeJob.booking_code || "CCRC-0000");
    }
    if (custEl) custEl.textContent = activeJob.customer_name || "Passenger";
    if (amtEl) amtEl.textContent = `₱${Math.round(Number(activeJob.fare_amount || 0)).toLocaleString()}`;

    const pStat = String(activeJob.payment_status || "pending").toLowerCase();
    const isPaid = pStat === "paid";

    if (pillEl) {
      if (isPaid) {
        pillEl.className = "gcash-status-pill paid";
        pillEl.textContent = tRider("✅ GCash Paid & Verified");
      } else if (pStat === "customer_sent") {
        pillEl.className = "gcash-status-pill sent";
        pillEl.textContent = tRider("📲 Customer Marked Payment Sent");
      } else {
        pillEl.className = "gcash-status-pill pending";
        pillEl.textContent = tRider("⏳ Waiting Customer GCash");
      }
    }

    if (refEl) {
      if (activeJob.payment_ref) {
        refEl.textContent = `Ref: ${activeJob.payment_ref}`;
        refEl.classList.remove("hidden");
      } else {
        refEl.textContent = "Ref: -";
        refEl.classList.add("hidden");
      }
    }

    const qrUrl = String(currentRider.gcash_qr_url || "").trim();
    const gNum = String(currentRider.gcash_number || currentRider.phone || "-").trim();

    if (qrUrl) {
      if (qrBoxEl) qrBoxEl.classList.remove("hidden");
      if (missingBoxEl) missingBoxEl.classList.add("hidden");
      if (qrImgEl && qrImgEl.getAttribute("src") !== qrUrl) {
        qrImgEl.src = qrUrl;
      }
      if (numDispEl) numDispEl.textContent = gNum;
    } else {
      if (qrBoxEl) qrBoxEl.classList.add("hidden");
      if (missingBoxEl) missingBoxEl.classList.remove("hidden");
      if (missingNumEl) missingNumEl.textContent = gNum;
    }

    if (confirmSectionEl) confirmSectionEl.classList.toggle("hidden", isPaid);
    if (paidDoneBoxEl) paidDoneBoxEl.classList.toggle("hidden", !isPaid);

    if (!isPaid) {
      if (offlineWrapEl) {
        offlineWrapEl.classList.toggle("hidden", pStat !== "pending");
      }
      if (
        rGcashConfirmRefInput
        && document.activeElement !== rGcashConfirmRefInput
        && !rGcashConfirmRefInput.dataset.dirty
      ) {
        rGcashConfirmRefInput.value = activeJob.payment_ref ? String(activeJob.payment_ref) : "";
      }
    }
  }

  function openRiderGcashQrModal() {
    if (!activeJob || !currentRider || !gcashQrModal) return;
    if (rGcashConfirmError) {
      rGcashConfirmError.textContent = "";
      rGcashConfirmError.classList.add("hidden");
    }
    if (rGcashConfirmRefInput) {
      delete rGcashConfirmRefInput.dataset.dirty;
      rGcashConfirmRefInput.value = activeJob.payment_ref ? String(activeJob.payment_ref) : "";
    }
    if (rGcashOfflineChk) {
      rGcashOfflineChk.checked = false;
    }
    renderRiderGcashQrModal();
    gcashQrModal.classList.remove("hidden");
  }

  if (jobShowGcashQrBtn) {
    jobShowGcashQrBtn.addEventListener("click", openRiderGcashQrModal);
  }
  if (jobGcashTopBtn) {
    jobGcashTopBtn.addEventListener("click", openRiderGcashQrModal);
  }
  if (rGcashConfirmRefInput) {
    rGcashConfirmRefInput.addEventListener("input", () => {
      rGcashConfirmRefInput.dataset.dirty = "1";
    });
  }
  if (rGcashConfirmBtn) {
    rGcashConfirmBtn.addEventListener("click", async () => {
      if (!activeJob || !currentRider) return;
      if (rGcashConfirmError) {
        rGcashConfirmError.textContent = "";
        rGcashConfirmError.classList.add("hidden");
      }
      const pStat = String(activeJob.payment_status || "pending").toLowerCase();
      const verifiedOffline = Boolean(rGcashOfflineChk && rGcashOfflineChk.checked);
      if (pStat === "pending" && !verifiedOffline) {
        if (rGcashConfirmError) {
          rGcashConfirmError.textContent = tRider(
            "Wait for the customer to mark payment as sent, or check 'Verified GCash receipt in person' if you saw the GCash transfer complete beside you."
          );
          rGcashConfirmError.classList.remove("hidden");
        }
        return;
      }

      const refVal = (rGcashConfirmRefInput ? rGcashConfirmRefInput.value : "").trim();
      rGcashConfirmBtn.disabled = true;
      rGcashConfirmBtn.textContent = tRider("Confirming...");

      try {
        const res = await fetch(`/api/bookings/${activeJob.id}/gcash/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_ref: refVal,
            verified_offline_receipt: verifiedOffline,
          }),
        });
        if (res.status === 401) {
          if (gcashQrModal) gcashQrModal.classList.add("hidden");
          handleExpiredRiderSession();
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Could not confirm GCash payment.");
        }
        if (rGcashConfirmRefInput) delete rGcashConfirmRefInput.dataset.dirty;
        activeJob = data.job || data.booking || activeJob;
        prevGcashPayStatus = `${activeJob.id}:${String(activeJob.payment_status || "paid").toLowerCase()}`;
        renderActiveJobCard(activeJob);
        renderRiderGcashQrModal();
        checkActiveJob();
      } catch (err) {
        if (rGcashConfirmError) {
          rGcashConfirmError.textContent = err.message || "Could not confirm GCash payment.";
          rGcashConfirmError.classList.remove("hidden");
        }
      } finally {
        rGcashConfirmBtn.disabled = false;
        rGcashConfirmBtn.textContent = tRider("✓ Confirm GCash Payment Received");
      }
    });
  }

  // Emergency Booking Transfer / Re-Broadcast Modal & Handlers
  function getCurrentRiderGpsForTransfer() {
    if (
      lastRiderGpsPos
      && Number.isFinite(Number(lastRiderGpsPos.lat))
      && Number.isFinite(Number(lastRiderGpsPos.lng))
    ) {
      return { lat: Number(lastRiderGpsPos.lat), lng: Number(lastRiderGpsPos.lng) };
    }
    if (
      currentRider
      && Number.isFinite(Number(currentRider.last_lat))
      && Number.isFinite(Number(currentRider.last_lng))
      && Number(currentRider.last_lat) !== 0
      && Number(currentRider.last_lng) !== 0
    ) {
      return { lat: Number(currentRider.last_lat), lng: Number(currentRider.last_lng) };
    }
    return null;
  }

  function isJobFutureScheduled(job) {
    if (!job || !job.scheduled_at || job.status === "in_progress") return false;
    try {
      const schedMs = new Date(job.scheduled_at).getTime();
      if (!Number.isFinite(schedMs)) return false;
      return (schedMs - Date.now()) / 60000 > 30;
    } catch (_) {
      return false;
    }
  }

  async function loadTransferCoRiders() {
    if (!transferCoridersList || !currentRider) return;
    transferCoridersList.innerHTML = `<div class="text-muted" style="font-size:0.84rem;text-align:center;padding:12px;">Checking online co-riders...</div>`;

    try {
      const res = await fetch(`/api/rider/co-riders?rider_id=${currentRider.id}`);
      if (res.status === 401) {
        handleExpiredRiderSession();
        return;
      }
      if (!res.ok) {
        throw new Error("Unable to load online co-riders.");
      }
      const data = await res.json();
      const rawList = Array.isArray(data.co_riders) ? data.co_riders : [];
      const targetJob = transferTargetJob || activeJob;
      const allowBusy = isJobFutureScheduled(targetJob);
      const refGps = getCurrentRiderGpsForTransfer()
        || (
          targetJob
          && Number.isFinite(Number(targetJob.pickup_lat))
          && Number.isFinite(Number(targetJob.pickup_lng))
          && Number(targetJob.pickup_lat) !== 0
            ? { lat: Number(targetJob.pickup_lat), lng: Number(targetJob.pickup_lng) }
            : null
        );

      const candidates = rawList
        .filter((r) => !r.is_self && Number(r.id) !== Number(currentRider.id))
        .map((r) => {
          let distKm = null;
          if (
            refGps
            && Number.isFinite(Number(r.last_lat))
            && Number.isFinite(Number(r.last_lng))
            && Number(r.last_lat) !== 0
          ) {
            distKm = calculateHaversineKm(refGps.lat, refGps.lng, Number(r.last_lat), Number(r.last_lng));
          }
          return { ...r, distKm };
        })
        .sort((a, b) => {
          if (transferHighlightRiderId) {
            const aSel = Number(a.id) === transferHighlightRiderId ? 1 : 0;
            const bSel = Number(b.id) === transferHighlightRiderId ? 1 : 0;
            if (aSel !== bSel) return bSel - aSel;
          }
          const busyDiff = Number(Boolean(a.has_active_job)) - Number(Boolean(b.has_active_job));
          if (busyDiff !== 0) return busyDiff;
          if (a.distKm !== null && b.distKm !== null) return a.distKm - b.distKm;
          if (a.distKm !== null) return -1;
          if (b.distKm !== null) return 1;
          return Number(b.rating_avg || 5.0) - Number(a.rating_avg || 5.0);
        });

      if (candidates.length === 0) {
        transferCoridersList.innerHTML = `<div class="empty-state" style="padding:12px;font-size:0.84rem;">No other online CCRC riders found right now. Use Option 2 below to urgently re-broadcast!</div>`;
        return;
      }

      transferCoridersList.innerHTML = candidates.map((r) => {
        const isBusy = Boolean(r.has_active_job);
        const isDisabled = isBusy && !allowBusy;
        const actStatus = r.activity_status || (isBusy ? "accepted" : "available");
        const isHighlighted = Boolean(transferHighlightRiderId && Number(r.id) === transferHighlightRiderId);
        const distLabel = r.distKm !== null ? `📍 ${r.distKm.toFixed(1)} km away` : `📍 ${escapeHtml(r.municipality || "Camiguin")}`;

        let statusBadge = "";
        if (actStatus === "accepted") {
          statusBadge = `<span class="badge badge-accepting" style="font-size:0.7rem;padding:2px 6px;">🟡 ${tRider("Accepting Booking")}</span>`;
        } else if (actStatus === "in_progress") {
          statusBadge = `<span class="badge badge-heading" style="font-size:0.7rem;padding:2px 6px;">🟠 ${tRider("Heading Destination")}</span>`;
        } else if (isBusy) {
          statusBadge = `<span class="badge badge-warning" style="font-size:0.7rem;padding:2px 6px;">${tRider("Busy")}</span>`;
        } else {
          statusBadge = `<span class="badge badge-success" style="font-size:0.7rem;padding:2px 6px;">🟢 ${tRider("Available")}</span>`;
        }

        const selectedBadge = isHighlighted
          ? `<span class="badge" style="background:#fff7ed;color:#c2410c;border:1px solid #fb923c;font-size:0.7rem;padding:2px 6px;">⭐ Selected</span>`
          : "";
        const highlightStyle = isHighlighted ? "border:2px solid #f97316;background:#fff7ed;" : "";

        let btnLabel = tRider("Transfer Now");
        if (isDisabled) {
          btnLabel = actStatus === "in_progress" ? tRider("Heading Dest") : tRider("Busy");
        }

        return `
          <div class="transfer-corider-option ${isDisabled ? "is-busy" : ""}" style="${highlightStyle}">
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <strong style="font-size:0.88rem;color:#0f172a;">${escapeHtml(r.name)}</strong>
                ${statusBadge}
                ${selectedBadge}
              </div>
              <div class="text-muted" style="font-size:0.76rem;margin-top:2px;">
                🏍️ ${escapeHtml(r.bike_model)} (${escapeHtml(r.plate_number)}) &bull; ⭐ ${Number(r.rating_avg || 5.0).toFixed(1)}
              </div>
              <div style="font-size:0.76rem;color:#0284c7;font-weight:600;margin-top:2px;">
                ${distLabel}
              </div>
            </div>
            <button
              type="button"
              class="btn btn-sm ${isDisabled ? "btn-outline" : "btn-primary"} execute-direct-transfer-btn"
              data-rider-id="${r.id}"
              data-can-transfer="${isDisabled ? "0" : "1"}"
              ${isDisabled ? "disabled" : ""}
              style="white-space:nowrap;"
            >${btnLabel}</button>
          </div>
        `;
      }).join("");
    } catch (err) {
      transferCoridersList.innerHTML = `<div class="text-muted" style="font-size:0.84rem;text-align:center;padding:12px;">${escapeHtml(err.message || "Failed to load online co-riders.")}</div>`;
    }
  }

  function openEmergencyTransferModal(targetJob = null, highlightRiderId = null) {
    const job = (targetJob && targetJob.id) ? targetJob : activeJob;
    if (!job || !currentRider || !transferModal) return;
    transferTargetJob = job;
    transferHighlightRiderId = highlightRiderId ? Number(highlightRiderId) : null;

    if (transferStatusError) {
      transferStatusError.textContent = "";
      transferStatusError.classList.add("hidden");
    }
    if (transferModalSubtitle) {
      transferModalSubtitle.textContent = `${job.booking_code} • ${job.dropoff_address} • ₱${Math.round(job.fare_amount || 0)}`;
    }
    if (transferNoteInput) {
      transferNoteInput.value = "";
    }
    if (transferUpdateGpsChk) {
      transferUpdateGpsChk.checked = job.status === "in_progress";
    }
    if (transferGoOfflineChk) {
      transferGoOfflineChk.checked = !isJobFutureScheduled(job);
    }

    transferModal.classList.remove("hidden");
    loadTransferCoRiders();

    if (!lastRiderGpsPos && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (currentRider) {
            currentRider.last_lat = pos.coords.latitude;
            currentRider.last_lng = pos.coords.longitude;
          }
          lastRiderGpsPos = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || currentRiderBearing || 0,
          };
          if (!transferModal.classList.contains("hidden")) {
            loadTransferCoRiders();
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 10000 }
      );
    }
  }

  async function executeBookingTransfer(targetRiderId) {
    const job = transferTargetJob || activeJob;
    if (!job || !currentRider) return;
    if (transferStatusError) {
      transferStatusError.textContent = "";
      transferStatusError.classList.add("hidden");
    }

    const reason = transferReasonSelect ? transferReasonSelect.value : "Flat tire / tire puncture";
    const note = transferNoteInput ? transferNoteInput.value.trim() : "";
    const useGps = transferUpdateGpsChk ? transferUpdateGpsChk.checked : false;
    const goOffline = transferGoOfflineChk ? transferGoOfflineChk.checked : true;

    const payload = {
      reason,
      note,
      go_offline: goOffline,
    };
    if (targetRiderId) {
      payload.target_rider_id = Number(targetRiderId);
    }
    if (useGps) {
      const gps = getCurrentRiderGpsForTransfer();
      if (gps) {
        payload.new_pickup_lat = gps.lat;
        payload.new_pickup_lng = gps.lng;
      }
    }

    const origRebroadcastText = transferRebroadcastBtn ? transferRebroadcastBtn.textContent : "";
    if (transferRebroadcastBtn) {
      transferRebroadcastBtn.disabled = true;
      if (!targetRiderId) {
        transferRebroadcastBtn.textContent = "Re-broadcasting...";
      }
    }
    const directBtns = transferCoridersList
      ? Array.from(transferCoridersList.querySelectorAll(".execute-direct-transfer-btn[data-can-transfer='1']"))
      : [];
    directBtns.forEach((b) => {
      b.disabled = true;
      if (targetRiderId && Number(b.getAttribute("data-rider-id")) === Number(targetRiderId)) {
        b.textContent = "Transferring...";
      }
    });

    try {
      const res = await fetch(`/api/bookings/${job.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        if (transferModal) transferModal.classList.add("hidden");
        handleExpiredRiderSession();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not complete trip transfer.");
      }

      const wasActiveBoxJob = Boolean(activeJob && Number(activeJob.id) === Number(job.id));
      transferTargetJob = null;
      transferHighlightRiderId = null;
      if (transferModal) transferModal.classList.add("hidden");

      if (wasActiveBoxJob) {
        activeJob = null;
        prevActiveJobKey = null;
        if (activeJobBox) activeJobBox.classList.add("hidden");
        resetRiderChat(null);
        renderJobOnRiderMap(null);
      }

      if (data.is_online !== null && data.is_online !== undefined) {
        const nowOnline = Number(data.is_online) === 1;
        if (onlineToggle) onlineToggle.checked = nowOnline;
        updateOnlineBadge(nowOnline);
        if (currentRider) {
          currentRider.is_online = nowOnline ? 1 : 0;
          setStoredRider(currentRider);
        }
        if (!nowOnline) {
          if (jobsFeedList) {
            jobsFeedList.innerHTML = `<div class="empty-state">You are currently OFFLINE. Turn the switch above ON to receive booking requests in Camiguin.</div>`;
          }
          if (jobsCountPill) jobsCountPill.textContent = "0";
        } else {
          fetchAvailableJobs();
        }
      } else {
        fetchAvailableJobs();
      }

      fetchCoRiders();
      checkActiveJob();
      alert("✅ " + (data.message || "Booking transferred successfully!"));
    } catch (err) {
      if (transferStatusError) {
        transferStatusError.textContent = err.message || "Could not complete trip transfer.";
        transferStatusError.classList.remove("hidden");
      } else {
        alert(err.message || "Could not complete trip transfer.");
      }
      loadTransferCoRiders();
    } finally {
      if (transferRebroadcastBtn) {
        transferRebroadcastBtn.disabled = false;
        transferRebroadcastBtn.textContent = origRebroadcastText || "📡 Re-Broadcast to All Online Riders (Urgent)";
      }
      directBtns.forEach((b) => {
        b.disabled = false;
        b.textContent = "Transfer Now";
      });
    }
  }

  if (jobTransferBtn) {
    jobTransferBtn.addEventListener("click", () => openEmergencyTransferModal(activeJob, null));
  }
  if (jobTransferTopBtn) {
    jobTransferTopBtn.addEventListener("click", () => openEmergencyTransferModal(activeJob, null));
  }
  if (transferRefreshCoridersBtn) {
    transferRefreshCoridersBtn.addEventListener("click", loadTransferCoRiders);
  }
  if (transferRebroadcastBtn) {
    transferRebroadcastBtn.addEventListener("click", () => executeBookingTransfer(null));
  }
  if (transferCoridersList) {
    transferCoridersList.addEventListener("click", (e) => {
      const btn = e.target.closest(".execute-direct-transfer-btn");
      if (!btn || btn.disabled) return;
      const targetId = btn.getAttribute("data-rider-id");
      if (targetId) {
        executeBookingTransfer(targetId);
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
      if (res.status === 401) {
        handleExpiredRiderSession();
        return;
      }
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

  function getCurrentPhtMonthString() {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === "year")?.value || "";
      const m = parts.find((p) => p.type === "month")?.value || "";
      if (y && m) return `${y}-${m}`;
    } catch (_) {}
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function downloadRiderEarningsCsv(monthVal) {
    if (!currentRider) return;
    const params = new URLSearchParams();
    if (monthVal && /^\d{4}-\d{2}$/.test(monthVal)) {
      params.set("month", monthVal);
    }
    const qs = params.toString();
    window.location.href = `/api/rider/reports/earnings.csv${qs ? `?${qs}` : ""}`;
  }

  function openRiderPrintableEarningsReport(monthVal) {
    if (!currentRider) return;
    const params = new URLSearchParams();
    if (monthVal && /^\d{4}-\d{2}$/.test(monthVal)) {
      params.set("month", monthVal);
    }
    const qs = params.toString();
    window.open(`/rider/reports/earnings${qs ? `?${qs}` : ""}`, "_blank", "noopener");
  }

  const openRiderTxnsBtn = document.getElementById("open-rider-txns-btn");
  const riderTxnsModal = document.getElementById("rider-transactions-modal");
  const riderReportMonthInput = document.getElementById("rider-report-month");
  const riderExportCsvBtn = document.getElementById("rider-export-csv-btn");
  const riderPrintReportBtn = document.getElementById("rider-print-report-btn");
  const riderModalExportCsvBtn = document.getElementById("rider-modal-export-csv-btn");
  const riderModalPrintReportBtn = document.getElementById("rider-modal-print-report-btn");

  if (riderReportMonthInput && !riderReportMonthInput.value) {
    riderReportMonthInput.value = getCurrentPhtMonthString();
  }
  if (openRiderTxnsBtn && riderTxnsModal) {
    openRiderTxnsBtn.addEventListener("click", () => {
      if (riderReportMonthInput && !riderReportMonthInput.value) {
        riderReportMonthInput.value = getCurrentPhtMonthString();
      }
      loadRiderTransactions();
      riderTxnsModal.classList.remove("hidden");
    });
  }
  if (riderExportCsvBtn) {
    riderExportCsvBtn.addEventListener("click", () => downloadRiderEarningsCsv(""));
  }
  if (riderPrintReportBtn) {
    riderPrintReportBtn.addEventListener("click", () => openRiderPrintableEarningsReport(""));
  }
  if (riderModalExportCsvBtn) {
    riderModalExportCsvBtn.addEventListener("click", () => {
      downloadRiderEarningsCsv((riderReportMonthInput && riderReportMonthInput.value) || "");
    });
  }
  if (riderModalPrintReportBtn) {
    riderModalPrintReportBtn.addEventListener("click", () => {
      openRiderPrintableEarningsReport((riderReportMonthInput && riderReportMonthInput.value) || "");
    });
  }

  // Available Jobs Polling & Sound Chime Alert
  async function fetchAvailableJobs() {
    if (!onlineToggle.checked) return;
    try {
      const res = await fetch("/api/rider/available-jobs");
      if (res.status === 401) {
        handleExpiredRiderSession();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const jobs = data.jobs || [];

      jobsCountPill.textContent = jobs.length;

      // Check if new incoming job (or urgent re-broadcast) arrived -> Play Sound Alert!
      let hasNewJob = false;
      let hasUrgentRebroadcast = false;
      const nextKeys = new Set();
      jobs.forEach((j) => {
        const key = `${j.id}:${j.transfer_count || 0}`;
        nextKeys.add(key);
        if (!knownJobKeys.has(key)) {
          hasNewJob = true;
          if (Number(j.transfer_count || 0) > 0) {
            hasUrgentRebroadcast = true;
          }
        }
      });
      knownJobKeys = nextKeys;

      if (hasNewJob && window.playDispatchChime) {
        window.playDispatchChime();
      }
      if (hasUrgentRebroadcast && "vibrate" in navigator) {
        try { navigator.vibrate([150, 70, 150, 70, 220]); } catch (_) {}
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
        .map((j) => {
          const isTransferred = Number(j.transfer_count || 0) > 0;
          const transferFrom = j.transferred_from_rider_name ? ` from ${escapeHtml(j.transferred_from_rider_name)}` : "";
          const transferReason = j.transfer_reason ? `: ${escapeHtml(j.transfer_reason)}` : "";
          const groupSize = Number(j.group_size || 1);
          const isGroup = groupSize > 1;
          const openSlots = Number(j.group_open_count !== undefined ? j.group_open_count : (isGroup ? groupSize : 1));
          const joinedSlots = Number(j.group_assigned_count || 0);
          const alreadyInGroup = Boolean(j.rider_already_in_group);
          const groupTotalFare = Math.round(Number(j.group_total_fare || Number(j.fare_amount || 0) * groupSize)).toLocaleString();
          return `
            <div class="job-card" data-job-id="${j.id}">
              ${isTransferred ? `
                <div class="transfer-urgency-banner" style="margin-bottom:8px;">
                  <strong>🚨 EMERGENCY TRANSFER</strong>
                  <div style="font-size:0.78rem;margin-top:2px;">Handed over${transferFrom}${transferReason}. Original fare ₱${Math.round(j.fare_amount)}.</div>
                </div>
              ` : ""}
              <div class="job-card-top">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span class="badge badge-accent">${escapeHtml(j.service_type.toUpperCase())}</span>
                  ${isGroup ? `<span class="badge" style="background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;font-weight:800;">👥 GROUP RIDE • ${groupSize} Riders</span>` : ""}
                  ${isGroup ? `<span class="badge" style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;font-size:0.72rem;font-weight:700;">${openSlots} Open &bull; ${joinedSlots} Joined</span>` : ""}
                </div>
                <span class="job-fare-tag">₱${Math.round(j.fare_amount)}${isGroup ? " <small style='font-size:0.72rem;font-weight:600;'>/ rider</small>" : ""}</span>
              </div>
              <div class="job-route-preview">
                <div>🟢 <strong>From:</strong> ${escapeHtml(j.pickup_address)}</div>
                <div>🏁 <strong>To:</strong> ${escapeHtml(j.dropoff_address)}</div>
                ${isGroup ? `<div style="font-size:0.78rem;color:#1d4ed8;font-weight:600;margin-top:3px;">👥 Group Code: <strong>${escapeHtml(j.group_code || "")}</strong> &bull; Group Total: ₱${groupTotalFare}</div>` : ""}
                ${j.scheduled_at ? `<div style="background:#eff6ff;color:#1d4ed8;padding:4px 8px;border-radius:6px;font-size:0.8rem;font-weight:700;margin-top:6px;">📅 Scheduled Pickup: ${new Date(j.scheduled_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>` : ""}
                ${j.payment_method ? `<div style="font-size:0.78rem;color:#475569;margin-top:2px;">💳 Payment: ${String(j.payment_method).toLowerCase() === "gcash" ? `<span class="badge" style="background:#dbeafe;color:#0047b8;border:1px solid #93c5fd;font-size:0.74rem;font-weight:800;padding:1px 7px;">💙 GCASH</span>` : `<strong style="text-transform:uppercase;">${escapeHtml(j.payment_method)}</strong>`}</div>` : ""}
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
                ${alreadyInGroup ? `
                  <button type="button" class="btn btn-sm btn-outline" disabled>
                    ✓ Already Joined Group
                  </button>
                ` : `
                  <button type="button" class="btn btn-primary btn-sm accept-job-btn" data-id="${j.id}">
                    ${isGroup ? "Accept Group Slot 🛵" : "Accept This Booking 🛵"}
                  </button>
                `}
              </div>
            </div>
          `;
        })
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
        fetchCoRiders();
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
    if (!riderChatBox) return;
    if (msg.id && riderChatBox.querySelector(`[data-msg-id="${msg.id}"]`)) return;
    if (riderChatEmptyHint) riderChatEmptyHint.style.display = "none";

    const isSystem = msg.sender_role === "system";
    const wrap = document.createElement("div");
    wrap.className = `chat-bubble-wrap ${isSystem ? "system" : (isSelf ? "self" : "other")}`;
    if (msg.id) wrap.dataset.msgId = String(msg.id);

    const sender = isSystem
      ? (msg.sender_name || "CCRC Dispatch")
      : (isSelf ? "You (Rider)" : (msg.sender_name || "Customer"));
    const roleIcon = isSystem ? "🚨" : (isSelf ? "🛵" : "👤");
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
    } else if (msg.msg_type === "image" && safeMediaUrl) {
      const rawCaption = String(msg.message || "").trim();
      const hasCaption = Boolean(rawCaption && rawCaption !== "📸 Photo");
      bodyHtml = `
        <div class="chat-photo-bubble-body">
          <img src="${escapeHtml(safeMediaUrl)}" alt="${escapeHtml(hasCaption ? rawCaption : "Chat photo")}" class="chat-photo-thumb" loading="lazy" title="Tap photo to zoom">
          ${hasCaption ? `<div class="chat-photo-caption">${escapeHtml(rawCaption)}</div>` : ""}
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

    if (msg.msg_type === "image" && safeMediaUrl) {
      const thumbEl = wrap.querySelector(".chat-photo-thumb");
      if (thumbEl) {
        thumbEl.addEventListener("click", () => {
          if (typeof window.openCcrcPhotoLightbox === "function") {
            window.openCcrcPhotoLightbox(safeMediaUrl, String(msg.message || "").trim());
          }
        });
        thumbEl.addEventListener("load", () => {
          if (riderChatBox) riderChatBox.scrollTop = riderChatBox.scrollHeight;
        }, { once: true });
      }
    }

    riderChatBox.appendChild(wrap);
    riderChatBox.scrollTop = riderChatBox.scrollHeight;
  }

  async function pollRiderChat() {
    if (!activeJob) return;
    try {
      const res = await fetch(`/api/chat/${activeJob.id}/messages?after=${riderLastMessageId}`);
      if (res.status === 401) {
        handleExpiredRiderSession();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.messages && data.messages.length > 0) {
        let hasIncomingFromCustomer = false;
        for (const msg of data.messages) {
          if (msg.id > riderLastMessageId) {
            riderLastMessageId = msg.id;
            const isSelf = (msg.sender_role === "rider");
            appendRiderChatMessage(msg, isSelf);
            if (!isSelf && msg.sender_name !== "CCRC Call") hasIncomingFromCustomer = true;
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
          sender_name: currentRider ? currentRider.name : "Club Rider",
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

  if (riderChatVoiceBtn && window.CCRCVoiceCall && typeof window.CCRCVoiceCall.bindVoiceRecorder === "function") {
    window.CCRCVoiceCall.bindVoiceRecorder({
      triggerBtn: riderChatVoiceBtn,
      barEl: riderChatVoiceBar,
      timerEl: riderChatVoiceTimer,
      cancelBtn: riderChatVoiceCancelBtn,
      sendBtn: riderChatVoiceSendBtn,
      getUploadUrl: () => activeJob ? `/api/chat/${activeJob.id}/voice?after=${riderLastMessageId}` : "",
      onUploaded: (data) => {
        const list = (data && Array.isArray(data.messages) && data.messages.length > 0)
          ? data.messages
          : (data && data.message ? [data.message] : []);
        for (const m of list) {
          if (m && m.id > riderLastMessageId) {
            riderLastMessageId = m.id;
            appendRiderChatMessage(m, m.sender_role === "rider");
          }
        }
      },
    });
  }

  async function sendRiderChatPhoto() {
    if (!pendingRiderChatPhotoDataUrl || isSendingRiderChatPhoto || !activeJob || !activeJob.id) return;
    isSendingRiderChatPhoto = true;
    if (riderChatPhotoSendBtn) {
      riderChatPhotoSendBtn.disabled = true;
      riderChatPhotoSendBtn.textContent = "Sending...";
    }
    try {
      const caption = riderChatPhotoCaptionInput ? riderChatPhotoCaptionInput.value.trim() : "";
      const csrfMeta = document.querySelector('meta[name="csrf-token"]');
      const headers = { "Content-Type": "application/json" };
      if (csrfMeta && csrfMeta.getAttribute("content")) {
        headers["X-CSRF-Token"] = csrfMeta.getAttribute("content");
      }
      const res = await fetch(`/api/chat/${activeJob.id}/photo?after=${riderLastMessageId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          photo_base64: pendingRiderChatPhotoDataUrl,
          caption,
          sender_role: "rider",
        }),
      });
      if (res.status === 401) {
        handleExpiredRiderSession();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data && data.error) || "Could not send photo. Please try again.");
        return;
      }
      const list = (data && Array.isArray(data.messages) && data.messages.length > 0)
        ? data.messages
        : (data && data.message ? [data.message] : []);
      for (const m of list) {
        if (m && m.id > riderLastMessageId) {
          riderLastMessageId = m.id;
          appendRiderChatMessage(m, m.sender_role === "rider");
        }
      }
      clearRiderChatPhotoPreview();
    } catch (_) {
      alert("Network error while sending photo. Please try again.");
    } finally {
      isSendingRiderChatPhoto = false;
      if (riderChatPhotoSendBtn) {
        riderChatPhotoSendBtn.disabled = false;
        riderChatPhotoSendBtn.textContent = (typeof window.ccrcT === "function") ? window.ccrcT("Send Photo ✈️") : "Send Photo ✈️";
      }
    }
  }

  if (riderChatPhotoBtn && riderChatPhotoInput) {
    riderChatPhotoBtn.addEventListener("click", () => {
      if (isSendingRiderChatPhoto) return;
      riderChatPhotoInput.value = "";
      riderChatPhotoInput.click();
    });
    riderChatPhotoInput.addEventListener("change", async () => {
      const file = riderChatPhotoInput.files && riderChatPhotoInput.files[0];
      if (!file) return;
      if (typeof window.ccrcCompressChatPhoto !== "function") return;
      riderChatPhotoBtn.disabled = true;
      riderChatPhotoBtn.textContent = "⏳";
      try {
        const compressed = await window.ccrcCompressChatPhoto(file);
        pendingRiderChatPhotoDataUrl = compressed.dataUrl;
        if (riderChatPhotoPreviewThumb) riderChatPhotoPreviewThumb.src = pendingRiderChatPhotoDataUrl;
        if (riderChatPhotoPreviewBar) riderChatPhotoPreviewBar.classList.remove("hidden");
        if (riderChatPhotoCaptionInput) riderChatPhotoCaptionInput.focus();
      } catch (err) {
        clearRiderChatPhotoPreview();
        alert((err && err.message) || "Could not load photo.");
      } finally {
        riderChatPhotoBtn.disabled = false;
        riderChatPhotoBtn.textContent = "📷";
      }
    });
  }
  if (riderChatPhotoPreviewThumb) {
    riderChatPhotoPreviewThumb.addEventListener("click", () => {
      if (pendingRiderChatPhotoDataUrl && typeof window.openCcrcPhotoLightbox === "function") {
        window.openCcrcPhotoLightbox(pendingRiderChatPhotoDataUrl, riderChatPhotoCaptionInput ? riderChatPhotoCaptionInput.value.trim() : "");
      }
    });
  }
  if (riderChatPhotoCancelBtn) {
    riderChatPhotoCancelBtn.addEventListener("click", clearRiderChatPhotoPreview);
  }
  if (riderChatPhotoSendBtn) {
    riderChatPhotoSendBtn.addEventListener("click", sendRiderChatPhoto);
  }
  if (riderChatPhotoCaptionInput) {
    riderChatPhotoCaptionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendRiderChatPhoto();
      }
    });
  }

  function resetRiderChat(job) {
    if (!job) {
      if (riderChatPollTimer) clearInterval(riderChatPollTimer);
      riderChatPollTimer = null;
      currentActiveJobId = null;
      if (riderChatVoiceBar) riderChatVoiceBar.classList.add("hidden");
      clearRiderChatPhotoPreview();
      return;
    }
    if (currentActiveJobId !== job.id) {
      currentActiveJobId = job.id;
      riderLastMessageId = 0;
      clearRiderChatPhotoPreview();
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

  function renderCoRidersList(list) {
    cachedCoRiders = Array.isArray(list) ? list : [];

    const targetForCoRider = (activeJob && ["accepted", "in_progress"].includes(activeJob.status))
      ? activeJob
      : (currentScheduledJobs && currentScheduledJobs.length > 0
          ? Object.assign({ _fromScheduledList: true }, currentScheduledJobs[0])
          : null);

    const hintEl = document.getElementById("co-riders-transfer-hint");
    if (hintEl) {
      hintEl.classList.toggle("hidden", Boolean(targetForCoRider));
    }

    if (!coRidersList) return;

    if (cachedCoRiders.length === 0) {
      coRidersList.innerHTML = `
        <div class="empty-state" style="padding:1rem;">
          <span class="text-muted">No other online riders found right now. Waiting for fellow riders!</span>
        </div>
      `;
      return;
    }

    const allowBusy = isJobFutureScheduled(targetForCoRider);

    coRidersList.innerHTML = cachedCoRiders.map((r) => {
      const isSelf = r.is_self;
      const isBusy = Boolean(r.has_active_job);
      const isDisabled = isBusy && !allowBusy;
      const actStatus = r.activity_status || (isBusy ? "accepted" : "available");

      let avatarClass = "is-available";
      if (actStatus === "accepted") avatarClass = "is-accepting";
      else if (actStatus === "in_progress") avatarClass = "is-heading";

      const avatarHtml = r.avatar_url
        ? `<img src="${escapeHtml(r.avatar_url)}" alt="${escapeHtml(r.name)}" class="co-rider-avatar ${avatarClass}">`
        : `<div class="co-rider-avatar-placeholder ${avatarClass}">🛵</div>`;

      const selfBadge = isSelf ? `<span class="badge badge-accent" style="font-size:0.7rem;padding:2px 7px;white-space:nowrap;">${tRider("You")}</span>` : '';

      let statusBadge = "";
      if (actStatus === "accepted") {
        statusBadge = `<span class="badge badge-accepting" style="font-size:0.68rem;padding:2px 7px;white-space:nowrap;">🟡 ${tRider("Accepting Booking")}</span>`;
      } else if (actStatus === "in_progress") {
        statusBadge = `<span class="badge badge-heading" style="font-size:0.68rem;padding:2px 7px;white-space:nowrap;">🟠 ${tRider("Heading Destination")}</span>`;
      } else if (r.recent_completed) {
        statusBadge = `<span class="badge badge-completed" style="font-size:0.68rem;padding:2px 7px;white-space:nowrap;">🟢 ${tRider("Available (Completed ✓)")}</span>`;
      } else if (isBusy) {
        statusBadge = `<span class="badge badge-warning" style="font-size:0.68rem;padding:2px 6px;white-space:nowrap;">${tRider("Busy")}</span>`;
      } else {
        statusBadge = `<span class="badge badge-success" style="font-size:0.68rem;padding:2px 6px;white-space:nowrap;">🟢 ${tRider("Available")}</span>`;
      }

      let detailHtml = "";
      if (actStatus === "accepted") {
        const destPart = r.trip_destination ? ` &bull; Dest: <strong>${escapeHtml(r.trip_destination)}</strong>` : "";
        detailHtml = `<div class="co-rider-status-detail status-accepting">🟡 ${tRider("Accepting booking &bull; Heading to pickup")}${destPart}</div>`;
      } else if (actStatus === "in_progress") {
        const destPart = r.trip_destination ? `: <strong>${escapeHtml(r.trip_destination)}</strong>` : "";
        detailHtml = `<div class="co-rider-status-detail status-heading">🟠 ${tRider("Heading to destination")}${destPart}</div>`;
      } else if (r.recent_completed) {
        detailHtml = `<div class="co-rider-status-detail status-completed">✓ ${tRider("Completed trip &bull; Ready for next booking")}</div>`;
      } else if (!isSelf) {
        detailHtml = `<div class="co-rider-status-detail status-available">🟢 ${tRider("Ready to take bookings")}</div>`;
      }

      const town = escapeHtml(r.municipality || 'Camiguin');
      const freeCallBtn = (!isSelf)
        ? `<button type="button" class="btn btn-sm btn-inapp-call co-rider-inapp-call-btn" data-rider-id="${r.id}" data-rider-name="${escapeHtml(r.name)}" data-rider-phone="${escapeHtml(r.phone || '')}" data-rider-town="${town}" style="font-size:0.75rem;padding:4px 9px;white-space:nowrap;" title="${tRider('Free In-App Voice Call')}">🎙️ ${tRider("Free Call")}</button>`
        : '';
      const phoneBtn = (!isSelf && r.phone)
        ? `<a href="tel:${escapeHtml(r.phone)}" class="btn btn-sm btn-outline" style="font-size:0.75rem;padding:4px 9px;" title="Call Rider">📞 Call</a>`
        : '';

      let transferTooltip = tRider("Transfer active trip to this rider");
      let transferBtnLabel = tRider("🔄 Transfer to Rider");
      if (isDisabled) {
        if (actStatus === "in_progress") {
          transferTooltip = tRider("Rider heading to destination");
          transferBtnLabel = tRider("Heading Dest");
        } else {
          transferTooltip = tRider("Rider is accepting a booking");
          transferBtnLabel = tRider("Busy");
        }
      }
      const transferBtn = (!isSelf && targetForCoRider)
        ? `<button type="button" class="btn btn-sm btn-transfer-emergency co-rider-transfer-btn" data-rider-id="${r.id}" ${isDisabled ? "disabled" : ""} style="font-size:0.75rem;padding:4px 9px;white-space:nowrap;" title="${transferTooltip}">${transferBtnLabel}</button>`
        : '';

      const hasActions = Boolean(transferBtn || freeCallBtn || phoneBtn);
      const actionsHtml = hasActions
        ? `<div class="co-rider-actions">${transferBtn}${freeCallBtn}${phoneBtn}</div>`
        : '';

      return `
        <div class="co-rider-item ${isSelf ? 'is-self' : ''}">
          ${avatarHtml}
          <div class="co-rider-info">
            <div class="co-rider-name-row">
              <span class="co-rider-name">${escapeHtml(r.name)}</span>
              ${selfBadge}
              ${statusBadge}
            </div>
            <div class="co-rider-sub">
              🏍️ ${escapeHtml(r.bike_model)} &bull; Plate: <strong>${escapeHtml(r.plate_number)}</strong>
            </div>
            ${detailHtml}
            <div class="co-rider-footer-row">
              <span class="co-rider-town">📍 ${town}</span>
              ${actionsHtml}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  if (coRidersList) {
    coRidersList.addEventListener("click", (e) => {
      const callBtn = e.target.closest(".co-rider-inapp-call-btn");
      if (callBtn && !callBtn.disabled) {
        const rid = Number(callBtn.getAttribute("data-rider-id"));
        const rName = callBtn.getAttribute("data-rider-name") || "Co-Rider";
        const rPhone = callBtn.getAttribute("data-rider-phone") || "";
        const rTown = callBtn.getAttribute("data-rider-town") || "Camiguin";
        if (rid && window.CCRCVoiceCall && typeof window.CCRCVoiceCall.startRiderCall === "function") {
          window.CCRCVoiceCall.startRiderCall(rid, rName, rPhone, rTown);
        }
        return;
      }

      const btn = e.target.closest(".co-rider-transfer-btn");
      if (!btn || btn.disabled) return;
      const rid = Number(btn.getAttribute("data-rider-id"));
      const targetJob = (activeJob && ["accepted", "in_progress"].includes(activeJob.status))
        ? activeJob
        : (currentScheduledJobs && currentScheduledJobs.length > 0
            ? Object.assign({ _fromScheduledList: true }, currentScheduledJobs[0])
            : null);
      if (targetJob && rid) {
        openEmergencyTransferModal(targetJob, rid);
      }
    });
  }

  async function fetchCoRiders() {
    if (!currentRider) return;
    try {
      const res = await fetch(`/api/rider/co-riders?rider_id=${currentRider.id}`);
      if (res.status === 401) {
        handleExpiredRiderSession();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const list = data.co_riders || [];

      if (coRidersCountPill) {
        const busyCount = list.filter((x) => x.has_active_job).length;
        const availCount = list.length - busyCount;
        if (busyCount > 0) {
          coRidersCountPill.textContent = `${list.length} Online (${availCount} Available, ${busyCount} Busy)`;
        } else {
          coRidersCountPill.textContent = `${list.length} Online`;
        }
      }

      renderCoRidersList(list);

      // Update Radar Map Pins if map initialized
      if (radarMap) {
        const activeIds = new Set();
        list.forEach((r) => {
          if (r.last_lat && r.last_lng) {
            activeIds.add(r.id);
            const isSelf = r.is_self;
            const actStatus = r.activity_status || (r.has_active_job ? "accepted" : "available");
            let pinColor = "#16a34a";
            let pinIcon = "🟢";
            let statusText = `🟢 ${tRider("Available")}`;
            if (actStatus === "accepted") {
              pinColor = "#d97706";
              pinIcon = "🟡";
              statusText = `🟡 ${tRider("Accepting Booking")}`;
            } else if (actStatus === "in_progress") {
              pinColor = "#ea580c";
              pinIcon = "🚀";
              statusText = `🟠 ${tRider("Heading Destination")}`;
            } else if (r.has_active_job) {
              pinColor = "#eab308";
              pinIcon = "🛵";
              statusText = `🟡 ${tRider("Busy")}`;
            }
            if (isSelf) {
              pinColor = "#f97316";
              pinIcon = "🛵";
            }

            const iconHtml = `<div style="background:${pinColor};color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${pinIcon}</div>`;

            const customIcon = L.divIcon({
              className: "co-rider-radar-pin",
              html: iconHtml,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            });

            const destInfo = r.trip_destination ? `<br>🎯 <strong>${escapeHtml(r.trip_destination)}</strong>` : "";
            const safeNameJs = escapeHtml(String(r.name || "Co-Rider").replace(/'/g, "\\'"));
            const safePhoneJs = escapeHtml(String(r.phone || "").replace(/'/g, "\\'"));
            const safeTownJs = escapeHtml(String(r.municipality || "Camiguin").replace(/'/g, "\\'"));
            const popupCallBtn = (!isSelf)
              ? `<div style="margin-top:6px;"><button type="button" class="btn btn-sm btn-inapp-call" onclick="window.startCoRiderInAppCall(${r.id}, '${safeNameJs}', '${safePhoneJs}', '${safeTownJs}')" style="font-size:0.74rem;padding:4px 10px;width:100%;">🎙️ ${tRider("Free Call")}</button></div>`
              : "";
            const popupContent = `<strong>${escapeHtml(r.name)}</strong> ${isSelf ? `(${tRider("You")})` : ""}<br>${escapeHtml(r.bike_model)} (${escapeHtml(r.plate_number)})<br>📍 ${escapeHtml(r.municipality || "Camiguin")}<br><strong>Status:</strong> ${statusText}${destInfo}${popupCallBtn}`;

            if (!radarMarkers[r.id]) {
              radarMarkers[r.id] = L.marker([r.last_lat, r.last_lng], { icon: customIcon })
                .addTo(radarMap)
                .bindPopup(popupContent);
            } else {
              radarMarkers[r.id].setIcon(customIcon);
              radarMarkers[r.id].setLatLng([r.last_lat, r.last_lng]);
              radarMarkers[r.id].setPopupContent(popupContent);
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

  // ---------------------------------------------------------------------------
  // Digital Official CCRC Club ID Card (Fullscreen Modal + Live Clock + QR)
  // ---------------------------------------------------------------------------
  const openRiderIdCardBtn = document.getElementById("open-rider-id-card-btn");
  const riderOfficialIdModal = document.getElementById("rider-official-id-modal");
  const oidCloseTopBtn = document.getElementById("oid-close-top-btn");
  const oidCloseBtn = document.getElementById("oid-close-btn");
  const oidPrintBtn = document.getElementById("oid-print-btn");
  const oidCopyLinkBtn = document.getElementById("oid-copy-link-btn");
  const oidClubName = document.getElementById("oid-club-name");
  const oidClubId = document.getElementById("oid-club-id");
  const oidStatusStrip = document.getElementById("oid-status-strip");
  const oidStatusLabel = document.getElementById("oid-status-label");
  const oidLiveClock = document.getElementById("oid-live-clock");
  const oidAvatarImg = document.getElementById("oid-avatar-img");
  const oidAvatarFallback = document.getElementById("oid-avatar-fallback");
  const oidVerifiedCheck = document.getElementById("oid-verified-check");
  const oidName = document.getElementById("oid-name");
  const oidMunicipality = document.getElementById("oid-municipality");
  const oidRatingPill = document.getElementById("oid-rating-pill");
  const oidTripsPill = document.getElementById("oid-trips-pill");
  const oidOnlinePill = document.getElementById("oid-online-pill");
  const oidBike = document.getElementById("oid-bike");
  const oidPlate = document.getElementById("oid-plate");
  const oidLicense = document.getElementById("oid-license");
  const oidMemberSince = document.getElementById("oid-member-since");
  const oidQrImg = document.getElementById("oid-qr-img");
  const oidHotline = document.getElementById("oid-hotline");

  let oidClockTimer = null;
  let currentOfficialVerifyUrl = "";

  function formatOfficialPhtClock() {
    try {
      return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(new Date()) + " PHT";
    } catch (_) {
      return new Date().toLocaleString();
    }
  }

  function startOfficialIdLiveClock() {
    stopOfficialIdLiveClock();
    if (oidLiveClock) oidLiveClock.textContent = formatOfficialPhtClock();
    oidClockTimer = setInterval(() => {
      if (oidLiveClock) oidLiveClock.textContent = formatOfficialPhtClock();
    }, 1000);
  }

  function stopOfficialIdLiveClock() {
    if (oidClockTimer) {
      clearInterval(oidClockTimer);
      oidClockTimer = null;
    }
  }

  function populateOfficialIdCard(card) {
    if (!card) return;
    const clubIdText = card.club_id || `CCRC-${String(Number(card.id) || 0).padStart(4, "0")}`;
    if (oidClubName && card.club_name) oidClubName.textContent = card.club_name;
    if (oidClubId) oidClubId.textContent = clubIdText;

    const status = String(card.status || "active").toLowerCase();
    const isVerified = card.is_verified !== undefined ? Boolean(card.is_verified) : (status === "active");
    if (oidStatusStrip && oidStatusLabel) {
      oidStatusStrip.classList.remove("is-verified", "is-pending", "is-suspended");
      if (isVerified) {
        oidStatusStrip.classList.add("is-verified");
        oidStatusLabel.textContent = tRider("✅ VERIFIED ACTIVE MEMBER");
      } else if (status === "pending") {
        oidStatusStrip.classList.add("is-pending");
        oidStatusLabel.textContent = tRider("⏳ PENDING ADMIN VERIFICATION");
      } else {
        oidStatusStrip.classList.add("is-suspended");
        oidStatusLabel.textContent = tRider("🚫 SUSPENDED / INACTIVE RIDER");
      }
    }
    if (oidVerifiedCheck) {
      oidVerifiedCheck.classList.toggle("hidden", !isVerified);
    }

    const rName = card.name || "Club Rider";
    if (oidName) oidName.textContent = rName;
    if (oidAvatarImg && oidAvatarFallback) {
      if (card.avatar_url) {
        oidAvatarImg.src = card.avatar_url;
        oidAvatarImg.classList.remove("hidden");
        oidAvatarFallback.classList.add("hidden");
      } else {
        oidAvatarImg.classList.add("hidden");
        oidAvatarFallback.textContent = String(rName).trim().slice(0, 1).toUpperCase() || "R";
        oidAvatarFallback.classList.remove("hidden");
      }
    }

    const muni = card.municipality || "Mambajao";
    if (oidMunicipality) oidMunicipality.textContent = `📍 ${muni}, Camiguin Island`;

    const ratingVal = Number(card.rating_avg || 5.0).toFixed(1);
    const revSuffix = typeof card.review_count === "number" ? ` (${card.review_count})` : "";
    if (oidRatingPill) oidRatingPill.textContent = `⭐ ${ratingVal}${revSuffix}`;

    const trips = Number(card.total_trips || 0);
    if (oidTripsPill) oidTripsPill.textContent = `🛵 ${trips} ${trips === 1 ? "Trip" : "Trips"}`;

    const isOnline = card.is_online !== undefined ? Boolean(card.is_online) : Boolean(onlineToggle && onlineToggle.checked);
    if (oidOnlinePill) oidOnlinePill.classList.toggle("hidden", !isOnline);

    if (oidBike) oidBike.textContent = card.bike_model || "Motorcycle";
    if (oidPlate) oidPlate.textContent = String(card.plate_number || "N/A").toUpperCase();
    if (oidLicense) oidLicense.textContent = card.license_no ? String(card.license_no).toUpperCase() : "Verified on File";
    if (oidMemberSince) {
      if (card.member_since) {
        oidMemberSince.textContent = card.member_since;
      } else if (card.created_at) {
        oidMemberSince.textContent = String(card.created_at).slice(0, 10);
      } else {
        oidMemberSince.textContent = "Verified Member";
      }
    }

    if (oidHotline && card.club_hotline) oidHotline.textContent = card.club_hotline;

    const rid = card.id;
    currentOfficialVerifyUrl = card.verify_url || (rid ? `${window.location.origin}/verify/rider/${rid}` : "");
    if (oidQrImg && rid) {
      const qrSrc = card.qr_svg_url || `/api/rider/${rid}/id-qr.svg`;
      if (oidQrImg.getAttribute("data-qr-src") !== qrSrc) {
        oidQrImg.setAttribute("data-qr-src", qrSrc);
        oidQrImg.src = qrSrc;
      }
    }
  }

  function closeOfficialRiderIdCard() {
    if (!riderOfficialIdModal) return;
    riderOfficialIdModal.classList.add("hidden");
    stopOfficialIdLiveClock();
  }

  async function openOfficialRiderIdCard() {
    if (!riderOfficialIdModal || !currentRider) return;
    // Instant hydrate from current session data
    populateOfficialIdCard(currentRider);
    riderOfficialIdModal.classList.remove("hidden");
    startOfficialIdLiveClock();

    // Refresh live verified stats & club hotline from DB
    try {
      const res = await fetch("/api/rider/id-card");
      if (res.status === 401) {
        closeOfficialRiderIdCard();
        handleExpiredRiderSession();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data && data.id_card) {
          populateOfficialIdCard(data.id_card);
        }
      }
    } catch (_) {}
  }

  if (openRiderIdCardBtn) {
    openRiderIdCardBtn.addEventListener("click", openOfficialRiderIdCard);
  }
  if (oidCloseTopBtn) {
    oidCloseTopBtn.addEventListener("click", closeOfficialRiderIdCard);
  }
  if (oidCloseBtn) {
    oidCloseBtn.addEventListener("click", closeOfficialRiderIdCard);
  }
  if (riderOfficialIdModal) {
    riderOfficialIdModal.addEventListener("click", (e) => {
      if (e.target === riderOfficialIdModal) closeOfficialRiderIdCard();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && riderOfficialIdModal && !riderOfficialIdModal.classList.contains("hidden")) {
      closeOfficialRiderIdCard();
    }
  });
  if (oidPrintBtn) {
    oidPrintBtn.addEventListener("click", () => {
      window.print();
    });
  }
  if (oidCopyLinkBtn) {
    oidCopyLinkBtn.addEventListener("click", async () => {
      if (!currentOfficialVerifyUrl) return;
      const origLabel = oidCopyLinkBtn.textContent;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(currentOfficialVerifyUrl);
          oidCopyLinkBtn.textContent = "✅ Link Copied!";
          setTimeout(() => {
            if (oidCopyLinkBtn) oidCopyLinkBtn.textContent = origLabel;
          }, 2000);
          return;
        }
      } catch (_) {}
      prompt("Copy your Official Rider Verification link:", currentOfficialVerifyUrl);
    });
  }

  // ---------------------------------------------------------------------------
  // Admin Live Club Advisory Banner for Riders (Auto-Refresh + Dismiss)
  // ---------------------------------------------------------------------------
  const riderAdvBanner = document.getElementById("rider-live-advisory-banner");
  if (riderAdvBanner) {
    const RIDER_ADV_DISMISS_KEY = "ccrc_dismissed_advisory_rider";
    const rAdvIconEl = document.getElementById("rider-advisory-icon");
    const rAdvCatEl = document.getElementById("rider-advisory-cat-label");
    const rAdvMetaEl = document.getElementById("rider-advisory-meta");
    const rAdvTitleEl = document.getElementById("rider-advisory-title");
    const rAdvMsgEl = document.getElementById("rider-advisory-message");
    const rAdvDismissBtn = document.getElementById("rider-advisory-dismiss-btn");

    function getRiderDismissedRev() {
      try { return sessionStorage.getItem(RIDER_ADV_DISMISS_KEY) || ""; } catch (_) { return ""; }
    }

    function applyRiderAdvisory(advisory, visible) {
      if (!advisory || !visible) {
        riderAdvBanner.classList.add("hidden");
        return;
      }
      const rev = String(advisory.revision || "");
      riderAdvBanner.setAttribute("data-revision", rev);
      if (rev && getRiderDismissedRev() === rev) {
        riderAdvBanner.classList.add("hidden");
        return;
      }
      const cat = String(advisory.category || "info");
      riderAdvBanner.className = `ccrc-advisory-banner is-${cat}`;
      if (rAdvIconEl) rAdvIconEl.textContent = advisory.category_icon || "📢";
      if (rAdvCatEl) rAdvCatEl.textContent = advisory.category_label || "Club Advisory";
      if (rAdvMetaEl) rAdvMetaEl.textContent = advisory.updated_label ? `Updated ${advisory.updated_label}` : "";
      if (rAdvTitleEl) rAdvTitleEl.textContent = advisory.title || "";
      if (rAdvMsgEl) {
        const m = String(advisory.message || "").trim();
        rAdvMsgEl.textContent = m;
        rAdvMsgEl.classList.toggle("hidden", !m);
      }
      riderAdvBanner.classList.remove("hidden");
    }

    const initRiderAdvRev = riderAdvBanner.getAttribute("data-revision") || "";
    if (initRiderAdvRev && getRiderDismissedRev() === initRiderAdvRev) {
      riderAdvBanner.classList.add("hidden");
    }

    if (rAdvDismissBtn) {
      rAdvDismissBtn.addEventListener("click", () => {
        const rev = riderAdvBanner.getAttribute("data-revision") || "";
        try { if (rev) sessionStorage.setItem(RIDER_ADV_DISMISS_KEY, rev); } catch (_) {}
        riderAdvBanner.classList.add("hidden");
      });
    }

    async function refreshRiderLiveAdvisory() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/advisory?audience=riders", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success) {
          applyRiderAdvisory(data.advisory, Boolean(data.visible));
        }
      } catch (_) {}
    }

    setInterval(refreshRiderLiveAdvisory, 45000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshRiderLiveAdvisory();
    });
  }

  // On Load: Check stored session
  window.addEventListener("DOMContentLoaded", () => {
    const saved = getStoredRider();
    if (saved) {
      initRiderSession(saved);
    }
  });
})();
