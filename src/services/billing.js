import { getBuildingMetrics } from "./buildingsStore.js";

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

/**
 * Cálculo SIREN según edificio activo:
 * - Modo habitaciones/áreas: áreas × kWh/área/día
 * - Modo m²: metros² totales × kWh/m²/día
 * × factor de equipos eléctricos
 */
export function getBillingMetrics() {
  const m = getBuildingMetrics();
  if (!m) {
    return {
      areaCount: 0,
      totalSqm: 0,
      measurementMode: "rooms",
      kwhPerArea: 0,
      kwhPerSqm: 0,
      tariff: 0,
      applianceFactor: 1,
      daily: { kwh: 0, cost: 0 },
      weekly: { kwh: 0, cost: 0 },
      monthly: { kwh: 0, cost: 0 },
      formula: { dailyKwh: "", dailyCost: "" },
    };
  }

  const dailyKwh = m.dailyKwh;
  const dailyCost = round(dailyKwh * m.tariff, 2);

  return {
    areaCount: m.areaCount,
    totalSqm: m.totalSqm,
    measurementMode: m.measurementMode,
    kwhPerArea: m.kwhPerRoom,
    kwhPerSqm: m.kwhPerSqm,
    tariff: m.tariff,
    applianceFactor: m.applianceFactor,
    formula: {
      dailyKwh: `${m.formulaKwh} × factor equipos ${m.applianceFactor.toFixed(2)} = ${dailyKwh} kWh`,
      dailyCost: `${dailyKwh} kWh × $${m.tariff} = $${dailyCost} MXN`,
    },
    daily: { kwh: dailyKwh, cost: dailyCost },
    weekly: { kwh: round(dailyKwh * 7, 1), cost: round(dailyCost * 7, 2) },
    monthly: { kwh: round(dailyKwh * 30, 1), cost: round(dailyCost * 30, 2) },
  };
}

/** Valor pseudoaleatorio estable 0–1 a partir de una semilla (misma entrada → mismo resultado). */
function hashToUnitInterval(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Consumo diario simulado con variación realista (día de semana, estacionalidad, picos).
 * @param {number} baseDailyKwh — referencia del edificio activo
 * @param {Date} date
 * @param {string} seedKey — id/tipo de edificio para reproducibilidad
 */
export function simulateDayKwh(baseDailyKwh, date, seedKey = "default") {
  if (!baseDailyKwh || baseDailyKwh <= 0) return 0;

  const d = date instanceof Date ? date : new Date(date);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const t = hashToUnitInterval(`${seedKey}|${ymd}`);
  const t2 = hashToUnitInterval(`${seedKey}|${ymd}|v2`);
  const day = d.getDay();
  const isWeekend = day === 0 || day === 6;

  const monthWave = 0.9 + 0.1 * Math.sin(((d.getDate() - 1) / 29) * Math.PI);
  const weekendFactor = isWeekend ? 0.76 + t * 0.14 : 1;
  const weekdayFactor = isWeekend ? 1 : 0.94 + t2 * 0.14;
  const noise = 0.84 + t * 0.32;

  let kwh = baseDailyKwh * monthWave * weekendFactor * weekdayFactor * noise;

  if (t2 > 0.9) kwh *= 1.08 + (t2 - 0.9) * 1.8;
  if (t < 0.07) kwh *= 0.7 + t * 4;

  const min = baseDailyKwh * 0.52;
  const max = baseDailyKwh * 1.48;
  return round(Math.max(min, Math.min(max, kwh)), 1);
}

/**
 * Serie de días con kWh y costo variables (para reportes semanal / mensual).
 */
export function buildSimulatedDaySeries({
  baseKwh,
  tariff,
  numDays,
  seedKey,
  endDate = new Date(),
}) {
  const series = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const kwh = simulateDayKwh(baseKwh, d, seedKey);
    const costMxn = round(kwh * tariff, 2);
    series.push({ date: d, kwh, costMxn });
  }
  return series;
}

export function splitDailyIntoReadings(dailyKwh) {
  const slots = [
    { hora: "00:00", weight: 250 },
    { hora: "12:00", weight: 300 },
    { hora: "20:00", weight: 200 },
  ];
  const totalWeight = slots.reduce((s, x) => s + x.weight, 0);
  const kwhParts = slots.map((s) => Math.round((dailyKwh * s.weight) / totalWeight));
  const diff = Math.round(dailyKwh) - kwhParts.reduce((a, b) => a + b, 0);
  kwhParts[kwhParts.length - 1] += diff;

  return slots.map((s, i) => ({
    hora: s.hora,
    kwh: kwhParts[i],
  }));
}
