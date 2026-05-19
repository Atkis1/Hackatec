# -*- coding: utf-8 -*-
"""
Repara index.html cuando los acentos aparecen como '?' (pérdida de codificación al guardar).

No toca URLs (p. ej. ?auto= en Unsplash). Idempotente si el texto ya está correcto.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "public" / "index.html"

# Orden: frases largas primero; evitar trozos ambiguos.
REPLACEMENTS: list[tuple[str, str]] = [
    (
        "Nombre libre, tipo de edificio y pisos. La tarifa y los kWh se sugieren seg?n los equipos; puede ajustarlos o usar ?Usar sugerida? / ?Usar sugerido?.",
        "Nombre libre, tipo de edificio y pisos. La tarifa y los kWh se sugieren según los equipos; puede ajustarlos o usar «Usar sugerida» / «Usar sugerido».",
    ),
    (
        "Inicie o detenga la medici?n para acumular kWh y costo en las gr?ficas. La potencia (kW) se muestra en vivo en todo momento.",
        "Inicie o detenga la medición para acumular kWh y costo en las gráficas. La potencia (kW) se muestra en vivo en todo momento.",
    ),
    (
        "kW previstos para las pr?ximas horas seg?n el edificio activo. La l?nea base se compara con el consumo habitual.",
        "kW previstos para las próximas horas según el edificio activo. La línea base se compara con el consumo habitual.",
    ),
    (
        "Encienda, apague o defina un tope de kW por zona. Los cambios se reflejan al instante en medidores y gr?ficas.",
        "Encienda, apague o defina un tope de kW por zona. Los cambios se reflejan al instante en medidores y gráficas.",
    ),
    ("SIREN ? Regulaci?n Energ?tica Inteligente", "SIREN – Regulación Energética Inteligente"),
    ("Sistema Inteligente de Regulaci?n Energ?tica", "Sistema Inteligente de Regulación Energética"),
    ("Men? principal", "Menú principal"),
    ("Cerrar men?", "Cerrar menú"),
    ("Abrir men? de navegaci?n", "Abrir menú de navegación"),
    ("?reas y control", "Áreas y control"),
    ("Gesti?n de edificios", "Gestión de edificios"),
    ("Identificaci?n", "Identificación"),
    ("Configuraci?n", "Configuración"),
    ("Medici?n", "Medición"),
    ("Por habitaciones / ?reas", "Por habitaciones / áreas"),
    ("Por metros cuadrados (m?)", "Por metros cuadrados (m²)"),
    ("Zona clim?tica CFE", "Zona climática CFE"),
    ("Subsidio estacional y l?mite antes de tarifa DAC", "Subsidio estacional y límite antes de tarifa DAC"),
    ("Par?metros energ?ticos", "Parámetros energéticos"),
    ("Tarifa el?ctrica (MXN/kWh)", "Tarifa eléctrica (MXN/kWh)"),
    ("kWh promedio por ?rea / d?a", "kWh promedio por área / día"),
    ("kWh por m? / d?a", "kWh por m² / día"),
    ("Equipos el?ctricos", "Equipos eléctricos"),
    ("Pisos y ?reas", "Pisos y áreas"),
    ("Uso mixto ? gesti?n y monitoreo energ?tico", "Uso mixto · gestión y monitoreo energético"),
    ("Medici?n en tiempo real", "Medición en tiempo real"),
    ("Ayuda medici?n", "Ayuda medición"),
    ("Activar autom?ticamente seg?n horario", "Activar automáticamente según horario"),
    ("D?as y franja horaria (hora local). Al entrar en la ventana, se reinicia el contador del d?a.", "Días y franja horaria (hora local). Al entrar en la ventana, se reinicia el contador del día."),
    ('aria-label="D?as de la semana"', 'aria-label="Días de la semana"'),
    (" /> Mi?", " /> Mié"),
    (" /> S?b", " /> Sáb"),
    ("Automatizaci?n", "Automatización"),
    ("Ayuda automatizaci?n", "Ayuda automatización"),
    ("Reglas de demostraci?n: limitan sobrecargas o apagan servicios en picos de demanda.", "Reglas de demostración: limitan sobrecargas o apagan servicios en picos de demanda."),
    ("Ayuda gr?ficas", "Ayuda gráficas"),
    ("costo acumulado hoy en pesos seg?n tu tarifa.", "costo acumulado hoy en pesos según tu tarifa."),
    ("En M?xico suele rondar los 127 V.", "En México suele rondar los 127 V."),
    (
        "Escala de 0 a 1: cuanto m?s cercano a 1, mayor es el aprovechamiento de la energ?a el?ctrica.",
        "Escala de 0 a 1: cuánto más cercano a 1, mayor es el aprovechamiento de la energía eléctrica.",
    ),
    ("Control por ?rea", "Control por área"),
    ("Ayuda ?reas", "Ayuda áreas"),
    ("Uso mixto ? control por zona", "Uso mixto · control por zona"),
    ("Pron?stico de demanda", "Pronóstico de demanda"),
    ("Ayuda pron?stico", "Ayuda pronóstico"),
    ("Edificio activo y medici?n en tiempo real.", "Edificio activo y medición en tiempo real."),
    ("Uso mixto ? supervisi?n de instalaciones", "Uso mixto · supervisión de instalaciones"),
    ("Reportes peri?dicos", "Reportes periódicos"),
    ("Uso mixto ? informes de consumo", "Uso mixto · informes de consumo"),
    ("y proveedor seg?n el tipo de zona.", "y proveedor según el tipo de zona."),
    ("Formas de conexi?n", "Formas de conexión"),
    ("Uso mixto ? medidores y sensores IoT", "Uso mixto · medidores y sensores IoT"),
    # Zonas CFE: guión largo
    ("Zona 1 ? Centro", "Zona 1 — Centro"),
    ("Zona 1A ? Muy c?lida", "Zona 1A — Muy cálida"),
    ("Zona 1B ? C?lida", "Zona 1B — Cálida"),
    ("Zona 1C ? Litoral c?lido", "Zona 1C — Litoral cálido"),
    ("Zona 1D ? Templada costera", "Zona 1D — Templada costera"),
    ("Zona 1E ? Templada", "Zona 1E — Templada"),
    ("Zona 1F ? Fr?a", "Zona 1F — Fría"),
    ("Seleccionar equipos?", "Seleccionar equipos…"),
    ('<span id="sync-status" class="sync-status">?</span>', '<span id="sync-status" class="sync-status">—</span>'),
    (
        '<span id="ms-status-badge" class="ms-status-badge status-paused">?</span>',
        '<span id="ms-status-badge" class="ms-status-badge status-paused">—</span>',
    ),
    (
        '<span id="automation-status" class="ms-status-badge status-paused">?</span>',
        '<span id="automation-status" class="ms-status-badge status-paused">—</span>',
    ),
]


def fix_sidebar_close_glyph(s: str) -> str:
    """El botón cerrar debe mostrar ×, no ?."""
    return s.replace(
        'class="sidebar-close" aria-label="Cerrar menú">\n          ?\n',
        'class="sidebar-close" aria-label="Cerrar menú">\n          ×\n',
    )


def main() -> None:
    s = INDEX.read_text(encoding="utf-8")
    orig = s
    for old, new in REPLACEMENTS:
        s = s.replace(old, new)
    s = fix_sidebar_close_glyph(s)

    # Cualquier ? restante en texto (no en URL): Zona X ? ya cubierto
    if s != orig or "Regulaci?n" in s or "Men?" in s:
        INDEX.write_text(s, encoding="utf-8", newline="\n")
        print("Repaired and wrote UTF-8:", INDEX)
    else:
        print("No known broken patterns; file unchanged.")

    # Comprobar ? fuera de URLs conocidas
    tmp = re.sub(r"https://[^\"]+", "", s)
    q = tmp.count("?")
    if q:
        print("Warning: still", q, "question marks outside stripped URLs — review manually.")


if __name__ == "__main__":
    main()
