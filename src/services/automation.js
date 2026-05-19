import {
  getAreas,
  getAreaExpectedKw,
  getBaselineTotalKw,
  updateArea,
} from "./energyStore.js";
import { getActiveBuilding } from "./buildingsStore.js";
import {
  getAutomationConfig,
  saveAutomationConfig,
} from "./runtimeStore.js";

const DEFAULT_RULES = {
  limitOverload: {
    enabled: true,
    name: "Limitar zonas en sobrecarga",
    description:
      "Si una zona supera 135% de lo esperado, ajusta su tope de kW automáticamente.",
  },
  shedUtilityPeak: {
    enabled: false,
    name: "Apagar servicios en pico",
    description:
      "Si la demanda total supera 130% del baseline, apaga una zona de servicios.",
  },
};

const actionCooldowns = new Map();
const MAX_LOG = 12;

function canRunAction(key, ms = 60_000) {
  const last = actionCooldowns.get(key);
  if (last && Date.now() - last < ms) return false;
  actionCooldowns.set(key, Date.now());
  return true;
}

export function getAutomationRules() {
  const saved = getAutomationConfig().rules ?? {};
  const merged = {};
  for (const [id, def] of Object.entries(DEFAULT_RULES)) {
    merged[id] = { ...def, ...(saved[id] ?? {}) };
  }
  return merged;
}

export function setAutomationRules(partial) {
  const current = getAutomationRules();
  for (const [id, patch] of Object.entries(partial ?? {})) {
    if (!current[id]) continue;
    current[id] = { ...current[id], ...patch };
  }
  const cfg = getAutomationConfig();
  cfg.rules = current;
  saveAutomationConfig(cfg);
  return current;
}

function appendAutomationLog(actions) {
  const cfg = getAutomationConfig();
  const entries = actions.map((a) => ({
    ...a,
    at: new Date().toISOString(),
  }));
  cfg.recentLog = [...entries, ...(cfg.recentLog ?? [])].slice(0, MAX_LOG);
  saveAutomationConfig(cfg);
}

export function getAutomationLog() {
  return [...(getAutomationConfig().recentLog ?? [])];
}

export function runAutomation(building = getActiveBuilding()) {
  if (!building) return [];

  const rules = getAutomationRules();
  const actions = [];
  const areas = getAreas();
  const baseline = getBaselineTotalKw();
  const totalKw = areas
    .filter((a) => a.powered)
    .reduce((s, a) => s + a.currentKw, 0);

  if (rules.limitOverload?.enabled) {
    for (const area of areas) {
      if (!area.powered) continue;
      const expected = getAreaExpectedKw(area, building);
      if (expected <= 0) continue;
      if (area.currentKw <= expected * 1.35) continue;

      const key = `limit:${area.areaId}`;
      if (!canRunAction(key, 75_000)) continue;

      const newLimit = Math.round(expected * 1.12 * 10) / 10;
      if (area.limitKw != null && area.limitKw <= newLimit) continue;

      updateArea(area.areaId, { limitKw: newLimit });
      actions.push({
        type: "set_limit",
        areaId: area.areaId,
        areaName: area.name,
        limitKw: newLimit,
        message: `Tope ajustado a ${newLimit} kW en ${area.name}`,
      });
    }
  }

  if (
    rules.shedUtilityPeak?.enabled &&
    baseline > 0 &&
    totalKw > baseline * 1.3
  ) {
    const key = "shed:peak";
    if (canRunAction(key, 120_000)) {
      const target = areas
        .filter((a) => a.type === "utility" && a.powered)
        .sort((a, b) => b.currentKw - a.currentKw)[0];
      if (target) {
        updateArea(target.areaId, { powered: false, currentKw: 0 });
        actions.push({
          type: "power_off",
          areaId: target.areaId,
          areaName: target.name,
          message: `Apagado automático: ${target.name} (pico global)`,
        });
      }
    }
  }

  if (actions.length) appendAutomationLog(actions);
  return actions;
}

export { DEFAULT_RULES };
