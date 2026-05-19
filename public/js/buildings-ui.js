import {
  initBuildingSuggestions,
  refreshSuggestions,
  onBuildingFormLoaded,
  resetSuggestionOverrides,
} from "./building-suggestions.js";
import {
  saveBuildingFormDraft,
  clearBuildingFormDraft,
  loadBuildingFormDraft,
} from "./ui-persistence.js";
import {
  updateBuildingPhotos,
  updateBuildingPhotosFromSelect,
} from "./building-photos.js";

const API = "/api";

let buildingTypes = {};
let buildingsList = [];
let editingBuilding = null;
let draftFloors = [];
let formDraftTimer = null;

export function getEditingBuilding() {
  return editingBuilding;
}

export async function fetchJson(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putJson(path, body) {
  const res = await fetch(API + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function deleteJson(path) {
  const res = await fetch(API + path, { method: "DELETE" });
  return res.json();
}

const $ = (s) => document.querySelector(s);

export async function loadBuildingTypes() {
  buildingTypes = await fetchJson("/buildings/types");
  const sel = $("#bf-type");
  if (!sel) return;
  sel.innerHTML = "";
  Object.entries(buildingTypes).forEach(([id, t]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = t.label;
    sel.appendChild(opt);
  });
}

export async function refreshBuildingsSelect(activeId) {
  const state = await fetchJson("/buildings");
  buildingsList = state.buildings;
  const sel = $("#building-select");
  if (!sel) return state;
  sel.innerHTML = "";
  buildingsList.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    if (b.id === (activeId ?? state.activeId)) opt.selected = true;
    sel.appendChild(opt);
  });
  return state;
}

function typeDef() {
  return buildingTypes[$("#bf-type")?.value] ?? { appliances: [], defaultHasRooms: true };
}

let appliancesDropdownBound = false;

function normalizeApplianceSelection(selected = []) {
  const apps = typeDef().appliances;
  const valid = new Set(apps.map((a) => a.id));
  const kept = selected.filter((id) => valid.has(id));
  if (kept.length) return kept;
  return apps.slice(0, Math.min(4, apps.length)).map((a) => a.id);
}

function updateApplianceDropdownLabel() {
  const labelEl = $("#bf-appliances-label");
  const apps = typeDef().appliances;
  const selected = collectAppliances();
  if (!labelEl) return;
  if (!selected.length) {
    labelEl.textContent = "Seleccionar equipos…";
    return;
  }
  const names = selected
    .map((id) => apps.find((a) => a.id === id)?.label)
    .filter(Boolean);
  if (names.length <= 2) {
    labelEl.textContent = names.join(", ");
  } else {
    labelEl.textContent =
      names.slice(0, 2).join(", ") + " y " + (names.length - 2) + " más";
  }
}

function setApplianceDropdownOpen(open) {
  const wrap = $("#bf-appliances");
  const trigger = $("#bf-appliances-trigger");
  const panel = $("#bf-appliances-panel");
  if (!wrap || !trigger || !panel) return;
  wrap.classList.toggle("appliance-select--open", open);
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
  panel.hidden = !open;
}

function renderApplianceDropdown(selected = []) {
  const wrap = $("#bf-appliances");
  const panel = $("#bf-appliances-panel");
  if (!wrap || !panel) return;

  const normalized = normalizeApplianceSelection(selected);
  panel.innerHTML = "";

  typeDef().appliances.forEach((app) => {
    const option = document.createElement("label");
    option.className = "appliance-select-option";
    option.setAttribute("role", "option");
    const checked = normalized.includes(app.id);
    option.innerHTML =
      '<input type="checkbox" value="' +
      app.id +
      '"' +
      (checked ? " checked" : "") +
      " /><span>" +
      app.label +
      "</span>";
    option.querySelector("input").addEventListener("change", () => {
      updateApplianceDropdownLabel();
      refreshSuggestions({ applyValues: false });
    });
    panel.appendChild(option);
  });

  updateApplianceDropdownLabel();

  if (!appliancesDropdownBound) {
    appliancesDropdownBound = true;
    const trigger = $("#bf-appliances-trigger");
    trigger?.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !wrap.classList.contains("appliance-select--open");
      setApplianceDropdownOpen(open);
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) setApplianceDropdownOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setApplianceDropdownOpen(false);
    });
  }
}

function toggleMeasurementUi(mode) {
  const rooms = $("#bf-kwh-rooms-wrap");
  const sqm = $("#bf-kwh-sqm-wrap");
  if (!rooms || !sqm) return;
  if (mode === "sqm") {
    rooms.classList.add("hidden");
    sqm.classList.remove("hidden");
  } else {
    rooms.classList.remove("hidden");
    sqm.classList.add("hidden");
  }
}

