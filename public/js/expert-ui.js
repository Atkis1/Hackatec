import {
  formatHourStepLabel,
  getLightChartOptions,
  computeYScaleBounds,
} from "./charts.js";

const FORECAST_FALLBACK_STEPS = 6;

let expertChart = null;
let expertRotationTimer = null;
let fetchExpertJson = null;

const ROTATION_MS = 30000;

const $ = (s) => document.querySelector(s);

export function renderExpert(data) {
  if (!data) return;
  renderExpertSummary(data);
  updateForecastCaption(data);
  renderExpertForecastChart(data);
  renderExpertDynamicPanels(data);
}

export async function loadExpertView(fetchJson) {
  fetchExpertJson = fetchJson;
  const cycle = Math.floor(Date.now() / ROTATION_MS);
  const data = await fetchJson("/expert/analysis?cycle=" + cycle);
  renderExpert(data);
}

export function initExpertUi(fetchJson) {
  fetchExpertJson = fetchJson;
  stopExpertUi();
  expertRotationTimer = setInterval(() => {
    if (!$("#view-expert")?.classList.contains("active")) return;
    refreshExpertRotation().catch(console.error);
  }, ROTATION_MS);
}

export function stopExpertUi() {
  if (expertRotationTimer) {
    clearInterval(expertRotationTimer);
    expertRotationTimer = null;
  }
}

async function refreshExpertRotation() {
  if (!fetchExpertJson) return;
  const cycle = Math.floor(Date.now() / ROTATION_MS);
  const data = await fetchExpertJson("/expert/analysis?cycle=" + cycle);
  renderExpert(data);
}

function renderExpertSummary(data) {
  const el = $("#expert-summary");
  if (!el) return;
  const b = data.building;
  const dq = data.dataQuality || {};
  const trendLabel =
    data.forecast?.trend === "rising"
      ? "↑ Alza"
      : data.forecast?.trend === "falling"
        ? "↓ Baja"
        : data.forecast?.trend === "stable"
          ? "→ Estable"
          : "—";
  const rot = data.rotation;
  const rotHint = rot
    ? '<p class="expert-rot-hint">Predicciones y recomendaciones rotan cada ' +
      (rot.intervalSec || 30) +
      " s · ciclo " +
      rot.cycle +
      "</p>"
    : "";

  el.innerHTML =
    "<h2>Estado del motor experto</h2>" +
    rotHint +
    '<div class="expert-summary-grid">' +
    '<div class="expert-stat"><label>Edificio</label><div class="value">' +
    (b?.name || "—") +
    '</div><p class="sub">' +
    (b?.type || "") +
    "</p></div>" +
    '<div class="expert-stat"><label>Demanda actual</label><div class="value">' +
    (data.currentTotalKw ?? "—") +
    ' kW</div><p class="sub">Base esperada: ' +
    (data.baselineTotalKw ?? "—") +
    " kW</p></div>" +
    '<div class="expert-stat"><label>Carga vs modelo</label><div class="value">' +
    Math.round((data.loadRatio || 1) * 100) +
    '%</div><p class="sub">' +
    trendLabel +
    "</p></div>" +
    '<div class="expert-stat"><label>Calidad de datos</label><div class="value">' +
    (dq.logSamples ?? 0) +
    ' muestras</div><p class="sub"><span class="expert-badge ' +
    (dq.confidence || "inicial") +
    '">' +
    (dq.confidence || "inicial") +
    "</span></p></div>" +
    "</div>";
}

function buildForecastSeries(data) {
  const current = data.currentTotalKw ?? 0;
  const baseline = data.baselineTotalKw ?? (current || 5);
  const chart = data.demandChart;

  if (chart?.points?.length) {
    return {
      labels: ["0", ...chart.points.map((p) => p.hourLabel)],
      values: [current, ...chart.points.map((p) => p.kw)],
      baselineSeries: [
        baseline,
        ...(chart.baselinePoints ?? chart.points.map(() => baseline)),
      ],
    };
  }

  const labels = [
    "0",
    ...Array.from({ length: FORECAST_FALLBACK_STEPS }, (_, i) =>
      formatHourStepLabel(i + 1),
    ),
  ];
  const values = [
    current,
    ...Array.from({ length: FORECAST_FALLBACK_STEPS }, (_, i) => {
      const t = (i + 1) / FORECAST_FALLBACK_STEPS;
      const scale = 0.88 + t * 0.22;
      return Math.round(current * scale * 100) / 100;
    }),
  ];
  return {
    labels,
    values,
    baselineSeries: labels.map((_, i) =>
      i === 0 ? baseline : Math.round(baseline * (0.9 + (i / labels.length) * 0.15) * 100) / 100,
    ),
  };
}

