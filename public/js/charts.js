const MAX_POINTS = 48;

const palette = {
  navy: "#1a2d4a",
  gold: "#FF8C00",
  goldFill: "rgba(255, 140, 0, 0.5)",
  teal: "#00B894",
  tealFill: "rgba(0, 184, 148, 0.45)",
  coral: "#FF4757",
  coralFill: "rgba(255, 71, 87, 0.45)",
  violet: "#6C5CE7",
  violetFill: "rgba(108, 92, 231, 0.45)",
  sky: "#0984E3",
  skyFill: "rgba(9, 132, 227, 0.4)",
};

let charts = {};
let labels = [];
let lastSessionCost = 0;
let sampleIndex = 0;

/** Etiqueta numérica de eje horario: 1, 1.5, 2, 2.5… (sin 12:34 a.m.) */
export function formatHourStepLabel(stepIndex) {
  const hours = 1 + (stepIndex - 1) * 0.5;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function timeLabel() {
  sampleIndex += 1;
  return formatHourStepLabel(sampleIndex);
}

const lineDatasetDefaults = {
  borderWidth: 4,
  pointRadius: 4,
  pointHoverRadius: 7,
  pointBorderWidth: 2,
  pointBackgroundColor: "#ffffff",
};

/** Límites del eje Y para que la línea se vea aunque los valores estén muy juntos */
export function computeYScaleBounds(...series) {
  const all = series
    .flat()
    .filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!all.length) return { min: 0, max: 10 };
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min = Math.max(0, min - 2);
    max = max + 2;
  } else {
    const pad = Math.max((max - min) * 0.22, 1.2);
    min = Math.max(0, min - pad);
    max = max + pad;
  }
  return { min, max };
}

export function getLightChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 280 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        labels: {
          color: palette.navy,
          font: { family: "Source Sans 3", size: 15, weight: "600" },
          boxWidth: 14,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: "#1a2d4a",
        titleColor: "#ffffff",
        bodyColor: "#f7f4ee",
        borderColor: "rgba(255, 176, 32, 0.5)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Hora (h)",
          color: palette.navy,
          font: { family: "Source Sans 3", size: 14, weight: "600" },
        },
        ticks: { color: "#2a3f58", maxTicksLimit: 8, font: { family: "Source Sans 3", size: 14, weight: "600" } },
        grid: { color: "rgba(26, 45, 74, 0.18)" },
      },
      y: {
        ticks: { color: "#2a3f58", font: { family: "Source Sans 3", size: 14, weight: "600" } },
        grid: { color: "rgba(26, 45, 74, 0.22)" },
      },
    },
    ...extra,
  };
}

