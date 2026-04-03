#!/usr/bin/env python3
"""
Generate a starfield PNG from BSC5 (Yale Bright Star Catalogue) via Vizier.

Projection: Azimuthal equidistant from the north ecliptic pole —
matching the top-down ecliptic view used by the orbit canvas.

Output: frontend/public/starfield.png  (2048x2048, RGBA)
"""

import math
import requests
from PIL import Image, ImageDraw

# ── Fetch BSC5 from Vizier ────────────────────────────────────────────────────

def hms_to_deg(s):
    """'HH MM SS.S' or 'HH:MM:SS.S' → decimal degrees (RA)."""
    s = s.strip().replace(":", " ")
    parts = s.split()
    h, m, sec = float(parts[0]), float(parts[1]), float(parts[2])
    return (h + m / 60 + sec / 3600) * 15.0

def dms_to_deg(s):
    """'+DD MM SS.S' or '-DD MM SS.S' → decimal degrees (Dec)."""
    s = s.strip().replace(":", " ")
    sign = -1 if s.startswith("-") else 1
    s = s.lstrip("+-")
    parts = s.split()
    d, m, sec = float(parts[0]), float(parts[1]), float(parts[2])
    return sign * (d + m / 60 + sec / 3600)

def fetch_bsc5():
    print("Fetching BSC5 from Vizier …")
    url = (
        "https://vizier.cds.unistra.fr/viz-bin/asu-tsv"
        "?-source=V/50"
        "&-out=RAJ2000,DEJ2000,Vmag,B-V"
        "&-out.max=9200"
    )
    r = requests.get(url, timeout=90)
    r.raise_for_status()

    stars = []
    header_done = False
    for line in r.text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("-"):
            header_done = True
            continue
        if not header_done:
            continue  # skip column name / unit rows
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        try:
            ra  = hms_to_deg(parts[0])
            dec = dms_to_deg(parts[1])
            mag = float(parts[2])
            bv  = float(parts[3]) if len(parts) > 3 and parts[3].strip() else 0.6
            stars.append((ra, dec, mag, bv))
        except (ValueError, IndexError):
            continue

    print(f"  {len(stars)} stars loaded")
    return stars

# ── Coordinate transform ──────────────────────────────────────────────────────

_EPS = math.radians(23.4393)  # obliquity of ecliptic J2000

def to_ecliptic(ra_deg, dec_deg):
    """Equatorial (J2000) → ecliptic (λ, β) in radians."""
    a  = math.radians(ra_deg)
    d  = math.radians(dec_deg)
    sb = math.sin(d) * math.cos(_EPS) - math.cos(d) * math.sin(_EPS) * math.sin(a)
    beta = math.asin(max(-1.0, min(1.0, sb)))
    lam  = math.atan2(
        math.sin(a) * math.cos(_EPS) + math.tan(d) * math.sin(_EPS),
        math.cos(a),
    )
    return lam, beta   # radians

# ── Star colour from B-V index ────────────────────────────────────────────────

def bv_to_rgb(bv):
    """Map Johnson B-V to approximate sRGB tuple (0-255 each)."""
    bv = max(-0.4, min(2.0, bv))
    if bv < 0.0:
        r, g, b = 160 + int(95 * (bv + 0.4) / 0.4), 170 + int(85 * (bv + 0.4) / 0.4), 255
    elif bv < 0.4:
        t = bv / 0.4
        r, g, b = 200 + int(55 * t), 210 + int(45 * t), 255 - int(25 * t)
    elif bv < 0.8:
        t = (bv - 0.4) / 0.4
        r, g, b = 255, 255 - int(10 * t), 230 - int(40 * t)
    elif bv < 1.4:
        t = (bv - 0.8) / 0.6
        r, g, b = 255, 245 - int(60 * t), 190 - int(70 * t)
    else:
        t = min(1.0, (bv - 1.4) / 0.6)
        r, g, b = 255 - int(30 * t), 185 - int(55 * t), 120 - int(60 * t)
    return (min(255, r), min(255, g), min(255, b))

# ── Image generation ──────────────────────────────────────────────────────────

def generate(stars, size=2048, out="frontend/public/starfield.png", mag_limit=5.5):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    cx = cy = size // 2
    # Azimuthal equidistant from ecliptic N pole:
    #   β = π/2 (N pole) → r = 0
    #   β = 0   (equator) → r = size/2  (fills the canvas)
    # scale = (size/2) / (π/2) = size/π
    scale = size / math.pi

    placed = 0
    for ra, dec, mag, bv in stars:
        if mag > mag_limit:
            continue
        lam, beta = to_ecliptic(ra, dec)

        # Azimuthal equidistant: distance from ecliptic N pole
        r = (math.pi / 2 - beta) * scale  # β=π/2 → r=0, β=0 → r=scale=size/2

        x = cx + r * math.cos(lam)
        y = cy - r * math.sin(lam)   # screen Y inverted

        px, py = int(round(x)), int(round(y))
        if not (0 <= px < size and 0 <= py < size):
            continue

        rgb = bv_to_rgb(bv)

        # Dot radius: mag 1 → 2.5 px, mag 6 → 0.8 px, mag 8 → 0.4 px
        dot_r = max(0.4, 2.8 - mag * 0.32)

        if dot_r >= 1.2:
            # Glow layers for bright stars
            glow_steps = int(dot_r * 3)
            for s in range(glow_steps, 0, -1):
                frac   = s / glow_steps
                radius = int(dot_r * (1 + frac * 1.8))
                alpha  = int(200 * frac ** 2.5)
                box = [px - radius, py - radius, px + radius, py + radius]
                draw.ellipse(box, fill=(*rgb, alpha))
            # Solid core
            cr = max(1, int(dot_r * 0.6))
            draw.ellipse([px - cr, py - cr, px + cr, py + cr], fill=(*rgb, 255))
        elif dot_r >= 0.7:
            draw.ellipse([px, py, px + 1, py + 1], fill=(*rgb, 255))
        else:
            # Sub-pixel: draw with partial alpha
            draw.point((px, py), fill=(*rgb, int(255 * dot_r / 0.7)))

        placed += 1

    print(f"  Placed {placed} stars on canvas")
    img.save(out, "PNG", optimize=True, compress_level=9)
    import os
    kb = os.path.getsize(out) / 1024
    print(f"  Saved → {out}  ({kb:.0f} KB)")

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys, os
    # Run from repo root
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(repo_root)

    stars = fetch_bsc5()
    generate(stars, size=2048, out="frontend/public/starfield.png", mag_limit=5.5)
    print("Done.")
