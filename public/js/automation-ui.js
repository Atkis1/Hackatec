const API = "/api";

async function fetchJson(path, opts) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatLogTime(iso) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function renderAutomationLog(entries) {
  const logEl = document.getElementById("automation-log");
  if (!logEl) return;
  if (!entries?.length) {
    logEl.innerHTML = '<li class="automation-log-empty">Sin acciones recientes.</li>';
    return;
  }
  logEl.innerHTML = entries
    .map(
      (e) =>
        "<li><time>" +
        formatLogTime(e.at) +
        "</time> " +
        (e.message || e.type) +
        "</li>",
    )
    .join("");
}

export async function loadAutomationPanel() {
  const listEl = document.getElementById("automation-rules-list");
  if (!listEl) return;

  const data = await fetchJson("/automation/rules");
  const rules = data.rules ?? {};
  listEl.innerHTML = "";

  Object.entries(rules).forEach(([id, rule]) => {
    const row = document.createElement("label");
    row.className = "automation-rule";
    row.innerHTML =
      '<input type="checkbox" data-rule-id="' +
      id +
      '" ' +
      (rule.enabled ? "checked" : "") +
      " />" +
      "<span><strong>" +
      rule.name +
      "</strong><br><small>" +
      rule.description +
      "</small></span>";
    const input = row.querySelector("input");
    input.addEventListener("change", async () => {
      await fetchJson("/automation/rules", {
        method: "PUT",
        body: JSON.stringify({ [id]: { enabled: input.checked } }),
      });
      const status = document.getElementById("automation-status");
      if (status) {
        status.textContent = input.checked ? "Regla activa" : "Regla pausada";
        status.className =
          "ms-status-badge " + (input.checked ? "status-active" : "");
      }
    });
    listEl.appendChild(row);
  });

  renderAutomationLog(data.recentLog ?? []);
  const status = document.getElementById("automation-status");
  const anyOn = Object.values(rules).some((r) => r.enabled);
  if (status) {
    status.textContent = anyOn ? "Automatización activa" : "Todas pausadas";
    status.className =
      "ms-status-badge " + (anyOn ? "status-active" : "");
  }
}

export function initAutomationUi(socket) {
  socket?.on("automation", (payload) => {
    if (payload?.actions?.length) {
      renderAutomationLog(
        payload.actions.map((a) => ({
          ...a,
          at: new Date().toISOString(),
        })),
      );
    }
    loadAutomationPanel().catch(console.error);
  });
}
