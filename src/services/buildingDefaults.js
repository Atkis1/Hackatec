import { getBuildingType } from "../data/buildingTypes.js";
import { config } from "../config.js";

function computeApplianceFactor(typeDef, applianceIds) {
  const selected = applianceIds ?? [];
  if (!selected.length) return 1;
  let sum = 0;
  let n = 0;
  for (const app of typeDef.appliances) {
    if (selected.includes(app.id)) {
      sum += app.factor;
      n++;
    }
  }
  return n ? sum / n : 1;
}

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

/**
 * Valores sugeridos según tipo de edificio, equipos y modo de medición (CFE / sector).
 * El usuario puede cambiarlos manualmente en cualquier momento.
 */
export function getSuggestedEnergyDefaults(
  typeId,
  measurementMode = "rooms",
  applianceIds = [],
) {
  const typeDef = getBuildingType(typeId);
  const factor = computeApplianceFactor(typeDef, applianceIds);
  const tariff =
    typeDef.suggestedTariffMxn ?? config.kwhPriceMxn;

  const kwhPerRoomPerDay = round(typeDef.defaultKwhPerRoom * factor, 1);
  const kwhPerSqmPerDay = round(typeDef.defaultKwhPerSqm * factor, 2);

  const tariffExplain =
    typeDef.tariffHint ??
    "Tarifa promedio en México (tarifa DAC / comercial intermedia). Revisa tu recibo CFE y ajústala si hace falta.";

  const kwhExplain =
    measurementMode === "sqm"
      ? `Consumo diario estimado por m² para un ${typeDef.label}, según los equipos que marcaste.`
      : `Consumo diario estimado por cada zona o habitación (${typeDef.label}), según los equipos que marcaste.`;

  return {
    tariff,
    kwhPerRoomPerDay,
    kwhPerSqmPerDay,
    applianceFactor: round(factor, 2),
    measurementMode,
    buildingTypeLabel: typeDef.label,
    hints: {
      tariff: tariffExplain,
      kwh: kwhExplain,
    },
    labels: {
      tariff: "Sugerido por SIREN",
      kwh: "Sugerido según tipo y equipos",
    },
  };
}
