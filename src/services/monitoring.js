import { config } from "../config.js";
import { getActiveBuilding, getActiveBuildingSite } from "./buildingsStore.js";
import { analyzeCfeTariff } from "./cfeBilling.js";
import { getAreas, getArea } from "./energyStore.js";
import { getBillingMetrics } from "./billing.js";
import { getBuildingMetrics } from "./buildingsStore.js";
import {
  getSessionPublicStatus,
  isMeasurementAccumulating,
} from "./measurementSession.js";
import { getSessionKwhTotal } from "./energyStore.js";

export function getSiteOverview() {
  const site = getActiveBuildingSite();
  const areas = getAreas();
  const active = areas.filter((a) => a.powered);
  const totalKw = active.reduce((s, a) => s + a.currentKw, 0);
  const billing = getBillingMetrics();
  const buildingMeta = getBuildingMetrics();
  const session = getSessionPublicStatus();
  const sessionKwh = round(getSessionKwhTotal(), 2);
  const tariff = site?.tariff ?? billing.tariff;
  const sessionCost = round(sessionKwh * tariff, 2);
  const building = getActiveBuilding();
  const cfeStatus = building
    ? analyzeCfeTariff(building, { totalKwhToday: sessionKwh })
    : null;

  return {
    site,
    buildingMeta,
    cfeStatus,
    measurementSession: session,
    summary: {
      totalAreas: billing.areaCount,
      activeAreas: active.length,
      kwhPerArea: billing.kwhPerArea,
      totalKw: round(totalKw, 2),
      totalKwhToday: sessionKwh,
      estimatedCostTodayMxn: sessionCost,
      measurementAccumulating: isMeasurementAccumulating(),
      referenceDailyKwh: billing.daily.kwh,
      pricePerKwh: billing.tariff,
      weeklyKwh: billing.weekly.kwh,
      weeklyCostMxn: billing.weekly.cost,
      monthlyKwh: billing.monthly.kwh,
      monthlyCostMxn: billing.monthly.cost,
    },
    floors: site.floors.map((floor) => {
      const floorAreas = areas.filter((a) => a.floorId === floor.id);
      const floorKw = floorAreas
        .filter((a) => a.powered)
        .reduce((s, a) => s + a.currentKw, 0);
      return {
        ...floor,
        totalKw: round(floorKw, 2),
        areas: floorAreas.map(publicArea),
      };
    }),
  };
}

export function getRealtimeByArea(areaId) {
  const area = getArea(areaId);
  if (!area) return null;
  return publicArea(area);
}

export function getRealtimeAll() {
  return getAreas().map(publicArea);
}

function publicArea(area) {
  return {
    areaId: area.areaId,
    name: area.name,
    floorId: area.floorId,
    floorName: area.floorName,
    type: area.type,
    powered: area.powered,
    limitKw: area.limitKw,
    currentKw: round(area.currentKw, 3),
    voltage: round(area.voltage, 1),
    powerFactor: round(area.powerFactor, 3),
    meterId: area.meterId,
    provider: area.provider,
    totalKwhToday: round(area.totalKwhToday, 3),
    status: deriveStatus(area),
    history: area.history.slice(-30),
  };
}

function deriveStatus(area) {
  if (!area.powered) return "off";
  if (area.limitKw != null && area.currentKw >= area.limitKw * 0.95) return "limited";
  if (area.currentKw >= config.alertThresholdKw) return "high";
  return "normal";
}

function round(n, d) {
  return Math.round(n * 10 ** d) / 10 ** d;
}