function updateForecastCaption(data) {
  const el = document.getElementById("expert-forecast-caption");
  if (!el) return;
  el.textContent =
    data.demandChart?.caption ||
    "Conectado al edificio activo y a la medición en vivo del Panel central.";
}

function renderExpertForecastChart(data) {
  const canvas = document.getElementById("chart-expert-forecast");
  if (!canvas || typeof Chart === "undefined") return;

  const { labels, values, baselineSeries } = buildForecastSeries(data);
  const yBounds = computeYScaleBounds(values, baselineSeries);

  const datasets = [
    {
      label: "kW previstos",
      data: values,
      borderColor: "#FF8C00",
      backgroundColor: "rgba(255, 140, 0, 0.5)",
      pointBorderColor: "#E67E00",
      pointBackgroundColor: "#ffffff",
      borderWidth: 3.5,
      pointRadius: 5,
      pointHoverRadius: 8,
      fill: true,
      tension: 0.35,
    },
    {
      label: "Línea base",
      data: baselineSeries,
      borderColor: "#00B894",
      backgroundColor: "rgba(0, 184, 148, 0.2)",
      borderWidth: 3,
      borderDash: [10, 6],
      pointRadius: 4,
      pointBackgroundColor: "#00c9a0",
      pointBorderColor: "#007a60",
      fill: false,
    },
  ];

  const chartOptions = getLightChartOptions({
    scales: {
      y: {
        beginAtZero: false,
        min: yBounds.min,
        max: yBounds.max,
        title: {
          display: true,
          text: "kW",
          color: "#1a2d4a",
          font: { weight: "700" },
        },
        ticks: {
          color: "#1a2d4a",
          font: { size: 12, weight: "600" },
          callback: (v) => (Number(v) % 1 === 0 ? v : Number(v).toFixed(1)),
        },
        grid: { color: "rgba(26, 45, 74, 0.22)", lineWidth: 1 },
      },
      x: {
        ticks: {
          color: "#1a2d4a",
          maxTicksLimit: 10,
          font: { size: 12, weight: "600" },
        },
        grid: { color: "rgba(26, 45, 74, 0.16)", lineWidth: 1 },
      },
    },
  });

  if (!expertChart) {
    expertChart = new Chart(canvas, {
      type: "line",
      data: { labels, datasets },
      options: chartOptions,
    });
    return;
  }

  expertChart.data.labels = labels;
  expertChart.data.datasets[0].data = values;
  expertChart.data.datasets[1].data = baselineSeries;
  expertChart.options = chartOptions;
  expertChart.update("active");
}

function formatPrediction(p) {
  const pct = Math.round((p.probability ?? 0) * 100);
  return (
    '<li class="expert-pred-item">' +
    '<span class="pred-method">' +
    (p.method || "análisis") +
    "</span><br>" +
    "<strong>" +
    p.title +
    "</strong>" +
    '<div class="pred-bar-wrap"><div class="pred-bar" style="width:' +
    pct +
    '%"></div></div>' +
    "<small>Confianza " +
    pct +
    "% · Ventana " +
    (p.window || "—") +
    " · " +
    (p.expectedKw ?? "—") +
    " kW</small><br>" +
    (p.reason || "") +
    "</li>"
  );
}

function formatRecommendation(r) {
  return (
    '<li class="expert-rec-item">' +
    '<span class="tag ' +
    (r.priority || "medium") +
    '">' +
    (r.priority || "medium") +
    "</span> " +
    (r.action || "") +
    (r.savingsEstimateMxnPerDay != null
      ? "<br><small>Ahorro est.: $" +
        r.savingsEstimateMxnPerDay +
        " MXN/día</small>"
      : "") +
    "</li>"
  );
}

