export const config = {
  port: Number(process.env.PORT) || 3000,
  siteName: "SIREN",
  fullName: "Sistema Inteligente de Regulación Energética",
  kwhPriceMxn: Number(process.env.KWH_PRICE_MXN) || 3.2,
  /** Umbral global del sitio (suma de áreas) para alertas de demanda total */
  alertThresholdKw: Number(process.env.ALERT_THRESHOLD_KW) || 85,
  /** Factor sobre carga esperada para marcar un área como anómala */
  areaOverloadFactor: Number(process.env.AREA_OVERLOAD_FACTOR) || 1.35,
  simulationIntervalMs: 2000,
  /** Consumo promedio diario por habitación o área (kWh) */
  kwhPerAreaPerDay: Number(process.env.KWH_PER_AREA_DAY) || 28,
};
