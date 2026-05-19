import { initCharts, resetCharts, pushRealtime } from "./charts.js";
import {
  setChartOverviewContext,
  updateChartExplainerLive,
} from "./chart-context.js";
import {
  initBuildingsUi,
  refreshBuildingsSelect,
} from "./buildings-ui.js";
import {
  renderExpert,
  loadExpertView,
  initExpertUi,
} from "./expert-ui.js";
import {
  initMeasurementUi,
  renderMeasurementPanel,
  applyRealtimeSession,
  loadMeasurementSession,
  notifyActiveBuildingSwitched,
} from "./measurement-ui.js";
import {
  bindUiPersistence,
  applyUiPrefs,
  loadUiPrefs,
} from "./ui-persistence.js";
import { createConnectedViewsSync } from "./sync-views.js";
import {
  initAlertSound,
  bindAlertSocket,
  updateAlertBadge,
} from "./alert-sound.js";
import { loadAutomationPanel, initAutomationUi } from "./automation-ui.js";
import { initSidebar } from "./sidebar-ui.js";
import { updateBuildingPhotosFromSite } from "./building-photos.js";
const API = "/api";
let overview = null;
const realtimeMap = new Map();
let connectedSync = null;

const AREA_TYPE_LABELS = {
  room: "Habitación",
  common: "Área común",
  office: "Oficina",
  dining: "Comedor",
  meeting: "Sala",
  utility: "Servicios",
};
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const titles = {
  dashboard: "Panel central",
  areas: "Áreas y control",
  expert: "Sistema experto",
  alerts: "Alertas automáticas",
  reports: "Reportes periódicos",
  meters: "Medidores IoT",
};

async function fetchJson(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiJson(path, { method = "GET", body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: body != null ? { "Content-Type": "application/json" } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function initNav() {
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-btn").forEach((b) => b.classList.remove("active"));
      $$(".view").forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("view-" + btn.dataset.view).classList.add("active");
      $("#view-title").textContent = titles[btn.dataset.view];
      if (btn.dataset.view === "expert") {
        loadExpert().catch(console.error);
      }
    });
  });
}

function getOverviewAreaIds() {
  if (!overview?.floors) return new Set();
  return new Set(
    overview.floors.flatMap((f) => f.areas.map((a) => a.areaId)),
  );
}

function findAreaInOverview(areaId) {
  if (!overview?.floors) return null;
  for (const floor of overview.floors) {
    const area = floor.areas.find((a) => a.areaId === areaId);
    if (area) return area;
  }
  return null;
}

function syncRealtimeMapFromPacket(data) {
  realtimeMap.clear();
  (data.areas ?? []).forEach((a) => realtimeMap.set(a.areaId, a));
}

function updateAreasTableLive() {
  const table = $("#areas-table");
  if (!table || !overview) return;

  const validIds = getOverviewAreaIds();
  table.querySelectorAll(".area-row").forEach((row) => {
    const id = row.dataset.id;
    if (!validIds.has(id)) {
      row.remove();
      return;
    }
    const area = findAreaInOverview(id);
    if (!area) {
      row.remove();
      return;
    }
    const live = realtimeMap.get(id);
    const kw = live?.kw ?? area.currentKw;
    const kwEl = row.querySelector(".kw-val");
    if (kwEl) kwEl.textContent = kw.toFixed(2) + " kW";
    const btn = row.querySelector(".btn-power");
    if (btn) btn.textContent = area.powered ? "Apagar" : "Encender";
  });
}

function refreshAreasViewFromOverview() {
  const domIds = new Set(
    [...document.querySelectorAll("#areas-table .area-row")].map(
      (r) => r.dataset.id,
    ),
  );
  const overviewIds = getOverviewAreaIds();
  const structureChanged =
    domIds.size !== overviewIds.size ||
    [...overviewIds].some((id) => !domIds.has(id));

  renderAreasContext();
  if (structureChanged || domIds.size === 0) {
    renderAreasTable();
  } else {
    updateAreasTableLive();
  }
}

function applyRealtimeLight(data) {
  syncRealtimeMapFromPacket(data);
  updateLiveKpis(data);
  pushRealtime(data);
  updateChartExplainerLive(data);
  if (overview) refreshAreasViewFromOverview();
  refreshFloorKw();
  refreshMetersTableLive();
  applyRealtimeSession(data);
}

