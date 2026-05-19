/**
 * Mantiene Panel central y todas las pestañas con los mismos datos del edificio activo.
 */

let syncTimer = null;
let syncInFlight = null;

export function createConnectedViewsSync(handlers) {
  function updateSyncNotes() {
    const name = handlers.getBuildingName?.() || "—";
    const time = new Date().toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const status = document.getElementById("sync-status");
    if (status) {
      status.textContent = time;
      status.title =
        (name && name !== "—" ? name + " · " : "") +
        "Última actualización " +
        time;
    }
  }

  async function refreshAllConnectedViews({ reloadOverview = true } = {}) {
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
      if (reloadOverview) await handlers.loadOverview();
      else handlers.refreshDashboardPanels?.();

      handlers.renderAreasContext?.();
      handlers.renderAreasTable?.();
      handlers.renderMeasurementPanel?.();

      await Promise.all([
        handlers.loadExpert?.(),
        handlers.loadAlerts?.(),
        handlers.loadReports?.(),
        handlers.refreshMeters?.(),
        handlers.loadAutomation?.(),
      ]);

      updateSyncNotes();
    })();

    try {
      await syncInFlight;
    } finally {
      syncInFlight = null;
    }
  }

  function scheduleConnectedViewsSync(delayMs = 2000) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      refreshAllConnectedViews({ reloadOverview: true }).catch(console.error);
    }, delayMs);
  }

  function onRealtimePacket(data) {
    handlers.applyRealtimeLight?.(data);
    scheduleConnectedViewsSync(2500);
  }

  return {
    refreshAllConnectedViews,
    scheduleConnectedViewsSync,
    onRealtimePacket,
    updateSyncNotes,
  };
}
