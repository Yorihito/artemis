#!/usr/bin/env python3
"""
Generate a starfield PNG from Hipparcos catalogue via Vizier.

Projection: Azimuthal equidistant from the north ecliptic pole,
with a 30° total field of view (matching typical screen viewing angle).

The ecliptic north pole (RA=270°, Dec=66.56°) is at canvas centre;
the 15° circle maps to the canvas edge.

Output: frontend/public/starfield.png  (2048x2048, RGBA)
"""

import math
import requests
from PIL import Image, ImageDraw

# ── Constants ─────────────────────────────────────────────────────────────────

FOV_DEG   = 30.0   # total field of view (degrees)
MAG_LIMIT = 9.0    # faintest magnitude to include

_EPS = math.radians(23.4393)   # obliquity of ecliptic J2000

# Equatorial coords of the ecliptic north pole (J2000)
_POLE_RA  = 270.0    # degrees
_POLE_DEC =  66.5607 # degrees

# ── Fetch from Hipparcos (Vizier I/239/hip_main) ──────────────────────────────

def fetch_hipparcos(fov_deg=FOV_DEG, mag_limit=MAG_LIMIT):
    half_fov_arcmin = int(fov_deg / 2 * 60) + 1   # +1 for margin
    print(f"Fetching Hipparcos within {fov_deg/2:.0f}° of ecliptic N pole "
          f"(mag < {mag_limit}) …")
    url = (
        "https://vizier.cds.unistra.fr/viz-bin/asu-tsv"
        "?-source=I/239/hip_main"
        "&-out=RAICRS,DEICRS,Vmag,B-V"
        f"&-c.ra={_POLE_RA}&-c.dec={_POLE_DEC}"
        f"&-c.rm={half_fov_arcmin}"
        f"&Vmag=%3C{mag_limit}"
        "&-out.max=5000"
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
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        try:
            ra  = float(parts[0])
            dec = float(parts[1])
            mag = float(parts[2])
            bv  = float(parts[3]) if len(parts) > 3 and parts[3].strip() else 0.6
            stars.append((ra, dec, mag, bv))
        except (ValueError, IndexError):
            continue

    print(f"  {len(stars)} stars loaded")
    return stars

# ── Coordinate transform ──────────────────────────────────────────────────────

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

def generate(stars, size=2048, out="frontend/public/starfield.png",
             fov_deg=FOV_DEG):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    cx = cy = size // 2

    # Azimuthal equidistant from ecliptic N pole.
    # The half-FOV angle maps to the canvas radius (size/2).
    # scale = (size/2) / radians(fov_deg/2)
    half_fov_rad = math.radians(fov_deg / 2)
    scale = (size / 2) / half_fov_rad

    placed = 0
    for ra, dec, mag, bv in stars:
        lam, beta = to_ecliptic(ra, dec)

        # Angular distance from ecliptic N pole
        r = (math.pi / 2 - beta) * scale

        x = cx + r * math.cos(lam)
        y = cy - r * math.sin(lam)   # screen Y inverted

        px, py = int(round(x)), int(round(y))
        if not (0 <= px < size and 0 <= py < size):
            continue

        rgb = bv_to_rgb(bv)

        # Dot radius: mag 1 → 3px, mag 6 → 1px, mag 9 → 0.4px
        dot_r = max(0.4, 3.2 - mag * 0.32)

        if dot_r >= 1.2:
            glow_steps = int(dot_r * 3)
            for s in range(glow_steps, 0, -1):
                frac   = s / glow_steps
                radius = int(dot_r * (1 + frac * 1.8))
                alpha  = int(200 * frac ** 2.5)
                box = [px - radius, py - radius, px + radius, py + radius]
                draw.ellipse(box, fill=(*rgb, alpha))
            cr = max(1, int(dot_r * 0.6))
            draw.ellipse([px - cr, py - cr, px + cr, py + cr], fill=(*rgb, 255))
        elif dot_r >= 0.7:
            draw.ellipse([px, py, px + 1, py + 1], fill=(*rgb, 255))
        else:
            draw.point((px, py), fill=(*rgb, int(255 * dot_r / 0.7)))

        placed += 1

    print(f"  Placed {placed} stars on canvas")
    img.save(out, "PNG", optimize=True, compress_level=9)
    import os
    kb = os.path.getsize(out) / 1024
    print(f"  Saved → {out}  ({kb:.0f} KB)")

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(repo_root)

    stars = fetch_hipparcos(fov_deg=FOV_DEG, mag_limit=MAG_LIMIT)
    generate(stars, size=2048, out="frontend/public/starfield.png", fov_deg=FOV_DEG)
    print("Done.")