function renderFloorRows() {
  const list = $("#floors-list");
  if (!list) return;
  list.innerHTML = "";
  const mode = $("#bf-measurement")?.value ?? "rooms";

  draftFloors.forEach((floor, idx) => {
    const row = document.createElement("div");
    row.className = "floor-row";
    const showRooms = mode === "rooms";
    row.innerHTML =
      '<div class="field" style="grid-column:1/-1"><label>Nombre del piso</label><input type="text" class="input floor-name" value="' +
      (floor.name || "") +
      '" /></div>' +
      (showRooms
        ? '<div class="field"><label><input type="checkbox" class="floor-has-rooms"' +
          (floor.hasRooms ? " checked" : "") +
          " /> Habitaciones</label></div>" +
          '<div class="field floor-rooms-field' +
          (floor.hasRooms ? "" : " hidden") +
          '"><label>Cantidad</label><input type="number" class="input floor-rooms" min="0" max="200" value="' +
          (floor.roomCount || 0) +
          '" /></div>'
        : "") +
      '<div class="field"><label>m² del piso</label><input type="number" class="input floor-sqm" min="0" value="' +
      (floor.sqm || 0) +
      '" /></div>' +
      '<button type="button" class="btn btn-ghost btn-sm floor-remove">Quitar</button>';

    const preview = document.createElement("p");
    preview.className = "floor-preview hint";
    preview.style.gridColumn = "1 / -1";

    const syncPreview = () => {
      const f = draftFloors[idx];
      const mode = $("#bf-measurement")?.value ?? "rooms";
      if (mode === "sqm") {
        preview.textContent =
          "Al guardar: 1 zona «" +
          (f.name || "Piso") +
          "»" +
          (f.sqm > 0 ? " con " + f.sqm + " m²" : "");
      } else if (f.hasRooms && f.roomCount > 0) {
        const n = Number(f.roomCount);
        preview.textContent =
          "Al guardar: " +
          n +
          " habitación(es), p. ej. «" +
          (f.name || "Piso") +
          (n > 1 ? " – Hab. 1» … «" + (f.name || "Piso") + " – Hab. " + n + "»" : "»");
      } else {
        preview.textContent =
          "Al guardar: 1 zona «" + (f.name || "Piso") + "» (sin contar habitaciones)";
      }
    };

    row.querySelector(".floor-name").addEventListener("input", (e) => {
      draftFloors[idx].name = e.target.value;
      syncPreview();
    });
    const hasRooms = row.querySelector(".floor-has-rooms");
    if (hasRooms) {
      hasRooms.addEventListener("change", (e) => {
        draftFloors[idx].hasRooms = e.target.checked;
        row.querySelector(".floor-rooms-field").classList.toggle("hidden", !e.target.checked);
        syncPreview();
      });
      row.querySelector(".floor-rooms").addEventListener("input", (e) => {
        draftFloors[idx].roomCount = Number(e.target.value) || 0;
        syncPreview();
      });
    }
    row.querySelector(".floor-sqm").addEventListener("input", (e) => {
      draftFloors[idx].sqm = Number(e.target.value) || 0;
      syncPreview();
    });
    syncPreview();
    row.appendChild(preview);
    row.querySelector(".floor-remove").addEventListener("click", () => {
      draftFloors.splice(idx, 1);
      renderFloorRows();
    });
    list.appendChild(row);
  });
}

function collectAppliances() {
  return [
    ...($("#bf-appliances-panel")?.querySelectorAll("input:checked") ?? []),
  ].map((el) => el.value);
}

function collectPayload() {
  return {
    name: $("#bf-name").value.trim(),
    type: $("#bf-type").value,
    measurementMode: $("#bf-measurement").value,
    tariff: Number($("#bf-tariff").value) || 3.2,
    cfeClimateZone: $("#bf-cfe-zone")?.value || "1C",
    kwhPerRoomPerDay: Number($("#bf-kwh-room").value) || 28,
    kwhPerSqmPerDay: Number($("#bf-kwh-sqm").value) || 1.1,
    appliances: collectAppliances(),
    floors: draftFloors.map((f, i) => ({
      id: f.id || "p" + (i + 1),
      name: (f.name || "Piso " + (i + 1)).trim(),
      hasRooms: !!f.hasRooms,
      roomCount: Number(f.roomCount) || 0,
      sqm: Number(f.sqm) || 0,
      areas: [],
    })),
  };
}

function scheduleBuildingFormDraft() {
  if (!editingBuilding?.id) return;
  clearTimeout(formDraftTimer);
  formDraftTimer = setTimeout(() => {
    saveBuildingFormDraft(
      editingBuilding.id,
      collectPayload(),
      draftFloors.map((f) => ({ ...f })),
    );
  }, 700);
}

