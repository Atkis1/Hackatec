/** Fotos reales (Unsplash) por tipo de edificio — w=640 para carga ligera. */
const BUILDING_PHOTO_BY_TYPE = {
  hotel: {
    url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=640&q=80",
    alt: "Lobby y habitaciones de hotel",
    label: "Hotel",
  },
  hospital: {
    url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=640&q=80",
    alt: "Interior de hospital moderno",
    label: "Hospital",
  },
  university: {
    url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=640&q=80",
    alt: "Campus universitario y edificios escolares",
    label: "Universidad / campus",
  },
  corporate: {
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=640&q=80",
    alt: "Oficinas corporativas modernas",
    label: "Corporativo / oficinas",
  },
  mixed: {
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=640&q=80",
    alt: "Complejo de edificios de uso mixto",
    label: "Uso mixto",
  },
};

const CAPTION_BY_ROLE = {
  building: (label) => `${label} · gestión y monitoreo energético`,
  areas: (label) => `${label} · control por zona`,
  alerts: (label) => `${label} · supervisión de instalaciones`,
  reports: (label) => `${label} · informes de consumo`,
  meters: (label) => `${label} · medidores y sensores IoT`,
};

function photoDef(typeId) {
  return BUILDING_PHOTO_BY_TYPE[typeId] ?? BUILDING_PHOTO_BY_TYPE.mixed;
}

/**
 * Actualiza todas las imágenes marcadas con data-building-photo.
 * @param {string} typeId - hotel, hospital, university, corporate, mixed
 * @param {string} [typeLabel] - etiqueta legible opcional
 */
export function updateBuildingPhotos(typeId, typeLabel) {
  const def = photoDef(typeId);
  const label = typeLabel || def.label;

  document.querySelectorAll("[data-building-photo]").forEach((img) => {
    const role = img.dataset.photoRole || "building";
    img.src = def.url;
    img.alt = def.alt;
    const cap = img.closest("[data-building-photo-wrap]")?.querySelector(
      "[data-building-photo-caption]",
    );
    if (cap) {
      const fn = CAPTION_BY_ROLE[role] ?? CAPTION_BY_ROLE.building;
      cap.textContent = fn(label);
    }
  });
}

export function updateBuildingPhotosFromSelect() {
  const sel = document.getElementById("bf-type");
  if (!sel) return;
  const opt = sel.selectedOptions?.[0];
  updateBuildingPhotos(sel.value, opt?.textContent?.trim());
}

export function updateBuildingPhotosFromSite(site) {
  if (!site?.type) return;
  const def = photoDef(site.type);
  updateBuildingPhotos(site.type, def.label);
}
