import {
  getActiveBuilding,
  getBuilding,
  updateBuilding,
} from "./buildingsStore.js";
import { resetRealtimeCounters } from "./energyStore.js";
import { clearExpertObservations } from "./expertSystem.js";
import {
  DAY_LABELS,
  defaultMeasurementConfig,
  getScheduleUpcoming,
  isMeasurementAccumulatingFor,
  isWithinSchedule,
  normalizeMeasurement,
  SCHEDULE_WARN_MINUTES,
} from "./measurementSchedule.js";

export {
  defaultMeasurementConfig,
  isWithinSchedule,
  normalizeMeasurement,
} from "./measurementSchedule.js";

export function getMeasurementSession(buildingId) {
  const b = buildingId ? getBuilding(buildingId) : getActiveBuilding();
  if (!b) return null;
  return normalizeMeasurement(b);
}

export function getActiveMeasurementSession() {
  const b = getActiveBuilding();
  if (!b) return null;
  return b.measurement;
}

export function isMeasurementAccumulating(buildingId) {
  const b = buildingId ? getBuilding(buildingId) : getActiveBuilding();
  return isMeasurementAccumulatingFor(b);
}

export function getSessionPublicStatus(buildingId) {
  const b = buildingId ? getBuilding(buildingId) : getActiveBuilding();
  if (!b) return null;
  const m = normalizeMeasurement(b);
  const accumulating = isMeasurementAccumulatingFor(b);
  const inSchedule = m.schedule?.enabled;
  const within = inSchedule ? isWithinSchedule(m.schedule) : null;

  let status = "paused";
  let statusLabel = "Medición pausada";
  if (inSchedule) {
    if (within) {
      status = "scheduled-active";
      statusLabel = "Activa por horario";
    } else {
      status = "scheduled-wait";
      statusLabel = "Esperando horario";
    }
  } else if (m.active) {
    status = "active";
    statusLabel = "Medición activa";
  }

  const scheduleUpcoming = inSchedule
    ? getScheduleUpcoming(m.schedule)
  : null;

  return {
    buildingId: b.id,
    buildingName: b.name,
    active: m.active,
    accumulating,
    status,
    statusLabel,
    startedAt: m.startedAt,
    lastResetAt: m.lastResetAt,
    schedule: { ...m.schedule },
    scheduleWithinWindow: within,
    scheduleUpcoming,
    scheduleWarnMinutes: SCHEDULE_WARN_MINUTES,
    dayLabels: DAY_LABELS,
  };
}

/** Al cambiar el edificio activo: contadores en memoria + estado de horario de ese edificio */
export function syncMeasurementForActiveBuilding() {
  const b = getActiveBuilding();
  if (!b) return null;

  resetRealtimeCounters();
  clearExpertObservations(b.id);
  processScheduleTick();

  const fresh = getActiveBuilding();
  const m = fresh?.measurement;
  if (!m?.schedule?.enabled && m?.active && !m.startedAt) {
    persistMeasurement(fresh.id, { startedAt: new Date().toISOString() });
  }

  return getSessionPublicStatus(fresh?.id);
}

function persistMeasurement(buildingId, patch) {
  const b = getBuilding(buildingId);
  if (!b) return { ok: false, error: "Edificio no encontrado" };
  const base = normalizeMeasurement(b);
  const measurement = {
    ...base,
    ...patch,
    schedule: patch.schedule
      ? { ...base.schedule, ...patch.schedule }
      : { ...base.schedule },
  };
  return updateBuilding(buildingId, { measurement });
}

export function startMeasurementSession(buildingId) {
  const id = buildingId ?? getActiveBuilding()?.id;
  if (!id) return { ok: false, error: "Sin edificio activo" };
  const now = new Date().toISOString();
  return persistMeasurement(id, { active: true, startedAt: now });
}

export function stopMeasurementSession(buildingId) {
  const id = buildingId ?? getActiveBuilding()?.id;
  if (!id) return { ok: false, error: "Sin edificio activo" };
  return persistMeasurement(id, { active: false });
}

export function resetAndStartMeasurement(buildingId) {
  const id = buildingId ?? getActiveBuilding()?.id;
  if (!id) return { ok: false, error: "Sin edificio activo" };
  resetRealtimeCounters();
  clearExpertObservations(id);
  const now = new Date().toISOString();
  const result = persistMeasurement(id, {
    active: true,
    startedAt: now,
    lastResetAt: now,
  });
  if (result.ok) {
    result.session = getSessionPublicStatus(id);
  }
  return result;
}

export function updateMeasurementSchedule(buildingId, schedule) {
  const id = buildingId ?? getActiveBuilding()?.id;
  if (!id) return { ok: false, error: "Sin edificio activo" };
  const days = Array.isArray(schedule.days)
    ? [...new Set(schedule.days.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))]
    : defaultMeasurementConfig().schedule.days;
  const normalized = {
    enabled: Boolean(schedule.enabled),
    days: days.length ? days.sort((a, b) => a - b) : [1, 2, 3, 4, 5],
    startTime: schedule.startTime || "08:00",
    endTime: schedule.endTime || "20:00",
  };
  const result = persistMeasurement(id, { schedule: normalized });
  if (result.ok) {
    processScheduleTick();
    result.session = getSessionPublicStatus(id);
  }
  return result;
}

export function processScheduleTick() {
  const b = getActiveBuilding();
  if (!b?.measurement?.schedule?.enabled) return null;

  const m = b.measurement;
  const within = isWithinSchedule(m.schedule);
  const today = new Date().toISOString().slice(0, 10);

  if (within) {
    if (m.lastScheduledDate !== today) {
      resetRealtimeCounters();
      clearExpertObservations(b.id);
      const now = new Date().toISOString();
      persistMeasurement(b.id, {
        active: true,
        startedAt: now,
        lastResetAt: now,
        lastScheduledDate: today,
      });
      return { event: "schedule-started", date: today };
    }
    if (!m.active) {
      persistMeasurement(b.id, { active: true });
    }
    return { event: "schedule-continued" };
  }

  if (m.active) {
    persistMeasurement(b.id, { active: false });
    return { event: "schedule-paused" };
  }
  return null;
}
