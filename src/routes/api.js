import { Router } from "express";
import * as monitoring from "../services/monitoring.js";
import * as control from "../services/control.js";
import * as reports from "../services/reports.js";
import * as expert from "../services/expertSystem.js";
import * as alerts from "../services/alerts.js";
import { getCfeStatusForActive } from "../services/cfeBilling.js";
import { getActiveBuilding } from "../services/buildingsStore.js";
import { CFE_ZONE_IDS, getCfeZone } from "../data/cfeTariffs.js";
import * as meters from "../services/meters.js";
import * as automation from "../services/automation.js";
import { config } from "../config.js";
import buildingsRouter from "./buildings.js";
import * as measurementSession from "../services/measurementSession.js";

const router = Router();

router.use("/buildings", buildingsRouter);

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    product: config.siteName,
    name: config.fullName,
  });
});

// Monitoreo
router.get("/monitoring/overview", (_req, res) => {
  res.json(monitoring.getSiteOverview());
});

router.get("/monitoring/session", (_req, res) => {
  const session = measurementSession.getSessionPublicStatus();
  if (!session) return res.status(404).json({ error: "Sin edificio activo" });
  res.json(session);
});

router.post("/monitoring/session/reset", (_req, res) => {
  const result = measurementSession.resetAndStartMeasurement();
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post("/monitoring/session/start", (_req, res) => {
  const result = measurementSession.startMeasurementSession();
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true, session: measurementSession.getSessionPublicStatus() });
});

router.post("/monitoring/session/stop", (_req, res) => {
  const result = measurementSession.stopMeasurementSession();
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true, session: measurementSession.getSessionPublicStatus() });
});

router.put("/monitoring/session/schedule", (req, res) => {
  const result = measurementSession.updateMeasurementSchedule(
    undefined,
    req.body ?? {},
  );
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post("/monitoring/session/sync-building", (_req, res) => {
  const session = measurementSession.syncMeasurementForActiveBuilding();
  if (!session) return res.status(404).json({ error: "Sin edificio activo" });
  res.json({ ok: true, session });
});

router.get("/monitoring/realtime", (req, res) => {
  const { areaId } = req.query;
  if (areaId) {
    const data = monitoring.getRealtimeByArea(areaId);
    if (!data) return res.status(404).json({ error: "Área no encontrada" });
    return res.json(data);
  }
  res.json(monitoring.getRealtimeAll());
});

// Control
router.post("/control/:areaId/power", (req, res) => {
  const { powered } = req.body;
  if (powered === undefined) {
    return res.status(400).json({ error: "Se requiere 'powered' (boolean)" });
  }
  const result = control.setPower(req.params.areaId, powered);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

router.post("/control/:areaId/limit", (req, res) => {
  const { limitKw } = req.body;
  const result = control.setLimit(
    req.params.areaId,
    limitKw === null ? null : limitKw,
  );
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post("/control/bulk", (req, res) => {
  res.json(control.bulkControl(req.body));
});

// Reportes
router.get("/reports", (req, res) => {
  const period = req.query.period ?? "daily";
  res.json(reports.buildReportData(period));
});

router.get("/reports/export/excel", async (req, res) => {
  const period = req.query.period ?? "daily";
  const buffer = await reports.exportExcel(period);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="siren-reporte-${period}.xlsx"`,
  );
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(Buffer.from(buffer));
});

router.get("/reports/export/pdf", async (req, res) => {
  try {
    const period = req.query.period ?? "daily";
    const buffer = await reports.exportPdf(period);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="siren-reporte-${period}.pdf"`,
    );
    res.type("application/pdf");
    res.send(buffer);
  } catch (err) {
    console.error("PDF export error:", err);
    res.status(500).json({
      error: "No se pudo generar el PDF",
      detail: err.message,
    });
  }
});

// Sistema experto
router.get("/expert/analysis", (req, res) => {
  const cycleParam = req.query.cycle;
  const cycle =
    cycleParam != null && cycleParam !== ""
      ? Number(cycleParam)
      : expert.getExpertRotationCycle();
  res.json(
    expert.analyzeAndRecommend({
      cycle: Number.isFinite(cycle) ? cycle : expert.getExpertRotationCycle(),
    }),
  );
});

router.get("/expert/area/:areaId", (req, res) => {
  const data = expert.getAreaExpertInsight(req.params.areaId);
  if (!data) return res.status(404).json({ error: "Área no encontrada" });
  res.json(data);
});

// Tarifa CFE (subsidio / DAC)
router.get("/billing/cfe/zones", (_req, res) => {
  res.json(
    CFE_ZONE_IDS.map((id) => ({
      id,
      label: getCfeZone(id).label,
    })),
  );
});

router.get("/billing/cfe", (req, res) => {
  const building = getActiveBuilding();
  if (!building) return res.status(404).json({ error: "Sin edificio activo" });
  const live = {
    totalKwhToday: Number(req.query.kwhToday) || undefined,
    totalKw: Number(req.query.kw) || undefined,
  };
  res.json(getCfeStatusForActive(building, live));
});

// Alertas
router.get("/alerts", (req, res) => {
  const onlyActive = req.query.active === "true";
  res.json(alerts.getAlerts({ onlyActive }));
});

router.post("/alerts/:alertId/ack", (req, res) => {
  const alert = alerts.acknowledgeAlert(req.params.alertId);
  if (!alert) return res.status(404).json({ error: "Alerta no encontrada" });
  res.json(alert);
});

// Automatización
router.get("/automation/rules", (_req, res) => {
  res.json({
    rules: automation.getAutomationRules(),
    recentLog: automation.getAutomationLog(),
  });
});

router.put("/automation/rules", (req, res) => {
  const rules = automation.setAutomationRules(req.body ?? {});
  res.json({ ok: true, rules });
});

// Medidores
router.get("/meters/providers", (_req, res) => {
  res.json(meters.listProviders());
});

router.get("/meters", (_req, res) => {
  res.json(meters.listMeters());
});

router.get("/meters/summary", (_req, res) => {
  res.json(meters.getMetersSummary());
});

router.post("/meters/:meterId/sync", (req, res) => {
  const result = meters.syncMeterReading(req.params.meterId, req.body);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

export default router;
