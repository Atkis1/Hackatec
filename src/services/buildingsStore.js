import fs from "node:fs";
import { getBuildingType } from "../data/buildingTypes.js";
import { config } from "../config.js";
import { normalizeMeasurement } from "./measurementSchedule.js";
import {
  BUILDINGS_FILE,
  LEGACY_BUILDINGS_FILE,
  ensureUserDataDir,
} from "./dataPaths.js";

const DATA_FILE = BUILDINGS_FILE;

let state = null;
let activeBuildingId = null;

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultHotelBuilding() {
  return {
    id: "site-hotel-centro",
    name: "Mi edificio",
    type: "hotel",
    measurementMode: "rooms",
    kwhPerRoomPerDay: 28,
    kwhPerSqmPerDay: 1.15,
    tariff: config.kwhPriceMxn,
    appliances: ["hvac", "lighting", "elevators", "kitchen", "laundry"],
    floors: [
      {
        id: "p1",
        name: "Piso 1 – Lobby y recepción",
        hasRooms: false,
        roomCount: 0,
        sqm: 1200,
        areas: [
          { id: "p1-lobby", name: "Lobby principal", type: "common" },
          { id: "p1-recep", name: "Recepción", type: "office" },
          { id: "p1-rest", name: "Restaurante", type: "dining" },
        ],
      },
      {
        id: "p2",
        name: "Piso 2 – Habitaciones 201-210",
        hasRooms: true,
        roomCount: 10,
        sqm: 980,
        areas: [],
      },
      {
        id: "p3",
        name: "Piso 3 – Habitaciones 301-310",
        hasRooms: true,
        roomCount: 10,
        sqm: 980,
        areas: [],
      },
      {
        id: "p4",
        name: "Piso 4 – Salas y servicios",
        hasRooms: false,
        roomCount: 0,
        sqm: 850,
        areas: [
          { id: "p4-sala-a", name: "Sala de juntas A", type: "meeting" },
          { id: "p4-sala-b", name: "Sala de juntas B", type: "meeting" },
          { id: "p4-lav", name: "Lavandería industrial", type: "utility" },
          { id: "p4-hvac", name: "Centro HVAC", type: "utility" },
        ],
      },
    ],
  };
}

function migrateLegacyBuildingsFile() {
  ensureUserDataDir();
  if (fs.existsSync(DATA_FILE)) return;
  if (!fs.existsSync(LEGACY_BUILDINGS_FILE)) return;
  try {
    fs.copyFileSync(LEGACY_BUILDINGS_FILE, DATA_FILE);
    console.log("[SIREN] Datos migrados a data/user/buildings.json");
  } catch (err) {
    console.error("[SIREN] No se pudo migrar buildings.json:", err.message);
  }
}

function loadFile() {
  migrateLegacyBuildingsFile();
  ensureUserDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      state = { buildings: raw.buildings ?? [], activeId: raw.activeId };
    }
  } catch {
    state = null;
  }
  if (!state?.buildings?.length) {
    const hotel = defaultHotelBuilding();
    state = { buildings: [hotel], activeId: hotel.id };
    saveFile();
  }
  let migrated = false;
  for (const b of state.buildings) {
    if (
      b.name === "Hotel & Centro Corporativo Demo" ||
      b.name?.includes("Demo")
    ) {
      b.name = "Mi edificio";
      migrated = true;
    }
  }
  if (!state.activeId && state.buildings[0]) {
    state.activeId = state.buildings[0].id;
    migrated = true;
  }
  if (migrated) saveFile();
  activeBuildingId = state.activeId ?? state.buildings[0].id;
  state.buildings.forEach((b) => normalizeBuilding(b));
}

function saveFile() {
  ensureUserDataDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      { activeId: activeBuildingId, buildings: state.buildings },
      null,
      2,
    ),
    "utf8",
  );
}

