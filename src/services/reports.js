import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { getAreas } from "./energyStore.js";
import { getActiveBuilding, getActiveBuildingSite } from "./buildingsStore.js";
import { analyzeCfeTariff, buildCfeReportSummary } from "./cfeBilling.js";
import { config } from "../config.js";
import {
  buildSimulatedDaySeries,
  getBillingMetrics,
  simulateDayKwh,
  splitDailyIntoReadings,
} from "./billing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "..", "..", "public", "img", "logo.png");
const LOGO_BANNER_PATH = path.join(
  __dirname,
  "..",
  "..",
  "public",
  "img",
  "logo-banner.png",
);

/** Proporción real del banner (ancho / alto) — logo-banner.png */
const BANNER_ASPECT = 418 / 185;

const periodLabels = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
};

function round(n, d = 2) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

function formatFecha(date) {
  return date.toLocaleDateString("es-MX", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatFechaCorta(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatCostoMxn(amount) {
  const n = round(amount, 2);
  if (Number.isInteger(n)) {
    return `$${n.toLocaleString("es-MX")}`;
  }
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TABLE_HEADERS = [
  "Fecha",
  "Hora",
  "Periodo",
  "Consumo (kWh)",
  "Costo (MXN)",
];

function buildPeriodSummary(metrics, { period, tableTotals, dayCount } = {}) {
  const weeklyKwh =
    period === "weekly" && tableTotals
      ? tableTotals.kwh
      : metrics.weekly.kwh;
  const weeklyCost =
    period === "weekly" && tableTotals
      ? tableTotals.costMxn
      : metrics.weekly.cost;
  const monthlyKwh =
    period === "monthly" && tableTotals
      ? tableTotals.kwh
      : metrics.monthly.kwh;
  const monthlyCost =
    period === "monthly" && tableTotals
      ? tableTotals.costMxn
      : metrics.monthly.cost;

  const avgDayKwh =
    dayCount && tableTotals
      ? round(tableTotals.kwh / dayCount, 1)
      : metrics.daily.kwh;

  return {
    title: "Resumen del periodo",
    items: [
      {
        label: "Habitaciones / áreas",
        value: `${metrics.areaCount} unidades`,
      },
      {
        label: "Consumo promedio por área",
        value: `${metrics.kwhPerArea} kWh / día`,
      },
      {
        label: "Tarifa eléctrica vigente",
        value: `$${metrics.tariff} MXN / kWh`,
      },
      {
        label: "Consumo diario total",
        value: `${metrics.daily.kwh.toLocaleString("es-MX")} kWh`,
        detail: metrics.formula.dailyKwh,
      },
      {
        label: "Costo diario total",
        value: `${formatCostoMxn(metrics.daily.cost)} MXN`,
        detail: metrics.formula.dailyCost,
      },
      {
        label: "Consumo semanal total",
        value: `${weeklyKwh.toLocaleString("es-MX")} kWh`,
        detail:
          period === "weekly" && dayCount
            ? `Suma de ${dayCount} días · promedio ${avgDayKwh} kWh/día`
            : "Estimado: consumo diario × 7",
      },
      {
        label: "Costo semanal total",
        value: `${formatCostoMxn(weeklyCost)} MXN`,
        detail:
          period === "weekly" && dayCount
            ? `Suma de ${dayCount} días simulados`
            : "Estimado: costo diario × 7",
      },
      {
        label: "Consumo mensual total",
        value: `${monthlyKwh.toLocaleString("es-MX")} kWh`,
        detail:
          period === "monthly" && dayCount
            ? `Suma de ${dayCount} días · promedio ${avgDayKwh} kWh/día`
            : "Estimado: consumo diario × 30",
      },
      {
        label: "Costo mensual total",
        value: `${formatCostoMxn(monthlyCost)} MXN`,
        detail:
          period === "monthly" && dayCount
            ? `Suma de ${dayCount} días simulados`
            : "Estimado: costo diario × 30",
      },
    ],
  };
}

function simulationSeedKey(building) {
  if (!building) return "siren-default";
  return `${building.id ?? "site"}-${building.type ?? "mixed"}`;
}

function sumSeriesTotals(series) {
  const kwh = round(
    series.reduce((s, row) => s + row.kwh, 0),
    1,
  );
  const costMxn = round(
    series.reduce((s, row) => s + row.costMxn, 0),
    2,
  );
  return { kwh, costMxn, costoFormatted: formatCostoMxn(costMxn) };
}

function dayRowFromSimulation(entry, periodoLabel) {
  return {
    fecha: formatFechaCorta(entry.date),
    hora: "00:00 – 23:59",
    periodo: periodoLabel,
    kwh: entry.kwh,
    costMxn: entry.costMxn,
    costoFormatted: formatCostoMxn(entry.costMxn),
  };
}

/** Filas del reporte: fecha, hora, periodo, kWh, costo */
function buildTimeSeriesRows(period, building) {
  const metrics = getBillingMetrics();
  const tariff = metrics.tariff;
  const now = new Date();
  const seedKey = simulationSeedKey(building);
  const dayPeriodLabel = periodLabels.daily;

  if (period === "daily") {
    const todayKwh = simulateDayKwh(metrics.daily.kwh, now, seedKey);
    const fecha = formatFechaCorta(now);
    const rows = [];
    let sumKwh = 0;
    let sumCost = 0;
    for (const reading of splitDailyIntoReadings(todayKwh)) {
      const cost = round(reading.kwh * tariff, 2);
      sumKwh += reading.kwh;
      sumCost += cost;
      rows.push({
        fecha,
        hora: reading.hora,
        periodo: dayPeriodLabel,
        kwh: reading.kwh,
        costMxn: cost,
        costoFormatted: formatCostoMxn(cost),
      });
    }
    const totals = {
      label: "TOTAL DIARIO",
      kwh: round(sumKwh, 1),
      costMxn: round(sumCost, 2),
    };
    totals.costoFormatted = formatCostoMxn(totals.costMxn);
    return { rows, metrics, totals, dayCount: 1 };
  }

  if (period === "weekly") {
    const series = buildSimulatedDaySeries({
      baseKwh: metrics.daily.kwh,
      tariff,
      numDays: 7,
      seedKey,
      endDate: now,
    });
    const rows = series.map((entry) =>
      dayRowFromSimulation(entry, dayPeriodLabel),
    );
    const totals = {
      label: "TOTAL SEMANAL",
      ...sumSeriesTotals(series),
    };
    return { rows, metrics, totals, dayCount: 7 };
  }

  const series = buildSimulatedDaySeries({
    baseKwh: metrics.daily.kwh,
    tariff,
    numDays: 30,
    seedKey,
    endDate: now,
  });
  const rows = series.map((entry) =>
    dayRowFromSimulation(entry, dayPeriodLabel),
  );
  const totals = {
    label: "TOTAL MENSUAL",
    ...sumSeriesTotals(series),
  };
  return { rows, metrics, totals, dayCount: 30 };
}

export function buildReportData(period = "daily") {
  const areas = getAreas();
  const building = getActiveBuilding();
  const { rows, totals, metrics, dayCount } = buildTimeSeriesRows(
    period,
    building,
  );
  const totalKw = areas.filter((a) => a.powered).reduce((s, a) => s + a.currentKw, 0);

  const site = getActiveBuildingSite();
  const cfe = building
    ? analyzeCfeTariff(building, {
        totalKwhToday:
          period === "monthly" ? totals.kwh : metrics.monthly.kwh,
      })
    : null;

  const byFloor = (site?.floors ?? []).map((floor) => {
    const floorAreas = areas.filter((a) => a.floorId === floor.id);
    const kwh = round(floorAreas.length * metrics.kwhPerArea, 1);
    return {
      floorName: floor.name,
      areas: floorAreas.length,
      kwh,
      costMxn: round(kwh * metrics.tariff, 2),
    };
  });

  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd);
  if (period === "weekly") rangeStart.setDate(rangeStart.getDate() - 6);
  if (period === "monthly") rangeStart.setDate(rangeStart.getDate() - 29);

  return {
    generatedAt: new Date().toISOString(),
    site: site?.name ?? "—",
    product: config.fullName,
    period,
    periodLabel: periodLabels[period] ?? period,
    dateRange: {
      from: formatFecha(rangeStart),
      to: formatFecha(rangeEnd),
    },
    billing: metrics,
    summary: {
      totalAreas: metrics.areaCount,
      kwhPerArea: metrics.kwhPerArea,
      totalKw: round(totalKw, 2),
      totalKwh: totals.kwh,
      totalCostMxn: totals.costMxn,
      pricePerKwh: metrics.tariff,
      daily: metrics.daily,
      weekly: metrics.weekly,
      monthly: metrics.monthly,
    },
    table: {
      headers: TABLE_HEADERS,
      rows,
      totals,
    },
    periodSummary: buildPeriodSummary(metrics, {
      period,
      tableTotals: totals,
      dayCount,
    }),
    cfeSummary: buildCfeReportSummary(cfe),
    byFloor,
  };
}

function getReportLogoPath() {
  if (fs.existsSync(LOGO_BANNER_PATH)) return LOGO_BANNER_PATH;
  if (fs.existsSync(LOGO_PATH)) return LOGO_PATH;
  return null;
}

function isBannerLogo(logoPath) {
  return logoPath?.includes("logo-banner");
}

/** Encabezado con logo en hoja Excel; devuelve la fila donde continúa el contenido */
function addExcelLogoHeader(workbook, sheet) {
  const logoPath = getReportLogoPath();
  if (!logoPath) return 1;

  const img = workbook.addImage({
    filename: logoPath,
    extension: "png",
  });

  if (isBannerLogo(logoPath)) {
    const imgW = 520;
    const imgH = Math.round(imgW / BANNER_ASPECT);
    sheet.mergeCells("A1:E1");
    sheet.getRow(1).height = Math.round(imgH * 0.85);
    sheet.addImage(img, {
      tl: { col: 0, row: 0 },
      ext: { width: imgW, height: imgH },
    });
    return 4;
  }

  sheet.getRow(1).height = 62;
  sheet.addImage(img, {
    tl: { col: 0, row: 0 },
    ext: { width: 64, height: 72 },
  });
  sheet.mergeCells("B1:E1");
  sheet.getCell("B1").value = "SIREN";
  sheet.getCell("B1").font = { bold: true, size: 18, color: { argb: "FFC9A962" } };
  sheet.getCell("B2").value = config.fullName;
  sheet.getCell("B2").font = { size: 10, color: { argb: "FF4A3F35" } };
  return 5;
}

/* Paleta tabla — estilo beige elegante (referencia UI) */
const EXCEL_HEADER_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8D9C8" },
};
const EXCEL_BODY_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFCF8" },
};
const EXCEL_TOTAL_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9C4A8" },
};
const EXCEL_TEXT = { argb: "FF4A3F35" };

