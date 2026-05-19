import { getAreas, getArea, updateArea } from "./energyStore.js";
import { getActiveBuilding } from "./buildingsStore.js";

/** Integración con medidores inteligentes (simulados por zona del edificio activo) */
const supportedProviders = [
  {
    id: "openmeter",
    name: "OpenMeter API",
    protocol: "REST",
    status: "connected",
    statusLabel: "Conectado",
    description:
      "Envía lecturas por internet. Sirve para medidores digitales en la nube o plataformas de energía.",
  },
  {
    id: "modbus-tcp",
    name: "Modbus TCP",
    protocol: "Modbus",
    status: "connected",
    statusLabel: "Conectado",
    description:
      "Conexión industrial directa al cuadro eléctrico o PLC. Muy usado en edificios grandes.",
  },
  {
    id: "mqtt-iot",
    name: "MQTT Gateway",
    protocol: "MQTT",
    status: "standby",
    statusLabel: "En espera",
    description:
      "Canal ligero para sensores IoT. Se activa cuando conectes hardware compatible.",
  },
];

import { providerForAreaType } from "../data/meterProviders.js";

export { providerForAreaType };

const AREA_TYPE_LABELS = {
  room: "Habitación / área",
  common: "Área común",
  office: "Oficina",
  dining: "Comedor",
  meeting: "Sala",
  utility: "Servicios",
};

export function listProviders() {
  const areas = getAreas();
  const inUse = new Set(areas.map((a) => a.provider));
  return supportedProviders.map((p) => {
    const count = areas.filter((a) => a.provider === p.name).length;
    const active = inUse.has(p.name);
    return {
      ...p,
      metersCount: count,
      status: active ? "connected" : p.status,
      statusLabel: active
        ? count
          ? `En uso (${count})`
          : "En uso"
        : p.statusLabel,
    };
  });
}

export function listMeters() {
  const building = getActiveBuilding();
  return getAreas().map((a) => ({
    meterId: a.meterId,
    areaId: a.areaId,
    areaName: a.name,
    floorName: a.floorName,
    areaType: a.type,
    areaTypeLabel: AREA_TYPE_LABELS[a.type] ?? a.type,
    provider: a.provider,
    online: a.powered,
    statusLabel: a.powered ? "En línea" : "Apagado / sin lectura",
    lastReading: {
      kw: a.currentKw,
      voltage: a.voltage,
      powerFactor: a.powerFactor,
      timestamp: new Date().toISOString(),
    },
    buildingName: building?.name ?? "—",
  }));
}

export function getMetersSummary() {
  const meters = listMeters();
  const online = meters.filter((m) => m.online).length;
  return {
    total: meters.length,
    online,
    offline: meters.length - online,
    buildingName: getActiveBuilding()?.name ?? "—",
  };
}

export function syncMeterReading(meterId, reading) {
  const area = getAreas().find((a) => a.meterId === meterId);
  if (!area) return { ok: false, error: "Medidor no registrado" };

  updateArea(area.areaId, {
    currentKw: reading.kw ?? area.currentKw,
    voltage: reading.voltage ?? area.voltage,
    powerFactor: reading.powerFactor ?? area.powerFactor,
  });

  return { ok: true, area: getArea(area.areaId) };
}
