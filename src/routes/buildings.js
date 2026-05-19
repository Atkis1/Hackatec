import { Router } from "express";
import { BUILDING_TYPES } from "../data/buildingTypes.js";
import {
  getBuildingsState,
  getBuilding,
  getActiveBuilding,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  activateBuilding,
} from "../services/buildingsStore.js";
import { reloadEnergyForActiveBuilding } from "../services/energyStore.js";
import { syncMeasurementForActiveBuilding } from "../services/measurementSession.js";
import { getSuggestedEnergyDefaults } from "../services/buildingDefaults.js";

function afterBuildingEnergyReload() {
  reloadEnergyForActiveBuilding();
  return syncMeasurementForActiveBuilding();
}

const router = Router();

router.get("/types", (_req, res) => {
  res.json(BUILDING_TYPES);
});

router.get("/suggestions", (req, res) => {
  const type = req.query.type ?? "mixed";
  const mode = req.query.mode ?? "rooms";
  const appliances = req.query.appliances
    ? String(req.query.appliances).split(",").filter(Boolean)
    : [];
  res.json(getSuggestedEnergyDefaults(type, mode, appliances));
});

router.get("/", (_req, res) => {
  res.json(getBuildingsState());
});

router.get("/active", (_req, res) => {
  const building = getActiveBuilding();
  if (!building) return res.status(404).json({ error: "Sin edificio activo" });
  res.json(building);
});

router.get("/:id", (req, res) => {
  const building = getBuilding(req.params.id);
  if (!building) return res.status(404).json({ error: "Edificio no encontrado" });
  res.json(building);
});

router.post("/", (req, res) => {
  const result = createBuilding(req.body);
  const measurementSession = afterBuildingEnergyReload();
  res.status(201).json({ ...result, measurementSession });
});

router.put("/:id", (req, res) => {
  const result = updateBuilding(req.params.id, req.body);
  if (!result.ok) return res.status(404).json(result);
  let measurementSession = null;
  if (getBuildingsState().activeId === req.params.id) {
    measurementSession = afterBuildingEnergyReload();
  }
  res.json({ ...result, measurementSession });
});

router.post("/:id/activate", (req, res) => {
  const result = activateBuilding(req.params.id);
  if (!result.ok) return res.status(404).json(result);
  const measurementSession = afterBuildingEnergyReload();
  res.json({ ...result, measurementSession });
});

router.delete("/:id", (req, res) => {
  const result = deleteBuilding(req.params.id);
  if (!result.ok) return res.status(400).json(result);
  const measurementSession = afterBuildingEnergyReload();
  res.json({ ...result, measurementSession });
});

export default router;
