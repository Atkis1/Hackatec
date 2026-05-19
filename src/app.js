import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiRouter from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/api", apiRouter);
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  return app;
}