function initSocket() {
  const socket = io();
  socket.on("realtime", (data) => {
    if (connectedSync) connectedSync.onRealtimePacket(data);
    else applyRealtimeLight(data);
  });
  socket.on("measurement-session", () => {
    resetCharts(overview?.site?.name);
    connectedSync?.refreshAllConnectedViews({ reloadOverview: true }).catch(console.error);
  });
  socket.on("expert", (data) => {
    renderExpert(data);
  });
  bindAlertSocket(socket, {
    onNewAlerts: () => loadAlerts().catch(console.error),
  });
  initAutomationUi(socket);
  return socket;
}

function updateLiveKpis(data) {
  const kw = $("#kpi-kw");
  if (kw) kw.textContent = (data.totalKw ?? 0).toFixed(2) + " kW";
  const kwh = $("#kpi-kwh");
  if (kwh) kwh.textContent = (data.totalKwhToday ?? 0).toFixed(1) + " kWh";
  const cost = $("#kpi-cost");
  if (cost) cost.textContent = "$" + (data.costTodayMxn ?? 0).toFixed(2);
  const volt = $("#kpi-voltage");
  if (volt) volt.textContent = (data.voltageAvg ?? 0).toFixed(1) + " V";
  const pf = $("#kpi-pf");
  if (pf) pf.textContent = (data.powerFactorAvg ?? 0).toFixed(3);
}

let floorFilterBound = false;

function populateFloorFilter(floors, { reset = false } = {}) {
  const floorSelect = $("#floor-filter");
  if (!floorSelect) return;
  const previous = reset ? "" : floorSelect.value;
  floorSelect.innerHTML = '<option value="">Todos los pisos</option>';
  (floors || []).forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.id;
    const zoneCount = f.areas?.length ?? 0;
    const suffix =
      zoneCount > 0
        ? " · " + zoneCount + (zoneCount === 1 ? " zona" : " zonas")
        : "";
    opt.textContent = (f.name || f.id) + suffix;
    floorSelect.appendChild(opt);
  });
  if (previous && floors?.some((f) => f.id === previous)) {
    floorSelect.value = previous;
  }
}

async function loadOverview() {
  overview = await fetchJson("/monitoring/overview");
  updateSiteSubtitle(overview);

  populateFloorFilter(overview.floors ?? overview.site?.floors ?? [], {
    reset: false,
  });

  const floorSelect = $("#floor-filter");
  if (
    floorSelect?.value &&
    !overview.floors?.some((f) => f.id === floorSelect.value)
  ) {
    floorSelect.value = "";
  }
  if (!floorFilterBound) {
    floorFilterBound = true;
    floorSelect.addEventListener("change", () => {
      renderFloorCards(filterFloors(overview.floors));
      renderAreasContext();
      renderAreasTable();
    });
  }

  resetCharts(overview.site.name);
  setChartOverviewContext(overview);
  renderKpis(overview.summary, overview.buildingMeta, overview.cfeStatus);
  renderFloorCards(overview.floors);
  syncRealtimeMapWithOverview();
  renderAreasContext();
  renderAreasTable();
  renderMeasurementPanel(overview.measurementSession, overview);
  updateBuildingPhotosFromSite(overview.site);
  connectedSync?.updateSyncNotes?.();
}

function syncRealtimeMapWithOverview() {
  if (!overview?.floors) return;
  const valid = new Set(
    overview.floors.flatMap((f) => f.areas.map((a) => a.areaId)),
  );
  for (const id of [...realtimeMap.keys()]) {
    if (!valid.has(id)) realtimeMap.delete(id);
  }
}

function getFloorsForAreasView() {
  if (!overview?.floors) return [];
  const floorId = $("#floor-filter")?.value;
  return floorId
    ? overview.floors.filter((f) => f.id === floorId)
    : overview.floors;
}

function renderAreasContext() {
  const ctx = $("#areas-context");
  if (!ctx || !overview?.site) {
    if (ctx) ctx.textContent = "";
    return;
  }
  const floors = getFloorsForAreasView();
  const areaCount = floors.reduce((s, f) => s + f.areas.length, 0);
  ctx.innerHTML =
    areaCount === 0
      ? "Sin zonas: guarda pisos y habitaciones en Panel central."
      : "<strong>" +
        overview.site.name +
        "</strong> · " +
        floors.length +
        " piso(s) · " +
        areaCount +
        " zona(s). Filtro <strong>Piso</strong> arriba.";
}

function refreshDashboardPanels() {
  if (!overview) return;
  renderKpis(overview.summary, overview.buildingMeta, overview.cfeStatus);
  renderFloorCards(filterFloors(overview.floors));
  setChartOverviewContext(overview);
  refreshAreasViewFromOverview();
  renderMeasurementPanel(overview.measurementSession, overview);
}

