import { resetCharts } from "./charts.js";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => root.querySelectorAll(s);

let sessionCache = null;
let onSessionChanged = null;
let apiJsonFn = null;
let lastBuildingId = null;
let scheduleFormDirty = false;
let scheduleSaveInFlight = false;

async function apiJson(path, opts = {}) {
  const fn = apiJsonFn;
  if (!fn) throw new Error("API no configurada");
  return fn(path, opts);
}

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getSelectedDays(root) {
  const days = [];
  $$(".ms-day:checked", root).forEach((cb) => {
    days.push(Number(cb.value));
  });
  return days.sort((a, b) => a - b);
}

function setSelectedDays(root, days) {
  $$(".ms-day", root).forEach((cb) => {
    cb.checked = days.includes(Number(cb.value));
  });
}

function collectScheduleFromForm(panel) {
  return {
    enabled: $("#ms-schedule-enabled")?.checked ?? false,
    days: getSelectedDays(panel),
    startTime: $("#ms-start-time")?.value || "08:00",
    endTime: $("#ms-end-time")?.value || "20:00",
  };
}

function renderMeasurementForm(s, panel) {
  const schedEnabled = $("#ms-schedule-enabled");
  const schedFields = $("#ms-schedule-fields");
  if (schedEnabled) {
    schedEnabled.checked = Boolean(s.schedule?.enabled);
    schedFields?.classList.toggle("hidden", !schedEnabled.checked);
  }
  if (s.schedule) {
    setSelectedDays(panel, s.schedule.days || []);
    const start = $("#ms-start-time");
    const end = $("#ms-end-time");
    if (start) start.value = s.schedule.startTime || "08:00";
    if (end) end.value = s.schedule.endTime || "20:00";
  }
  const manualBtns = $("#ms-manual-actions");
  if (manualBtns) {
    manualBtns.classList.toggle("hidden", Boolean(s.schedule?.enabled));
  }
}

function renderMeasurementStatus(s) {
  const badge = $("#ms-status-badge");
  if (badge) {
    badge.textContent = s.statusLabel;
    badge.className = "ms-status-badge status-" + (s.status || "paused");
  }

  const detail = $("#ms-status-detail");
  if (detail) {
    let text = s.accumulating
      ? "Se están sumando kWh y costo en las gráficas."
      : "La demanda (kW) sigue en vivo; el consumo acumulado no aumenta.";
    if (s.schedule?.enabled) {
      const days = (s.schedule.days || [])
        .map((d) => s.dayLabels?.[d] ?? d)
        .join(", ");
      text +=
        " Horario: " +
        days +
        " · " +
        s.schedule.startTime +
        " – " +
        s.schedule.endTime +
        ".";
    }
    detail.textContent = text;
  }

  const times = $("#ms-times");
  if (times) {
    times.innerHTML =
      "<span>Inicio de sesión: <strong>" +
      formatWhen(s.startedAt) +
      "</strong></span>" +
      "<span>Último reinicio: <strong>" +
      formatWhen(s.lastResetAt) +
      "</strong></span>";
  }

  renderScheduleNotice(s);
  renderBuildingChangeHint(s);
}

export function renderMeasurementPanel(session, overview) {
  const panel = $("#measurement-panel");
  if (!panel) return;

  sessionCache = session ?? overview?.measurementSession ?? sessionCache;
  const s = sessionCache;
  if (!s) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");

  renderMeasurementStatus(s);
  if (!scheduleFormDirty && !scheduleSaveInFlight) {
    renderMeasurementForm(s, panel);
  }
}

async function saveScheduleFromForm(panel, { silent = false } = {}) {
  let schedule = collectScheduleFromForm(panel);
  if (schedule.enabled && !schedule.days.length) {
    schedule.days = [1, 2, 3, 4, 5];
    setSelectedDays(panel, schedule.days);
  }
  scheduleSaveInFlight = true;
  try {
    await apiJson("/monitoring/session/schedule", {
      method: "PUT",
      body: schedule,
    });
    scheduleFormDirty = false;
    sessionCache = await apiJson("/monitoring/session");
    renderMeasurementStatus(sessionCache);
    renderMeasurementForm(sessionCache, panel);
    if (onSessionChanged) {
      await onSessionChanged({ session: sessionCache });
    }
    return true;
  } catch (err) {
    console.error(err);
    if (!silent) alert("No se pudo guardar el horario. Intenta de nuevo.");
    return false;
  } finally {
    scheduleSaveInFlight = false;
  }
}