function styleHeaderRow(row) {
  row.font = { bold: true, color: EXCEL_TEXT, size: 11, name: "Calibri" };
  row.fill = EXCEL_HEADER_FILL;
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.height = 24;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFDECDB8" } },
      bottom: { style: "thin", color: { argb: "FFDECDB8" } },
      left: { style: "thin", color: { argb: "FFDECDB8" } },
      right: { style: "thin", color: { argb: "FFDECDB8" } },
    };
  });
}

function styleBodyRow(row) {
  row.font = { size: 11, color: EXCEL_TEXT, name: "Calibri" };
  row.fill = EXCEL_BODY_FILL;
  row.height = 22;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFEDE3D6" } },
      bottom: { style: "thin", color: { argb: "FFEDE3D6" } },
      left: { style: "thin", color: { argb: "FFEDE3D6" } },
      right: { style: "thin", color: { argb: "FFEDE3D6" } },
    };
  });
}

function styleTotalRow(row) {
  row.font = { bold: true, size: 12, color: EXCEL_TEXT, name: "Calibri" };
  row.fill = EXCEL_TOTAL_FILL;
  row.height = 28;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "medium", color: { argb: "FFC9A962" } },
      bottom: { style: "medium", color: { argb: "FFC9A962" } },
      left: { style: "thin", color: { argb: "FFDECDB8" } },
      right: { style: "thin", color: { argb: "FFDECDB8" } },
    };
  });
}

