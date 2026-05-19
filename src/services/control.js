import { getArea, getAreas, updateArea, addAlert } from "./energyStore.js";

export function setPower(areaId, powered) {
  const area = getArea(areaId);
  if (!area) return { ok: false, error: "Área no encontrada" };

  updateArea(areaId, {
    powered: Boolean(powered),
    currentKw: powered ? area.currentKw || 0.5 : 0,
  });

  if (!powered) {
    addAlert({
      type: "control",
      severity: "info",
      areaId,
      message: `Circuito apagado manualmente: ${area.name}`,
    });
  }

  return { ok: true, area: getArea(areaId) };
}

export function setLimit(areaId, limitKw) {
  const area = getArea(areaId);
  if (!area) return { ok: false, error: "Área no encontrada" };

  if (limitKw != null && (limitKw < 0.1 || limitKw > 50)) {
    return { ok: false, error: "Límite debe estar entre 0.1 y 50 kW" };
  }

  updateArea(areaId, { limitKw: limitKw == null ? null : Number(limitKw) });

  if (limitKw != null) {
    addAlert({
      type: "control",
      severity: "info",
      areaId,
      message: `Límite de consumo fijado a ${limitKw} kW en ${area.name}`,
    });
  }

  return { ok: true, area: getArea(areaId) };
}

export function bulkControl({ floorId, powered, limitKw }) {
  const targets = getAreas().filter((a) => !floorId || a.floorId === floorId);
  const results = [];

  for (const area of targets) {
    if (powered !== undefined) {
      results.push(setPower(area.areaId, powered));
    }
    if (limitKw !== undefined) {
      results.push(setLimit(area.areaId, limitKw));
    }
  }

  return { ok: true, affected: results.length, results };
}
