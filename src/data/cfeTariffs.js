/**
 * Modelo educativo CFE (México): zonas climáticas, temporada y escalones
 * tarifarios hacia DAC (Doméstica de Alto Consumo / penalización por exceso).
 * Referencia: tarifas CFE por zona de temperatura y recargos DAC.
 */

export const CFE_CLIMATE_ZONES = {
  "1": {
    label: "Zona 1 — Centro y altiplano",
    dacThresholdMonthlyKwh: 2800,
    subsidyRateMxn: 2.15,
    normalRateMxn: 3.35,
    dacRateMxn: 6.4,
    summerMonths: [4, 5, 6, 7, 8, 9, 10],
    subsidyNote:
      "En invierno y en bloques básicos el costo por kWh es menor; la red subsidia parte del suministro.",
  },
  "1A": {
    label: "Zona 1A — Muy cálida",
    dacThresholdMonthlyKwh: 2200,
    subsidyRateMxn: 1.95,
    normalRateMxn: 3.25,
    dacRateMxn: 6.9,
    summerMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    subsidyNote:
      "Zona de máxima incidencia solar: tarifa verano con apoyo más amplio en kWh bajos.",
  },
  "1B": {
    label: "Zona 1B — Cálida",
    dacThresholdMonthlyKwh: 2400,
    subsidyRateMxn: 2.05,
    normalRateMxn: 3.3,
    dacRateMxn: 6.7,
    summerMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    subsidyNote: "Temporada de calor: vigilan los primeros bloques con tarifa reducida.",
  },
  "1C": {
    label: "Zona 1C — Litoral cálido",
    dacThresholdMonthlyKwh: 2000,
    subsidyRateMxn: 1.88,
    normalRateMxn: 3.2,
    dacRateMxn: 6.85,
    summerMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    subsidyNote:
      "Costa y litoral: verano largo; conviene no rebasar el límite mensual antes de DAC.",
  },
  "1D": {
    label: "Zona 1D — Templada costera",
    dacThresholdMonthlyKwh: 2600,
    subsidyRateMxn: 2.12,
    normalRateMxn: 3.38,
    dacRateMxn: 6.55,
    summerMonths: [4, 5, 6, 7, 8, 9],
    subsidyNote: "Menor presión térmica que 1C; subsidio moderado en bloques bajos.",
  },
  "1E": {
    label: "Zona 1E — Templada",
    dacThresholdMonthlyKwh: 3000,
    subsidyRateMxn: 2.22,
    normalRateMxn: 3.42,
    dacRateMxn: 6.35,
    summerMonths: [5, 6, 7, 8, 9],
    subsidyNote: "Transición verano–invierno más corta; tarifa intermedia estable.",
  },
  "1F": {
    label: "Zona 1F — Fría",
    dacThresholdMonthlyKwh: 3200,
    subsidyRateMxn: 2.28,
    normalRateMxn: 3.48,
    dacRateMxn: 6.2,
    summerMonths: [6, 7, 8],
    subsidyNote:
      "Invierno prolongado: más kWh permitidos antes de escalar a tarifa DAC.",
  },
};

export const CFE_ZONE_IDS = Object.keys(CFE_CLIMATE_ZONES);

export function getCfeZone(zoneId) {
  return CFE_CLIMATE_ZONES[zoneId] ?? CFE_CLIMATE_ZONES["1C"];
}

export function getSeasonForZone(zoneId, month = new Date().getMonth() + 1) {
  const zone = getCfeZone(zoneId);
  const isSummer = zone.summerMonths.includes(month);
  return {
    id: isSummer ? "verano" : "invierno",
    label: isSummer ? "Temporada de verano" : "Temporada de invierno",
    isSummer,
  };
}