export function initCharts() {
  if (typeof Chart === "undefined") return;

  const demandCtx = document.getElementById("chart-demand-cost");
  if (!demandCtx) return;

  charts.demandCost = new Chart(demandCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Potencia total (kW) — suma de tus zonas",
          data: [],
          borderColor: palette.gold,
          backgroundColor: palette.goldFill,
          pointBorderColor: palette.gold,
          fill: true,
          tension: 0.35,
          yAxisID: "y",
          ...lineDatasetDefaults,
        },
        {
          label: "Costo acumulado hoy (MXN)",
          data: [],
          borderColor: palette.teal,
          backgroundColor: palette.tealFill,
          pointBorderColor: palette.teal,
          fill: false,
          tension: 0.35,
          yAxisID: "y1",
          ...lineDatasetDefaults,
        },
      ],
    },
    options: getLightChartOptions({
      scales: {
        y: {
          position: "left",
          title: { display: true, text: "kW", color: palette.gold, font: { weight: "700" } },
        },
        y1: {
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "MXN", color: palette.teal, font: { weight: "700" } },
          ticks: { color: palette.teal },
        },
        x: { ticks: { maxTicksLimit: 8 } },
      },
    }),
  });

  charts.voltage = new Chart(document.getElementById("chart-voltage"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Voltaje red (V)",
          data: [],
          borderColor: palette.coral,
          backgroundColor: palette.coralFill,
          pointBorderColor: palette.coral,
          tension: 0.3,
          fill: true,
          ...lineDatasetDefaults,
        },
      ],
    },
    options: getLightChartOptions({
      scales: {
        y: {
          suggestedMin: 120,
          suggestedMax: 132,
          title: { display: true, text: "V", color: palette.coral, font: { weight: "700" } },
        },
      },
    }),
  });

  charts.powerFactor = new Chart(document.getElementById("chart-power-factor"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Factor de potencia",
          data: [],
          borderColor: palette.violet,
          backgroundColor: palette.violetFill,
          pointBorderColor: palette.violet,
          tension: 0.3,
          fill: true,
          ...lineDatasetDefaults,
        },
      ],
    },
    options: getLightChartOptions({
      scales: {
        y: {
          suggestedMin: 0.82,
          suggestedMax: 0.98,
          title: { display: true, text: "FP", color: palette.violet, font: { weight: "700" } },
        },
      },
    }),
  });

  charts.floors = new Chart(document.getElementById("chart-floors"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "kW por piso",
          data: [],
          backgroundColor: palette.gold,
          borderColor: "#E67E00",
          borderWidth: 3,
          borderRadius: 6,
        },
        {
          label: "Costo del piso hoy (MXN)",
          data: [],
          backgroundColor: palette.teal,
          borderColor: "#009B7A",
          borderWidth: 3,
          borderRadius: 6,
        },
      ],
    },
    options: getLightChartOptions({
      scales: {
        x: {
          title: { display: true, text: "Piso", color: palette.navy, font: { weight: "600" } },
        },
        y: { beginAtZero: true },
      },
    }),
  });
}

function trimSeries() {
  if (labels.length > MAX_POINTS) labels.shift();
  for (const key of ["demandCost", "voltage", "powerFactor"]) {
    const c = charts[key];
    if (!c) continue;
    c.data.labels = [...labels];
    c.data.datasets.forEach((ds) => {
      if (ds.data.length > MAX_POINTS) ds.data.shift();
    });
  }
}

export function resetCharts(buildingLabel) {
  labels = [];
  sampleIndex = 0;
  lastSessionCost = 0;
  const hint = document.getElementById("chart-building-label");
  if (hint) hint.textContent = buildingLabel || "—";

  for (const c of Object.values(charts)) {
    if (!c) continue;
    c.data.labels = [];
    c.data.datasets.forEach((ds) => {
      ds.data = [];
    });
    c.update();
  }
}

export function pushRealtime(data) {
  if (!charts.demandCost) return;

  const hint = document.getElementById("chart-building-label");
  if (hint && data.buildingName) {
    hint.textContent =
      data.buildingName +
      " · $" +
      (data.tariff ?? 0).toFixed(2) +
      "/kWh · " +
      (data.totalKwhToday ?? 0).toFixed(1) +
      " kWh hoy";
  }

  labels.push(timeLabel());
  trimSeries();

  const dc = charts.demandCost;
  dc.data.datasets[0].data.push(data.totalKw ?? 0);
  if (data.measurementAccumulating !== false) {
    lastSessionCost = data.costTodayMxn ?? 0;
  }
  dc.data.datasets[1].data.push(lastSessionCost);
  dc.update("none");

  const v = charts.voltage;
  v.data.datasets[0].data.push(data.voltageAvg ?? 127);
  v.update("none");

  const pf = charts.powerFactor;
  pf.data.datasets[0].data.push(data.powerFactorAvg ?? 0.9);
  pf.update("none");

  const fl = charts.floors;
  const floors = data.byFloor ?? [];
  fl.data.labels = floors.map((f) => f.floorName?.split("–")[0]?.trim() || f.floorId);
  fl.data.datasets[0].data = floors.map((f) => Math.round(f.kw * 100) / 100);
  fl.data.datasets[1].data = floors.map((f) => Math.round(f.costMxn * 100) / 100);
  fl.update("none");
}
