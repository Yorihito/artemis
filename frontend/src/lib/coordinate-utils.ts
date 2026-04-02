import type { Vector3D } from "@/types/mission";

export type ViewMode = "earth-centered" | "overview";

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Projects a 3D EME2000 position (km) to 2D SVG coordinates.
 * Uses XY-plane projection (ecliptic approximation).
 *
 * Returns { x, y } in SVG pixel coordinates centered on the viewport.
 */
export function projectTo2D(
  pos: Vector3D,
  viewport: Viewport,
  scaleFactor: number // pixels per km
): { x: number; y: number } {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  return {
    x: cx + pos.x * scaleFactor,
    y: cy - pos.y * scaleFactor, // SVG Y is inverted
  };
}

/**
 * Compute auto scale so that Earth and Moon both fit in viewport.
 * earthMoonDistKm is used as the reference distance.
 */
export function computeAutoScale(
  earthMoonDistKm: number,
  viewport: Viewport,
  margin = 0.15
): number {
  const minDim = Math.min(viewport.width, viewport.height);
  return (minDim * (1 - margin * 2)) / (earthMoonDistKm * 2);
}

/**
 * Approximate Moon position in EME2000 (km) at given time.
 * Simplified circular orbit, same formula as backend.
 */
export function moonPositionAt(date: Date): Vector3D {
  const epoch = new Date("2000-01-01T12:00:00Z");
  const dtSeconds = (date.getTime() - epoch.getTime()) / 1000;
  const moonPeriod = 27.3217 * 86400;
  const angle = (2 * Math.PI * dtSeconds) / moonPeriod;
  const R = 384_400; // km
  const inc = (5.1 * Math.PI) / 180;
  return {
    x: R * Math.cos(angle),
    y: R * Math.sin(angle) * Math.cos(inc),
    z: R * Math.sin(angle) * Math.sin(inc),
  };
}