export async function exportExcel(period = "daily") {
  const data = buildReportData(period);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIREN";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Reporte de consumo", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  });
  sheet.properties.defaultRowHeight = 20;
  for (let r = 1; r <= 120; r++) {
    for (let c = 1; c <= 6; c++) {
      sheet.getCell(r, c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF9F2" },
      };
    }
  }

  let startRow = addExcelLogoHeader(workbook, sheet);

  sheet.mergeCells(`A${startRow}:E${startRow}`);
  sheet.getCell(`A${startRow}`).value = "Reporte de consumo energético";
  sheet.getCell(`A${startRow}`).font = {
    bold: true,
    size: 14,
    color: { argb: "FF4A3F35" },
  };
  startRow += 2;

  const b = data.billing;
  const meta = [
    ["Sitio", data.site],
    ["Periodo del reporte", data.periodLabel],
    ["Habitaciones / áreas", `${b.areaCount}`],
    ["Consumo promedio por área", `${b.kwhPerArea} kWh / día`],
    ["Tarifa eléctrica", `$${b.tariff} MXN / kWh`],
    ["Generado", new Date(data.generatedAt).toLocaleString("es-MX")],
  ];
  meta.forEach(([label, value]) => {
    sheet.getCell(`A${startRow}`).value = label;
    sheet.getCell(`A${startRow}`).font = { bold: true };
    sheet.mergeCells(`B${startRow}:E${startRow}`);
    sheet.getCell(`B${startRow}`).value = value;
    startRow += 1;
  });
  startRow += 1;

  const headerRowNum = startRow;
  const headers = data.table.headers;
  sheet.getRow(headerRowNum).values = headers;
  styleHeaderRow(sheet.getRow(headerRowNum));

  const colWidths = [14, 10, 12, 16, 16];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  let r = headerRowNum + 1;
  for (const row of data.table.rows) {
    const dataRow = sheet.getRow(r);
    dataRow.values = [
      row.fecha,
      row.hora,
      row.periodo,
      row.kwh,
      row.costoFormatted ?? formatCostoMxn(row.costMxn),
    ];
    styleBodyRow(dataRow);
    sheet.getCell(`D${r}`).alignment = { horizontal: "right" };
    sheet.getCell(`E${r}`).alignment = { horizontal: "right" };
    r += 1;
  }

  const totalRow = sheet.getRow(r);
  totalRow.values = [
    "",
    "",
    data.table.totals.label,
    data.table.totals.kwh,
    data.table.totals.costoFormatted,
  ];
  styleTotalRow(totalRow);
  sheet.getCell(`D${r}`).alignment = { horizontal: "right" };
  sheet.getCell(`E${r}`).alignment = { horizontal: "right" };

  r += 2;
  sheet.mergeCells(`A${r}:E${r}`);
  sheet.getCell(`A${r}`).value = data.periodSummary.title;
  sheet.getCell(`A${r}`).font = { bold: true, size: 13, color: { argb: "FF4A3F35" } };
  r += 1;
  for (const item of data.periodSummary.items) {
    sheet.mergeCells(`A${r}:C${r}`);
    sheet.getCell(`A${r}`).value = item.label;
    sheet.getCell(`A${r}`).font = { bold: true };
    sheet.mergeCells(`D${r}:E${r}`);
    sheet.getCell(`D${r}`).value = item.value;
    sheet.getCell(`D${r}`).font = { bold: true, color: { argb: "FF1E4A7A" } };
    r += 1;
  }

  if (data.cfeSummary?.items?.length) {
    r += 1;
    sheet.mergeCells(`A${r}:E${r}`);
    sheet.getCell(`A${r}`).value = data.cfeSummary.title;
    sheet.getCell(`A${r}`).font = { bold: true, size: 13, color: { argb: "FF1E4A7A" } };
    r += 1;
    for (const item of data.cfeSummary.items) {
      sheet.mergeCells(`A${r}:C${r}`);
      sheet.getCell(`A${r}`).value = item.label;
      sheet.getCell(`A${r}`).font = { bold: true };
      sheet.mergeCells(`D${r}:E${r}`);
      sheet.getCell(`D${r}`).value = item.value;
      sheet.getCell(`D${r}`).font = { bold: true, color: { argb: "FF1E4A7A" } };
      r += 1;
    }
  }

  const resumen = workbook.addWorksheet("Resumen por piso");
  let resumenStart = addExcelLogoHeader(workbook, resumen);
  resumen.mergeCells(`A${resumenStart}:D${resumenStart}`);
  resumen.getCell(`A${resumenStart}`).value = "Resumen por piso";
  resumen.getCell(`A${resumenStart}`).font = {
    bold: true,
    size: 14,
    color: { argb: "FF4A3F35" },
  };
  resumenStart += 2;
  resumen.getRow(resumenStart).values = [
    "Piso",
    "Áreas",
    "Consumo (kWh)",
    "Costo (MXN)",
  ];
  styleHeaderRow(resumen.getRow(resumenStart));
  resumenStart += 1;
  data.byFloor.forEach((f) => {
    const row = resumen.getRow(resumenStart);
    row.values = [f.floorName, f.areas, f.kwh, f.costMxn];
    styleBodyRow(row);
    resumenStart += 1;
  });

  return workbook.xlsx.writeBuffer();
}

