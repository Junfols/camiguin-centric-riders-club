(function () {
  "use strict";

  const DEFAULT_ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" }
  ];

  function tr(enText) {
    try {
      if (typeof window.ccrcT === "function") return window.ccrcT(enText);
    } catch (_) {}
    return enText;
  }

  function formatSec(totalSec) {
    const s = Math.max(0, Math.floor(Number(totalSec) || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }

  function supportsWebRTC() {
    return (
      typeof window.RTCPeerConnection !== "undefined" &&
      Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function")
    );
  }

  function pickRecorderMime() {
    if (typeof window.MediaRecorder === "undefined") return "";
    if (typeof MediaRecorder.isTypeSupported !== "function") return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg"
    ];
    for (const mime of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) return mime;
      } catch (_) {}
    }
    return "";
  }

  // Modal Elements
  const modal = document.getElementById("ccrc-call-modal");
  const avatarRing = document.getElementById("ccrc-call-avatar-ring");
  const avatarIcon = document.getElementById("ccrc-call-avatar-icon");
  const peerRoleEl = document.getElementById("ccrc-call-peer-role");
  const peerNameEl = document.getElementById("ccrc-call-peer-name");
  const bookingCodeEl = document.getElementById("ccrc-call-booking-code");
  const statusTextEl = document.getElementById("ccrc-call-status-text");
  const timerEl = document.getElementById("ccrc-call-timer");
  const incomingActions = document.getElementById("ccrc-call-incoming-actions");
  const answerBtn = document.getElementById("ccrc-call-answer-btn");
  const declineBtn = document.getElementById("ccrc-call-decline-btn");
  const activeActions = document.getElementById("ccrc-call-active-actions");
  const muteBtn = document.getElementById("ccrc-call-mute-btn");
  const hangupBtn = document.getElementById("ccrc-call-hangup-btn");
  const telFallbackBtn = document.getElementById("ccrc-call-tel-fallback");
  const voiceFallbackBtn = document.getElementById("ccrc-call-voice-note-fallback");
  const closeBtn = document.getElementById("ccrc-call-close-btn");
  const remoteAudioEl = document.getElementById("ccrc-remote-audio");

  const state = {
    role: null,
    riderId: null,
    riderPhone: "",
    bookingRef: null,
    bookingCode: "",
    peerName: "User",
    peerPhone: "",
    peerRoleLabel: "CCRC Member",
    canCall: false,
    onFallbackVoiceNote: null,

    activeCallKind: "booking", // "booking" | "rider"
    targetRiderId: null,
    iceServers: DEFAULT_ICE_SERVERS,
    activeCall: null,
    activeCallId: null,
    lastSignalId: 0,
    dismissedCallIds: new Set(),
    dismissedRiderCallIds: new Set(),
    pendingIncomingOffer: null,
    pendingRemoteCandidates: [],
    pendingOutgoingCandidates: [],
    remoteDescriptionSet: false,
    candidateFlushTimer: null,

    pc: null,
    localStream: null,
    isMuted: false,
    connectedAtMs: null,
    callDurationTimer: null,
    pollTimer: null,
    pollRateMs: 2200,
    isPolling: false,

    ringTimer: null,
    audioCtx: null
  };

  function getCsrfHeaders(extra) {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const csrf = meta ? meta.getAttribute("content") : "";
    return Object.assign(
      { "Content-Type": "application/json" },
      csrf ? { "X-CSRF-Token": csrf } : {},
      extra || {}
    );
  }

  function isRiderCallActive() {
    return state.activeCallKind === "rider";
  }

  function getRiderAuthCreds() {
    let rid = state.riderId;
    let rphone = state.riderPhone || "";
    if (!rid || !rphone) {
      try {
        const stored = JSON.parse(localStorage.getItem("ccrc_rider_session") || "null");
        if (stored) {
          if (!rid && stored.id) rid = Number(stored.id);
          if (!rphone && stored.phone) rphone = String(stored.phone);
        }
      } catch (_) {}
    }
    return { riderId: rid ? Number(rid) : null, riderPhone: rphone };
  }

  function appendRiderAuthToParams(qs) {
    const creds = getRiderAuthCreds();
    if (creds.riderId) qs.set("rider_id", String(creds.riderId));
    if (creds.riderPhone) qs.set("rider_phone", creds.riderPhone);
  }

  function withRiderAuthBody(payload) {
    const body = Object.assign({}, payload || {});
    if (state.role === "rider" || isRiderCallActive()) {
      const creds = getRiderAuthCreds();
      if (creds.riderId) body.rider_id = creds.riderId;
      if (creds.riderPhone) body.rider_phone = creds.riderPhone;
    }
    return body;
  }

  function getRespondUrl(callId) {
    return isRiderCallActive()
      ? `/api/rider/calls/session/${callId}/respond`
      : `/api/calls/session/${callId}/respond`;
  }

  function getSignalUrl(callId) {
    return isRiderCallActive()
      ? `/api/rider/calls/session/${callId}/signal`
      : `/api/calls/session/${callId}/signal`;
  }

  function getAudioCtx() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!state.audioCtx || state.audioCtx.state === "closed") {
        state.audioCtx = new AC();
      }
      if (state.audioCtx.state === "suspended") {
        state.audioCtx.resume().catch(() => {});
      }
      return state.audioCtx;
    } catch (_) {
      return null;
    }
  }

  function playToneBurst(freqA, freqB, volume, durationSec) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(freqA, now);
      gain1.gain.setValueAtTime(volume, now);
      gain1.gain.exponentialRampToValueAtTime(0.005, now + durationSec);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + durationSec);

      if (freqB) {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(freqB, now + durationSec + 0.06);
        gain2.gain.setValueAtTime(volume, now + durationSec + 0.06);
        gain2.gain.exponentialRampToValueAtTime(0.005, now + durationSec * 2 + 0.06);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + durationSec + 0.06);
        osc2.stop(now + durationSec * 2 + 0.06);
      }
    } catch (_) {}
  }

  function startRingtone(kind) {
    stopRingtone();
    if (kind === "incoming") {
      const triggerRing = () => {
        playToneBurst(659.25, 880.0, 0.24, 0.22);
        if ("vibrate" in navigator) {
          try { navigator.vibrate([240, 120, 240]); } catch (_) {}
        }
      };
      triggerRing();
      state.ringTimer = setInterval(triggerRing, 2100);
    } else if (kind === "outgoing") {
      const triggerBeep = () => playToneBurst(440.0, null, 0.09, 0.35);
      triggerBeep();
      state.ringTimer = setInterval(triggerBeep, 3000);
    }
  }

  function stopRingtone() {
    if (state.ringTimer) {
      clearInterval(state.ringTimer);
      state.ringTimer = null;
    }
  }

  function stopCallTimer() {
    if (state.callDurationTimer) {
      clearInterval(state.callDurationTimer);
      state.callDurationTimer = null;
    }
    state.connectedAtMs = null;
  }

  function startCallTimer() {
    if (state.callDurationTimer) return;
    state.connectedAtMs = Date.now();
    if (timerEl) {
      timerEl.textContent = "00:00";
      timerEl.classList.remove("hidden");
    }
    state.callDurationTimer = setInterval(() => {
      if (!timerEl || !state.connectedAtMs) return;
      timerEl.textContent = formatSec(Math.floor((Date.now() - state.connectedAtMs) / 1000));
    }, 500);
  }

  function cleanupWebRTC(stopMedia = true) {
    stopRingtone();
    stopCallTimer();
    if (state.candidateFlushTimer) {
      clearTimeout(state.candidateFlushTimer);
      state.candidateFlushTimer = null;
    }
    state.pendingOutgoingCandidates = [];
    state.pendingRemoteCandidates = [];
    state.pendingIncomingOffer = null;
    state.remoteDescriptionSet = false;
    state.isMuted = false;

    if (state.pc) {
      try {
        state.pc.onicecandidate = null;
        state.pc.ontrack = null;
        state.pc.onconnectionstatechange = null;
        state.pc.oniceconnectionstatechange = null;
        state.pc.close();
      } catch (_) {}
      state.pc = null;
    }
    if (stopMedia && state.localStream) {
      try {
        state.localStream.getTracks().forEach((t) => {
          try { t.stop(); } catch (_) {}
        });
      } catch (_) {}
      state.localStream = null;
    }
    if (remoteAudioEl) {
      try {
        remoteAudioEl.pause();
        remoteAudioEl.srcObject = null;
      } catch (_) {}
    }
    if (muteBtn) {
      muteBtn.textContent = tr("🎙️ Mute");
    }
  }

  function updateModalHeader(peerNameOverride, roleLabelOverride, codeOverride, phoneOverride) {
    if (peerRoleEl) peerRoleEl.textContent = tr(roleLabelOverride || state.peerRoleLabel || "CCRC Member");
    if (peerNameEl) peerNameEl.textContent = peerNameOverride || state.peerName || "CCRC Member";
    if (bookingCodeEl) bookingCodeEl.textContent = codeOverride !== undefined ? codeOverride : (state.bookingCode || "");
    const tel = phoneOverride !== undefined ? phoneOverride : state.peerPhone;
    if (telFallbackBtn) {
      if (tel) {
        telFallbackBtn.href = `tel:${tel}`;
        telFallbackBtn.classList.remove("hidden");
      } else {
        telFallbackBtn.classList.add("hidden");
      }
    }
    if (voiceFallbackBtn) {
      voiceFallbackBtn.classList.toggle("hidden", isRiderCallActive());
    }
  }

  function setModalMode(mode, statusMsg) {
    if (!modal) return;
    modal.classList.remove("hidden");

    if (statusTextEl) statusTextEl.textContent = statusMsg || "";
    if (avatarIcon) {
      avatarIcon.textContent = (state.role === "customer" || isRiderCallActive()) ? "🛵" : "👤";
    }
    if (avatarRing) {
      avatarRing.classList.toggle("ringing", mode === "incoming" || mode === "outgoing" || mode === "connecting");
    }

    if (incomingActions) incomingActions.classList.toggle("hidden", mode !== "incoming");
    if (activeActions) activeActions.classList.toggle("hidden", mode !== "outgoing" && mode !== "connecting" && mode !== "connected");
    if (closeBtn) closeBtn.classList.toggle("hidden", mode !== "ended" && mode !== "error");

    if (muteBtn) {
      muteBtn.disabled = mode !== "connected" && mode !== "connecting";
    }
    if (timerEl && mode !== "connected") {
      timerEl.classList.add("hidden");
    }
  }

  function closeModal() {
    if (state.activeCallId) {
      if (isRiderCallActive()) {
        state.dismissedRiderCallIds.add(Number(state.activeCallId));
      } else {
        state.dismissedCallIds.add(Number(state.activeCallId));
      }
    }
    cleanupWebRTC(true);
    state.activeCall = null;
    state.activeCallId = null;
    state.activeCallKind = "booking";
    state.targetRiderId = null;
    state.lastSignalId = 0;
    setPollingRate(2200);
    if (modal) modal.classList.add("hidden");
  }

  function shouldPoll() {
    return Boolean((state.bookingRef && state.canCall) || (state.role === "rider" && state.riderId));
  }

  function setPollingRate(ms) {
    if (state.pollRateMs === ms && state.pollTimer) return;
    state.pollRateMs = ms;
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    if (shouldPoll()) {
      state.pollTimer = setInterval(pollCallState, state.pollRateMs);
    }
  }

  async function flushOutgoingCandidates() {
    if (!state.activeCallId || state.pendingOutgoingCandidates.length === 0) return;
    const batch = state.pendingOutgoingCandidates.splice(0, 30);
    try {
      await fetch(getSignalUrl(state.activeCallId), {
        method: "POST",
        headers: getCsrfHeaders(),
        body: JSON.stringify(withRiderAuthBody({ candidates: batch }))
      });
    } catch (_) {}
  }

  function queueOutgoingCandidate(candidate) {
    if (!candidate) return;
    const candJson = typeof candidate.toJSON === "function" ? candidate.toJSON() : candidate;
    state.pendingOutgoingCandidates.push(candJson);
    if (state.candidateFlushTimer) return;
    state.candidateFlushTimer = setTimeout(() => {
      state.candidateFlushTimer = null;
      flushOutgoingCandidates();
    }, 150);
  }

  async function applyRemoteSignal(sig) {
    if (!sig || !sig.signal_type) return;
    const sigType = sig.signal_type;
    const payload = sig.data;

    if (sigType === "offer") {
      state.pendingIncomingOffer = payload;
      return;
    }

    if (!state.pc) {
      if (sigType === "candidate" && payload) {
        state.pendingRemoteCandidates.push(payload);
      }
      return;
    }

    try {
      if (sigType === "answer" && payload) {
        if (state.pc.signalingState !== "stable") {
          await state.pc.setRemoteDescription(new RTCSessionDescription(payload));
          state.remoteDescriptionSet = true;
          while (state.pendingRemoteCandidates.length > 0) {
            const c = state.pendingRemoteCandidates.shift();
            try { await state.pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
          }
        }
      } else if (sigType === "candidate" && payload) {
        if (state.remoteDescriptionSet) {
          await state.pc.addIceCandidate(new RTCIceCandidate(payload));
        } else {
          state.pendingRemoteCandidates.push(payload);
        }
      }
    } catch (_) {}
  }

  function createPeerConnection(iceServers) {
    const servers = Array.isArray(iceServers) && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;
    const pc = new RTCPeerConnection({ iceServers: servers });

    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, state.localStream);
      });
    }

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        queueOutgoingCandidate(evt.candidate);
      }
    };

    pc.ontrack = (evt) => {
      if (!remoteAudioEl) return;
      const stream = (evt.streams && evt.streams[0]) || new MediaStream([evt.track]);
      remoteAudioEl.srcObject = stream;
      remoteAudioEl.muted = false;
      remoteAudioEl.play().catch(() => {});
    };

    const handleStateChange = () => {
      if (!state.pc || state.pc !== pc) return;
      const connState = pc.connectionState || pc.iceConnectionState;
      if (connState === "connected" || connState === "completed") {
        stopRingtone();
        setModalMode("connected", tr("🟢 Connected (Free In-App Voice)"));
        startCallTimer();
        setPollingRate(2400);
      } else if (connState === "failed") {
        stopRingtone();
        if (statusTextEl) {
          statusTextEl.textContent = tr("⚠️ Weak mobile signal prevented audio link. Try Regular Phone Call or Voice Message below.");
        }
      }
    };

    pc.onconnectionstatechange = handleStateChange;
    pc.oniceconnectionstatechange = handleStateChange;
    return pc;
  }

  async function acquireMicrophone() {
    if (!supportsWebRTC()) {
      throw Object.assign(new Error("WebRTC audio calls require HTTPS and microphone support."), { code: "NO_WEBRTC" });
    }
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  }

  async function startCall() {
    if (!state.bookingRef || !state.canCall) {
      alert(tr("Free in-app calls are available once a rider is assigned and before the trip completes."));
      return;
    }
    if (state.activeCallId && state.pc) {
      if (modal) modal.classList.remove("hidden");
      return;
    }

    cleanupWebRTC(true);
    state.activeCall = null;
    state.activeCallId = null;
    state.activeCallKind = "booking";
    state.targetRiderId = null;
    state.lastSignalId = 0;

    updateModalHeader(state.peerName, state.peerRoleLabel, state.bookingCode, state.peerPhone);

    if (!supportsWebRTC()) {
      setModalMode(
        "error",
        tr("⚠️ Live in-app calling requires an HTTPS connection and microphone access. Use Regular Phone Call or Voice Message below.")
      );
      return;
    }

    setModalMode("connecting", tr("🎙️ Requesting microphone access..."));

    try {
      state.localStream = await acquireMicrophone();
    } catch (err) {
      const msg = err && err.name === "NotAllowedError"
        ? tr("🎙️ Microphone permission denied. Allow microphone access in browser settings, or use the backup options below.")
        : tr("🎙️ Microphone not available on this device. Use the backup options below.");
      cleanupWebRTC(true);
      setModalMode("error", msg);
      return;
    }

    try {
      let iceServers = state.iceServers;
      try {
        const iceRes = await fetch("/api/rtc/ice-config");
        if (iceRes.ok) {
          const iceJson = await iceRes.json();
          if (iceJson && Array.isArray(iceJson.ice_servers)) {
            iceServers = iceJson.ice_servers;
            state.iceServers = iceServers;
          }
        }
      } catch (_) {}

      const pc = createPeerConnection(iceServers);
      state.pc = pc;
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      setModalMode("outgoing", tr("📞 Calling... Waiting for answer"));
      startRingtone("outgoing");

      const res = await fetch(`/api/calls/${encodeURIComponent(state.bookingRef)}/start`, {
        method: "POST",
        headers: getCsrfHeaders(),
        body: JSON.stringify(withRiderAuthBody({
          offer: { type: offer.type, sdp: offer.sdp }
        }))
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data && data.call) {
        cleanupWebRTC(true);
        if (data.call.status === "ringing" && data.call.callee_role === state.role) {
          await pollCallState();
          return;
        }
        setModalMode("error", data.error || tr("A call is already active."));
        return;
      }

      if (!res.ok || !data.success || !data.call) {
        throw new Error(data.error || tr("Could not start in-app call."));
      }

      if (Array.isArray(data.ice_servers)) {
        state.iceServers = data.ice_servers;
      }
      state.activeCall = data.call;
      state.activeCallId = Number(data.call.id);
      state.activeCallKind = "booking";
      setPollingRate(950);
      await flushOutgoingCandidates();
    } catch (err) {
      cleanupWebRTC(true);
      setModalMode("error", (err && err.message) || tr("Unable to start in-app call."));
    }
  }

  async function startRiderCall(targetRiderId, peerName, peerPhone, peerMunicipality) {
    const targetId = Number(targetRiderId);
    if (!targetId) return;
    const creds = getRiderAuthCreds();
    if (creds.riderId && !state.riderId) state.riderId = creds.riderId;
    if (creds.riderPhone && !state.riderPhone) state.riderPhone = creds.riderPhone;
    if (!state.role && creds.riderId) state.role = "rider";
    if (state.activeCallId && state.pc) {
      if (modal) modal.classList.remove("hidden");
      return;
    }

    cleanupWebRTC(true);
    state.activeCall = null;
    state.activeCallId = null;
    state.activeCallKind = "rider";
    state.targetRiderId = targetId;
    state.lastSignalId = 0;

    const codeLabel = peerMunicipality ? `CCRC Co-Rider • ${peerMunicipality}` : "CCRC Fellow Rider";
    updateModalHeader(peerName || "Fellow Rider", tr("Fellow Club Rider"), codeLabel, peerPhone || "");

    if (!supportsWebRTC()) {
      setModalMode(
        "error",
        tr("⚠️ Live in-app calling requires an HTTPS connection and microphone access. Use Regular Phone Call below.")
      );
      return;
    }

    setModalMode("connecting", tr("🎙️ Requesting microphone access..."));

    try {
      state.localStream = await acquireMicrophone();
    } catch (err) {
      const msg = err && err.name === "NotAllowedError"
        ? tr("🎙️ Microphone permission denied. Allow microphone access in browser settings, or use the backup options below.")
        : tr("🎙️ Microphone not available on this device. Use the backup options below.");
      cleanupWebRTC(true);
      setModalMode("error", msg);
      return;
    }

    try {
      let iceServers = state.iceServers;
      try {
        const iceRes = await fetch("/api/rtc/ice-config");
        if (iceRes.ok) {
          const iceJson = await iceRes.json();
          if (iceJson && Array.isArray(iceJson.ice_servers)) {
            iceServers = iceJson.ice_servers;
            state.iceServers = iceServers;
          }
        }
      } catch (_) {}

      const pc = createPeerConnection(iceServers);
      state.pc = pc;
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      setModalMode("outgoing", tr("📞 Calling fellow rider... Waiting for answer"));
      startRingtone("outgoing");

      const res = await fetch(`/api/rider/calls/${encodeURIComponent(targetId)}/start`, {
        method: "POST",
        headers: getCsrfHeaders(),
        body: JSON.stringify(withRiderAuthBody({
          offer: { type: offer.type, sdp: offer.sdp }
        }))
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data && data.call) {
        cleanupWebRTC(true);
        const myRiderRole = `rider:${state.riderId}`;
        if (data.call.status === "ringing" && data.call.callee_role === myRiderRole) {
          await pollCallState();
          return;
        }
        setModalMode("error", data.error || tr("Rider is already in a call."));
        return;
      }

      if (!res.ok || !data.success || !data.call) {
        throw new Error(data.error || tr("Could not start rider call."));
      }

      if (Array.isArray(data.ice_servers)) {
        state.iceServers = data.ice_servers;
      }
      state.activeCall = data.call;
      state.activeCallId = Number(data.call.id);
      state.activeCallKind = "rider";
      setPollingRate(950);
      await flushOutgoingCandidates();
    } catch (err) {
      cleanupWebRTC(true);
      setModalMode("error", (err && err.message) || tr("Unable to start rider call."));
    }
  }

  async function answerIncomingCall() {
    const call = state.activeCall;
    if (!call || !state.activeCallId) return;

    stopRingtone();
    const isRider = isRiderCallActive();
    const roleLabel = isRider ? tr("Fellow Club Rider") : state.peerRoleLabel;
    const codeLabel = isRider ? "CCRC Co-Rider Direct Call" : state.bookingCode;
    const myRoleMatch = isRider ? `rider:${state.riderId}` : state.role;

    updateModalHeader(call.caller_name || state.peerName, roleLabel, codeLabel, state.peerPhone);
    setModalMode("connecting", tr("🎙️ Connecting audio..."));

    try {
      state.localStream = await acquireMicrophone();
    } catch (err) {
      const msg = err && err.name === "NotAllowedError"
        ? tr("🎙️ Microphone permission denied. Please enable microphone access to answer.")
        : tr("🎙️ Microphone unavailable on this device.");
      cleanupWebRTC(true);
      setModalMode("error", msg);
      return;
    }

    try {
      // Ensure we definitely have the caller's SDP offer and queued candidates
      if (!state.pendingIncomingOffer) {
        const ansQs = new URLSearchParams();
        ansQs.set("call_id", String(state.activeCallId));
        ansQs.set("after_signal_id", "0");
        if (isRider || state.role === "rider") appendRiderAuthToParams(ansQs);
        const stateUrl = isRider
          ? `/api/rider/calls/state?${ansQs.toString()}`
          : `/api/calls/${encodeURIComponent(state.bookingRef)}/state?${ansQs.toString()}`;
        const stRes = await fetch(stateUrl);
        if (stRes.ok) {
          const stData = await stRes.json();
          if (stData && Array.isArray(stData.ice_servers)) state.iceServers = stData.ice_servers;
          if (stData && Array.isArray(stData.signals)) {
            for (const sig of stData.signals) {
              if (sig.signal_type === "offer" && sig.data) state.pendingIncomingOffer = sig.data;
              if (sig.signal_type === "candidate" && sig.data && sig.sender_role !== myRoleMatch) {
                state.pendingRemoteCandidates.push(sig.data);
              }
              if (sig.id > state.lastSignalId) state.lastSignalId = sig.id;
            }
          }
        }
      }

      if (!state.pendingIncomingOffer) {
        throw new Error(tr("Call offer expired. Please try calling back."));
      }

      const pc = createPeerConnection(state.iceServers);
      state.pc = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(state.pendingIncomingOffer));
      state.remoteDescriptionSet = true;
      while (state.pendingRemoteCandidates.length > 0) {
        const c = state.pendingRemoteCandidates.shift();
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const res = await fetch(getRespondUrl(state.activeCallId), {
        method: "POST",
        headers: getCsrfHeaders(),
        body: JSON.stringify(withRiderAuthBody({
          action: "accept",
          answer: { type: answer.type, sdp: answer.sdp }
        }))
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || tr("Call is no longer ringing."));
      }

      state.activeCall = data.call;
      setPollingRate(950);
      await flushOutgoingCandidates();
    } catch (err) {
      cleanupWebRTC(true);
      setModalMode("error", (err && err.message) || tr("Could not connect call."));
    }
  }

  async function declineIncomingCall() {
    const callId = state.activeCallId;
    const isRider = isRiderCallActive();
    stopRingtone();
    if (callId) {
      if (isRider) state.dismissedRiderCallIds.add(Number(callId));
      else state.dismissedCallIds.add(Number(callId));
      try {
        await fetch(getRespondUrl(callId), {
          method: "POST",
          headers: getCsrfHeaders(),
          body: JSON.stringify(withRiderAuthBody({ action: "decline", reason: "Declined" }))
        });
      } catch (_) {}
    }
    closeModal();
  }

  async function hangupCall() {
    const callId = state.activeCallId;
    const isRider = isRiderCallActive();
    stopRingtone();
    cleanupWebRTC(true);
    if (callId) {
      if (isRider) state.dismissedRiderCallIds.add(Number(callId));
      else state.dismissedCallIds.add(Number(callId));
      try {
        await fetch(getRespondUrl(callId), {
          method: "POST",
          headers: getCsrfHeaders(),
          body: JSON.stringify(withRiderAuthBody({ action: "hangup", reason: "Ended call" }))
        });
      } catch (_) {}
    }
    state.activeCall = null;
    state.activeCallId = null;
    state.activeCallKind = "booking";
    state.targetRiderId = null;
    setPollingRate(2200);
    if (modal) modal.classList.add("hidden");
  }

  function toggleMute() {
    if (!state.localStream) return;
    state.isMuted = !state.isMuted;
    state.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !state.isMuted;
    });
    if (muteBtn) {
      muteBtn.textContent = state.isMuted ? tr("🔇 Muted") : tr("🎙️ Mute");
    }
  }

  function handleTerminalCallState(call) {
    const status = call.status;
    if (isRiderCallActive() || call.call_kind === "rider_to_rider") {
      state.dismissedRiderCallIds.add(Number(call.id));
    } else {
      state.dismissedCallIds.add(Number(call.id));
    }
    cleanupWebRTC(true);
    state.activeCall = null;
    state.activeCallId = null;
    state.activeCallKind = "booking";
    state.targetRiderId = null;
    state.lastSignalId = 0;
    setPollingRate(2200);

    let msg = tr("📵 Call ended.");
    if (status === "declined") msg = tr("📵 Call was declined.");
    else if (status === "missed") msg = tr("📵 No answer.");
    else if (call.end_reason) msg = `📵 ${call.end_reason}`;

    // Keep modal open to show terminal reason + fallback options if modal was visible
    if (modal && !modal.classList.contains("hidden")) {
      setModalMode("ended", msg);
    }
  }

  async function processPolledCallData(data, kind) {
    if (!data || !data.success) return false;
    const isRider = kind === "rider";
    const myRole = isRider ? (data.viewer_role || `rider:${state.riderId}`) : state.role;
    const dismissedSet = isRider ? state.dismissedRiderCallIds : state.dismissedCallIds;

    if (Array.isArray(data.ice_servers)) {
      state.iceServers = data.ice_servers;
    }

    const call = data.call;
    if (!call) {
      if (state.activeCallId && state.activeCallKind === kind && state.pc) {
        cleanupWebRTC(true);
        state.activeCall = null;
        state.activeCallId = null;
        state.activeCallKind = "booking";
        state.targetRiderId = null;
        setPollingRate(2200);
        if (modal && !modal.classList.contains("hidden")) {
          setModalMode("ended", tr("📵 Call ended."));
        }
      }
      return false;
    }

    const callId = Number(call.id);
    if (dismissedSet.has(callId) && (!state.activeCallId || state.activeCallId !== callId || state.activeCallKind !== kind)) {
      return false;
    }

    const signals = Array.isArray(data.signals) ? data.signals : [];

    // Case 1: New incoming ringing call for us!
    if (
      call.status === "ringing" &&
      call.callee_role === myRole &&
      (!state.activeCallId || state.activeCallId !== callId || state.activeCallKind !== kind)
    ) {
      // Do not interrupt an already accepted live call of another kind
      if (state.activeCallId && state.activeCall && state.activeCall.status === "accepted") {
        return false;
      }

      cleanupWebRTC(true);
      state.activeCall = call;
      state.activeCallId = callId;
      state.activeCallKind = kind;
      state.lastSignalId = 0;
      if (data.peer_name) state.peerName = data.peer_name;
      if (data.peer_phone !== undefined) state.peerPhone = data.peer_phone;

      for (const sig of signals) {
        if (sig.sender_role !== myRole) {
          await applyRemoteSignal(sig);
        }
        if (sig.id > state.lastSignalId) state.lastSignalId = sig.id;
      }

      const roleLabel = isRider ? tr("Fellow Club Rider") : state.peerRoleLabel;
      const codeLabel = isRider ? "CCRC Co-Rider Direct Call" : state.bookingCode;
      updateModalHeader(call.caller_name || state.peerName, roleLabel, codeLabel, state.peerPhone);
      setModalMode("incoming", isRider ? tr("📞 Incoming Co-Rider Voice Call...") : tr("📞 Incoming Free In-App Voice Call..."));
      startRingtone("incoming");
      setPollingRate(1000);

      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        try {
          new Notification("CCRC Free In-App Call", {
            body: `${call.caller_name || state.peerName} is calling you (${codeLabel})`,
            icon: "/static/icons/icon-192.png?v=3"
          });
        } catch (_) {}
      }
      return true;
    }

    // Case 2: Ongoing/tracked call matching activeCallId and kind
    if (state.activeCallId === callId && state.activeCallKind === kind) {
      state.activeCall = call;
      if (data.peer_name) state.peerName = data.peer_name;
      if (data.peer_phone !== undefined) state.peerPhone = data.peer_phone;

      for (const sig of signals) {
        if (sig.sender_role !== myRole) {
          await applyRemoteSignal(sig);
        }
        if (sig.id > state.lastSignalId) state.lastSignalId = sig.id;
      }

      if (call.status === "accepted") {
        stopRingtone();
        if (!state.pc || (state.pc.connectionState !== "connected" && state.pc.iceConnectionState !== "connected")) {
          if (statusTextEl && (!state.connectedAtMs)) {
            statusTextEl.textContent = tr("🔄 Connecting voice audio...");
          }
        }
      } else if (["ended", "declined", "missed"].includes(call.status)) {
        handleTerminalCallState(call);
      }
      return true;
    }

    if (call.status === "ringing" && call.caller_role === myRole && state.activeCallKind === kind) {
      for (const sig of signals) {
        if (sig.id > state.lastSignalId) state.lastSignalId = sig.id;
      }
      return true;
    }

    return false;
  }

  async function pollCallState() {
    if (!shouldPoll() || state.isPolling) return;
    state.isPolling = true;
    try {
      // If actively in a rider-to-rider call, poll rider call state first
      if (state.activeCallId && state.activeCallKind === "rider") {
        const rQs = new URLSearchParams();
        rQs.set("after_signal_id", String(state.lastSignalId || 0));
        rQs.set("call_id", String(state.activeCallId));
        appendRiderAuthToParams(rQs);
        const rRes = await fetch(`/api/rider/calls/state?${rQs.toString()}`);
        if (rRes.ok) {
          const rData = await rRes.json();
          await processPolledCallData(rData, "rider");
        }
        return;
      }

      // Poll booking call state if a booking is active
      if (state.bookingRef && state.canCall) {
        const qs = new URLSearchParams();
        qs.set("after_signal_id", String(state.activeCallKind === "booking" ? (state.lastSignalId || 0) : 0));
        if (state.activeCallId && state.activeCallKind === "booking") {
          qs.set("call_id", String(state.activeCallId));
        }
        if (state.role === "rider") appendRiderAuthToParams(qs);
        const res = await fetch(`/api/calls/${encodeURIComponent(state.bookingRef)}/state?${qs.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const handledBooking = await processPolledCallData(data, "booking");
          if (handledBooking && state.activeCallId) return;
        }
      }

      // Also poll rider-to-rider call state if logged in as a rider
      if (state.role === "rider" && state.riderId) {
        const rQs = new URLSearchParams();
        rQs.set("after_signal_id", "0");
        appendRiderAuthToParams(rQs);
        const rRes = await fetch(`/api/rider/calls/state?${rQs.toString()}`);
        if (rRes.ok) {
          const rData = await rRes.json();
          await processPolledCallData(rData, "rider");
        }
      }
    } catch (_) {
    } finally {
      state.isPolling = false;
    }
  }

  function configure(opts) {
    if (!opts) return;
    const prevRef = state.bookingRef ? String(state.bookingRef) : null;
    const nextRef = opts.bookingRef ? String(opts.bookingRef) : null;
    const prevCanCall = state.canCall;

    state.role = opts.role || state.role;
    if (opts.riderId !== undefined) state.riderId = opts.riderId ? Number(opts.riderId) : null;
    if (opts.riderPhone !== undefined) state.riderPhone = opts.riderPhone ? String(opts.riderPhone) : "";
    state.bookingRef = opts.bookingRef || null;
    state.bookingCode = opts.bookingCode || state.bookingCode || "";
    if (!isRiderCallActive()) {
      if (opts.peerName) state.peerName = opts.peerName;
      if (opts.peerPhone !== undefined) state.peerPhone = opts.peerPhone;
      if (opts.peerRoleLabel) state.peerRoleLabel = opts.peerRoleLabel;
    }
    if (typeof opts.onFallbackVoiceNote === "function") state.onFallbackVoiceNote = opts.onFallbackVoiceNote;
    state.canCall = Boolean(opts.canCall && state.bookingRef);

    // Only hang up if an active BOOKING call had its bookingRef removed/changed
    if (!isRiderCallActive() && (prevRef !== nextRef || (prevCanCall && !state.canCall))) {
      if (state.activeCallId) {
        hangupCall();
      } else {
        cleanupWebRTC(true);
      }
      state.activeCall = null;
      state.activeCallId = null;
      state.lastSignalId = 0;
    }

    if (shouldPoll()) {
      if (!state.pollTimer) {
        pollCallState();
        state.pollTimer = setInterval(pollCallState, state.pollRateMs);
      }
    } else if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  // Wire Modal Buttons Once
  if (answerBtn) answerBtn.addEventListener("click", answerIncomingCall);
  if (declineBtn) declineBtn.addEventListener("click", declineIncomingCall);
  if (hangupBtn) hangupBtn.addEventListener("click", hangupCall);
  if (muteBtn) muteBtn.addEventListener("click", toggleMute);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (voiceFallbackBtn) {
    voiceFallbackBtn.addEventListener("click", () => {
      const cb = state.onFallbackVoiceNote;
      if (state.activeCallId) hangupCall();
      else closeModal();
      if (typeof cb === "function") cb();
    });
  }

  window.addEventListener("pagehide", () => {
    if (state.activeCallId && state.activeCall && ["ringing", "accepted"].includes(state.activeCall.status)) {
      try {
        fetch(getRespondUrl(state.activeCallId), {
          method: "POST",
          headers: getCsrfHeaders(),
          body: JSON.stringify(withRiderAuthBody({ action: "hangup", reason: "Page closed" })),
          keepalive: true
        });
      } catch (_) {}
    }
  });


  // ---------------------------------------------------------------------------
  // Voice Message Recorder Binding (Shared for Customer & Rider Chat)
  // ---------------------------------------------------------------------------
  function bindVoiceRecorder(cfg) {
    const triggerBtn = cfg.triggerBtn;
    const barEl = cfg.barEl;
    const timerEl = cfg.timerEl;
    const cancelBtn = cfg.cancelBtn;
    const sendBtn = cfg.sendBtn;
    if (!triggerBtn || !barEl) return null;

    if (typeof window.MediaRecorder === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      triggerBtn.title = tr("Voice recording requires HTTPS / modern mobile browser");
      triggerBtn.addEventListener("click", () => {
        alert(tr("Voice recording requires HTTPS and microphone support on your browser."));
      });
      return null;
    }

    let recorder = null;
    let recStream = null;
    let chunks = [];
    let recStartMs = 0;
    let recTickTimer = null;
    let cancelled = false;
    let uploading = false;

    function cleanupRec() {
      if (recTickTimer) {
        clearInterval(recTickTimer);
        recTickTimer = null;
      }
      if (recStream) {
        try {
          recStream.getTracks().forEach((t) => {
            try { t.stop(); } catch (_) {}
          });
        } catch (_) {}
        recStream = null;
      }
      recorder = null;
      chunks = [];
      triggerBtn.classList.remove("recording");
      barEl.classList.add("hidden");
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = tr("Send Voice ✈️");
      }
    }

    async function beginRecording() {
      if (uploading) return;
      if (state.pc) {
        alert(tr("Please end your live voice call first before recording a voice message."));
        return;
      }
      if (recorder && recorder.state === "recording") {
        finishAndSend();
        return;
      }

      try {
        recStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
      } catch (err) {
        alert(tr("Could not access microphone. Please allow Microphone permission in your browser."));
        cleanupRec();
        return;
      }

      const mime = pickRecorderMime();
      try {
        const opts = mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 };
        recorder = new MediaRecorder(recStream, opts);
      } catch (_) {
        recorder = new MediaRecorder(recStream);
      }

      cancelled = false;
      chunks = [];
      recStartMs = Date.now();
      if (timerEl) timerEl.textContent = "0:00";

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = async () => {
        if (cancelled) {
          cleanupRec();
          return;
        }
        const elapsedSec = Math.max(0.5, (Date.now() - recStartMs) / 1000);
        const recMime = (recorder && recorder.mimeType) || mime || "audio/webm";
        const baseMime = recMime.split(";")[0].trim().toLowerCase() || "audio/webm";
        const blob = new Blob(chunks, { type: baseMime });

        if (!blob || blob.size < 50) {
          cleanupRec();
          alert(tr("Voice recording was too short. Please hold/speak for at least 1 second."));
          return;
        }

        uploading = true;
        if (sendBtn) {
          sendBtn.disabled = true;
          sendBtn.textContent = tr("Sending...");
        }

        try {
          const uploadUrl = typeof cfg.getUploadUrl === "function" ? cfg.getUploadUrl() : "";
          if (!uploadUrl) throw new Error("No active chat target.");
          const fd = new FormData();
          const ext = baseMime.includes("mp4") || baseMime.includes("m4a") ? "m4a" : (baseMime.includes("ogg") ? "ogg" : "webm");
          fd.append("audio", blob, `voice.${ext}`);
          fd.append("mimetype", baseMime);
          fd.append("duration", String(elapsedSec.toFixed(1)));

          const res = await fetch(uploadUrl, {
            method: "POST",
            body: fd
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.success) {
            throw new Error(data.error || tr("Could not upload voice message."));
          }
          if (typeof cfg.onUploaded === "function") {
            cfg.onUploaded(data);
          }
        } catch (err) {
          alert((err && err.message) || tr("Could not upload voice message."));
        } finally {
          uploading = false;
          cleanupRec();
        }
      };

      try {
        recorder.start(250);
      } catch (_) {
        recorder.start();
      }
      triggerBtn.classList.add("recording");
      barEl.classList.remove("hidden");

      recTickTimer = setInterval(() => {
        const secs = Math.floor((Date.now() - recStartMs) / 1000);
        if (timerEl) timerEl.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
        if (secs >= 58 && recorder && recorder.state === "recording") {
          finishAndSend();
        }
      }, 250);
    }

    function finishAndSend() {
      if (!recorder || recorder.state !== "recording") return;
      cancelled = false;
      try { recorder.stop(); } catch (_) { cleanupRec(); }
    }

    function cancelRecording() {
      cancelled = true;
      if (recorder && recorder.state === "recording") {
        try { recorder.stop(); } catch (_) { cleanupRec(); }
      } else {
        cleanupRec();
      }
    }

    triggerBtn.addEventListener("click", beginRecording);
    if (cancelBtn) cancelBtn.addEventListener("click", cancelRecording);
    if (sendBtn) sendBtn.addEventListener("click", finishAndSend);

    return {
      startRecording: beginRecording,
      cancelRecording: cancelRecording
    };
  }

  window.CCRCVoiceCall = {
    configure: configure,
    startCall: startCall,
    startRiderCall: startRiderCall,
    hangupCall: hangupCall,
    bindVoiceRecorder: bindVoiceRecorder
  };
})();