/** Sincroniza todas las pestañas con el edificio guardado en Panel central */
async function refreshAllViewsFromBuilding() {
  realtimeMap.clear();
  metersCache = [];
  const metersSearch = $("#meters-search");
  if (metersSearch) metersSearch.value = "";

  await refreshBuildingsSelect();
  resetCharts();
  await connectedSync?.refreshAllConnectedViews({ reloadOverview: true });
  populateFloorFilter(overview?.floors ?? overview?.site?.floors ?? [], {
    reset: true,
  });
  const floorSelect = $("#floor-filter");
  if (floorSelect) floorSelect.value = "";
}

async function onBuildingChanged() {
  notifyActiveBuildingSwitched();
  realtimeMap.clear();
  await refreshAllViewsFromBuilding();
  refreshAreasViewFromOverview();
}

function filterFloors(floors) {
  const id = $("#floor-filter").value;
  return id ? floors.filter((f) => f.id === id) : floors;
}

function cfeKpiClass(tier) {
  if (tier === "dac" || tier === "pre_dac") return "kpi kpi--cfe-warn";
  if (tier === "subsidio" || tier === "intermedio") return "kpi kpi--cfe-ok";
  return "kpi";
}

function renderKpis(s, meta, cfe) {
  const grid = $("#kpi-grid");
  grid.innerHTML = "";
  const modeLabel =
    meta?.measurementMode === "sqm"
      ? meta.totalSqm + " m²"
      : meta?.areaCount + " áreas";
  const items = [
    ["Demanda total", s.totalKw + " kW", "Tiempo real", "kpi-kw", "kpi"],
    [
      "Consumo sesión",
      s.totalKwhToday + " kWh",
      s.measurementAccumulating
        ? "Acumulando desde tu último reinicio"
        : "Pausado — kW sigue en vivo",
      "kpi-kwh",
      "kpi",
    ],
    [
      "Costo sesión hoy",
      "$" + s.estimatedCostTodayMxn,
      "kWh del día × tarifa configurada",
      "kpi-cost",
      "kpi",
    ],
  ];

  if (cfe) {
    const tierShort =
      cfe.tier === "dac"
        ? "DAC (alto consumo)"
        : cfe.tier === "pre_dac"
          ? "Cerca de DAC"
          : cfe.tier === "subsidio"
            ? "Con subsidio"
            : cfe.tierLabel;
    items.push(
      [
        "Escalón CFE",
        tierShort,
        cfe.zoneId +
          " · " +
          cfe.seasonLabel +
          " · " +
          cfe.percentToDac +
          "% del límite",
        "kpi-cfe-tier",
        cfeKpiClass(cfe.tier),
      ],
      [
        "Factura CFE estimada (mes)",
        "$" + cfe.costProjectedMxn.toLocaleString("es-MX"),
        "$" + cfe.effectiveRateMxn + "/kWh efectivo · DAC $" + cfe.dacRateMxn,
        "kpi-cfe-bill",
        cfeKpiClass(cfe.tier),
      ],
    );
  }

  items.push(
    ["Voltaje prom.", "—", "Red eléctrica", "kpi-voltage", "kpi"],
    ["Factor potencia", "—", "Eficiencia", "kpi-pf", "kpi"],
    ["Áreas activas", s.activeAreas + "/" + s.totalAreas, modeLabel || "Circuitos", null, "kpi"],
    ["Proyección semanal", s.weeklyKwh + " kWh", "$" + s.weeklyCostMxn + " MXN", null, "kpi"],
    ["Proyección mensual", s.monthlyKwh + " kWh", "$" + s.monthlyCostMxn + " MXN", null, "kpi"],
  );
  items.forEach(([label, value, sub, id, className]) => {
    const art = document.createElement("article");
    art.className = className || "kpi";
    art.innerHTML =
      "<label>" +
      label +
      "</label><div class=\"value\"" +
      (id ? ' id="' + id + '"' : "") +
      ">" +
      value +
      '</div><p class="sub">' +
      sub +
      "</p>";
    grid.appendChild(art);
  });
}

