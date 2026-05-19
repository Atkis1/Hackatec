import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { startSimulation } from "./simulation.js";
import {
  getAreas,
  getConsumptionLog,
  getAlerts,
} from "./services/energyStore.js";
import { flushRuntimeSave } from "./services/runtimeStore.js";

function persistBeforeExit() {
  flushRuntimeSave(() => ({
    areas: getAreas(),
    consumptionLog: getConsumptionLog(),
    alerts: getAlerts(),
  }));
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    persistBeforeExit();
    process.exit(0);
  });
}

const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);
});

startSimulation(io);

httpServer.listen(config.port, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║  SIREN – Sistema Inteligente de Regulación       ║
  ║       Energética                                 ║
  ╠══════════════════════════════════════════════════╣
  ║  Panel:  http://localhost:${config.port}              ║
  ║  API:    http://localhost:${config.port}/api          ║
  ╚══════════════════════════════════════════════════╝
  `);
});