const PDF = {
  cream: "#FFF9F2",
  navy: "#0C1526",
  navyMid: "#111D32",
  summaryBlue: "#4a7398",
  summaryBlueDark: "#3a5f82",
  summaryBlueLight: "#5a85b0",
  gold: "#C9A962",
  goldLight: "#E8D49A",
  beige: "#E8D9C8",
  beigeDark: "#D9C4A8",
  border: "#DECDB8",
  text: "#4A3F35",
  textLight: "#F2F6FC",
  white: "#FFFFFF",
  accent: "#4DB8A4",
};

const PDF_PAGE_BOTTOM = 52;

function ensurePdfSpace(doc, y, blockHeight) {
  const limit = doc.page.height - PDF_PAGE_BOTTOM;
  if (y + blockHeight <= limit) return y;
  doc.addPage();
  return doc._sirenContentTop ?? 130;
}

function paintPdfPageBase(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(PDF.cream);
  doc.restore();
}

function paintPdfHeader(doc, logoPath) {
  const left = 40;
  const width = 515;
  const pad = 8;

  if (logoPath && fs.existsSync(logoPath) && isBannerLogo(logoPath)) {
    try {
      const imgW = width - pad * 2;
      const imgH = imgW / BANNER_ASPECT;
      const boxH = imgH + pad * 2;
      doc.save();
      doc.roundedRect(left, 28, width, boxH, 8).fill(PDF.navy);
      doc.restore();
      doc.image(logoPath, left + pad, 28 + pad, {
        width: imgW,
        height: imgH,
      });
      return 28 + boxH + 14;
    } catch {
      drawPdfHeaderFallback(doc, left, width);
      return 118;
    }
  }

  doc.save();
  doc.roundedRect(left, 28, width, 78, 8).fill(PDF.navy);
  doc.restore();

  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, left + 12, 38, { width: 48, height: 52 });
      doc.font("Helvetica-Bold").fontSize(20).fillColor(PDF.gold);
      doc.text("SIREN", left + 72, 44);
      doc.font("Helvetica").fontSize(9).fillColor(PDF.textLight);
      doc.text(config.fullName, left + 72, 66, { width: 420 });
    } catch {
      drawPdfHeaderFallback(doc, left, width);
    }
  } else {
    drawPdfHeaderFallback(doc, left, width);
  }
  return 118;
}

