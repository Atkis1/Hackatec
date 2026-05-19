import { config } from "../config.js";
import {
  getAreas,
  addAlert,
  getAlerts,
  acknowledgeAlert,
  getAreaExpectedKw,
  getBaselineTotalKw,
  getConsumptionLog,
} from "./energyStore.js";
import { getActiveBuilding } from "./buildingsStore.js";
import { analyzeCfeTariff } from "./cfeBilling.js";
import { analyzeAndRecommend } from "./expertSystem.js";
import { isMeasurementAccumulatingFor } from "./measurementSchedule.js";

const cooldowns = new Map();

function shouldEmit(key, ms = 90_000) {
  const last = cooldowns.get(key);
  if (last && Date.now() - last < ms) return false;
  cooldowns.set(key, Date.now());
  return true;
}

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

function pushAlert(alert) {
  return addAlert({
    title: alert.title,
    message: alert.message,
    detail: alert.detail,
    action: alert.action,
    meta: alert.meta,
    type: alert.type,
    severity: alert.severity,
    areaId: alert.areaId,
    valueKw: alert.valueKw,
    expectedKw: alert.expectedKw,
    voltage: alert.voltage,
  });
}

function evaluateCfeAlerts(building, live) {
  if (!building) return [];
  const created = [];
  const cfe = analyzeCfeTariff(building, live);
  const bid = building?.id ?? "site";

  if (cfe.tier === "dac") {
    const key = `cfe-dac:${bid}`;
    if (shouldEmit(key, 180_000)) {
      created.push(
        pushAlert({
          type: "cfe_dac",
          severity: "critical",
          title: "Tarifa DAC activa (consumo alto)",
          message:
            `Proyección mensual ${cfe.monthlyProjectedKwh} kWh supera el límite de ${cfe.dacThresholdKwh} kWh en ${cfe.zoneLabel}.`,
          detail:
            `CFE aplica recargo DAC: $${cfe.dacRateMxn}/kWh vs $${cfe.subsidyRateMxn}/kWh en bloque subsidiado. ` +
            `Costo estimado del mes: $${cfe.costProjectedMxn} MXN. ` +
            `Reduce picos en Áreas y control o programa apagados en horario valle.`,
          action: {
            kind: "navigate",
            view: "areas",
            label: "Ir a Áreas y control",
          },
          meta: cfe,
        }),
      );
    }
  } else if (cfe.tier === "pre_dac" || cfe.percentToDac >= 78) {
    const key = `cfe-predac:${bid}`;
    if (shouldEmit(key, 120_000)) {
      created.push(
        pushAlert({
          type: "cfe_dac",
          severity: "warning",
          title: "Riesgo de pasar a tarifa DAC",
          message:
            `Llevas ${cfe.percentToDac}% del límite mensual (${cfe.monthlyProjectedKwh} / ${cfe.dacThresholdKwh} kWh). Faltan ${cfe.kwhUntilDac} kWh para el techo.`,
          detail:
            `Si lo rebasas, el costo puede subir $${cfe.extraCostIfDacMxn} MXN/mes (de $${cfe.effectiveRateMxn} a $${cfe.dacRateMxn}/kWh). ` +
            `${cfe.seasonLabel} en tu zona: conviene bajar HVAC y cargas no críticas antes del cierre de mes.`,
          action: {
            kind: "navigate",
            view: "expert",
            label: "Ver recomendaciones del experto",
          },
          meta: cfe,
        }),
      );
    }
  }

  if (cfe.tier === "subsidio" || cfe.tier === "intermedio") {
    const key = `cfe-subsidy:${bid}:${cfe.season}`;
    if (shouldEmit(key, 300_000)) {
      created.push(
        pushAlert({
          type: "cfe_subsidy",
          severity: "info",
          title: `Tarifa subsidiada — ${cfe.seasonLabel}`,
          message:
            `${cfe.zoneLabel}: estás en «${cfe.tierLabel}» ($${cfe.effectiveRateMxn}/kWh efectivo).`,
          detail:
            `${cfe.subsidyNote} Tu tarifa configurada en el edificio es $${cfe.userTariffMxn}/kWh; ` +
            `SIREN compara el consumo en vivo con el tope DAC de la zona (${cfe.dacThresholdKwh} kWh/mes).`,
          action: {
            kind: "navigate",
            view: "dashboard",
            label: "Revisar consumo en Panel central",
          },
          meta: cfe,
        }),
      );
    }
  }

  if (cfe.isSummer && cfe.tier !== "dac") {
    const key = `cfe-summer:${bid}`;
    if (shouldEmit(key, 600_000)) {
      created.push(
        pushAlert({
          type: "cfe_subsidy",
          severity: "info",
          title: "Temporada de verano en tu zona",
          message:
            `En ${cfe.zoneId} los meses de calor suelen tener tarifas más bajas en los primeros bloques de kWh.`,
          detail:
            `Aprovecha programar medición automática y revisar picos en la gráfica de demanda antes de que el consumo acumulado empuje a tarifa normal o DAC.`,
          action: {
            kind: "navigate",
            view: "dashboard",
            label: "Abrir gráficas de demanda",
          },
          meta: { season: cfe.season, zoneId: cfe.zoneId },
        }),
      );
    }
  }

  return created;
}