function renderFloorCards(floors) {
  const container = $("#floor-cards");
  container.innerHTML = "";
  floors.forEach((f) => {
    const art = document.createElement("article");
    art.className = "floor-card";
    art.dataset.floor = f.id;
    let pills = "";
    f.areas.slice(0, 8).forEach((a) => {
      const cls =
        (a.status === "high" ? " high" : "") + (!a.powered ? " off" : "");
      const short = a.name.split(" ").pop();
      pills +=
        '<span class="pill' +
        cls +
        '">' +
        short +
        " " +
        a.currentKw +
        "kW</span>";
    });
    if (f.areas.length > 8) {
      pills += '<span class="pill">+' + (f.areas.length - 8) + " más</span>";
    }
    art.innerHTML =
      "<h3>" +
      f.name +
      '</h3><div class="kw" data-floor-kw>' +
      f.totalKw +
      ' kW</div><div class="area-pills">' +
      pills +
      "</div>";
    container.appendChild(art);
  });
}

function refreshFloorKw() {
  if (!overview) return;
  overview.floors.forEach((floor) => {
    let sum = 0;
    floor.areas.forEach((area) => {
      const live = realtimeMap.get(area.areaId);
      if (live) sum += live.kw;
      else if (area.powered) sum += area.currentKw;
    });
    const card = document.querySelector(
      '[data-floor="' + floor.id + '"] [data-floor-kw]',
    );
    if (card) card.textContent = sum.toFixed(2) + " kW";
  });
}

function appendAreaRow(container, a) {
  const live = realtimeMap.get(a.areaId);
  const kw = live ? live.kw : a.currentKw;
  const powered = a.powered;
  const typeLabel = AREA_TYPE_LABELS[a.type] || a.type || "Zona";
  const row = document.createElement("div");
  row.className = "area-row";
  row.dataset.id = a.areaId;
    row.innerHTML =
      '<div class="meta"><strong>' +
      a.name +
      "</strong><small>" +
      a.floorName +
      " · " +
      typeLabel +
      '</small></div><span class="kw-val">' +
    kw.toFixed(2) +
    ' kW</span><button type="button" class="btn btn-sm btn-ghost btn-power">' +
    (powered ? "Apagar" : "Encender") +
    '</button><input type="number" class="select limit-input" placeholder="Límite kW" step="0.1" min="0.1" max="50" />';
  const btn = row.querySelector(".btn-power");
  btn.addEventListener("click", async () => {
    await postJson("/control/" + a.areaId + "/power", { powered: !powered });
    await connectedSync?.refreshAllConnectedViews({ reloadOverview: true });
  });
  const input = row.querySelector(".limit-input");
  if (a.limitKw != null) input.value = a.limitKw;
  input.addEventListener("change", async () => {
    const val = input.value === "" ? null : Number(input.value);
    await postJson("/control/" + a.areaId + "/limit", { limitKw: val });
    await connectedSync?.refreshAllConnectedViews({ reloadOverview: true });
  });
  container.appendChild(row);
}

function renderAreasTable() {
  const container = $("#areas-table");
  if (!container) return;
  container.innerHTML = "";

  if (!overview?.floors?.length) {
    container.innerHTML =
      '<p class="hint">Configura y guarda un edificio en Panel central para ver las zonas aquí.</p>';
    return;
  }

  const floors = getFloorsForAreasView();
  const totalAreas = floors.reduce((s, f) => s + f.areas.length, 0);

  if (totalAreas === 0) {
    container.innerHTML =
      '<p class="hint">Este edificio no tiene zonas aún. En Panel central agrega pisos, habitaciones y pulsa <strong>Guardar edificio</strong>.</p>';
    return;
  }

  floors.forEach((floor) => {
    if (!floor.areas.length) return;
    const heading = document.createElement("div");
    heading.className = "areas-floor-heading";
    heading.innerHTML =
      "<h4>" +
      floor.name +
      "</h4><span>" +
      floor.areas.length +
      (floor.areas.length === 1 ? " zona" : " zonas") +
      "</span>";
    container.appendChild(heading);
    floor.areas.forEach((area) => appendAreaRow(container, area));
  });

  renderAreasContext();
}

async function loadExpert() {
  await loadExpertView(fetchJson);
}

const ALERT_TYPE_LABELS = {
  consumption: "Consumo",
  electrical_fault: "Red eléctrica",
  control: "Control SIREN",
  expert: "Sistema experto",
  measurement: "Medición",
  cfe_dac: "Tarifa DAC",
  cfe_subsidy: "Subsidio CFE",
};

const ALERT_SEVERITY_LABELS = {
  critical: "Urgente",
  warning: "Atención",
  info: "Información",
};

function handleAlertAction(action) {
  if (!action || action.kind !== "navigate" || !action.view) return;
  const nav = document.querySelector('.nav-btn[data-view="' + action.view + '"]');
  if (nav) nav.click();
  if (action.areaId) {
    setTimeout(() => {
      const row = document.querySelector('.area-row[data-id="' + action.areaId + '"]');
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.classList.add("area-row-highlight");
      setTimeout(() => row?.classList.remove("area-row-highlight"), 2500);
    }, 200);
  }
}

