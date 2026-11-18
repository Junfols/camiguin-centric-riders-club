(function () {
  "use strict";

  let currentCustAvatarBase64 = "";

  function getStoredCustomer() {
    try {
      const raw = localStorage.getItem("ccrc_customer_session") || localStorage.getItem("ccrc_customer_user");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.phone ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function clearCustomerStorage() {
    try {
      localStorage.removeItem("ccrc_customer_session");
      localStorage.removeItem("ccrc_customer_user");
      localStorage.removeItem("ccrc_customer_phone");
      localStorage.removeItem("ccrc_customer_name");
      localStorage.removeItem("ccrc_customer_avatar");
      localStorage.removeItem("ccrc_active_booking");
    } catch (_) {}
  }

  function setStoredCustomer(cust, opts) {
    try {
      if (cust && cust.phone) {
        localStorage.setItem("ccrc_customer_session", JSON.stringify(cust));
        localStorage.setItem("ccrc_customer_phone", cust.phone);
        if (cust.name) localStorage.setItem("ccrc_customer_name", cust.name);
        if (cust.avatar_url) {
          localStorage.setItem("ccrc_customer_avatar", cust.avatar_url);
        } else {
          localStorage.removeItem("ccrc_customer_avatar");
        }
      } else {
        localStorage.removeItem("ccrc_customer_session");
        localStorage.removeItem("ccrc_customer_user");
        localStorage.removeItem("ccrc_customer_phone");
        localStorage.removeItem("ccrc_customer_name");
        localStorage.removeItem("ccrc_customer_avatar");
      }
    } catch (_) {}

    syncUI();
    if (!opts || !opts.silent) {
      window.dispatchEvent(new CustomEvent("ccrc:customer-auth-changed", { detail: { customer: cust || null } }));
    }
  }

  function syncAvatarPair(imgEl, placeholderEl, avatarUrl) {
    if (imgEl && avatarUrl) {
      imgEl.src = avatarUrl;
      imgEl.classList.remove("hidden");
      if (placeholderEl) placeholderEl.classList.add("hidden");
    } else {
      if (imgEl) {
        imgEl.removeAttribute("src");
        imgEl.classList.add("hidden");
      }
      if (placeholderEl) placeholderEl.classList.remove("hidden");
    }
  }

  function syncUI() {
    const path = window.location.pathname || "/";
    const signInBtn = document.getElementById("customer-signin-btn") || document.getElementById("customer-auth-btn");
    const customerAuthBtnText = document.getElementById("customer-auth-btn-text");
    const loggedPill = document.getElementById("customer-logged-pill");
    const pillName = document.getElementById("customer-pill-name");
    const bottomRiderNav = document.getElementById("bottom-nav-rider");

    // 1. Rider & Admin Portals: Strictly hide customer sign-in controls
    if (path.startsWith("/rider") || path.startsWith("/admin")) {
      if (signInBtn) {
        signInBtn.style.setProperty("display", "none", "important");
        signInBtn.classList.add("hidden");
      }
      if (loggedPill) {
        loggedPill.style.setProperty("display", "none", "important");
        loggedPill.classList.add("hidden");
      }
      return;
    }

    // 2. Customer Pages
    const cust = getStoredCustomer();
    let phone = cust && cust.phone;
    let name = cust && cust.name;
    let avatarUrl = cust && cust.avatar_url;
    try {
      if (!phone) phone = localStorage.getItem("ccrc_customer_phone");
      if (!name) name = localStorage.getItem("ccrc_customer_name") || "Account";
      if (!avatarUrl) avatarUrl = localStorage.getItem("ccrc_customer_avatar");
    } catch (_) {}

    const unauthedView = document.getElementById("cust-auth-unauthed-view");
    const authedView = document.getElementById("cust-auth-authed-view");

    if (phone) {
      const shortName = (name ? String(name).trim().split(/\s+/)[0] : "") || "Account";
      if (signInBtn) {
        signInBtn.style.setProperty("display", "none", "important");
        signInBtn.classList.add("hidden");
      }
      if (loggedPill) {
        loggedPill.style.setProperty("display", "inline-flex", "important");
        loggedPill.classList.remove("hidden");
      }
      if (pillName) pillName.textContent = shortName + " ✓";
      if (customerAuthBtnText) customerAuthBtnText.textContent = shortName + " ✓";

      syncAvatarPair(
        document.getElementById("header-cust-avatar-img"),
        document.getElementById("header-cust-placeholder"),
        avatarUrl
      );

      if (unauthedView) unauthedView.classList.add("hidden");
      if (authedView) {
        authedView.classList.remove("hidden");
        const pName = document.getElementById("c-profile-name");
        const pPhone = document.getElementById("c-profile-phone");
        const pEmail = document.getElementById("c-profile-email");
        const pRides = document.getElementById("c-profile-rides");
        const pSpent = document.getElementById("c-profile-spent");
        if (pName) pName.textContent = name || "Customer";
        if (pPhone) pPhone.textContent = phone || "";
        if (pEmail) pEmail.textContent = (cust && cust.email) ? cust.email : "";
        if (pRides) pRides.textContent = (cust && cust.total_rides !== undefined && cust.total_rides !== null) ? cust.total_rides : 0;
        if (pSpent) pSpent.textContent = `₱${Number((cust && cust.total_spent) || 0).toFixed(2)}`;

        syncAvatarPair(
          document.getElementById("c-profile-avatar-img"),
          document.getElementById("c-profile-avatar-placeholder"),
          avatarUrl
        );
      }

      if (bottomRiderNav) {
        bottomRiderNav.style.setProperty("display", "none", "important");
        bottomRiderNav.classList.add("hidden");
      }
    } else {
      if (signInBtn) {
        signInBtn.style.setProperty("display", "inline-flex", "important");
        signInBtn.classList.remove("hidden");
      }
      if (loggedPill) {
        loggedPill.style.setProperty("display", "none", "important");
        loggedPill.classList.add("hidden");
      }
      if (customerAuthBtnText) customerAuthBtnText.textContent = "Sign In";

      syncAvatarPair(
        document.getElementById("header-cust-avatar-img"),
        document.getElementById("header-cust-placeholder"),
        ""
      );
      syncAvatarPair(
        document.getElementById("c-profile-avatar-img"),
        document.getElementById("c-profile-avatar-placeholder"),
        ""
      );

      if (unauthedView) unauthedView.classList.remove("hidden");
      if (authedView) authedView.classList.add("hidden");

      if (bottomRiderNav) {
        bottomRiderNav.style.removeProperty("display");
        bottomRiderNav.classList.remove("hidden");
      }
    }
  }

  async function refreshProfileFromServer() {
    const cust = getStoredCustomer();
    if (!cust || !cust.phone) return;
    try {
      const res = await fetch("/api/customer/me");
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.logged_in && data.customer) {
        setStoredCustomer(data.customer, { silent: true });
      }
    } catch (_) {}
  }

  function showTab(mode) {
    const tabLogin = document.getElementById("cust-tab-login");
    const tabRegister = document.getElementById("cust-tab-register");
    const loginForm = document.getElementById("cust-login-form");
    const registerForm = document.getElementById("cust-register-form");
    const forgotForm = document.getElementById("cust-forgot-form");
    const tabBar = document.getElementById("cust-auth-tab-bar");

    if (mode === "forgot") {
      if (loginForm) loginForm.classList.add("hidden");
      if (registerForm) registerForm.classList.add("hidden");
      if (tabBar) tabBar.classList.add("hidden");
      if (forgotForm) forgotForm.classList.remove("hidden");
      return;
    }

    if (tabBar) tabBar.classList.remove("hidden");
    if (forgotForm) forgotForm.classList.add("hidden");

    if (mode === "register") {
      if (tabRegister) {
        tabRegister.style.borderBottom = "3px solid var(--primary)";
        tabRegister.style.color = "var(--primary)";
        tabRegister.style.fontWeight = "700";
      }
      if (tabLogin) {
        tabLogin.style.borderBottom = "3px solid transparent";
        tabLogin.style.color = "#64748b";
        tabLogin.style.fontWeight = "600";
      }
      if (registerForm) registerForm.classList.remove("hidden");
      if (loginForm) loginForm.classList.add("hidden");
    } else {
      if (tabLogin) {
        tabLogin.style.borderBottom = "3px solid var(--primary)";
        tabLogin.style.color = "var(--primary)";
        tabLogin.style.fontWeight = "700";
      }
      if (tabRegister) {
        tabRegister.style.borderBottom = "3px solid transparent";
        tabRegister.style.color = "#64748b";
        tabRegister.style.fontWeight = "600";
      }
      if (loginForm) loginForm.classList.remove("hidden");
      if (registerForm) registerForm.classList.add("hidden");
    }
  }

  function openModal(defaultTab) {
    syncUI();
    const cust = getStoredCustomer();
    let hasPhone = !!(cust && cust.phone);
    try {
      if (!hasPhone) hasPhone = !!localStorage.getItem("ccrc_customer_phone");
    } catch (_) {}

    if (!hasPhone && defaultTab) {
      showTab(defaultTab);
    } else if (hasPhone) {
      refreshProfileFromServer();
    }

    const modal = document.getElementById("customer-auth-modal");
    if (modal) modal.classList.remove("hidden");
  }

  function closeModal() {
    const modal = document.getElementById("customer-auth-modal");
    if (modal) modal.classList.add("hidden");
  }

  async function logout() {
    if (!confirm("Are you sure you want to log out of your customer account?")) {
      return;
    }
    clearCustomerStorage();
    syncUI();
    closeModal();
    try {
      await fetch("/api/customer/logout", { method: "POST" });
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("ccrc:customer-auth-changed", { detail: { customer: null } }));
    window.location.reload();
  }

  function handleCustPhotoFile(file) {
    if (!file) return;
    const cPhotoImg = document.getElementById("c-reg-photo-img");
    const cPhotoPlaceholder = document.getElementById("c-reg-photo-placeholder");
    const cPhotoStatus = document.getElementById("c-photo-status");

    if (cPhotoStatus) {
      cPhotoStatus.textContent = "⏳ Processing photo...";
      cPhotoStatus.style.color = "#0284c7";
    }
    const reader = new FileReader();
    reader.onerror = function () {
      if (cPhotoStatus) {
        cPhotoStatus.textContent = "⚠️ Unable to read file.";
        cPhotoStatus.style.color = "#dc2626";
      }
    };
    reader.onload = function (e) {
      const img = new Image();
      img.onerror = function () {
        if (cPhotoStatus) {
          cPhotoStatus.textContent = "⚠️ Unable to read photo. Please choose a JPG or PNG file.";
          cPhotoStatus.style.color = "#dc2626";
        }
      };
      img.onload = function () {
        const maxDim = 480;
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
        currentCustAvatarBase64 = canvas.toDataURL("image/jpeg", 0.82);

        if (cPhotoImg) {
          cPhotoImg.src = currentCustAvatarBase64;
          cPhotoImg.classList.remove("hidden");
        }
        if (cPhotoPlaceholder) {
          cPhotoPlaceholder.classList.add("hidden");
        }
        if (cPhotoStatus) {
          cPhotoStatus.textContent = "✓ Photo ready (" + Math.round(currentCustAvatarBase64.length / 1024) + " KB)";
          cPhotoStatus.style.color = "#16a34a";
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function bindAuthHandlers() {
    const tabLogin = document.getElementById("cust-tab-login");
    const tabRegister = document.getElementById("cust-tab-register");
    const loginForm = document.getElementById("cust-login-form");
    const registerForm = document.getElementById("cust-register-form");
    const forgotForm = document.getElementById("cust-forgot-form");
    const switchForgotBtn = document.getElementById("c-switch-forgot-btn");
    const forgotBackBtn = document.getElementById("c-forgot-back-btn");

    if (tabLogin) {
      tabLogin.addEventListener("click", () => showTab("login"));
    }
    if (tabRegister) {
      tabRegister.addEventListener("click", () => showTab("register"));
    }
    if (switchForgotBtn && forgotForm) {
      switchForgotBtn.addEventListener("click", () => {
        showTab("forgot");
        const enteredPhone = document.getElementById("c-login-phone")?.value.trim();
        const forgotPhone = document.getElementById("c-forgot-phone");
        if (enteredPhone && forgotPhone && !forgotPhone.value) {
          forgotPhone.value = enteredPhone;
        }
      });
    }
    if (forgotBackBtn && forgotForm) {
      forgotBackBtn.addEventListener("click", () => showTab("login"));
    }

    if (forgotForm) {
      forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const forgotMsg = document.getElementById("c-forgot-msg");
        if (!forgotMsg) return;
        forgotMsg.classList.add("hidden");
        forgotMsg.textContent = "";

        const phone = document.getElementById("c-forgot-phone")?.value.trim() || "";
        const email = document.getElementById("c-forgot-email")?.value.trim() || "";
        const newPwd = document.getElementById("c-forgot-new-pwd")?.value || "";
        const confirmPwd = document.getElementById("c-forgot-confirm-pwd")?.value || "";
        const resetBtn = document.getElementById("c-forgot-btn");

        if (newPwd !== confirmPwd) {
          forgotMsg.style.background = "#fee2e2";
          forgotMsg.style.color = "#991b1b";
          forgotMsg.style.border = "1px solid #fca5a5";
          forgotMsg.textContent = "New password and confirmation password do not match.";
          forgotMsg.classList.remove("hidden");
          return;
        }

        resetBtn.disabled = true;
        resetBtn.textContent = "Verifying and saving...";

        try {
          const res = await fetch("/api/customer/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phone,
              email: email,
              new_password: newPwd,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to reset password.");

          forgotMsg.style.background = "#dcfce7";
          forgotMsg.style.color = "#166534";
          forgotMsg.style.border = "1px solid #86efac";
          forgotMsg.innerHTML = "✅ <strong>Success!</strong> " + (data.message || "Your password has been reset.") + "<br><small>Redirecting you to Log In...</small>";
          forgotMsg.classList.remove("hidden");

          const loginPhoneInput = document.getElementById("c-login-phone");
          if (loginPhoneInput) loginPhoneInput.value = phone;

          setTimeout(() => {
            showTab("login");
            forgotMsg.classList.add("hidden");
            const loginPwd = document.getElementById("c-login-pwd");
            if (loginPwd) loginPwd.focus();
          }, 1800);
        } catch (err) {
          forgotMsg.style.background = "#fee2e2";
          forgotMsg.style.color = "#991b1b";
          forgotMsg.style.border = "1px solid #fca5a5";
          forgotMsg.textContent = err.message;
          forgotMsg.classList.remove("hidden");
        } finally {
          resetBtn.disabled = false;
          resetBtn.textContent = "Save New Password →";
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("c-login-err");
        if (errEl) errEl.classList.add("hidden");
        const phone = document.getElementById("c-login-phone")?.value.trim();
        const password = document.getElementById("c-login-pwd")?.value;
        const btn = document.getElementById("c-login-btn");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Logging in...";
        }

        try {
          const res = await fetch("/api/customer/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, password }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Login failed");

          setStoredCustomer(data.customer);
          closeModal();
          alert(`Welcome back, ${data.customer.name}! Your account is verified.`);
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message;
            errEl.classList.remove("hidden");
          }
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Log In to CCRC →";
          }
        }
      });
    }

    const cCamBtn = document.getElementById("c-photo-camera-btn");
    const cGalBtn = document.getElementById("c-photo-gallery-btn");
    const cCamInput = document.getElementById("c-reg-file-camera");
    const cGalInput = document.getElementById("c-reg-file-gallery");

    if (cCamBtn && cCamInput) {
      cCamBtn.addEventListener("click", () => cCamInput.click());
    }
    if (cGalBtn && cGalInput) {
      cGalBtn.addEventListener("click", () => cGalInput.click());
    }
    if (cCamInput) {
      cCamInput.addEventListener("change", function () {
        if (this.files && this.files[0]) handleCustPhotoFile(this.files[0]);
      });
    }
    if (cGalInput) {
      cGalInput.addEventListener("change", function () {
        if (this.files && this.files[0]) handleCustPhotoFile(this.files[0]);
      });
    }

    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("c-reg-err");
        if (errEl) errEl.classList.add("hidden");
        const name = document.getElementById("c-reg-name")?.value.trim();
        const phone = document.getElementById("c-reg-phone")?.value.trim();
        const email = document.getElementById("c-reg-email")?.value.trim();
        const barangay = document.getElementById("c-reg-barangay")?.value;
        const password = document.getElementById("c-reg-pwd")?.value;

        if (!email || !email.includes("@") || !email.includes(".")) {
          if (errEl) {
            errEl.textContent = "Please enter a valid Email Address (e.g. maria@gmail.com).";
            errEl.classList.remove("hidden");
          }
          return;
        }
        if (!currentCustAvatarBase64) {
          if (errEl) {
            errEl.textContent = "Please take or choose a photo (Camera or Gallery) for your customer verification.";
            errEl.classList.remove("hidden");
          }
          return;
        }

        const btn = document.getElementById("c-reg-btn");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Registering...";
        }

        try {
          const res = await fetch("/api/customer/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              phone,
              email,
              barangay,
              password,
              avatar_base64: currentCustAvatarBase64,
            }),
          });
          let data = {};
          try {
            data = await res.json();
          } catch (_) {
            throw new Error(
              res.status === 502 || res.status === 503
                ? "The server is still restarting on Render. Please try again in a few seconds."
                : `Server error (${res.status}). Please try again.`
            );
          }
          if (!res.ok) throw new Error(data.error || "Registration failed. Please try again.");

          setStoredCustomer(data.customer);
          closeModal();
          alert(`Congratulations ${data.customer.name}! You are now a Verified CCRC Passenger (🛡️ Verified Badge).`);
        } catch (err) {
          if (errEl) {
            let msg = err.message || "";
            if (msg.toLowerCase().includes("fetch")) {
              msg = "Unable to connect to the server (Failed to fetch). The server may be deploying or restarting on Render. Please wait a few seconds and click again.";
            }
            errEl.textContent = msg;
            errEl.classList.remove("hidden");
          }
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Register & Get Verified Badge 🛡️";
          }
        }
      });
    }

    document.addEventListener("click", function (e) {
      const logoutTarget = e.target.closest("#header-cust-logout-btn, #c-profile-logout-btn");
      if (logoutTarget) {
        e.preventDefault();
        logout();
        return;
      }

      const profileTarget = e.target.closest("#customer-profile-btn");
      if (profileTarget) {
        e.preventDefault();
        openModal();
        return;
      }

      const signInTarget = e.target.closest("#customer-signin-btn, #customer-auth-btn");
      if (signInTarget) {
        e.preventDefault();
        openModal("login");
        return;
      }
    });
  }

  window.CCRCAuth = {
    getStoredCustomer: getStoredCustomer,
    setStoredCustomer: setStoredCustomer,
    syncUI: syncUI,
    openModal: openModal,
    closeModal: closeModal,
    logout: logout,
    refreshProfileFromServer: refreshProfileFromServer,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bindAuthHandlers();
      syncUI();
    });
  } else {
    bindAuthHandlers();
    syncUI();
  }
  window.addEventListener("pageshow", syncUI);
  window.addEventListener("storage", syncUI);
})();