function evaluateConsumptionAlerts(building) {
  const created = [];
  const overloadFactor = config.areaOverloadFactor ?? 1.35;
  const baselineKw = getBaselineTotalKw() || 1;
  const totalKw = getAreas()
    .filter((a) => a.powered)
    .reduce((s, a) => s + a.currentKw, 0);
  const dynamicThreshold = Math.max(
    round(baselineKw * 1.35, 1),
    Math.min(config.alertThresholdKw, baselineKw * 2.5),
  );

  if (totalKw >= dynamicThreshold) {
    const key = `site-total:${building?.id}`;
    if (shouldEmit(key, 75_000)) {
      const excess = round(((totalKw / baselineKw - 1) * 100));
      created.push(
        pushAlert({
          type: "consumption",
          severity: totalKw >= baselineKw * 1.55 ? "critical" : "warning",
          title: "Demanda total elevada",
          message: `${building?.name ?? "Edificio"}: ${totalKw.toFixed(1)} kW (${excess >= 0 ? "+" : ""}${excess}% vs modelo esperado ${baselineKw.toFixed(1)} kW).`,
          detail:
            "La suma de todas las zonas encendidas supera lo previsto para esta hora. Puedes apagar circuitos no críticos o fijar límites por área.",
          action: {
            kind: "navigate",
            view: "areas",
            label: "Gestionar zonas",
          },
          valueKw: totalKw,
          meta: { baselineKw, dynamicThreshold },
        }),
      );
    }
  }

  for (const area of getAreas()) {
    if (!area.powered) continue;
    const expected = getAreaExpectedKw(area, building);
    const threshold = expected * overloadFactor;

    if (area.currentKw >= threshold) {
      const key = `consumption:${area.areaId}`;
      if (shouldEmit(key, 60_000)) {
        const pct = Math.round(((area.currentKw / expected - 1) * 100));
        created.push(
          pushAlert({
            type: "consumption",
            severity: area.currentKw >= expected * 1.55 ? "critical" : "warning",
            areaId: area.areaId,
            title: `Exceso en ${area.name}`,
            message: `${area.currentKw.toFixed(2)} kW · +${pct}% sobre lo esperado (${expected.toFixed(2)} kW).`,
            detail:
              "SIREN detectó un pico local. Acciones: apagar desde la tabla de áreas, bajar límite kW o revisar equipos encendidos en ese piso.",
            action: {
              kind: "navigate",
              view: "areas",
              label: "Abrir esta zona",
              areaId: area.areaId,
            },
            valueKw: area.currentKw,
            expectedKw: round(expected),
          }),
        );
      }
    }

    if (area.limitKw != null && area.currentKw >= area.limitKw * 0.92) {
      const key = `limit:${area.areaId}`;
      if (shouldEmit(key, 120_000)) {
        created.push(
          pushAlert({
            type: "control",
            severity: area.currentKw >= area.limitKw ? "warning" : "info",
            areaId: area.areaId,
            title: "Límite de área en uso",
            message: `${area.name}: ${area.currentKw.toFixed(2)} kW (límite configurado ${area.limitKw} kW).`,
            detail:
              area.currentKw >= area.limitKw
                ? "El simulador está recortando la carga al tope que definiste."
                : "Cerca del tope: conviene revisar si el límite sigue siendo adecuado.",
            action: {
              kind: "navigate",
              view: "areas",
              label: "Ajustar en Áreas",
              areaId: area.areaId,
            },
          }),
        );
      }
    }

    if (area.voltage < 118 || area.voltage > 132) {
      const key = `voltage:${area.areaId}`;
      if (shouldEmit(key, 90_000)) {
        created.push(
          pushAlert({
            type: "electrical_fault",
            severity: "critical",
            areaId: area.areaId,
            title: "Anomalía de voltaje",
            message: `${area.name}: ${area.voltage.toFixed(1)} V (rango normal 127 V).`,
            detail:
              "Puede haber sobrecarga en la red, falla de contacto o penalización por bajo factor de potencia. Revisa el medidor y la carga conectada.",
            action: {
              kind: "navigate",
              view: "meters",
              label: "Ver medidores",
            },
            voltage: area.voltage,
          }),
        );
      }
    }

    if (area.powered && area.powerFactor < 0.88) {
      const key = `pf:${area.areaId}`;
      if (shouldEmit(key, 180_000)) {
        created.push(
          pushAlert({
            type: "electrical_fault",
            severity: "warning",
            areaId: area.areaId,
            title: "Factor de potencia bajo",
            message: `${area.name}: FP ${area.powerFactor.toFixed(2)} (CFE puede cobrar recargo).`,
            detail:
              "Equipos inductivos (motores, HVAC viejo) arrastran el FP. Considera compensación reactiva o redistribuir cargas.",
            action: {
              kind: "navigate",
              view: "expert",
              label: "Ver insights del experto",
            },
          }),
        );
      }
    }
  }

  return created;
}

