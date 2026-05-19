/**
 * Perfil horario de demanda relativa (0–1) por tipo de edificio.
 * Se usa como baseline cuando aún no hay suficiente historial en vivo.
 */
export const HOURLY_LOAD_PROFILES = {
  hotel: [
    0.42, 0.38, 0.36, 0.35, 0.36, 0.4, 0.55, 0.72, 0.78, 0.75, 0.7, 0.68,
    0.72, 0.7, 0.68, 0.7, 0.78, 0.88, 0.95, 1.0, 0.98, 0.92, 0.75, 0.55,
  ],
  hospital: [
    0.88, 0.9, 0.92, 0.94, 0.95, 0.96, 0.98, 1.0, 0.99, 0.98, 0.97, 0.96,
    0.96, 0.97, 0.98, 0.99, 1.0, 0.99, 0.98, 0.97, 0.95, 0.92, 0.9, 0.89,
  ],
  university: [
    0.25, 0.22, 0.2, 0.2, 0.22, 0.35, 0.65, 0.92, 0.98, 0.95, 0.9, 0.88,
    0.85, 0.88, 0.9, 0.92, 0.95, 0.85, 0.7, 0.55, 0.45, 0.38, 0.32, 0.28,
  ],
  corporate: [
    0.3, 0.28, 0.26, 0.26, 0.28, 0.4, 0.75, 0.95, 1.0, 0.98, 0.95, 0.92,
    0.88, 0.9, 0.92, 0.94, 0.96, 0.75, 0.5, 0.4, 0.38, 0.35, 0.32, 0.3,
  ],
  mixed: [
    0.4, 0.38, 0.36, 0.36, 0.38, 0.45, 0.62, 0.8, 0.88, 0.85, 0.82, 0.8,
    0.82, 0.84, 0.85, 0.86, 0.9, 0.92, 0.95, 0.93, 0.88, 0.75, 0.6, 0.48,
  ],
};

export function getProfileForType(typeId) {
  return HOURLY_LOAD_PROFILES[typeId] ?? HOURLY_LOAD_PROFILES.mixed;
}

export function profileMultiplierAt(typeId, hour) {
  const profile = getProfileForType(typeId);
  const h = ((hour % 24) + 24) % 24;
  return profile[h] ?? 0.7;
}

export function findUpcomingPeakHours(typeId, fromHour, lookahead = 8) {
  const profile = getProfileForType(typeId);
  const current = profileMultiplierAt(typeId, fromHour);
  const peaks = [];
  for (let i = 1; i <= lookahead; i++) {
    const h = (fromHour + i) % 24;
    const mult = profile[h];
    if (mult > current * 1.08) {
      peaks.push({ hour: h, multiplier: mult, deltaPct: Math.round((mult / current - 1) * 100) });
    }
  }
  peaks.sort((a, b) => b.multiplier - a.multiplier);
  return peaks;
}

export function dailyPeakHour(typeId) {
  const profile = getProfileForType(typeId);
  let maxH = 0;
  let maxV = 0;
  profile.forEach((v, h) => {
    if (v > maxV) {
      maxV = v;
      maxH = h;
    }
  });
  return { hour: maxH, multiplier: maxV };
}
