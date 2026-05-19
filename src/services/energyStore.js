import { getActiveAreas, getActiveBuilding } from "./buildingsStore.js";
import { getBuildingType } from "../data/buildingTypes.js";
import { config } from "../config.js";
import { isMeasurementAccumulatingFor } from "./measurementSchedule.js";
import { providerForAreaType } from "../data/meterProviders.js";
import {
  applyRuntimeToArea,
  flushRuntimeSave,
  getPersistedAlerts,
  getPersistedConsumptionLog,
  pruneBuildingRuntimeAreas,
  scheduleRuntimeSave,
} from "./runtimeStore.js";

function isMeasurementAccumulating() {
  return isMeasurementAccumulatingFor(getActiveBuilding());
}

let areas = new Map();
let alerts = getPersistedAlerts();
const consumptionLog = [];

function buildRuntimePayload() {
  return {
    areas: getAreas(),
    consumptionLog: getConsumptionLog(),
    alerts: getAlerts(),
  };
}

function requestRuntimeSave() {
  scheduleRuntimeSave(() => buildRuntimePayload());
}

function randomKw(base, variance = 0.35) {
  return Math.max(0.05, base + (Math.random() - 0.5) * variance);
}

export function getHourPeakFactor(hour = new Date().getHours()) {
  if (hour >= 18 && hour <= 23) return 1.35;
  if (hour >= 7 && hour <= 9) return 1.2;
  return 1;
}

export function getAreaExpectedKw(area, building) {
  const peakFactor = getHourPeakFactor();
  return baseLoadForType(area.type, building) * peakFactor;
}

function baseLoadForType(type, building) {
  const typeDef = getBuildingType(building?.type ?? "hotel");
  const applianceBoost = getApplianceBoost(building);

  const loads = {
    room: 3.8,
    common: 9.5,
    office: 5.2,
    dining: 14.0,
    meeting: 8.5,
    utility: 22.0,
  };
  return (loads[type] ?? 6.0) * applianceBoost;
}

function getApplianceBoost(building) {
  if (!building?.appliances?.length) return 1;
  const typeDef = getBuildingType(building.type);
  let sum = 0;
  let n = 0;
  for (const app of typeDef.appliances) {
    if (building.appliances.includes(app.id)) {
      sum += app.factor;
      n++;
    }
  }
  return n ? sum / n : 1;
}

function createAreaState(area, building) {
  const base = baseLoadForType(area.type, building);
  return {
    areaId: area.id,
    name: area.name,
    floorId: area.floorId,
    floorName: area.floorName,
    type: area.type,
    powered: true,
    limitKw: null,
    currentKw: randomKw(base),
    voltage: 127 + Math.random() * 3,
    powerFactor: 0.88 + Math.random() * 0.08,
    meterId: `SM-${area.id.toUpperCase()}`,
    provider: providerForAreaType(area.type),
    history: [],
    totalKwhToday: base * 18 + Math.random() * 40,
  };
}

export function reloadEnergyForActiveBuilding() {
  const building = getActiveBuilding();
  const defs = getActiveAreas();
  areas = new Map(
    defs.map((a) => {
      const state = createAreaState(a, building);
      applyRuntimeToArea(state, building?.id);
      return [a.id, state];
    }),
  );
  if (building?.id) {
    pruneBuildingRuntimeAreas(
      building.id,
      defs.map((a) => a.id),
    );
  }
  consumptionLog.length = 0;
  const persistedLog = getPersistedConsumptionLog(building?.id);
  if (persistedLog.length) consumptionLog.push(...persistedLog);
  flushRuntimeSave(() => buildRuntimePayload());
}

/** Pone en cero kWh de sesión, historial y log (sin recrear zonas) */
export function resetRealtimeCounters() {
  for (const area of areas.values()) {
    area.totalKwhToday = 0;
    area.history = [];
  }
  consumptionLog.length = 0;
  flushRuntimeSave(() => buildRuntimePayload());
}

export function getSessionKwhTotal() {
  return getAreas().reduce((s, a) => s + a.totalKwhToday, 0);
}

reloadEnergyForActiveBuilding();

export function getAreas() {
  return [...areas.values()];
}

export function getArea(areaId) {
  return areas.get(areaId) ?? null;
}

export function updateArea(areaId, patch) {
  const area = areas.get(areaId);
  if (!area) return null;
  Object.assign(area, patch);
  requestRuntimeSave();
  return area;
}

export function addAlert(alert) {
  const entry = {
    id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    acknowledged: false,
    ...alert,
  };
  alerts.unshift(entry);
  if (alerts.length > 100) alerts.pop();
  requestRuntimeSave();
  return entry;
}

export function getAlerts({ onlyActive = false } = {}) {
  if (onlyActive) return alerts.filter((a) => !a.acknowledged);
  return [...alerts];
}

export function acknowledgeAlert(alertId) {
  const alert = alerts.find((a) => a.id === alertId);
  if (alert) alert.acknowledged = true;
  requestRuntimeSave();
  return alert ?? null;
}

