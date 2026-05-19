export const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const SCHEDULE_WARN_MINUTES = 15;

export function defaultMeasurementConfig() {
  return {
    active: true,
    startedAt: null,
    lastResetAt: null,
    lastScheduledDate: null,
    schedule: {
      enabled: false,
      days: [1, 2, 3, 4, 5],
      startTime: "08:00",
      endTime: "20:00",
    },
  };
}

export function normalizeMeasurement(building) {
  if (!building) return;
  const base = defaultMeasurementConfig();
  building.measurement = {
    ...base,
    ...building.measurement,
    schedule: {
      ...base.schedule,
      ...building.measurement?.schedule,
    },
  };
  if (!Array.isArray(building.measurement.schedule.days)) {
    building.measurement.schedule.days = base.schedule.days;
  }
  return building.measurement;
}

export function parseTimeToMinutes(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
}

function findNextScheduleStart(schedule, fromDate = new Date()) {
  if (!schedule?.enabled || !schedule.days?.length) return null;

  const [sh, sm] = String(schedule.startTime || "08:00").split(":").map(Number);

  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + offset);
    d.setHours(sh, sm ?? 0, 0, 0);

    if (!schedule.days.includes(d.getDay())) continue;
    if (d <= fromDate) continue;
    return d;
  }
  return null;
}

function formatUpcomingMessage(minutesUntilStart, nextStart) {
  const timeStr = nextStart.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayStr = nextStart.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (minutesUntilStart <= 1) {
    return "La medición automática está por iniciar (ahora o en menos de 1 min).";
  }
  if (minutesUntilStart <= SCHEDULE_WARN_MINUTES) {
    return (
      "La medición automática iniciará en " +
      minutesUntilStart +
      " min (aprox. " +
      timeStr +
      ")."
    );
  }
  return "Próximo inicio automático: " + dayStr + " a las " + timeStr + ".";
}

/** Próximo inicio programado y aviso si faltan pocos minutos */
export function getScheduleUpcoming(
  schedule,
  fromDate = new Date(),
  warnMinutes = SCHEDULE_WARN_MINUTES,
) {
  if (!schedule?.enabled) return null;
  if (isWithinSchedule(schedule, fromDate)) return null;

  const nextStart = findNextScheduleStart(schedule, fromDate);
  if (!nextStart) return null;

  const minutesUntilStart = Math.max(
    0,
    Math.round((nextStart.getTime() - fromDate.getTime()) / 60_000),
  );

  return {
    nextStartAt: nextStart.toISOString(),
    minutesUntilStart,
    warnMinutes,
    showWarning: minutesUntilStart <= warnMinutes,
    message: formatUpcomingMessage(minutesUntilStart, nextStart),
  };
}

export function isWithinSchedule(schedule, date = new Date()) {
  if (!schedule?.enabled) return null;
  const day = date.getDay();
  if (!schedule.days.includes(day)) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  const start = parseTimeToMinutes(schedule.startTime);
  const end = parseTimeToMinutes(schedule.endTime);
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

export function isMeasurementAccumulatingFor(building) {
  if (!building?.measurement) return false;
  const m = building.measurement;
  if (m.schedule?.enabled) return isWithinSchedule(m.schedule) === true;
  return Boolean(m.active);
}