function renderCfeBanner(cfe) {
  const banner = $("#alerts-cfe-banner");
  if (!banner) return;
  if (!cfe) {
    banner.classList.add("hidden");
    return;
  }
  banner.classList.remove("hidden");
  const tierClass =
    cfe.tier === "dac"
      ? "cfe-banner--dac"
      : cfe.tier === "pre_dac"
        ? "cfe-banner--warn"
        : "cfe-banner--ok";
  banner.className = "cfe-tariff-banner " + tierClass;
  banner.innerHTML =
    '<div class="cfe-banner-head">' +
    "<h3>Tarifa CFE · " +
    cfe.zoneLabel +
    "</h3>" +
    '<span class="cfe-tier-pill">' +
    cfe.tierLabel +
    "</span></div>" +
    '<p class="cfe-banner-meta">' +
    cfe.seasonLabel +
    "</p>" +
    '<p class="cfe-banner-hero">' +
    '<span class="cfe-hero-num">' +
    cfe.monthlyProjectedKwh +
    " kWh/mes</span>" +
    '<span class="cfe-hero-meta"> proyectados (' +
    cfe.percentToDac +
    "% del límite DAC " +
    cfe.dacThresholdKwh +
    " kWh)</span></p>" +
    '<dl class="cfe-rates">' +
    "<div><dt>Tarifa efectiva</dt><dd>$" +
    cfe.effectiveRateMxn +
    "/kWh</dd></div>" +
    "<div><dt>Tarifa DAC</dt><dd>$" +
    cfe.dacRateMxn +
    "/kWh</dd></div>" +
    "<div><dt>Subsidio referencia</dt><dd>$" +
    cfe.subsidyRateMxn +
    "/kWh</dd></div>" +
    "</dl>";
}

async function loadAlerts() {
  let cfe = null;
  try {
    const kwh = overview?.summary?.totalKwhToday;
    const q =
      kwh != null ? "?kwhToday=" + encodeURIComponent(kwh) : "";
    cfe = await fetchJson("/billing/cfe" + q);
  } catch {
    cfe = null;
  }
  renderCfeBanner(cfe);

  const list = await fetchJson("/alerts");
  const ul = $("#alerts-list");
  ul.innerHTML = "";

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const sorted = [...list].sort((a, b) => {
    const sa = severityOrder[a.severity] ?? 3;
    const sb = severityOrder[b.severity] ?? 3;
    if (sa !== sb) return sa - sb;
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const unread = sorted.filter((a) => !a.acknowledged).length;
  updateAlertBadge(unread);

  const summaryEl = $("#alerts-summary");
  if (summaryEl) {
    summaryEl.textContent =
      unread === 0
        ? sorted.length
          ? sorted.length + " alertas, todas leídas"
          : "Sin alertas pendientes"
        : unread +
          (unread === 1 ? " alerta sin leer" : " alertas sin leer") +
          (sorted.length > unread
            ? " · " + sorted.length + " en total"
            : "");
  }

  if (!sorted.length) {
    ul.innerHTML =
      '<li class="alert-item info alert-item--empty">No hay alertas activas. SIREN avisará por consumo, red eléctrica, medición y tarifa CFE.</li>';
    updateAlertBadge(0);
    return;
  }

  sorted.forEach((a) => {
    const li = document.createElement("li");
    const typeLabel = ALERT_TYPE_LABELS[a.type] || a.type;
    const sev = a.severity || "info";
    const sevLabel = ALERT_SEVERITY_LABELS[sev] || sev;
    li.className =
      "alert-item " +
      sev +
      " alert-type-" +
      (a.type || "general") +
      (a.acknowledged ? " ack" : "");
    li.innerHTML =
      '<div class="alert-card-top">' +
      '<span class="alert-severity alert-severity--' +
      sev +
      '">' +
      sevLabel +
      "</span>" +
      '<span class="alert-type-tag">' +
      typeLabel +
      "</span>" +
      '<time class="alert-time">' +
      new Date(a.createdAt).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      }) +
      "</time></div>" +
      (a.title ? '<h3 class="alert-title">' + a.title + "</h3>" : "") +
      '<p class="alert-message">' +
      (a.message || "") +
      "</p>" +
      (a.detail ? '<p class="alert-detail">' + a.detail + "</p>" : "");

    const actions = document.createElement("div");
    actions.className = "alert-actions";

    if (a.action?.label && !a.acknowledged) {
      const goBtn = document.createElement("button");
      goBtn.className = "btn btn-sm btn-secondary";
      goBtn.textContent = a.action.label;
      goBtn.addEventListener("click", () => handleAlertAction(a.action));
      actions.appendChild(goBtn);
    }

    if (!a.acknowledged) {
      const ackBtn = document.createElement("button");
      ackBtn.className = "btn btn-sm btn-ghost";
      ackBtn.textContent = "Marcar leída";
      ackBtn.addEventListener("click", async () => {
        await postJson("/alerts/" + a.id + "/ack", {});
        await connectedSync?.refreshAllConnectedViews({ reloadOverview: true });
      });
      actions.appendChild(ackBtn);
    }

    if (actions.childElementCount) li.appendChild(actions);
    ul.appendChild(li);
  });
}

