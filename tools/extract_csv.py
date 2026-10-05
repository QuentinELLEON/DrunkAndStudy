#!/usr/bin/env python3
"""Extrait les deux jeux de données embarqués dans l'ancien prototype mono-fichier.

Usage :  python tools/extract_csv.py chemin/vers/student-viz.html
Écrit    data/student-mat.csv et data/student-por.csv (séparateur ",", fin de ligne LF).

Le prototype contenait les CSV dans <script type="text/csv" id="data-mat"> et id="data-por".
Ce script n'est utile qu'une fois : les fichiers produits sont déjà dans data/.
"""
import pathlib
import re
import sys

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "student-viz.html")
html = src.read_text(encoding="utf-8")
out = pathlib.Path(__file__).resolve().parent.parent / "data"
out.mkdir(exist_ok=True)

for key in ("mat", "por"):
    m = re.search(rf'<script type="text/csv" id="data-{key}">(.*?)</script>', html, re.S)
    if not m:
        sys.exit(f"bloc data-{key} introuvable dans {src}")
    text = m.group(1).strip() + "\n"
    lines = text.count("\n") - 1
    (out / f"student-{key}.csv").write_text(text, encoding="utf-8", newline="\n")
    print(f"data/student-{key}.csv : {lines} élèves")
