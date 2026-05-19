import { config } from "../config.js";
import {
  getAreas,
  getConsumptionLog,
  getAreaExpectedKw,
  getBaselineTotalKw,
} from "./energyStore.js";
import { getActiveBuilding, getBuildingMetrics } from "./buildingsStore.js";
import { getBuildingType } from "../data/buildingTypes.js";
import {
  profileMultiplierAt,
  findUpcomingPeakHours,
  dailyPeakHour,
} from "../data/loadProfiles.js";
import { findArea } from "../data/infrastructure.js";
import { SIREN_ODS_GOALS } from "../data/odsGoals.js";

const EXPERT_ROTATION_SEC = 30;

/** Promedio observado por hora y edificio (se alimenta con cada snapshot) */
const observedHourly = new Map();

export function clearExpertObservations(buildingId) {
  if (buildingId) observedHourly.delete(buildingId);
  else observedHourly.clear();
}

function recordObservedHourly(snapshot) {
  if (!snapshot?.buildingId) return;
  const h = snapshot.hour ?? new Date(snapshot.timestamp).getHours();
  let store = observedHourly.get(snapshot.buildingId);
  if (!store) {
    store = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
    observedHourly.set(snapshot.buildingId, store);
  }
  store[h].sum += snapshot.totalKw;
  store[h].n += 1;
}

function blendedMultiplier(buildingType, buildingId, hour) {
  const profile = profileMultiplierAt(buildingType, hour);
  const obs = observedHourly.get(buildingId)?.[hour];
  if (!obs || obs.n < 3) return { value: profile, source: "profile" };
  const avgKw = obs.sum / obs.n;
  const baseline = getBaselineTotalKw() || 1;
  const observedMult = avgKw / baseline;
  const weight = Math.min(0.75, obs.n * 0.05);
  return {
    value: profile * (1 - weight) + observedMult * weight,
    source: "hybrid",
  };
}

const CHART_FORECAST_STEPS = 7;