function normalizeFloorAreas(building, floor) {
  const typeDef = getBuildingType(building.type);
  const label = (floor.name || "Piso").trim();
  const roomCount = Math.max(0, Math.floor(Number(floor.roomCount) || 0));

  if (building.measurementMode === "sqm") {
    const sqm = Number(floor.sqm) || 0;
    floor.areas = [
      {
        id: `${floor.id}-zona`,
        name: sqm > 0 ? `${label} (${sqm} m²)` : label,
        type: "common",
      },
    ];
    floor.hasRooms = false;
    floor.roomCount = 0;
    return;
  }

  if (floor.hasRooms && roomCount > 0) {
    if (roomCount === 1) {
      floor.areas = [
        {
          id: `${floor.id}-hab-1`,
          name: label,
          type: "room",
        },
      ];
    } else {
      floor.areas = Array.from({ length: roomCount }, (_, i) => ({
        id: `${floor.id}-hab-${i + 1}`,
        name: `${label} – Hab. ${i + 1}`,
        type: "room",
      }));
    }
    return;
  }

  floor.areas = [
    {
      id: `${floor.id}-zona`,
      name: label,
      type: typeDef.areaTypes[0] ?? "common",
    },
  ];
}

export function normalizeBuilding(building) {
  const typeDef = getBuildingType(building.type);
  if (!building.appliances?.length) {
    building.appliances = typeDef.appliances.slice(0, 4).map((a) => a.id);
  }
  building.tariff = building.tariff ?? config.kwhPriceMxn;
  building.cfeClimateZone = building.cfeClimateZone ?? "1C";
  building.kwhPerRoomPerDay =
    building.kwhPerRoomPerDay ?? typeDef.defaultKwhPerRoom;
  building.kwhPerSqmPerDay =
    building.kwhPerSqmPerDay ?? typeDef.defaultKwhPerSqm;
  building.floors?.forEach((f) => normalizeFloorAreas(building, f));
  normalizeMeasurement(building);
  return building;
}

loadFile();

export function getBuildingsState() {
  return {
    buildings: state.buildings.map((b) => summarizeBuilding(b)),
    activeId: activeBuildingId,
  };
}

function summarizeBuilding(b) {
  const areas = countAreas(b);
  const sqm = totalSqm(b);
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    measurementMode: b.measurementMode,
    floorCount: b.floors.length,
    areaCount: areas,
    totalSqm: sqm,
    tariff: b.tariff,
    cfeClimateZone: b.cfeClimateZone ?? "1C",
  };
}

function countAreas(building) {
  return building.floors.reduce((s, f) => s + (f.areas?.length ?? 0), 0);
}

function totalSqm(building) {
  return building.floors.reduce((s, f) => s + (Number(f.sqm) || 0), 0);
}

export function getBuilding(id) {
  const b = state.buildings.find((x) => x.id === id);
  return b ? structuredClone(normalizeBuilding(b)) : null;
}

export function getActiveBuilding() {
  return getBuilding(activeBuildingId);
}

export function getActiveBuildingSite() {
  const b = getActiveBuilding();
  if (!b) return null;
  return buildingToSite(b);
}

export function buildingToSite(building) {
  return {
    id: building.id,
    name: building.name,
    type: building.type,
    measurementMode: building.measurementMode,
    kwhPerRoomPerDay: building.kwhPerRoomPerDay,
    kwhPerSqmPerDay: building.kwhPerSqmPerDay,
    tariff: building.tariff,
    cfeClimateZone: building.cfeClimateZone ?? "1C",
    appliances: building.appliances,
    floors: building.floors.map((f) => ({
      id: f.id,
      name: f.name,
      hasRooms: f.hasRooms,
      roomCount: f.roomCount,
      sqm: f.sqm,
      areas: f.areas.map((a) => ({ ...a })),
    })),
  };
}

export function getAllAreasFromBuilding(building) {
  return building.floors.flatMap((floor) =>
    floor.areas.map((area) => ({
      ...area,
      floorId: floor.id,
      floorName: floor.name,
    })),
  );
}