async function loadReportPreview() {
  const period = $("#report-period").value;
  const data = await fetchJson("/reports?period=" + period);
  const wrap = $("#report-preview");
  const t = data.table;

  let tableRows = "";
  t.rows.forEach((row) => {
    const costo = row.costoFormatted || "$" + row.costMxn;
    tableRows +=
      "<tr><td>" +
      row.fecha +
      "</td><td>" +
      row.hora +
      "</td><td>" +
      row.periodo +
      '</td><td class="num">' +
      row.kwh +
      '</td><td class="num cost">' +
      costo +
      "</td></tr>";
  });

  const totalCosto = t.totals.costoFormatted || "$" + t.totals.costMxn;
  const b = data.billing;
  let summaryHtml = "";
  data.periodSummary.items.forEach((item) => {
    summaryHtml +=
      "<li><strong>" + item.label + ":</strong> " + item.value + "</li>";
  });

  let cfeHtml = "";
  if (data.cfeSummary?.items?.length) {
    cfeHtml =
      '<section class="report-period-summary report-cfe-summary"><h3>' +
      data.cfeSummary.title +
      "</h3><ul>";
    data.cfeSummary.items.forEach((item) => {
      cfeHtml +=
        "<li><strong>" + item.label + ":</strong> " + item.value + "</li>";
    });
    cfeHtml += "</ul></section>";
  }

  wrap.innerHTML =
    '<header class="report-doc-header report-doc-header--banner">' +
    '<img src="/img/logo-banner.png" alt="SIREN" class="report-doc-banner" onerror="this.src=\'/img/logo.png\';this.className=\'report-doc-logo\'" />' +
    '<div class="report-doc-meta">' +
    "<p><strong>Sitio:</strong> " +
    data.site +
    "</p>" +
    "<p><strong>Periodo:</strong> " +
    data.periodLabel +
    "</p>" +
    "<p><strong>Áreas:</strong> " +
    b.areaCount +
    " · <strong>Promedio:</strong> " +
    b.kwhPerArea +
    " kWh/área/día · <strong>Tarifa:</strong> $" +
    b.tariff +
    "/kWh</p></div>" +
    '<div class="report-table-card"><table class="report-table"><thead><tr>' +
    t.headers.map((h) => "<th>" + h + "</th>").join("") +
    "</tr></thead><tbody>" +
    tableRows +
    '</tbody><tfoot><tr class="report-total-row">' +
    '<td colspan="3">' +
    t.totals.label +
    "</td>" +
    '<td class="num">' +
    t.totals.kwh +
    "</td>" +
    '<td class="num cost">' +
    totalCosto +
    "</td></tr></tfoot></table></div>" +
    '<section class="report-period-summary"><h3>' +
    data.periodSummary.title +
    "</h3><ul>" +
    summaryHtml +
    "</ul></section>" +
    cfeHtml;

  const ts = Date.now();
  $("#export-excel").href =
    "/api/reports/export/excel?period=" + period + "&v=" + ts;
  $("#export-pdf").href =
    "/api/reports/export/pdf?period=" + period + "&v=" + ts;
}

const BUILDING_TYPE_LABELS = {
  hotel: "Hotel",
  hospital: "Hospital",
  university: "Universidad / campus",
  corporate: "Oficinas corporativas",
  mixed: "Uso mixto",
};

function updateSiteSubtitle(overview) {
  const el = $("#site-name");
  if (!el || !overview?.site) return;
  const typeLabel =
    BUILDING_TYPE_LABELS[overview.site.type] || overview.site.type;
  const n = overview.summary?.totalAreas ?? 0;
  el.innerHTML =
    typeLabel +
    " · " +
    n +
    ' zonas con medidor · <span class="site-hint">Cambia el nombre en «Gestión de edificios» o pulsa Editar</span>';
}

