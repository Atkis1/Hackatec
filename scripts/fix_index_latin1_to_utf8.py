# -*- coding: utf-8 -*-
"""
index.html se guardó como Latin-1/Windows-1252 pero declara UTF-8: el navegador muestra ? en tildes.
Convierte a UTF-8 real y corrige ? que no son parte de URLs.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "public" / "index.html"


def main() -> None:
    raw = INDEX.read_bytes()
    s = raw.decode("latin-1")

    s = re.sub(
        r"<title>SIREN \? (.+)</title>",
        r"<title>SIREN – \1</title>",
        s,
        count=1,
    )
    s = re.sub(r"(Zona \d[A-F]?)\s+\?\s+", r"\1 — ", s)

    s = s.replace(
        '<span id="sync-status" class="sync-status">?</span>',
        '<span id="sync-status" class="sync-status">—</span>',
    )
    s = s.replace(
        '<span id="ms-status-badge" class="ms-status-badge status-paused">?</span>',
        '<span id="ms-status-badge" class="ms-status-badge status-paused">—</span>',
    )
    s = s.replace(
        '<span id="automation-status" class="ms-status-badge status-paused">?</span>',
        '<span id="automation-status" class="ms-status-badge status-paused">—</span>',
    )
    s = s.replace("Seleccionar equipos?", "Seleccionar equipos…")

    INDEX.write_text(s, encoding="utf-8", newline="\n")
    print("Wrote UTF-8:", INDEX)


if __name__ == "__main__":
    main()
