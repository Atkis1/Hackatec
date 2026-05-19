/** Menú lateral fijo en escritorio; drawer en pantallas pequeñas. */
export function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const openBtn = document.getElementById("btn-sidebar-open");
  const closeBtn = document.getElementById("btn-sidebar-close");
  if (!sidebar) return;

  const mq = window.matchMedia("(max-width: 1024px)");

  function setOpen(open) {
    sidebar.classList.toggle("sidebar--open", open);
    backdrop?.classList.toggle("sidebar-backdrop--visible", open);
    document.body.classList.toggle("sidebar-drawer-open", open && mq.matches);
    if (openBtn) openBtn.setAttribute("aria-expanded", open ? "true" : "false");
    backdrop?.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function close() {
    setOpen(false);
  }

  function open() {
    setOpen(true);
  }

  openBtn?.addEventListener("click", () => {
    if (sidebar.classList.contains("sidebar--open")) close();
    else open();
  });

  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  mq.addEventListener("change", () => {
    if (!mq.matches) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (mq.matches) close();
    });
  });

  return { close };
}
