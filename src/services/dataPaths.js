import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");

/** Datos del usuario: no se pierden al actualizar el código del repo */
export const USER_DATA_DIR = path.join(PROJECT_ROOT, "data", "user");
export const BUILDINGS_FILE = path.join(USER_DATA_DIR, "buildings.json");
export const RUNTIME_FILE = path.join(USER_DATA_DIR, "runtime.json");
export const LEGACY_BUILDINGS_FILE = path.join(PROJECT_ROOT, "data", "buildings.json");

export function ensureUserDataDir() {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}