function restoreBuildingFormDraft(buildingId) {
  const draft = loadBuildingFormDraft(buildingId);
  if (!draft?.payload) return false;
  const p = draft.payload;
  $("#bf-name").value = p.name ?? "";
  $("#bf-type").value = p.type ?? "hotel";
  $("#bf-measurement").value = p.measurementMode ?? "rooms";
  $("#bf-tariff").value = p.tariff ?? 3.2;
  if ($("#bf-cfe-zone")) $("#bf-cfe-zone").value = p.cfeClimateZone ?? "1C";
  $("#bf-kwh-room").value = p.kwhPerRoomPerDay ?? 28;
  $("#bf-kwh-sqm").value = p.kwhPerSqmPerDay ?? 1.1;
  toggleMeasurementUi(p.measurementMode ?? "rooms");
  renderApplianceDropdown(p.appliances || []);
  draftFloors = draft.draftFloors.map((f) => ({ ...f }));
  renderFloorRows();
  onBuildingFormLoaded();
  updateBuildingPhotosFromSelect();
  return true;
}

export function fillBuildingForm(building) {
  editingBuilding = building;
  if (restoreBuildingFormDraft(building.id)) return;
  $("#bf-name").value = building.name;
  $("#bf-type").value = building.type;
  $("#bf-measurement").value = building.measurementMode || "rooms";
  $("#bf-tariff").value = building.tariff;
  if ($("#bf-cfe-zone")) $("#bf-cfe-zone").value = building.cfeClimateZone ?? "1C";
  $("#bf-kwh-room").value = building.kwhPerRoomPerDay;
  $("#bf-kwh-sqm").value = building.kwhPerSqmPerDay;
  toggleMeasurementUi(building.measurementMode);
  renderApplianceDropdown(building.appliances || []);
  draftFloors = (building.floors || []).map((f) => ({ ...f }));
  renderFloorRows();
  onBuildingFormLoaded();
  updateBuildingPhotos(building.type, buildingTypes[building.type]?.label);
}

export async function loadActiveBuildingIntoForm() {
  const building = await fetchJson("/buildings/active");
  fillBuildingForm(building);
  return building;
}

export function initBuildingsUi({ onBuildingChanged }) {
  initBuildingSuggestions();
  loadBuildingTypes().then(() => {
    refreshBuildingsSelect().then(() => loadActiveBuildingIntoForm());
  });

  $("#bf-type")?.addEventListener("change", () => {
    renderApplianceDropdown(collectAppliances());
    setApplianceDropdownOpen(false);
    updateBuildingPhotosFromSelect();
  });

  $("#bf-measurement")?.addEventListener("change", (e) => {
    toggleMeasurementUi(e.target.value);
    renderFloorRows();
  });

  $("#btn-add-floor")?.addEventListener("click", () => {
    const td = typeDef();
    const n = draftFloors.length + 1;
    draftFloors.push({
      id: "p" + Date.now().toString(36).slice(-4),
      name: "Piso " + n,
      hasRooms: td.defaultHasRooms,
      roomCount: td.defaultHasRooms ? 8 : 0,
      sqm: 600,
      areas: [],
    });
    renderFloorRows();
  });

  $("#btn-new-building")?.addEventListener("click", async () => {
    const td = typeDef();
    editingBuilding = null;
    draftFloors = [
      {
        id: "p1",
        name: "Piso 1",
        hasRooms: td.defaultHasRooms,
        roomCount: td.defaultHasRooms ? 10 : 0,
        sqm: 800,
        areas: [],
      },
    ];
    $("#bf-name").value = "Nuevo edificio";
    $("#bf-type").value = "hotel";
    $("#bf-measurement").value = "rooms";
    resetSuggestionOverrides();
    renderApplianceDropdown(td.appliances.map((a) => a.id));
    renderFloorRows();
    refreshSuggestions({ applyValues: true, force: true });
    updateBuildingPhotosFromSelect();
  });

  $("#building-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = collectPayload();
    let result;
    if (editingBuilding?.id) {
      result = await putJson("/buildings/" + editingBuilding.id, payload);
    } else {
      result = await postJson("/buildings", payload);
    }
    if (!result.ok && result.error) {
      alert(result.error);
      return;
    }
    const b = result.building;
    clearBuildingFormDraft();
    await refreshBuildingsSelect(b.id);
    if (onBuildingChanged) await onBuildingChanged(b);
    fillBuildingForm(b);
  });

  $("#btn-delete-building")?.addEventListener("click", async () => {
    if (!editingBuilding?.id) return;
    if (!confirm("¿Eliminar este edificio?")) return;
    const result = await deleteJson("/buildings/" + editingBuilding.id);
    if (!result.ok) {
      alert(result.error || "No se pudo eliminar");
      return;
    }
    await refreshBuildingsSelect();
    await loadActiveBuildingIntoForm();
    if (onBuildingChanged) await onBuildingChanged();
  });

  $("#building-select")?.addEventListener("change", async (e) => {
    const id = e.target.value;
    await postJson("/buildings/" + id + "/activate", {});
    await loadActiveBuildingIntoForm();
    if (onBuildingChanged) await onBuildingChanged();
  });

  const form = $("#building-form");
  form?.addEventListener("input", scheduleBuildingFormDraft);
  form?.addEventListener("change", scheduleBuildingFormDraft);
}