/** Etiqueta del eje X: 1, 1.5, 2… (horas hacia adelante) */
function hourLabelForStep(stepIndex) {
  const hours = 1 + (stepIndex - 1) * 0.5;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/**
 * Serie para la gráfica del experto: kW previstos por hora según
 * medición en vivo del edificio activo + perfil del tipo + regresión.
 */
function buildDemandChartForecast(ctx) {
  const { building, totalKw, baselineKw, log, hour } = ctx;
  const typeId = building?.type ?? "mixed";
  const typeDef = getBuildingType(typeId);
  const bid = building?.id;
  const regression = linearForecast(log, CHART_FORECAST_STEPS);
  const logWeight = Math.min(0.72, Math.max(0.12, (log.length || 0) * 0.028));
  const nowMult = blendedMultiplier(typeId, bid, hour).value;

  const points = [];
  const baselinePoints = [];

  for (let i = 1; i <= CHART_FORECAST_STEPS; i++) {
    const hoursAhead = 1 + (i - 1) * 0.5;
    const futureHour = Math.floor(hour + hoursAhead) % 24;
    const futMult = blendedMultiplier(typeId, bid, futureHour).value;
    const scale = futMult / Math.max(nowMult, 0.15);

    let kw = round(totalKw * scale);
    if (regression?.points[i - 1]) {
      kw = round(kw * (1 - logWeight) + regression.points[i - 1].kw * logWeight);
    }

    points.push({
      hourLabel: hourLabelForStep(i),
      hoursAhead,
      kw,
    });
    baselinePoints.push(round(baselineKw * scale));
  }

  const method =
    log.length >= 4 && regression
      ? "hybrid"
      : log.length >= 2
        ? "regression"
        : "profile";

  const buildingName = building?.name ?? "Edificio activo";
  const samples = log.length;

  return {
    method,
    trend: regression?.trend ?? "profile",
    samples,
    buildingName,
    points,
    baselinePoints,
    caption:
      `Conectado a «${buildingName}» (${typeDef.label}): ${round(totalKw)} kW ahora · ` +
      `${samples} muestras en el log de medición · ` +
      (method === "hybrid"
        ? "proyección por perfil horario + tendencia en vivo."
        : method === "regression"
          ? "proyección por tendencia de las últimas muestras."
          : "proyección por perfil típico del sector (aún pocas muestras)."),
  };
}

function linearForecast(log, steps = 8) {
  const recent = log.filter((s) => s.totalKw != null).slice(-30);
  if (recent.length < 4) return null;

  const n = recent.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recent[i].totalKw;
    sumXY += i * recent[i].totalKw;
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const intervalSec = config.simulationIntervalMs / 1000;
  const intervalMin = intervalSec / 60;

  const points = [];
  for (let i = 1; i <= steps; i++) {
    const kw = Math.max(0, intercept + slope * (n - 1 + i));
    const aheadSec = Math.round(i * intervalSec);
    const aheadMin = Math.round(i * intervalMin * 10) / 10;
    points.push({
      step: i,
      secondsAhead: aheadSec,
      minutesAhead: aheadMin >= 1 ? aheadMin : null,
      label:
        aheadMin >= 1
          ? `+${aheadMin} min`
          : `+${aheadSec} s`,
      kw: round(kw),
    });
  }

  const trend =
    slope > 0.15 ? "rising" : slope < -0.15 ? "falling" : "stable";

  return {
    points,
    slopeKwPerCycle: round(slope),
    slopeKwPerMin: round(slope / intervalMin),
    trend,
    confidence: Math.min(0.92, 0.4 + recent.length * 0.025),
  };
}

function buildPredictions(ctx) {
  const { building, totalKw, baselineKw, log, hour, tariff } = ctx;
  const predictions = [];
  const typeId = building?.type ?? "mixed";
  const bid = building?.id;

  const forecast = linearForecast(log, 10);
  if (forecast?.points.length) {
    const peakPoint = forecast.points.reduce((a, b) => (b.kw > a.kw ? b : a));
    const prob = forecast.confidence;
    predictions.push({
      id: "pred-regression",
      title: `Demanda en ${peakPoint.label}`,
      probability: round(prob, 2),
      expectedKw: peakPoint.kw,
      window: `Próximos ${peakPoint.label.replace("+", "")}`,
      reason: `Tendencia ${forecast.trend === "rising" ? "alcista" : forecast.trend === "falling" ? "bajista" : "estable"} según ${log.length} muestras en vivo (${forecast.slopeKwPerMin > 0 ? "+" : ""}${forecast.slopeKwPerMin} kW/min).`,
      method: "time-series",
    });
  }

  const upcoming = findUpcomingPeakHours(typeId, hour, 6);
  if (upcoming.length > 0) {
    const next = upcoming[0];
    const mult = blendedMultiplier(typeId, bid, next.hour);
    const scale = mult.value / blendedMultiplier(typeId, bid, hour).value;
    const expectedKw = round(baselineKw * scale);
    predictions.push({
      id: `pred-profile-${next.hour}`,
      title: `Pico previsto ${String(next.hour).padStart(2, "0")}:00`,
      probability: round(0.55 + Math.min(log.length, 40) * 0.008, 2),
      expectedKw,
      window: `${String(next.hour).padStart(2, "0")}:00 – ${String((next.hour + 1) % 24).padStart(2, "0")}:00`,
      reason: `Perfil ${getBuildingType(typeId).label}: sube ${next.deltaPct}% vs hora actual (${mult.source === "hybrid" ? "calibrado con historial" : "modelo típico"}).`,
      method: "load-profile",
    });
  }

  const dailyPeak = dailyPeakHour(typeId);
  if (dailyPeak.hour !== hour) {
    const peakMult = profileMultiplierAt(typeId, dailyPeak.hour);
    const nowMult = profileMultiplierAt(typeId, hour);
    const expectedPeakKw = round((totalKw / Math.max(nowMult, 0.2)) * peakMult);
    predictions.push({
      id: "pred-daily-max",
      title: `Máximo del día (${String(dailyPeak.hour).padStart(2, "0")}:00)`,
      probability: round(0.72 + Math.min(log.length, 30) * 0.005, 2),
      expectedKw: expectedPeakKw,
      window: `Hoy ${String(dailyPeak.hour).padStart(2, "0")}:00`,
      reason: `Hora pico histórica del sector; demanda estimada ${expectedPeakKw} kW (${round(expectedPeakKw * tariff)} MXN/h a $${tariff}/kWh).`,
      method: "daily-profile",
    });
  }

  const metrics = getBuildingMetrics(building);
  if (metrics && totalKw > baselineKw * 1.1) {
    const excessKwh = ((totalKw - baselineKw) * 60) / 1000;
    predictions.push({
      id: "pred-cost-spike",
      title: "Riesgo de sobrecosto en la siguiente hora",
      probability: round(Math.min(0.88, 0.5 + (totalKw / baselineKw - 1)), 2),
      expectedKw: round(totalKw * 1.05),
      window: "Próxima hora",
      reason: `Demanda ${round(((totalKw / baselineKw - 1) * 100))}% sobre lo esperado; $${round(excessKwh * tariff * 10)} MXN extra si se mantiene.`,
      method: "cost-risk",
    });
  }

  const supplemental = buildSupplementalPredictions(ctx);
  const pool = dedupeByTitle([...predictions, ...supplemental]);
  return { predictions: pool, forecast };
}

function buildSupplementalPredictions(ctx) {
  const { building, totalKw, baselineKw, log, hour, tariff } = ctx;
  const typeId = building?.type ?? "mixed";
  const typeDef = getBuildingType(typeId);
  const extra = [];
  const loadPct = baselineKw > 0 ? round(((totalKw / baselineKw - 1) * 100)) : 0;

  extra.push({
    id: "pred-standby",
    title: "Consumo en horario valle",
    probability: round(0.62 + Math.min(log.length, 20) * 0.01, 2),
    expectedKw: round(baselineKw * profileMultiplierAt(typeId, (hour + 3) % 24)),
    window: `Próximas 2–3 h`,
    reason: `Perfil ${typeDef.label}: se espera menor demanda fuera de picos; útil para pruebas de apagado selectivo.`,
    method: "load-profile",
  });

  if (log.length >= 2) {
    const last = log[log.length - 1].totalKw;
    const prev = log[log.length - 2].totalKw;
    const dir = last > prev ? "subida" : last < prev ? "bajada" : "estable";
    extra.push({
      id: "pred-momentum",
      title: `Inercia de demanda (${dir})`,
      probability: round(0.58 + Math.min(log.length, 25) * 0.012, 2),
      expectedKw: round(last + (last - prev) * 0.6),
      window: "Siguiente ciclo de medición",
      reason: `Últimas muestras muestran ${dir}; extrapolación corto plazo sobre ${log.length} lecturas.`,
      method: "momentum",
    });
  }

  extra.push({
    id: "pred-tariff",
    title: "Costo energético si se mantiene la carga",
    probability: round(0.7, 2),
    expectedKw: round(totalKw),
    window: "Próxima hora",
    reason: `A $${tariff}/kWh y ${round(totalKw)} kW actuales: $${round(totalKw * tariff)} MXN/h (${loadPct >= 0 ? "+" : ""}${loadPct}% vs modelo).`,
    method: "cost-risk",
  });

  const offPeakHour = (dailyPeakHour(typeId).hour + 12) % 24;
  extra.push({
    id: "pred-offpeak",
    title: `Ventana de menor demanda (${String(offPeakHour).padStart(2, "0")}:00)`,
    probability: round(0.68, 2),
    expectedKw: round(baselineKw * profileMultiplierAt(typeId, offPeakHour) * 0.92),
    window: `Hoy ${String(offPeakHour).padStart(2, "0")}:00`,
    reason: "Hora típica de menor actividad según sector; ideal para mantenimiento o pruebas de eficiencia.",
    method: "daily-profile",
  });

  const floorCount = log[log.length - 1]?.byFloor?.length ?? 0;
  if (floorCount > 1) {
    extra.push({
      id: "pred-balance",
      title: "Equilibrio entre pisos",
      probability: round(0.55 + Math.min(log.length, 15) * 0.015, 2),
      expectedKw: round(totalKw * 0.95),
      window: "Próximos ciclos",
      reason: `${floorCount} pisos monitoreados; el experto vigila desbalance >45% sobre el promedio.`,
      method: "rules",
    });
  }

  return extra;
}

function buildSupplementalRecommendations(ctx) {
  const { building, totalKw, baselineKw, areas, hour, tariff } = ctx;
  const typeDef = getBuildingType(building?.type ?? "mixed");
  const recs = [];
  const powered = areas.filter((a) => a.powered);
  const avgKw =
    powered.length > 0
      ? powered.reduce((s, a) => s + a.currentKw, 0) / powered.length
      : 0;

  if (hour >= 18 || hour < 7) {
    recs.push({
      priority: "medium",
      action:
        "Horario nocturno: revisar iluminación perimetral y modos eco en HVAC de zonas vacías.",
      savingsEstimateMxnPerDay: round(avgKw * 4 * tariff),
    });
  } else if (hour >= 12 && hour < 16) {
    recs.push({
      priority: "low",
      action:
        "Mediodía: aprovechar luz natural y subir 1°C el setpoint en áreas con baja ocupación.",
      savingsEstimateMxnPerDay: round(avgKw * 2.5 * tariff),
    });
  }

  recs.push({
    priority: "medium",
    action: `Calibrar expectativas del perfil «${typeDef.label}» con al menos 30 ciclos de medición continua.`,
    savingsEstimateMxnPerDay: null,
  });

  recs.push({
    priority: "low",
    action:
      "Exportar reporte semanal y comparar picos pronosticados vs facturación CFE.",
    savingsEstimateMxnPerDay: null,
  });

  if (totalKw < baselineKw * 0.85) {
    recs.push({
      priority: "low",
      action:
        "Demanda bajo el modelo: documentar buenas prácticas actuales como línea base.",
      savingsEstimateMxnPerDay: null,
    });
  }

  recs.push({
    priority: "medium",
    action:
      "Programar en Panel central medición automática en horarios de pico para enriquecer el pronóstico.",
    savingsEstimateMxnPerDay: round((baselineKw - totalKw) * 3 * tariff),
  });

  return recs;
}

function rotatePool(pool, cycle, count = 4) {
  if (!pool?.length) return [];
  const n = pool.length;
  const start = ((cycle % n) + n) % n;
  const out = [];
  for (let i = 0; i < Math.min(count, n); i++) {
    out.push(pool[(start + i) % n]);
  }
  return out;
}

function jitterPrediction(p, cycle) {
  const seed = (cycle * 31 + (p.id?.length ?? 0) + (p.title?.length ?? 0)) % 13;
  const delta = seed / 100 - 0.06;
  return {
    ...p,
    probability: round(
      Math.min(0.95, Math.max(0.32, (p.probability ?? 0.55) + delta)),
      2,
    ),
  };
}

function analyzeAreas(areas, building, tariff) {
  const insights = [];
  const recommendations = [];
  const overloadFactor = config.areaOverloadFactor ?? 1.35;

  for (const area of areas) {
    if (!area.powered) continue;
    const expected = getAreaExpectedKw(area, building);
    const ratio = area.currentKw / Math.max(expected, 0.1);

    if (ratio >= overloadFactor) {
      insights.push({
        type: "anomaly",
        areaId: area.areaId,
        severity: ratio >= 1.55 ? "high" : "medium",
        message: `${area.name}: ${round(area.currentKw)} kW (${round((ratio - 1) * 100)}% sobre lo esperado para esta hora).`,
        metrics: { expectedKw: round(expected), actualKw: round(area.currentKw), ratio: round(ratio) },
      });
      recommendations.push({
        priority: ratio >= 1.55 ? "high" : "medium",
        areaId: area.areaId,
        action: `Limitar a ${round(expected * 1.1)} kW o revisar equipos en ${area.name}.`,
        savingsEstimateMxnPerDay: round(
          (area.currentKw - expected) * 8 * tariff,
        ),
      });
    } else if (area.type === "room" && ratio >= 1.2) {
      insights.push({
        type: "pattern",
        areaId: area.areaId,
        severity: "low",
        message: `${area.name}: consumo elevado sin patrón de ocupación (${round(area.currentKw)} kW vs ${round(expected)} kW esperados).`,
      });
      recommendations.push({
        priority: "medium",
        areaId: area.areaId,
        action: "Programar apagado por ocupación o bajar setpoint HVAC 2°C.",
        savingsEstimateMxnPerDay: round((area.currentKw - expected) * 12 * tariff),
      });
    }

    if (area.type === "utility" && area.powerFactor < 0.9) {
      insights.push({
        type: "power-quality",
        areaId: area.areaId,
        message: `${area.name}: factor de potencia ${area.powerFactor.toFixed(2)} (penalización CFE probable).`,
      });
      recommendations.push({
        priority: "medium",
        areaId: area.areaId,
        action: "Banco de capacitores o compensación reactiva en sala de máquinas.",
        savingsEstimateMxnPerDay: round(80 + area.currentKw * 2),
      });
    }
  }

  return { insights, recommendations };
}

function analyzeFloors(log, building, tariff) {
  const insights = [];
  const recommendations = [];
  const last = log[log.length - 1];
  if (!last?.byFloor?.length) return { insights, recommendations };

  const floors = last.byFloor;
  const avgKw = floors.reduce((s, f) => s + f.kw, 0) / floors.length;

  for (const floor of floors) {
    if (avgKw > 0 && floor.kw > avgKw * 1.45) {
      insights.push({
        type: "imbalance",
        floorId: floor.floorId,
        message: `Piso con carga desbalanceada: ${round(floor.kw)} kW (${round((floor.kw / avgKw - 1) * 100)}% sobre el promedio del edificio).`,
      });
    }
    if (floor.expectedKw > 0 && floor.kw > floor.expectedKw * 1.3) {
      recommendations.push({
        priority: "high",
        action: `Revisar distribución eléctrica en piso ${floor.floorId}; exceso de ${round(floor.kw - floor.expectedKw)} kW vs modelo.`,
        savingsEstimateMxnPerDay: round((floor.kw - floor.expectedKw) * 6 * tariff),
      });
    }
  }

  return { insights, recommendations };
}

function analyzeTrend(log) {
  const insights = [];
  if (log.length < 6) return insights;

  const recent = log.slice(-12);
  const delta = recent[recent.length - 1].totalKw - recent[0].totalKw;
  const pct = recent[0].totalKw > 0 ? (delta / recent[0].totalKw) * 100 : 0;

  if (delta > 1.5) {
    insights.push({
      type: "trend",
      severity: pct > 15 ? "high" : "medium",
      message: `Demanda total en alza: +${round(delta)} kW (${round(pct)}%) en los últimos ${recent.length} ciclos de medición.`,
    });
  } else if (delta < -1.5) {
    insights.push({
      type: "trend",
      severity: "low",
      message: `Demanda en descenso: ${round(delta)} kW en los últimos ${recent.length} ciclos (posible eficiencia o apagados).`,
    });
  }

  const volatility = stdDev(recent.map((r) => r.totalKw));
  if (volatility > 3) {
    insights.push({
      type: "volatility",
      message: `Alta variabilidad de carga (σ=${round(volatility)} kW); conviene estabilizar HVAC o escalonar equipos.`,
    });
  }

  return insights;
}

function globalRecommendations(totalKw, baselineKw, building, recommendations) {
  const tariff = building?.tariff ?? config.kwhPriceMxn;
  const typeDef = getBuildingType(building?.type);

  if (totalKw > baselineKw * 1.25) {
    recommendations.push({
      priority: "high",
      action: `Reducir carga global del ${typeDef.label}: priorizar áreas no críticas y escalonar arranques.`,
      savingsEstimateMxnPerDay: round((totalKw - baselineKw) * 0.25 * 10 * tariff),
    });
  }

  const offAreas = getAreas().filter((a) => !a.powered);
  if (offAreas.length > 0 && offAreas.length < getAreas().length * 0.15) {
    recommendations.push({
      priority: "low",
      action: `${offAreas.length} área(s) apagada(s); verificar que no haya consumo fantasma en circuitos standby.`,
    });
  }

  recommendations.push({
    priority: "medium",
    action: "Alinear operación con ODS 7, 11 y 12: picos predecibles permiten programar respuesta automática.",
    savingsEstimateMxnPerDay: null,
  });
}

export function getExpertRotationCycle(at = Date.now()) {
  return Math.floor(at / (EXPERT_ROTATION_SEC * 1000));
}

/**
 * Motor experto: reglas + series de tiempo + perfiles por tipo de edificio.
 * @param {{ cycle?: number }} [opts] — ciclo de rotación (cambia cada 30 s en UI)
 */
export function analyzeAndRecommend(opts = {}) {
  const building = getActiveBuilding();
  const areas = getAreas();
  const log = getConsumptionLog();
  const lastSnap = log[log.length - 1];
  if (lastSnap) recordObservedHourly(lastSnap);

  const hour = new Date().getHours();
  const totalKw = areas
    .filter((a) => a.powered)
    .reduce((s, a) => s + a.currentKw, 0);
  const baselineKw = getBaselineTotalKw() || totalKw || 1;
  const tariff = building?.tariff ?? config.kwhPriceMxn;

  const areaAnalysis = analyzeAreas(areas, building, tariff);
  const floorAnalysis = analyzeFloors(log, building, tariff);
  const trendInsights = analyzeTrend(log);

  const predCtx = {
    building,
    totalKw,
    baselineKw,
    log,
    hour,
    tariff,
    areas,
  };
  const { predictions: predictionPool, forecast } = buildPredictions(predCtx);
  const demandChart = buildDemandChartForecast(predCtx);

  const recommendations = [
    ...areaAnalysis.recommendations,
    ...floorAnalysis.recommendations,
    ...buildSupplementalRecommendations(predCtx),
  ];
  globalRecommendations(totalKw, baselineKw, building, recommendations);

  const cycle =
    typeof opts.cycle === "number" ? opts.cycle : getExpertRotationCycle();
  const fullRecPool = dedupeRecommendations(recommendations);
  const rotatedPredictions = rotatePool(predictionPool, cycle, 4).map((p) =>
    jitterPrediction(p, cycle),
  );
  const rotatedRecommendations = rotatePool(fullRecPool, cycle + 1, 4);

  const logSamples = log.length;
  const dataConfidence =
    logSamples >= 30
      ? "alta"
      : logSamples >= 10
        ? "media"
        : logSamples >= 3
          ? "baja"
          : "inicial";

  return {
    generatedAt: new Date().toISOString(),
    engine: "SIREN Expert v2 – reglas + series de tiempo + perfiles",
    building: building
      ? { id: building.id, name: building.name, type: building.type }
      : null,
    currentTotalKw: round(totalKw),
    baselineTotalKw: round(baselineKw),
    loadRatio: round(totalKw / baselineKw, 2),
    dataQuality: {
      logSamples,
      confidence: dataConfidence,
      forecastAvailable: !!forecast,
    },
    forecast: forecast ?? {
      points: [],
      trend: "unknown",
      confidence: 0,
    },
    demandChart,
    predictions: rotatedPredictions,
    predictionPoolSize: predictionPool.length,
    insights: [
      ...areaAnalysis.insights,
      ...floorAnalysis.insights,
      ...trendInsights,
    ],
    recommendations: rotatedRecommendations,
    recommendationPoolSize: fullRecPool.length,
    rotation: {
      cycle,
      intervalSec: EXPERT_ROTATION_SEC,
      nextChangeAt: new Date(
        (cycle + 1) * EXPERT_ROTATION_SEC * 1000,
      ).toISOString(),
    },
    odsAlignment: SIREN_ODS_GOALS,
  };
}

export function getAreaExpertInsight(areaId) {
  const meta = findArea(areaId);
  if (!meta) return null;
  const analysis = analyzeAndRecommend();
  const areaState = getAreas().find((a) => a.areaId === areaId);
  return {
    area: meta,
    currentKw: areaState ? round(areaState.currentKw) : null,
    expectedKw: areaState
      ? round(getAreaExpectedKw(areaState, getActiveBuilding()))
      : null,
    insights: analysis.insights.filter((i) => !i.areaId || i.areaId === areaId),
    predictions: analysis.predictions,
    recommendations: analysis.recommendations.filter(
      (r) => !r.areaId || r.areaId === areaId,
    ),
  };
}

function dedupeByTitle(list) {
  const seen = new Set();
  return list.filter((p) => {
    if (seen.has(p.title)) return false;
    seen.add(p.title);
    return true;
  });
}

function dedupeRecommendations(list) {
  const seen = new Set();
  return list.filter((r) => {
    const key = `${r.areaId ?? "global"}-${r.action.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}