let metersCache = [];
let metersSummaryCache = null;
let metersSearchBound = false;

function filterMetersList(list, query) {
  if (!query) return list;
  const q = query.toLowerCase();
  return list.filter(
    (m) =>
      m.areaName.toLowerCase().includes(q) ||
      m.floorName.toLowerCase().includes(q) ||
      m.meterId.toLowerCase().includes(q),
  );
}

function applyLiveReadingsToMeters(meters) {
  return meters.map((m) => {
    const live = realtimeMap.get(m.areaId);
    if (!live) return m;
    const online = live.powered !== undefined ? live.powered : m.online;
    return {
      ...m,
      online,
      statusLabel: online ? "En línea" : "Apagado / sin lectura",
      lastReading: {
        ...m.lastReading,
        kw: live.kw ?? m.lastReading.kw,
        voltage: live.voltage ?? m.lastReading.voltage,
        powerFactor: live.powerFactor ?? m.lastReading.powerFactor,
      },
    };
  });
}

function renderMetersContext(summary) {
  const ctx = $("#meters-context");
  const name = summary?.buildingName || overview?.site?.name || "—";
  const total = summary?.total ?? 0;
  const online = summary?.online ?? 0;
  if (!ctx) return;
  ctx.innerHTML =
    total === 0
      ? "Guarda el edificio en Panel central para generar medidores."
      : "<strong>" +
        name +
        "</strong> · " +
        total +
        " medidor(es) · " +
        online +
        " en línea.";
}

function renderMetersSummary(summary) {
  metersSummaryCache = summary;
  const sumEl = $("#meters-summary");
  if (!sumEl || !summary) return;
  sumEl.innerHTML =
    '<article class="expert-stat"><label>Edificio</label><div class="value">' +
    summary.buildingName +
    '</div><p class="sub">Medidores de este edificio</p></article>' +
    '<article class="expert-stat"><label>Total medidores</label><div class="value">' +
    summary.total +
    '</div><p class="sub">Uno por cada zona configurada</p></article>' +
    '<article class="expert-stat"><label>En línea</label><div class="value">' +
    summary.online +
    '</div><p class="sub">Zonas encendidas con lectura</p></article>' +
    '<article class="expert-stat"><label>Sin lectura</label><div class="value">' +
    summary.offline +
    "</div><p class=\"sub\">Zonas apagadas o sin energía</p></article>";
}

function renderMetersProviders(providers) {
  const provEl = $("#providers-list");
  if (!provEl) return;
  provEl.innerHTML = "";
  providers.forEach((p) => {
    const card = document.createElement("article");
    card.className = "provider-card " + p.status;
    card.innerHTML =
      "<h4>" +
      p.name +
      ' <span class="provider-status">' +
      (p.statusLabel || p.status) +
      "</span></h4>" +
      "<p>" +
      (p.description || "") +
      "</p>" +
      "<small>Protocolo: " +
      p.protocol +
      (p.metersCount ? " · " + p.metersCount + " zona(s)" : "") +
      "</small>";
    provEl.appendChild(card);
  });
}

function groupMetersByFloor(meters) {
  const groups = new Map();
  meters.forEach((m) => {
    const key = m.floorName || "Sin piso";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });

  if (overview?.site?.floors?.length) {
    const ordered = [];
    overview.site.floors.forEach((f) => {
      const list = groups.get(f.name);
      if (list?.length) {
        ordered.push({ floorName: f.name, meters: list });
        groups.delete(f.name);
      }
    });
    groups.forEach((list, floorName) => {
      ordered.push({ floorName, meters: list });
    });
    return ordered;
  }

  return [...groups.entries()].map(([floorName, list]) => ({
    floorName,
    meters: list,
  }));
}

function refreshMetersTableLive() {
  if (!metersCache.length) return;
  const q = $("#meters-search")?.value.trim() ?? "";
  const list = applyLiveReadingsToMeters(filterMetersList(metersCache, q));
  renderMetersTable(list);
}

async function refreshMetersData() {
  const [summary, providers, meters] = await Promise.all([
    fetchJson("/meters/summary"),
    fetchJson("/meters/providers"),
    fetchJson("/meters"),
  ]);
  metersCache = meters;

  renderMetersSummary(summary);
  renderMetersContext(summary);
  renderMetersProviders(providers);
  const q = $("#meters-search")?.value.trim() ?? "";
  renderMetersTable(applyLiveReadingsToMeters(filterMetersList(meters, q)));

  const search = $("#meters-search");
  if (search && !metersSearchBound) {
    metersSearchBound = true;
    search.addEventListener("input", () => {
      refreshMetersTableLive();
    });
  }
}

