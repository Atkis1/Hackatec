import { tickSimulation, getRealtimeSnapshot } from "./services/energyStore.js";
import { evaluateAlerts } from "./services/alerts.js";
import { runAutomation } from "./services/automation.js";
import { getActiveBuilding } from "./services/buildingsStore.js";
import { analyzeAndRecommend } from "./services/expertSystem.js";
import {
  getSessionPublicStatus,
  processScheduleTick,
} from "./services/measurementSession.js";
import { config } from "./config.js";

export function startSimulation(io) {
  let tick = 0;
  const broadcast = () => {
    const scheduleEvent = processScheduleTick();
    tickSimulation();
    const snapshot = getRealtimeSnapshot();
    const created = evaluateAlerts({
      totalKwhToday: snapshot.totalKwhToday,
      totalKw: snapshot.totalKw,
    });
    const autoActions = runAutomation(getActiveBuilding());
    if (created.length) {
      io.emit("alerts-created", {
        count: created.length,
        alerts: created.map((a) => ({
          id: a.id,
          severity: a.severity,
          title: a.title,
        })),
      });
    }
    if (autoActions.length) {
      io.emit("automation", { actions: autoActions });
    }
    snapshot.session = getSessionPublicStatus();
    io.emit("realtime", snapshot);
    if (scheduleEvent?.event === "schedule-started") {
      io.emit("measurement-session", snapshot.session);
    }
    tick += 1;
    if (tick % 15 === 0) {
      io.emit("expert", analyzeAndRecommend());
    }
  };

  broadcast();
  return setInterval(broadcast, config.simulationIntervalMs);
}