function drawPdfHeaderFallback(doc, left, width) {
  doc.font("Helvetica-Bold").fontSize(22).fillColor(PDF.gold);
  doc.text("SIREN", left + 16, 48);
  doc.font("Helvetica").fontSize(10).fillColor(PDF.textLight);
  doc.text(config.fullName, left + 16, 72, { width: width - 32 });
}

function drawPdfMetaBox(doc, y, data) {
  const left = 40;
  const width = 515;
  const boxH = 108;
  doc.save();
  doc.roundedRect(left, y, width, boxH, 8).fill("#FFFFFF");
  doc.roundedRect(left, y, width, boxH, 8).lineWidth(1).stroke(PDF.border);
  doc.restore();

  const b = data.billing;
  const items = [
    ["Sitio", data.site],
    ["Periodo del reporte", data.periodLabel],
    ["Habitaciones / áreas", `${b.areaCount}`],
    ["Consumo promedio por área", `${b.kwhPerArea} kWh / día`],
    ["Tarifa eléctrica", `$${b.tariff} MXN / kWh`],
    ["Generado", new Date(data.generatedAt).toLocaleString("es-MX")],
  ];

  let ty = y + 14;
  doc.font("Helvetica").fontSize(10).fillColor(PDF.text);
  items.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").text(`${label}: `, left + 16, ty, { continued: true });
    doc.font("Helvetica").text(value, { width: width - 120 });
    ty += 15;
  });

  return y + boxH + 16;
}