function evaluateExpertAlerts(building) {
  const created = [];
  const key = `expert:${building?.id}`;
  if (!shouldEmit(key, 150_000)) return created;

  const analysis = analyzeAndRecommend();
  const critical = analysis.insights.filter(
    (i) => i.severity === "high" || i.severity === "critical",
  );
  const top = critical[0] ?? analysis.insights[0];
  if (!top) return created;

  const rec = analysis.recommendations.find(
    (r) => !r.areaId || r.areaId === top.areaId,
  );

  created.push(
    pushAlert({
      type: "expert",
      severity: top.severity === "high" ? "critical" : "warning",
      areaId: top.areaId,
      title: "Insight del sistema experto",
      message: top.message,
      detail: rec
        ? `Acción sugerida: ${rec.action}${rec.savingsEstimateMxnPerDay != null ? ` (ahorro est. $${rec.savingsEstimateMxnPerDay}/día).` : "."}`
        : "Revisa predicciones y recomendaciones en la pestaña Sistema experto.",
      action: {
        kind: "navigate",
        view: "expert",
        label: "Abrir Sistema experto",
      },
    }),
  );

  return created;
}

function evaluateMeasurementAlerts(building) {
  const created = [];
  if (!building) return created;

  const accumulating = isMeasurementAccumulatingFor(building);
  const log = getConsumptionLog();
  const key = `measurement:${building.id}`;

  if (!accumulating && log.length > 0) {
    if (shouldEmit(`${key}-paused`, 300_000)) {
      created.push(
        pushAlert({
          type: "measurement",
          severity: "info",
          title: "Medición en pausa",
          message:
            "El contador del día no está acumulando kWh hasta que reinicies la sesión o active el horario automático.",
          detail:
            "En Panel central → Medición en vivo puedes iniciar, detener o programar la captura.",
          action: {
            kind: "navigate",
            view: "dashboard",
            label: "Ir a Medición en vivo",
          },
        }),
      );
    }
  }

  if (accumulating && log.length < 5) {
    if (shouldEmit(`${key}-warmup`, 240_000)) {
      created.push(
        pushAlert({
          type: "measurement",
          severity: "info",
          title: "Recopilando muestras",
          message: `Solo ${log.length} lecturas en el log; el pronóstico y las alertas de pico serán más precisos en breve.`,
          action: {
            kind: "navigate",
            view: "expert",
            label: "Ver estado del experto",
          },
        }),
      );
    }
  }

  return created;
}

export function evaluateAlerts(live = {}) {
  const building = getActiveBuilding();
  return [
    ...evaluateCfeAlerts(building, live),
    ...evaluateConsumptionAlerts(building),
    ...evaluateExpertAlerts(building),
    ...evaluateMeasurementAlerts(building),
  ];
}

export { getAlerts, acknowledgeAlert };
