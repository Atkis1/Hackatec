import fs from "node:fs";
import { getActiveBuilding } from "./buildingsStore.js";
import { RUNTIME_FILE, ensureUserDataDir } from "./dataPaths.js";

let cache = null;
let saveTimer = null;

function emptyState() {
  return {
    version: 1,
    byBuilding: {},
    alerts: [],
    automation: { rules: null, recentLog: [] },
  };
}

function loadAll() {
  if (cache) return cache;
  ensureUserDataDir();
  try {
    if (fs.existsSync(RUNTIME_FILE)) {
      cache = JSON.parse(fs.readFileSync(RUNTIME_FILE, "utf8"));
    }
  } catch {
    cache = null;
  }
  if (!cache?.byBuilding) cache = emptyState();
  if (!Array.isArray(cache.alerts)) cache.alerts = [];
  if (!cache.automation) cache.automation = { rules: null, recentLog: [] };
  if (!Array.isArray(cache.automation.recentLog)) {
    cache.automation.recentLog = [];
  }
  return cache;
}

export function getAutomationConfig() {
  return loadAll().automation;
}

export function saveAutomationConfig(automation) {
  const data = loadAll();
  data.automation = {
    rules: automation.rules ?? data.automation?.rules ?? null,
    recentLog: (automation.recentLog ?? data.automation?.recentLog ?? []).slice(
      0,
      20,
    ),
  };
  writeAll();
}

function writeAll() {
  ensureUserDataDir();
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(cache, null, 2), "utf8");
}

export function getBuildingRuntime(buildingId) {
  if (!buildingId) return null;
  return loadAll().byBuilding[buildingId] ?? null;
}

export function getPersistedAlerts() {
  return [...loadAll().alerts];
}

export function setPersistedAlerts(alerts) {
  const data = loadAll();
  data.alerts = alerts.slice(0, 100);
  writeAll();
}

export function applyRuntimeToArea(area, buildingId) {
  const snap = getBuildingRuntime(buildingId);
  const saved = snap?.areas?.[area.areaId];
  if (!saved) return;
  if (saved.powered !== undefined) area.powered = saved.powered;
  if (saved.limitKw !== undefined) area.limitKw = saved.limitKw;
  if (saved.totalKwhToday !== undefined) area.totalKwhToday = saved.totalKwhToday;
  if (Array.isArray(saved.history) && saved.history.length) {
    area.history = saved.history.slice(-60);
  }
}

export function getPersistedConsumptionLog(buildingId) {
  const snap = getBuildingRuntime(buildingId);
  return Array.isArray(snap?.consumptionLog) ? snap.consumptionLog : [];
}

export function saveActiveBuildingRuntime({ areas, consumptionLog, alerts }) {
  const building = getActiveBuilding();
  if (!building) return;

  const data = loadAll();
  const areaMap = {};
  for (const a of areas) {
    areaMap[a.areaId] = {
      powered: a.powered,
      limitKw: a.limitKw,
      totalKwhToday: a.totalKwhToday,
      history: (a.history ?? []).slice(-60),
    };
  }

  data.byBuilding[building.id] = {
    savedAt: new Date().toISOString(),
    areas: areaMap,
    consumptionLog: (consumptionLog ?? []).slice(-250),
  };

  if (alerts) data.alerts = alerts.slice(0, 100);
  writeAll();
}

export function scheduleRuntimeSave(getter) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const payload = getter();
      if (payload) saveActiveBuildingRuntime(payload);
    } catch (err) {
      console.error("[SIREN] Error guardando estado:", err.message);
    }
  }, 1500);
}

export function flushRuntimeSave(getter) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const payload = getter();
  if (payload) saveActiveBuildingRuntime(payload);
}

/** Quita zonas que ya no existen en el edificio guardado (pisos/áreas eliminados). */
export function pruneBuildingRuntimeAreas(buildingId, validAreaIds) {
  if (!buildingId) return;
  const valid = new Set(validAreaIds);
  const data = loadAll();
  const snap = data.byBuilding[buildingId];
  if (!snap?.areas) return;

  let changed = false;
  for (const areaId of Object.keys(snap.areas)) {
    if (!valid.has(areaId)) {
      delete snap.areas[areaId];
      changed = true;
    }
  }
  if (changed) writeAll();
}
