let lastOverview = null;

export function setChartOverviewContext(overview) {
  lastOverview = overview;
  renderChartExplainer(overview, null);
}

export function updateChartExplainerLive(realtime) {
  renderChartExplainer(lastOverview, realtime);
}

function renderChartExplainer(overview, realtime) {
  const el = document.getElementById("chart-explainer");
  if (!el) return;

  if (!overview?.site) {
    el.innerHTML =
      "Configura un edificio arriba para ver mediciones enlazadas a tus pisos y zonas.";
    return;
  }

  const site = overview.site;
  const meta = overview.buildingMeta ?? {};
  const floors = site.floors?.length ?? 0;
  const areas = meta.areaCount ?? overview.summary?.totalAreas ?? 0;
  const mode =
    meta.measurementMode === "sqm"
      ? `${meta.totalSqm ?? 0} m² en total`
      : `${areas} zonas o habitaciones`;
  const tariff = meta.tariff ?? overview.summary?.pricePerKwh ?? 3.2;
  const kwhRef =
    meta.measurementMode === "sqm"
      ? `${meta.kwhPerSqm ?? "—"} kWh/m²/día (para reportes)`
      : `${meta.kwhPerRoom ?? "—"} kWh por zona/día (para reportes)`;

  const kw = realtime?.totalKw ?? overview.summary?.totalKw ?? "—";
  const kwhToday = realtime?.totalKwhToday ?? overview.summary?.totalKwhToday ?? "—";
  const cost = realtime?.costTodayMxn ?? overview.summary?.estimatedCostTodayMxn ?? "—";

  el.innerHTML =
    "<strong>Origen de los datos</strong><br>" +
    site.name +
    " · " +
    floors +
    " pisos · " +
    mode +
    "<br>Tarifa $" +
    Number(tariff).toFixed(2) +
    "/kWh · ref. " +
    kwhRef +
    "<br><strong>Ahora:</strong> " +
    (typeof kw === "number" ? kw.toFixed(1) : kw) +
    " kW · " +
    (typeof kwhToday === "number" ? kwhToday.toFixed(1) : kwhToday) +
    " kWh hoy · $" +
    (typeof cost === "number" ? cost.toFixed(2) : cost) +
    " MXN";
}
