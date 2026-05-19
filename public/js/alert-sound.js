const MUTE_KEY = "siren-alerts-muted";

let muted = localStorage.getItem(MUTE_KEY) === "1";
let audioCtx = null;

const SOUND_ON_SVG = `<svg class="toolbar-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm7 3.5v3h2v-3h-2zm4.24-1.76a6.5 6.5 0 0 1 0 9.52l1.42 1.42a8 8 0 0 0 0-12.36l-1.42 1.42zm2.83-2.83a10.5 10.5 0 0 1 0 14.86l1.41 1.41a12 12 0 0 0 0-17.68l-1.41 1.41z"/></svg>`;

const SOUND_OFF_SVG = `<svg class="toolbar-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.27 3 2 4.27l4.74 4.74H3v6h4l5 5v-6.73l4.02 4.02a6.5 6.5 0 0 0 7.46 1.06l1.48 1.48 1.27-1.27-1.41-1.41L3.27 3zM14 3.23v2.06c2.89.86 5 3.54 5 6.71 0 1.08-.27 2.1-.74 3l1.46 1.46A8.96 8.96 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77z"/></svg>`;

function getCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function playNotificationSound() {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.45);
}

export function isAlertSoundMuted() {
  return muted;
}

export function updateAlertBadge(count) {
  const badge = document.getElementById("alert-badge");
  const bell = document.getElementById("btn-alert-bell");
  if (!badge) return;

  const n = Number(count) || 0;
  if (n > 0) {
    badge.textContent = n > 9 ? "9+" : String(n);
    badge.classList.remove("hidden");
    bell?.classList.add("toolbar-btn--bell-active");
  } else {
    badge.classList.add("hidden");
    bell?.classList.remove("toolbar-btn--bell-active");
  }
}

function syncSoundButton() {
  const btn = document.getElementById("btn-alert-sound");
  if (!btn) return;
  btn.innerHTML = muted ? SOUND_OFF_SVG : SOUND_ON_SVG;
  btn.classList.toggle("toolbar-btn--sound-muted", muted);
  btn.setAttribute(
    "aria-label",
    muted ? "Activar sonido de alertas" : "Silenciar sonido de alertas",
  );
  btn.title = muted ? "Activar sonido" : "Silenciar sonido";
}

export function initAlertSound() {
  const soundBtn = document.getElementById("btn-alert-sound");
  const bellBtn = document.getElementById("btn-alert-bell");

  syncSoundButton();

  soundBtn?.addEventListener("click", () => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    syncSoundButton();
    if (!muted) playNotificationSound();
  });

  bellBtn?.addEventListener("click", () => {
    document.querySelector('.nav-btn[data-view="alerts"]')?.click();
    setTimeout(() => {
      document.getElementById("alerts-list")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  });
}

export function bindAlertSocket(socket, { onNewAlerts } = {}) {
  socket.on("alerts-created", (payload) => {
    const loud = (payload?.alerts ?? []).some(
      (a) => a.severity === "warning" || a.severity === "critical",
    );
    if (loud || (payload?.count > 0 && !payload.alerts)) {
      playNotificationSound();
    }
    onNewAlerts?.(payload);
  });
}