function formatOdsGoal(goal) {
  const img = goal.imageUrl || "";
  return (
    '<details class="ods-goal">' +
    '<summary class="ods-goal-summary">' +
    (img
      ? '<img class="ods-thumb" src="' +
        img +
        '" alt="ODS ' +
        goal.id +
        '" width="48" height="48" loading="lazy" referrerpolicy="no-referrer" />'
      : "") +
    "<span>" +
    (goal.title || "ODS") +
    "</span></summary>" +
    '<div class="ods-goal-body">' +
    (img
      ? '<img class="ods-hero" src="' +
        img +
        '" alt="' +
        (goal.title || "") +
        '" loading="lazy" referrerpolicy="no-referrer" />'
      : "") +
    "<p>" +
    (goal.summary || "") +
    "</p>" +
    '<p class="ods-why"><strong>En SIREN:</strong> ' +
    (goal.whyInSiren || "") +
    "</p></div>" +
    "</details>"
  );
}

function renderExpertDynamicPanels(data) {
  const el = $("#expert-content");
  if (!el) return;

  const predCount = data.predictionPoolSize ?? data.predictions?.length ?? 0;
  const recCount =
    data.recommendationPoolSize ?? data.recommendations?.length ?? 0;

  const predictionsHtml =
    data.predictions?.length > 0
      ? data.predictions.map(formatPrediction).join("")
      : '<li class="expert-empty">Recopilando muestras… En unos segundos aparecerán predicciones según el consumo en vivo.</li>';

  const insightsHtml =
    data.insights?.length > 0
      ? data.insights
          .map(
            (i) =>
              "<li>" +
              (i.severity
                ? '<span class="tag ' + i.severity + '">' + i.type + "</span> "
                : i.type
                  ? '<span class="tag">' + i.type + "</span> "
                  : "") +
              (i.message || "") +
              "</li>",
          )
          .join("")
      : "<li>Sin anomalías: el consumo coincide con el modelo para esta hora.</li>";

  const recsHtml =
    data.recommendations?.length > 0
      ? data.recommendations.map(formatRecommendation).join("")
      : "<li>No hay acciones urgentes en este momento.</li>";

  const odsGoals = Array.isArray(data.odsAlignment) ? data.odsAlignment : [];
  const odsHtml =
    odsGoals.length > 0
      ? odsGoals
          .map((g) =>
            typeof g === "string" ? "<p>" + g + "</p>" : formatOdsGoal(g),
          )
          .join("")
      : "<p>Objetivos de desarrollo sostenible vinculados al monitoreo energético.</p>";

  const blocks = [
    {
      title: "Predicciones",
      meta: predCount + " en rotación · actualiza cada 30 s",
      html: predictionsHtml,
      panelClass: "expert-panel-predictions",
      wrap: "ul",
      listClass: "card-list",
    },
    {
      title: "Insights detectados",
      meta: (data.insights?.length || 0) + " activos",
      html: insightsHtml,
      panelClass: "expert-panel-insights",
      wrap: "ul",
      listClass: "card-list",
    },
    {
      title: "Recomendaciones de ahorro",
      meta: recCount + " en rotación · actualiza cada 30 s",
      html: recsHtml,
      panelClass: "expert-panel-recs",
      wrap: "ul",
      listClass: "card-list",
    },
    {
      title: "Alineación ODS 2030",
      meta: "Despliega cada objetivo para ver imagen y aplicación en SIREN",
      html: odsHtml,
      panelClass: "expert-panel-ods ods-panel",
      wrap: "div",
      listClass: "ods-list",
    },
  ];

  el.innerHTML = "";
  blocks.forEach((b) => {
    const panel = document.createElement("div");
    panel.className = "panel " + (b.panelClass || "");
    const body =
      b.wrap === "div"
        ? '<div class="' + b.listClass + '">' + b.html + "</div>"
        : "<ul class=\"" + b.listClass + "\">" + b.html + "</ul>";
    panel.innerHTML =
      "<h2>" +
      b.title +
      '</h2><p class="expert-panel-meta">' +
      (b.meta || "") +
      "</p>" +
      body;
    el.appendChild(panel);
  });
}
