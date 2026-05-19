const UI_KEY = "siren-ui-v1";
const DRAFT_KEY = "siren-building-draft-v1";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function readUi() {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeUi(patch) {
  const next = { ...readUi(), ...patch, savedAt: Date.now() };
  localStorage.setItem(UI_KEY, JSON.stringify(next));
  return next;
}

export function saveUiPrefs(prefs) {
  return writeUi(prefs);
}

export function loadUiPrefs() {
  return readUi();
}

export function applyUiPrefs() {
  const ui = readUi();
  if (ui.activeView) {
    const btn = document.querySelector(
      '.nav-btn[data-view="' + ui.activeView + '"]',
    );
    if (btn && !btn.classList.contains("active")) btn.click();
  }
  const floor = $("#floor-filter");
  if (floor && ui.floorFilter != null) floor.value = ui.floorFilter;
  const period = $("#report-period");
  if (period && ui.reportPeriod) period.value = ui.reportPeriod;
  return ui;
}

export function bindUiPersistence() {
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      writeUi({ activeView: btn.dataset.view });
    });
  });
  $("#floor-filter")?.addEventListener("change", (e) => {
    writeUi({ floorFilter: e.target.value });
  });
  $("#report-period")?.addEventListener("change", (e) => {
    writeUi({ reportPeriod: e.target.value });
  });
}

export function saveBuildingFormDraft(buildingId, payload, draftFloors) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        buildingId,
        payload,
        draftFloors,
        savedAt: Date.now(),
      }),
    );
  } catch {
    /* localStorage lleno */
  }
}

export function loadBuildingFormDraft(buildingId) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft.buildingId !== buildingId) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearBuildingFormDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