async function loadMetersView() {
  await refreshMetersData();
}

function renderMetersTable(meters) {
  const wrap = $("#meters-table-wrap");
  if (!wrap) return;

  if (!overview?.site) {
    wrap.innerHTML =
      '<p class="hint">Configura y guarda un edificio en Panel central.</p>';
    return;
  }

  if (!meters.length) {
    wrap.innerHTML =
      '<p class="hint">No hay medidores. Agrega pisos y zonas en Panel central → Gestión de edificios → <strong>Guardar edificio</strong>.</p>';
    return;
  }

  const groups = groupMetersByFloor(meters);
  let html =
    '<table class="meters-table"><thead><tr>' +
    "<th>ID medidor</th><th>Zona</th><th>Piso</th><th>Estado</th>" +
    "<th>Consumo</th><th>Voltaje</th><th>FP</th><th>Conexión</th>" +
    "</tr></thead><tbody>";

  groups.forEach((g) => {
    html +=
      '<tr class="meters-floor-row"><td colspan="8"><strong>' +
      g.floorName +
      "</strong> · " +
      g.meters.length +
      (g.meters.length === 1 ? " medidor" : " medidores") +
      "</td></tr>";
    g.meters.forEach((m) => {
      const statusCls = m.online ? "meter-online" : "meter-offline";
      html +=
        '<tr data-area-id="' +
        m.areaId +
        '">' +
        "<td><code>" +
        m.meterId +
        "</code></td>" +
        "<td><strong>" +
        m.areaName +
        "</strong><br><small>" +
        m.areaTypeLabel +
        "</small></td>" +
        "<td>" +
        m.floorName +
        "</td>" +
        '<td><span class="meter-status ' +
        statusCls +
        '">' +
        m.statusLabel +
        "</span></td>" +
        '<td class="num meter-kw">' +
        m.lastReading.kw.toFixed(2) +
        " kW</td>" +
        '<td class="num">' +
        m.lastReading.voltage.toFixed(1) +
        " V</td>" +
        '<td class="num">' +
        m.lastReading.powerFactor.toFixed(2) +
        "</td>" +
        "<td>" +
        m.provider +
        "</td>" +
        "</tr>";
    });
  });

  html += "</tbody></table>";
  wrap.innerHTML = html;
}

function goEditBuildingName() {
  const nav = document.querySelector('.nav-btn[data-view="dashboard"]');
  if (nav) nav.click();
  setTimeout(() => {
    $("#building-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = $("#bf-name");
    if (input) {
      input.focus();
      input.select();
    }
  }, 150);
}

function boot() {
  $("#btn-refresh")?.addEventListener("click", () => {
    refreshAllViewsFromBuilding().catch(console.error);
  });
  $("#btn-edit-building-name")?.addEventListener("click", goEditBuildingName);
  $("#report-period")?.addEventListener("change", () => {
    connectedSync?.refreshAllConnectedViews({ reloadOverview: false }).catch(console.error);
  });

  connectedSync = createConnectedViewsSync({
    getBuildingName: () => overview?.site?.name,
    loadOverview,
    refreshDashboardPanels,
    renderAreasContext,
    renderAreasTable,
    renderMeasurementPanel: () =>
      renderMeasurementPanel(overview?.measurementSession, overview),
    loadExpert,
    loadAlerts,
    loadReports: loadReportPreview,
    refreshMeters: refreshMetersData,
    loadAutomation: loadAutomationPanel,
    applyRealtimeLight,
  });

  initNav();
  bindUiPersistence();
  applyUiPrefs();
  initCharts();
  initAlertSound();
  initSidebar();
  initMeasurementUi({
    apiJson,
    onChanged: async () => {
      realtimeMap.clear();
      await connectedSync?.refreshAllConnectedViews({ reloadOverview: true });
    },
  });
  initBuildingsUi({ onBuildingChanged });
  initSocket();
  initExpertUi(fetchJson);
  connectedSync
    .refreshAllConnectedViews({ reloadOverview: true })
    .then(() => {
      const ui = loadUiPrefs();
      const floor = $("#floor-filter");
      if (floor && ui.floorFilter != null) {
        floor.value = ui.floorFilter;
        renderFloorCards(filterFloors(overview.floors));
        renderAreasContext();
        renderAreasTable();
      }
    })
    .catch(console.error);
}

boot();
