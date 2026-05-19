export const PROVIDER_BY_TYPE = {
  room: "OpenMeter API",
  office: "Modbus TCP",
  utility: "Modbus TCP",
  dining: "OpenMeter API",
  meeting: "Modbus TCP",
  common: "MQTT Gateway",
};

export function providerForAreaType(type) {
  return PROVIDER_BY_TYPE[type] ?? "OpenMeter API";
}
