const API = "/api";

let userOverrides = { tariff: false, kwhRoom: false, kwhSqm: false };
let lastSuggestions = null;

const $ = (s) => document.querySelector(s);

function collectApplianceIds() {
  const panel = $("#bf-appliances-panel");
  if (!panel) return [];
  return [...panel.querySelectorAll("input:checked")].map((el) => el.value);
}

export async function fetchSuggestions() {
  const type = $("#bf-type")?.value ?? "mixed";
  const mode = $("#bf-measurement")?.value ?? "rooms";
  const appliances = collectApplianceIds().join(",");
  const res = await fetch(
    `${API}/buildings/suggestions?type=${encodeURIComponent(type)}&mode=${encodeURIComponent(mode)}&appliances=${encodeURIComponent(appliances)}`,
  );
  if (!res.ok) throw new Error(await res.text());
  lastSuggestions = await res.json();
  return lastSuggestions;
}

function updateHintElements(s) {
  const tariffHint = $("#bf-tariff-hint");
  const kwhHint = $("#bf-kwh-hint");
  const kwhSqmHint = $("#bf-kwh-sqm-hint");
  if (tariffHint) {
    tariffHint.innerHTML =
      '<span class="suggest-badge">Sugerido: $' +
      s.tariff.toFixed(2) +
      "/kWh</span> — " +
      s.hints.tariff;
  }
  if (kwhHint) {
    kwhHint.innerHTML =
      '<span class="suggest-badge">Sugerido: ' +
      s.kwhPerRoomPerDay +
      " kWh/zona/día</span> — " +
      s.hints.kwh;
  }
  if (kwhSqmHint) {
    kwhSqmHint.innerHTML =
      '<span class="suggest-badge">Sugerido: ' +
      s.kwhPerSqmPerDay +
      " kWh/m²/día</span> — " +
      s.hints.kwh;
  }
}

export function applySuggestionsToFields(force = false) {
  if (!lastSuggestions) return;
  const s = lastSuggestions;
  if (force || !userOverrides.tariff) {
    $("#bf-tariff").value = s.tariff;
  }
  if (force || !userOverrides.kwhRoom) {
    $("#bf-kwh-room").value = s.kwhPerRoomPerDay;
  }
  if (force || !userOverrides.kwhSqm) {
    $("#bf-kwh-sqm").value = s.kwhPerSqmPerDay;
  }
}

export async function refreshSuggestions(opts = {}) {
  const { applyValues = false, force = false } = opts;
  const s = await fetchSuggestions();
  updateHintElements(s);
  if (applyValues) applySuggestionsToFields(force);
  return s;
}

export function initBuildingSuggestions() {
  const markTariff = () => {
    userOverrides.tariff = true;
  };
  const markKwhRoom = () => {
    userOverrides.kwhRoom = true;
  };
  const markKwhSqm = () => {
    userOverrides.kwhSqm = true;
  };

  $("#bf-tariff")?.addEventListener("input", markTariff);
  $("#bf-kwh-room")?.addEventListener("input", markKwhRoom);
  $("#bf-kwh-sqm")?.addEventListener("input", markKwhSqm);

  $("#btn-suggest-tariff")?.addEventListener("click", async () => {
    await refreshSuggestions();
    userOverrides.tariff = false;
    $("#bf-tariff").value = lastSuggestions.tariff;
    userOverrides.tariff = false;
  });

  $("#btn-suggest-kwh")?.addEventListener("click", async () => {
    await refreshSuggestions();
    userOverrides.kwhRoom = false;
    $("#bf-kwh-room").value = lastSuggestions.kwhPerRoomPerDay;
  });

  $("#btn-suggest-kwh-sqm")?.addEventListener("click", async () => {
    await refreshSuggestions();
    userOverrides.kwhSqm = false;
    $("#bf-kwh-sqm").value = lastSuggestions.kwhPerSqmPerDay;
  });

  $("#bf-type")?.addEventListener("change", () => {
    userOverrides = { tariff: false, kwhRoom: false, kwhSqm: false };
    refreshSuggestions({ applyValues: true, force: true });
  });

  $("#bf-measurement")?.addEventListener("change", () => {
    userOverrides.kwhRoom = false;
    userOverrides.kwhSqm = false;
    refreshSuggestions({ applyValues: true, force: true });
  });

}

export function resetSuggestionOverrides() {
  userOverrides = { tariff: false, kwhRoom: false, kwhSqm: false };
}

export function onBuildingFormLoaded() {
  resetSuggestionOverrides();
  refreshSuggestions({ applyValues: false });
}
