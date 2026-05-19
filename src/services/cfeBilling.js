import { getCfeZone, getSeasonForZone } from "../data/cfeTariffs.js";
import { getBuildingMetrics } from "./buildingsStore.js";
import { getAreas } from "./energyStore.js";

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

/**
 * Estima consumo mensual y escalón tarifario (subsidio → normal → DAC).
 */
export function analyzeCfeTariff(building, live = {}) {
  const zoneId = building?.cfeClimateZone ?? "1C";
  const zone = getCfeZone(zoneId);
  const month = new Date().getMonth() + 1;
  const season = getSeasonForZone(zoneId, month);
  const metrics = getBuildingMetrics(building);

  const totalKwhToday = live.totalKwhToday ?? getAreas().reduce(
    (s, a) => s + (a.totalKwhToday ?? 0),
    0,
  );
  const dayOfMonth = Math.max(1, new Date().getDate());
  const dailyFromMetrics = metrics?.dailyKwh ?? 0;
  const dailyPace =
    totalKwhToday > 0 ? totalKwhToday / dayOfMonth : dailyFromMetrics;
  const monthlyProjected = round(
    Math.max(dailyPace * 30, dailyFromMetrics * 30, totalKwhToday * 2),
    0,
  );

  const threshold = zone.dacThresholdMonthlyKwh;
  const ratio = monthlyProjected / threshold;
  const percentToDac = round(Math.min(150, ratio * 100), 0);

  let tier;
  let effectiveRateMxn;
  if (ratio >= 1) {
    tier = "dac";
    effectiveRateMxn = zone.dacRateMxn;
  } else if (ratio >= 0.88) {
    tier = "pre_dac";
    effectiveRateMxn = zone.normalRateMxn;
  } else if (ratio >= 0.55) {
    tier = "normal";
    effectiveRateMxn = zone.normalRateMxn;
  } else if (ratio >= 0.35) {
    tier = "intermedio";
    effectiveRateMxn = round(
      (zone.subsidyRateMxn + zone.normalRateMxn) / 2,
      2,
    );
  } else {
    tier = "subsidio";
    effectiveRateMxn = season.isSummer
      ? zone.subsidyRateMxn
      : round(zone.subsidyRateMxn * 1.08, 2);
  }

  const costAtCurrent = round(monthlyProjected * effectiveRateMxn, 0);
  const costIfDac = round(monthlyProjected * zone.dacRateMxn, 0);
  const extraIfDac = round(costIfDac - costAtCurrent, 0);
  const kwhUntilDac = Math.max(0, threshold - monthlyProjected);

  const tierLabels = {
    subsidio: "Tarifa con subsidio (bloque bajo)",
    intermedio: "Tarifa intermedia",
    normal: "Tarifa estándar",
    pre_dac: "Cerca del límite DAC",
    dac: "Tarifa DAC (alto consumo)",
  };

  return {
    zoneId,
    zoneLabel: zone.label,
    season: season.id,
    seasonLabel: season.label,
    isSummer: season.isSummer,
    monthlyProjectedKwh: monthlyProjected,
    dacThresholdKwh: threshold,
    percentToDac,
    kwhUntilDac,
    tier,
    tierLabel: tierLabels[tier],
    effectiveRateMxn,
    dacRateMxn: zone.dacRateMxn,
    subsidyRateMxn: zone.subsidyRateMxn,
    normalRateMxn: zone.normalRateMxn,
    costProjectedMxn: costAtCurrent,
    extraCostIfDacMxn: extraIfDac,
    subsidyNote: zone.subsidyNote,
    userTariffMxn: Number(building?.tariff) || zone.normalRateMxn,
  };
}

export function getCfeStatusForActive(building, live) {
  if (!building) return null;
  return analyzeCfeTariff(building, live);
}

/** Bloque para reportes (HTML / PDF / Excel) */
export function buildCfeReportSummary(cfe) {
  if (!cfe) return null;
  const items = [
    { label: "Zona climática CFE", value: cfe.zoneLabel },
    { label: "Temporada", value: cfe.seasonLabel },
    { label: "Escalón tarifario actual", value: cfe.tierLabel },
    {
      label: "Proyección de consumo mensual",
      value: `${cfe.monthlyProjectedKwh.toLocaleString("es-MX")} kWh (${cfe.percentToDac}% del límite DAC)`,
    },
    {
      label: "Límite mensual antes de DAC",
      value: `${cfe.dacThresholdKwh.toLocaleString("es-MX")} kWh`,
    },
    {
      label: "Tarifa efectiva estimada",
      value: `$${cfe.effectiveRateMxn} MXN / kWh`,
    },
    {
      label: "Referencia tarifa subsidiada",
      value: `$${cfe.subsidyRateMxn} MXN / kWh`,
    },
    {
      label: "Tarifa DAC (penalización por exceso)",
      value: `$${cfe.dacRateMxn} MXN / kWh`,
    },
    {
      label: "Costo mensual proyectado (escalón actual)",
      value: `$${cfe.costProjectedMxn.toLocaleString("es-MX")} MXN`,
    },
  ];
  if (cfe.kwhUntilDac > 0) {
    items.push({
      label: "Margen restante antes de DAC",
      value: `${cfe.kwhUntilDac.toLocaleString("es-MX")} kWh`,
    });
  }
  if (cfe.extraCostIfDacMxn > 0) {
    items.push({
      label: "Costo adicional estimado si entras a DAC",
      value: `$${cfe.extraCostIfDacMxn.toLocaleString("es-MX")} MXN / mes`,
    });
  }
  items.push({
    label: "Tarifa configurada en SIREN",
    value: `$${cfe.userTariffMxn} MXN / kWh`,
  });
  return {
    title: "Tarifa CFE — subsidio y DAC",
    subtitle: cfe.subsidyNote,
    items,
  };
}
