export const BUILDING_TYPES = {
  hotel: {
    label: "Hotel",
    suggestedTariffMxn: 3.45,
    tariffHint:
      "Hoteles suelen pagar tarifa comercial DAC ($3.20–$3.80/kWh según zona CFE).",
    defaultHasRooms: true,
    defaultKwhPerRoom: 28,
    defaultKwhPerSqm: 1.15,
    areaTypes: ["room", "common", "dining", "utility"],
    appliances: [
      { id: "hvac", label: "HVAC / climatización", factor: 1.35 },
      { id: "lighting", label: "Iluminación LED", factor: 1.0 },
      { id: "elevators", label: "Elevadores", factor: 0.85 },
      { id: "kitchen", label: "Cocina industrial", factor: 1.25 },
      { id: "laundry", label: "Lavandería", factor: 1.15 },
      { id: "pool", label: "Alberca / spa", factor: 0.9 },
      { id: "water_pumps", label: "Bombas y cisternas", factor: 0.95 },
      { id: "security", label: "Seguridad / CCTV", factor: 0.75 },
      { id: "ev_chargers", label: "Cargadores EV", factor: 0.85 },
      { id: "backup_power", label: "Planta de emergencia", factor: 0.8 },
    ],
  },
  hospital: {
    label: "Hospital",
    suggestedTariffMxn: 3.65,
    tariffHint:
      "Hospitales: alto consumo continuo; tarifa comercial elevada ($3.50–$4.00/kWh).",
    defaultHasRooms: true,
    defaultKwhPerRoom: 45,
    defaultKwhPerSqm: 2.1,
    areaTypes: ["room", "office", "utility", "common"],
    appliances: [
      { id: "hvac", label: "HVAC médico", factor: 1.4 },
      { id: "lighting", label: "Iluminación", factor: 1.05 },
      { id: "medical", label: "Equipos médicos", factor: 1.5 },
      { id: "imaging", label: "Imagenología (RX / RM)", factor: 1.45 },
      { id: "elevators", label: "Elevadores", factor: 0.95 },
      { id: "sterilization", label: "Esterilización", factor: 1.2 },
      { id: "laundry", label: "Lavandería hospitalaria", factor: 1.1 },
      { id: "kitchen", label: "Cocina / nutrición", factor: 1.05 },
      { id: "backup_power", label: "Planta y UPS críticos", factor: 0.9 },
      { id: "water_pumps", label: "Bombas y tratamiento de agua", factor: 1.0 },
    ],
  },
  university: {
    label: "Universidad / campus",
    suggestedTariffMxn: 2.95,
    tariffHint:
      "Campus grandes a veces tienen tarifa de media tensión o horarios escalonados ($2.70–$3.20/kWh).",
    defaultHasRooms: false,
    defaultKwhPerRoom: 18,
    defaultKwhPerSqm: 0.95,
    areaTypes: ["office", "common", "meeting", "utility"],
    appliances: [
      { id: "hvac", label: "HVAC", factor: 1.2 },
      { id: "lighting", label: "Iluminación", factor: 1.0 },
      { id: "labs", label: "Laboratorios", factor: 1.35 },
      { id: "servers", label: "Centro de datos", factor: 1.25 },
      { id: "elevators", label: "Elevadores", factor: 0.7 },
      { id: "cafeteria", label: "Comedores / cafeterías", factor: 1.05 },
      { id: "sports", label: "Deportes / gimnasio", factor: 1.1 },
      { id: "ev_chargers", label: "Cargadores EV", factor: 0.8 },
      { id: "security", label: "Seguridad / accesos", factor: 0.72 },
      { id: "water_pumps", label: "Bombas y riego", factor: 0.88 },
    ],
  },
  corporate: {
    label: "Corporativo / oficinas",
    suggestedTariffMxn: 3.25,
    tariffHint:
      "Oficinas corporativas: tarifa comercial típica ($3.00–$3.50/kWh).",
    defaultHasRooms: false,
    defaultKwhPerRoom: 22,
    defaultKwhPerSqm: 1.05,
    areaTypes: ["office", "meeting", "common", "utility"],
    appliances: [
      { id: "hvac", label: "HVAC", factor: 1.25 },
      { id: "lighting", label: "Iluminación", factor: 0.95 },
      { id: "servers", label: "TI / servidores", factor: 1.2 },
      { id: "elevators", label: "Elevadores", factor: 0.75 },
      { id: "ev_chargers", label: "Cargadores EV", factor: 0.82 },
      { id: "security", label: "Seguridad / CCTV", factor: 0.7 },
      { id: "water_pumps", label: "Bombas y cisternas", factor: 0.85 },
      { id: "backup_power", label: "Planta de emergencia", factor: 0.78 },
      { id: "cafeteria", label: "Cafetería / comedor", factor: 0.95 },
    ],
  },
  mixed: {
    label: "Uso mixto",
    suggestedTariffMxn: 3.2,
    tariffHint: "Promedio nacional de referencia para uso mixto comercial.",
    defaultHasRooms: true,
    defaultKwhPerRoom: 26,
    defaultKwhPerSqm: 1.1,
    areaTypes: ["room", "office", "common", "dining", "utility"],
    appliances: [
      { id: "hvac", label: "HVAC", factor: 1.3 },
      { id: "lighting", label: "Iluminación", factor: 1.0 },
      { id: "elevators", label: "Elevadores", factor: 0.8 },
      { id: "kitchen", label: "Cocina / cafetería", factor: 1.1 },
      { id: "laundry", label: "Lavandería", factor: 1.05 },
      { id: "pool", label: "Alberca / amenidades", factor: 0.88 },
      { id: "servers", label: "TI / servidores", factor: 1.15 },
      { id: "security", label: "Seguridad", factor: 0.74 },
      { id: "water_pumps", label: "Bombas de agua", factor: 0.9 },
    ],
  },
};

export const APPLIANCE_IDS = [
  ...new Set(
    Object.values(BUILDING_TYPES).flatMap((t) => t.appliances.map((a) => a.id)),
  ),
];

export function getBuildingType(typeId) {
  return BUILDING_TYPES[typeId] ?? BUILDING_TYPES.mixed;
}