function drawPdfTable(doc, startY, headers, rows, totals) {
  const left = 40;
  const tableWidth = 515;
  const colWidths = [98, 52, 88, 115, 162];
  const rowH = 26;
  const headerH = 30;
  const totalH = 34;
  let y = startY;

  const drawRow = (cells, opts) => {
    const h = opts.height ?? rowH;
    y = ensurePdfSpace(doc, y, h);
    const rowTop = y;

    doc.save();
    doc.rect(left, rowTop, tableWidth, h).fill(opts.fill ?? "#FFFFFF");
    if (opts.borderTop) {
      doc
        .moveTo(left, rowTop)
        .lineTo(left + tableWidth, rowTop)
        .lineWidth(1.5)
        .stroke(PDF.gold);
    }
    doc.restore();

    doc.fillColor(opts.textColor ?? PDF.text);
    doc
      .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(opts.fontSize ?? 10);

    let x = left;
    cells.forEach((text, i) => {
      const pad = 10;
      const cellText = String(text ?? "");
      const cellW = colWidths[i] - pad * 2;
      const lines = Math.max(
        1,
        Math.ceil(
          doc.heightOfString(cellText, {
            width: cellW,
            align: i >= 3 ? "right" : "left",
          }) / 12,
        ),
      );
      const textY = rowTop + Math.max(6, (h - lines * 12) / 2);
      doc.text(cellText, x + pad, textY, {
        width: cellW,
        align: i >= 3 ? "right" : "left",
        lineBreak: true,
      });
      if (i < cells.length - 1) {
        doc
          .moveTo(x + colWidths[i], rowTop)
          .lineTo(x + colWidths[i], rowTop + h)
          .lineWidth(0.5)
          .stroke(PDF.border);
      }
      x += colWidths[i];
    });

    doc
      .moveTo(left, rowTop + h)
      .lineTo(left + tableWidth, rowTop + h)
      .lineWidth(0.5)
      .stroke(PDF.border);

    y += h;
  };

  drawRow(headers, {
    fill: PDF.beige,
    bold: true,
    fontSize: 10,
    height: headerH,
    borderTop: true,
  });

  rows.forEach((row, i) => {
    drawRow(
      [
        row.fecha,
        row.hora,
        row.periodo,
        row.kwh,
        row.costoFormatted ?? formatCostoMxn(row.costMxn),
      ],
      { fill: i % 2 === 0 ? "#FFFCF8" : "#FFFFFF", height: rowH },
    );
  });

  drawRow(
    [
      "",
      "",
      totals.label,
      totals.kwh,
      totals.costoFormatted ?? formatCostoMxn(totals.costMxn),
    ],
    {
      fill: PDF.beigeDark,
      bold: true,
      fontSize: 11,
      height: totalH,
      textColor: PDF.text,
    },
  );

  return y + 12;
}