export function logConsumptionSnapshot() {
  if (!isMeasurementAccumulating()) return null;
  const ts = new Date().toISOString();
  const list = getAreas();
  const building = getActiveBuilding();
  const powered = list.filter((a) => a.powered);
  const totalKw = powered.reduce((s, a) => s + a.currentKw, 0);
  const expectedTotalKw = powered.reduce(
    (s, a) => s + getAreaExpectedKw(a, building),
    0,
  );
  const floorKw = new Map();
  for (const a of list) {
    if (!floorKw.has(a.floorId)) {
      floorKw.set(a.floorId, { floorId: a.floorId, kw: 0, expectedKw: 0 });
    }
    const f = floorKw.get(a.floorId);
    if (a.powered) f.kw += a.currentKw;
    f.expectedKw += getAreaExpectedKw(a, building);
  }

  const snapshot = {
    timestamp: ts,
    hour: new Date().getHours(),
    buildingId: building?.id,
    buildingType: building?.type,
    areas: list.map((a) => ({
      areaId: a.areaId,
      floorId: a.floorId,
      type: a.type,
      powered: a.powered,
      kw: a.currentKw,
      expectedKw: getAreaExpectedKw(a, building),
      kwhDelta: (a.currentKw * config.simulationIntervalMs) / 3_600_000,
    })),
    totalKw,
    expectedTotalKw,
    byFloor: [...floorKw.values()],
    voltageAvg: powered.length
      ? powered.reduce((s, a) => s + a.voltage, 0) / powered.length
      : 0,
    powerFactorAvg: powered.length
      ? powered.reduce((s, a) => s + a.powerFactor, 0) / powered.length
      : 0,
  };
  consumptionLog.push(snapshot);
  if (consumptionLog.length > 5000) consumptionLog.shift();
  return snapshot;
}

export function getBaselineTotalKw() {
  const building = getActiveBuilding();
  return getAreas()
    .filter((a) => a.powered)
    .reduce((s, a) => s + getAreaExpectedKw(a, building), 0);
}

export function getConsumptionLog() {
  return [...consumptionLog];
}

let simulationTickCount = 0;

export function tickSimulation() {
  simulationTickCount += 1;
  const building = getActiveBuilding();
  const hour = new Date().getHours();
  const peakFactor =
    hour >= 18 && hour <= 23 ? 1.35 : hour >= 7 && hour <= 9 ? 1.2 : 1;

  for (const area of areas.values()) {
    if (!area.powered) {
      area.currentKw = 0;
      continue;
    }

    const base = baseLoadForType(area.type, building) * peakFactor;
    area.currentKw = randomKw(base);
    if (area.limitKw != null && area.currentKw > area.limitKw) {
      area.currentKw = area.limitKw;
    }

    area.voltage = 126 + Math.random() * 5;

    if (isMeasurementAccumulating()) {
      const kwhDelta =
        (area.currentKw * config.simulationIntervalMs) / 3_600_000;
      area.totalKwhToday += kwhDelta;
      area.history.push({
        t: new Date().toISOString(),
        kw: area.currentKw,
      });
      if (area.history.length > 60) area.history.shift();
    }
  }

  const snapshot = logConsumptionSnapshot();
  if (simulationTickCount % 5 === 0) requestRuntimeSave();
  return snapshot;
}

export function getRealtimeSnapshot() {
  const list = getAreas();
  const building = getActiveBuilding();
  const tariff = building?.tariff ?? config.kwhPriceMxn;
  const totalKw = list.filter((a) => a.powered).reduce((s, a) => s + a.currentKw, 0);
  const totalKwhToday = list.reduce((s, a) => s + a.totalKwhToday, 0);
  const powered = list.filter((a) => a.powered);
  const voltageAvg = powered.length
    ? powered.reduce((s, a) => s + a.voltage, 0) / powered.length
    : 0;
  const powerFactorAvg = powered.length
    ? powered.reduce((s, a) => s + a.powerFactor, 0) / powered.length
    : 0;

  const floorMap = new Map();
  for (const a of list) {
    if (!floorMap.has(a.floorId)) {
      floorMap.set(a.floorId, {
        floorId: a.floorId,
        floorName: a.floorName,
        kw: 0,
        kwh: 0,
        costMxn: 0,
      });
    }
    const f = floorMap.get(a.floorId);
    if (a.powered) f.kw += a.currentKw;
    f.kwh += a.totalKwhToday;
    f.costMxn += a.totalKwhToday * tariff;
  }

  const accumulating = isMeasurementAccumulating();

  return {
    buildingId: building?.id,
    buildingName: building?.name,
    timestamp: new Date().toISOString(),
    totalKw,
    totalKwhToday,
    costTodayMxn: Math.round(totalKwhToday * tariff * 100) / 100,
    measurementAccumulating: accumulating,
    voltageAvg: Math.round(voltageAvg * 10) / 10,
    powerFactorAvg: Math.round(powerFactorAvg * 1000) / 1000,
    tariff,
    byFloor: [...floorMap.values()],
    areas: list.map((a) => ({
      areaId: a.areaId,
      floorId: a.floorId,
      kw: a.currentKw,
      voltage: Math.round(a.voltage * 10) / 10,
      powerFactor: Math.round(a.powerFactor * 1000) / 1000,
      powered: a.powered,
    })),
  };
}
