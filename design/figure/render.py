"""Convierte una figura dibujada en SVG (mapa de brillo en escala de grises) en
una figura hecha de dígitos binarios.

Uso:  python design/figure/render.py <carpeta>

La carpeta debe tener figure.svg (620x440, fondo negro, rellenos en grises:
blanco = dígitos más brillantes, negro = vacío). Opcional: un grupo
<g id="outline" display="none"> con trazos planos (sin <g> anidados) que se
superponen como líneas finas en el banner.

Genera en la misma carpeta:
  shade.png   la figura rasterizada (lo que "ve" el conversor)
  cells.json  la rejilla de dígitos: columnas, filas, celda y [col, fila, nivel, dígito]
  outline.txt el contenido del grupo outline (si existe)
  binary.svg / binary.png  vista previa de cómo se verá en el banner
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time

from PIL import Image

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
W, H = 620, 440          # caja de la figura dentro del banner
CW, CH = 7, 10           # tamaño de cada celda (un dígito)
CORE = (310, 210)        # centro del núcleo animado, en coordenadas de la figura


def shot(svg_path, png_path, w, h, motion=False, budget=1500):
    """Rasteriza un SVG con Edge en modo headless."""
    if os.path.exists(png_path):
        os.remove(png_path)
    profile = tempfile.mkdtemp(prefix="edge-fig-")
    url = "file:///" + os.path.abspath(svg_path).replace("\\", "/")
    subprocess.run(
        [EDGE, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={profile}",
         "--hide-scrollbars", "--force-device-scale-factor=1",
         *([] if motion else ["--force-prefers-reduced-motion"]),
         f"--window-size={w},{h}", f"--virtual-time-budget={budget}", f"--screenshot={os.path.abspath(png_path)}", url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90,
    )
    for _ in range(80):
        if os.path.exists(png_path) and os.path.getsize(png_path) > 0:
            return
        time.sleep(0.5)
    raise SystemExit(f"Edge no generó {png_path}")


def sample(png_path):
    cols, rows = W // CW, H // CH
    im = Image.open(png_path).convert("L").resize((W, H)).resize((cols, rows), Image.BOX)
    px = im.load()
    cells = []
    for r in range(rows):
        for c in range(cols):
            v = px[c, r] / 255
            if v < 0.10:
                continue
            level = 1 if v < 0.38 else 2 if v < 0.68 else 3
            digit = "1" if hashlib.md5(f"{c},{r}".encode()).digest()[0] & 1 else "0"
            cells.append([c, r, level, digit])
    return cols, rows, cells


def rows_svg(cells, cls="l"):
    groups = {}
    for c, r, lv, d in cells:
        groups.setdefault((lv, r), []).append((c, d))
    out = []
    for (lv, r), items in sorted(groups.items()):
        items.sort()
        xs = " ".join(f"{c * CW + 0.5:g}" for c, _ in items)
        out.append(f'<text class="{cls}{lv}" x="{xs}" y="{r * CH + CH - 2}">{"".join(d for _, d in items)}</text>')
    return "\n".join(out)


def outline_of(svg_text):
    m = re.search(r'<g[^>]*id="outline"[^>]*>(.*?)</g>', svg_text, re.S)
    return m.group(1).strip() if m else ""


def main(folder):
    fig = os.path.join(folder, "figure.svg")
    src = open(fig, encoding="utf-8").read()
    shade = os.path.join(folder, "shade.png")
    shot(fig, shade, W, H)
    cols, rows, cells = sample(shade)
    outline = outline_of(src)
    json.dump({"w": W, "h": H, "cw": CW, "ch": CH, "cols": cols, "rows": rows, "core": CORE, "cells": cells},
              open(os.path.join(folder, "cells.json"), "w"), separators=(",", ":"))
    open(os.path.join(folder, "outline.txt"), "w", encoding="utf-8").write(outline)

    cx, cy = CORE
    hexagon = " ".join(f"{cx + 22 * __import__('math').cos(a):.1f},{cy + 22 * __import__('math').sin(a):.1f}"
                       for a in [i * 3.14159265 / 3 + 3.14159265 / 6 for i in range(6)])
    preview = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs><radialGradient id="g"><stop offset="0" stop-color="#E8FBFF"/><stop offset=".35" stop-color="#00D4FF" stop-opacity=".7"/><stop offset="1" stop-color="#00D4FF" stop-opacity="0"/></radialGradient></defs>
<style>text{{font-family:Consolas,'Cascadia Code',monospace;font-size:10px}}.l1{{fill:#00D4FF;opacity:.30}}.l2{{fill:#00D4FF;opacity:.62}}.l3{{fill:#C9F6FF}}</style>
<rect width="{W}" height="{H}" fill="#090B10"/>
{rows_svg(cells)}
<g fill="none" stroke="#00D4FF" stroke-opacity=".55" stroke-width="1">{outline}</g>
<circle cx="{cx}" cy="{cy}" r="46" fill="url(#g)"/>
<polygon points="{hexagon}" fill="none" stroke="#E8FBFF" stroke-width="2"/>
</svg>"""
    bsvg = os.path.join(folder, "binary.svg")
    open(bsvg, "w", encoding="utf-8").write(preview)
    shot(bsvg, os.path.join(folder, "binary.png"), W, H)
    print(f"{len(cells)} dígitos en {cols}x{rows} celdas · outline: {len(outline)} chars · {folder}")


if __name__ == "__main__":
    main(sys.argv[1])