export function getActiveAreas() {
  const b = getActiveBuilding();
  return b ? getAllAreasFromBuilding(b) : [];
}

export function activateBuilding(id) {
  if (!state.buildings.some((b) => b.id === id)) {
    return { ok: false, error: "Edificio no encontrado" };
  }
  activeBuildingId = id;
  saveFile();
  return { ok: true, building: getActiveBuilding() };
}

export function createBuilding(payload) {
  const typeDef = getBuildingType(payload.type ?? "hotel");
  const building = normalizeBuilding({
    id: uid("bld"),
    name: payload.name ?? "Nuevo edificio",
    type: payload.type ?? "hotel",
    measurementMode: payload.measurementMode ?? "rooms",
    kwhPerRoomPerDay: payload.kwhPerRoomPerDay ?? typeDef.defaultKwhPerRoom,
    kwhPerSqmPerDay: payload.kwhPerSqmPerDay ?? typeDef.defaultKwhPerSqm,
    tariff: payload.tariff ?? config.kwhPriceMxn,
    cfeClimateZone: payload.cfeClimateZone ?? "1C",
    appliances: payload.appliances ?? typeDef.appliances.map((a) => a.id),
    floors: payload.floors ?? [
      {
        id: uid("p"),
        name: "Piso 1",
        hasRooms: typeDef.defaultHasRooms,
        roomCount: typeDef.defaultHasRooms ? 10 : 0,
        sqm: 800,
        areas: [],
      },
    ],
  });
  state.buildings.push(building);
  activeBuildingId = building.id;
  saveFile();
  return { ok: true, building };
}

export function updateBuilding(id, payload) {
  const idx = state.buildings.findIndex((b) => b.id === id);
  if (idx < 0) return { ok: false, error: "Edificio no encontrado" };
  const merged = normalizeBuilding({
    ...state.buildings[idx],
    ...payload,
    id,
    floors: payload.floors ?? state.buildings[idx].floors,
  });
  state.buildings[idx] = merged;
  saveFile();
  return { ok: true, building: getBuilding(id) };
}

export function deleteBuilding(id) {
  if (state.buildings.length <= 1) {
    return { ok: false, error: "Debe existir al menos un edificio" };
  }
  state.buildings = state.buildings.filter((b) => b.id !== id);
  if (activeBuildingId === id) {
    activeBuildingId = state.buildings[0].id;
  }
  saveFile();
  return { ok: true };
}

export function getBuildingMetrics(building) {
  const b = building ?? getActiveBuilding();
  if (!b) return null;
  const areaCount = countAreas(b);
  const sqm = totalSqm(b);
  const tariff = Number(b.tariff);

  let dailyKwh;
  let formulaKwh;
  if (b.measurementMode === "sqm") {
    dailyKwh = sqm * Number(b.kwhPerSqmPerDay);
    formulaKwh = `${sqm} m² × ${b.kwhPerSqmPerDay} kWh/m²`;
  } else {
    dailyKwh = areaCount * Number(b.kwhPerRoomPerDay);
    formulaKwh = `${areaCount} áreas × ${b.kwhPerRoomPerDay} kWh/área`;
  }

  const applianceFactor = getApplianceFactor(b);
  dailyKwh *= applianceFactor;

  return {
    areaCount,
    totalSqm: sqm,
    measurementMode: b.measurementMode,
    kwhPerRoom: b.kwhPerRoomPerDay,
    kwhPerSqm: b.kwhPerSqmPerDay,
    tariff,
    applianceFactor,
    dailyKwh: Math.round(dailyKwh * 10) / 10,
    formulaKwh,
  };
}

function getApplianceFactor(building) {
  const typeDef = getBuildingType(building.type);
  const selected = building.appliances ?? [];
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

export function reloadBuildingsFromDisk() {
  loadFile();
}
