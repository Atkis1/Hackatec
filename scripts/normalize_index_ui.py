# -*- coding: utf-8 -*-
"""One-shot: Latin-1 index.html -> UTF-8, remove auth gate, fix placeholders and copy."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "public" / "index.html"


def main() -> None:
    raw = INDEX.read_bytes()
    s = raw.decode("latin-1")

    # Quita pantalla de acceso simple
    s, n = re.subn(
        r"\s*<div id=\"auth-gate\"[^>]*>[\s\S]*?</div>\s*</div>\s*",
        "\n",
        s,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"auth-gate removal expected 1 match, got {n}")

    s = re.sub(
        r"<title>SIREN \? (.+)</title>",
        r"<title>SIREN – \1</title>",
        s,
        count=1,
    )

    # Zonas CFE: guión tipográfico entre código y descripción
    s = re.sub(r"(Zona \d[A-F]?)\s+\?\s+", r"\1 — ", s)

    s = s.replace(
        '<span id="sync-status" class="sync-status">?</span>',
        '<span id="sync-status" class="sync-status">—</span>',
    )
    s = s.replace(
        '<p class="chart-live-line" id="chart-building-label">?</p>',
        '<p class="chart-live-line" id="chart-building-label"></p>',
    )
    s = s.replace(
        '<p id="alerts-summary" class="alerts-summary">?</p>',
        '<p id="alerts-summary" class="alerts-summary"></p>',
    )
    s = s.replace(
        '<span id="ms-status-badge" class="ms-status-badge status-active">?</span>',
        '<span id="ms-status-badge" class="ms-status-badge status-paused">—</span>',
    )
    s = s.replace(
        '<span id="automation-status" class="ms-status-badge">?</span>',
        '<span id="automation-status" class="ms-status-badge status-paused">—</span>',
    )

    s = s.replace("Seleccionar equipos?", "Seleccionar equipos…")
    s = s.replace(
        'placeholder="Buscar por zona, piso o identificador?"',
        'placeholder="Buscar por zona, piso o identificador"',
    )

    # Textos: tono profesional y ortografía
    s = s.replace(
        "Nombre libre, tipo de edificio y pisos. La tarifa y los kWh se sugieren según los equipos; puedes ajustarlos o usar «Usar sugerida» / «Usar sugerido».",
        "Nombre libre, tipo de edificio y pisos. La tarifa y los kWh se sugieren según los equipos; puede ajustarlos o usar «Usar sugerida» / «Usar sugerido».",
    )

    s = s.replace(
        "Inicia o detén cuando se acumulen kWh y costo en las gráficas. La potencia (kW) siempre se muestra en vivo.",
        "Inicie o detenga la medición para acumular kWh y costo en las gráficas. La potencia (kW) se muestra en vivo en todo momento.",
    )

    s = s.replace(
        "Reglas de demostración: limitar sobrecargas o apagar servicios en picos de demanda.",
        "Reglas de demostración: limitan sobrecargas o apagan servicios en picos de demanda.",
    )

    s = s.replace(
        "Enciende, apaga o fija un tope de kW por zona. Los cambios se reflejan al instante en medidores y gráficas.",
        "Encienda, apague o defina un tope de kW por zona. Los cambios se reflejan al instante en medidores y gráficas.",
    )

    s = s.replace(
        "kW previstos para las próximas horas según el edificio activo. La línea base compara con el consumo habitual.",
        "kW previstos para las próximas horas según el edificio activo. La línea base se compara con el consumo habitual.",
    )

    s = s.replace(
        "Escala de 0 a 1: cuánto más cerca de 1, mejor aprovechamiento de la energía eléctrica.",
        "Escala de 0 a 1: cuanto más cercano a 1, mayor es el aprovechamiento de la energía eléctrica.",
    )

    s = s.replace(
        "Promedio de voltios (V) en la red simulada. En México suele estar cerca de 127 V.",
        "Promedio de voltaje (V) en la red simulada. En México suele rondar los 127 V.",
    )

    s = s.replace(
        "Un medidor por zona del edificio activo. Lecturas en vivo (kW, V, factor de potencia) y proveedor según el tipo de zona.",
        "Un medidor por zona del edificio activo. Lecturas en vivo (kW, V y factor de potencia) y proveedor según el tipo de zona.",
    )

    s = s.replace(
        "Vista previa del reporte. Usa los botones para descargar PDF o Excel con el logo SIREN y las tablas completas.",
        "Vista previa del reporte. Use los botones para descargar PDF o Excel con el logotipo SIREN y las tablas completas.",
    )

    s = s.replace(
        "Activar automáticamente por horario",
        "Activar automáticamente según horario",
    )

    s = s.replace(
        "Días y franja horaria (hora local). Al entrar en la ventana se reinicia el contador del día.",
        "Días y franja horaria (hora local). Al entrar en la ventana, se reinicia el contador del día.",
    )

    s = s.replace(
        "Edificio activo y medición en vivo.",
        "Edificio activo y medición en tiempo real.",
    )

    INDEX.write_text(s, encoding="utf-8", newline="\n")
    print("OK:", INDEX, "UTF-8, chars", len(s))


if __name__ == "__main__":
    main()