function measurePdfSummaryHeight(doc, periodSummary) {
  const textWidth = 515 - 32;
  doc.font("Helvetica").fontSize(10);
  let bodyH = 0;
  for (const item of periodSummary.items) {
    const line = `${item.label}: ${item.value}`;
    bodyH += doc.heightOfString(line, { width: textWidth }) + 6;
  }
  return 36 + bodyH + 12;
}

function drawPdfPeriodSummary(doc, y, periodSummary) {
  const left = 40;
  const width = 515;
  const textWidth = width - 32;
  const h = measurePdfSummaryHeight(doc, periodSummary);
  y = ensurePdfSpace(doc, y, h);

  doc.save();
  const grad = doc.linearGradient(left, y, left + width, y + h);
  grad.stop(0, PDF.summaryBlueDark);
  grad.stop(0.5, PDF.summaryBlue);
  grad.stop(1, PDF.summaryBlueLight);
  doc.roundedRect(left, y, width, h, 8).fill(grad);
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(12).fillColor(PDF.white);
  doc.text(periodSummary.title, left + 16, y + 12, { width: textWidth });

  let ty = y + 32;
  for (const item of periodSummary.items) {
    const line = `${item.label}: ${item.value}`;
    doc.font("Helvetica").fontSize(10).fillColor(PDF.white);
    const blockH = doc.heightOfString(line, { width: textWidth });
    doc.text(line, left + 16, ty, { width: textWidth });
    ty += blockH + 6;
  }

  return y + h + 12;
}

export function exportPdf(period = "daily") {
  const data = buildReportData(period);
  const doc = new PDFDocument({ margin: 0, size: "A4", bufferPages: true });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  const logoPath = getReportLogoPath();

  doc.on("pageAdded", () => {
    paintPdfPageBase(doc);
    doc._sirenContentTop = paintPdfHeader(doc, logoPath);
  });

  paintPdfPageBase(doc);
  doc._sirenContentTop = paintPdfHeader(doc, logoPath);
  let y = doc._sirenContentTop;

  y = drawPdfMetaBox(doc, y, data);

  doc.font("Helvetica-Bold").fontSize(12).fillColor(PDF.navyMid);
  doc.text("Detalle de consumo", 40, y);
  y += 22;

  y = drawPdfTable(doc, y, data.table.headers, data.table.rows, data.table.totals);
  y = drawPdfPeriodSummary(doc, y, data.periodSummary);
  if (data.cfeSummary?.items?.length) {
    y = drawPdfPeriodSummary(doc, y, data.cfeSummary);
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.rect(0, doc.page.height - 32, doc.page.width, 32).fill(PDF.navy);
    doc.fillColor(PDF.textLight).font("Helvetica").fontSize(8);
    doc.text(
      `SIREN — ${config.fullName}  ·  Página ${i + 1} de ${range.count}`,
      40,
      doc.page.height - 22,
      { align: "center", width: 515 },
    );
    doc.restore();
  }

  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