function renderScheduleNotice(s) {
  const notice = $("#ms-schedule-notice");
  if (!notice) return;
  const up = s.scheduleUpcoming;
  if (!s.schedule?.enabled || !up) {
    notice.classList.add("hidden");
    notice.textContent = "";
    return;
  }
  notice.textContent = up.message;
  notice.classList.toggle("ms-schedule-notice--warn", Boolean(up.showWarning));
  notice.classList.toggle("hidden", false);
}

function renderBuildingChangeHint(s) {
  const hint = $("#ms-building-hint");
  if (!hint) return;

  if (s.buildingId && s.buildingId !== lastBuildingId) {
    lastBuildingId = s.buildingId;
    let msg = "Edificio activo: " + (s.buildingName || "—") + ".";
    if (s.schedule?.enabled) {
      const days = (s.schedule.days || [])
        .map((d) => s.dayLabels?.[d] ?? d)
        .join(", ");
      msg +=
        " Horario automático: " +
        days +
        ", " +
        s.schedule.startTime +
        "–" +
        s.schedule.endTime +
        ".";
    } else {
      msg += " Medición manual" + (s.active ? " activa." : " en pausa.");
    }
    hint.textContent = msg;
    hint.classList.remove("hidden");
    return;
  }

  if (!hint.textContent) hint.classList.add("hidden");
}

export function notifyActiveBuildingSwitched() {
  lastBuildingId = null;
}

export async function loadMeasurementSession() {
  try {
    sessionCache = await apiJson("/monitoring/session");
    renderMeasurementPanel(sessionCache);
    return sessionCache;
  } catch {
    return null;
  }
}

async function afterSessionAction() {
  sessionCache = await loadMeasurementSession();
  if (onSessionChanged) await onSessionChanged({ session: sessionCache });
}

export function initMeasurementUi({ apiJson: api, onChanged }) {
  apiJsonFn = api;
  onSessionChanged = onChanged;
  const panel = $("#measurement-panel");
  if (!panel) return;

  $("#ms-schedule-enabled")?.addEventListener("change", async (e) => {
    scheduleFormDirty = true;
    $("#ms-schedule-fields")?.classList.toggle("hidden", !e.target.checked);
    $("#ms-manual-actions")?.classList.toggle("hidden", e.target.checked);
    await saveScheduleFromForm(panel);
  });

  panel.addEventListener("change", (ev) => {
    if (
      ev.target.classList?.contains("ms-day") ||
      ev.target.id === "ms-start-time" ||
      ev.target.id === "ms-end-time"
    ) {
      scheduleFormDirty = true;
    }
  });

  $("#btn-ms-reset")?.addEventListener("click", async () => {
    if (
      !confirm(
        "¿Reiniciar medición? Se pondrá en cero el consumo acumulado de hoy y las gráficas de sesión.",
      )
    ) {
      return;
    }
    await apiJson("/monitoring/session/reset", { method: "POST" });
    resetCharts();
    await afterSessionAction();
  });

  $("#btn-ms-start")?.addEventListener("click", async () => {
    await apiJson("/monitoring/session/start", { method: "POST" });
    await afterSessionAction();
  });

  $("#btn-ms-stop")?.addEventListener("click", async () => {
    await apiJson("/monitoring/session/stop", { method: "POST" });
    await afterSessionAction();
  });

  $("#btn-ms-save-schedule")?.addEventListener("click", async () => {
    scheduleFormDirty = true;
    const ok = await saveScheduleFromForm(panel);
    if (ok) await afterSessionAction();
  });
}

export function applyRealtimeSession(data) {
  if (!data?.session) return;
  sessionCache = data.session;
  renderMeasurementStatus(sessionCache);
  if (!scheduleFormDirty && !scheduleSaveInFlight) {
    renderMeasurementForm(sessionCache, $("#measurement-panel"));
  }
  renderBuildingChangeHint(sessionCache);
}
