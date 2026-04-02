"use client";
import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { MissionCurrentResponse, TrajectoryPoint } from "@/types/mission";
import { moonPositionAt } from "@/lib/coordinate-utils";

type TrajectoryRange = "off" | "10m" | "1h" | "mission";

interface Props {
  current: MissionCurrentResponse | undefined;
  trajectory: TrajectoryPoint[];
  trajectoryRange: TrajectoryRange;
  onTrajectoryRangeChange: (range: TrajectoryRange) => void;
}

const TRAJECTORY_OPTIONS: { label: string; value: TrajectoryRange }[] = [
  { label: "OFF",   value: "off" },
  { label: "10分",  value: "10m" },
  { label: "1時間", value: "1h" },
  { label: "全軌跡", value: "mission" },
];

const EARTH_MOON_KM = 384_400;

export function OrbitCanvas2D({ current, trajectory, trajectoryRange, onTrajectoryRangeChange }: Props) {
  const svgRef      = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const size = container.clientWidth || 500;     // square: w == h
    const w = size, h = size;

    const svg = d3.select(svgRef.current);
    svg.attr("width", w).attr("height", h);
    svg.selectAll("*").remove();

    // ── defs ────────────────────────────────────────────────────────────
    const defs = svg.append("defs");

    // Arrowhead marker
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("markerWidth", 7).attr("markerHeight", 7)
      .attr("refX", 6).attr("refY", 3.5)
      .attr("orient", "auto")
      .append("polygon")
      .attr("points", "0 0, 7 3.5, 0 7")
      .attr("fill", "#f97316");

    // Radial gradient for Earth
    const earthGrad = defs.append("radialGradient").attr("id", "earthGrad");
    earthGrad.append("stop").attr("offset", "0%").attr("stop-color", "#60a5fa");
    earthGrad.append("stop").attr("offset", "100%").attr("stop-color", "#1e3a8a");

    // Radial gradient for Moon
    const moonGrad = defs.append("radialGradient").attr("id", "moonGrad");
    moonGrad.append("stop").attr("offset", "0%").attr("stop-color", "#94a3b8");
    moonGrad.append("stop").attr("offset", "100%").attr("stop-color", "#334155");

    // Pulse animation
    defs.append("style").text(`
      @keyframes orion-pulse {
        0%   { r: 5;  opacity: 0.8; }
        100% { r: 18; opacity: 0;   }
      }
      .orion-pulse { animation: orion-pulse 2s ease-out infinite; }
    `);

    // ── coordinate helpers ───────────────────────────────────────────────
    const cx = w / 2, cy = h / 2;
    const margin = 40;
    const scale = (Math.min(w, h) / 2 - margin) / EARTH_MOON_KM;

    function toSVG(x: number, y: number): [number, number] {
      return [cx + x * scale, cy - y * scale];
    }

    // ── background: stars ────────────────────────────────────────────────
    const rng = d3.randomLcg(42);          // deterministic seed
    const rand = () => rng();
    for (let i = 0; i < 200; i++) {
      svg.append("circle")
        .attr("cx", rand() * w)
        .attr("cy", rand() * h)
        .attr("r",  rand() * 1.4 + 0.2)
        .attr("fill", "white")
        .attr("opacity", rand() * 0.55 + 0.15);
    }

    // ── zoomable group ───────────────────────────────────────────────────
    const g = svg.append("g").attr("class", "zoomable");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 30])
      .on("zoom", (e) => g.attr("transform", e.transform.toString()));
    svg.call(zoom);
    svg.on("dblclick.zoom", () =>
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity));

    // ── radar grid ──────────────────────────────────────────────────────
    const gridDistances = [100_000, 200_000, 300_000, EARTH_MOON_KM];
    gridDistances.forEach((km) => {
      g.append("circle")
        .attr("cx", cx).attr("cy", cy)
        .attr("r", km * scale)
        .attr("fill", "none")
        .attr("stroke", km === EARTH_MOON_KM ? "#1e3a5f" : "#1e293b")
        .attr("stroke-width", km === EARTH_MOON_KM ? 0.8 : 0.5)
        .attr("stroke-dasharray", "3 8");
    });
    // Radial lines (4 axes)
    [0, 45, 90, 135].forEach((deg) => {
      const r = (deg * Math.PI) / 180;
      const len = EARTH_MOON_KM * scale * 1.05;
      g.append("line")
        .attr("x1", cx - Math.cos(r) * len).attr("y1", cy - Math.sin(r) * len)
        .attr("x2", cx + Math.cos(r) * len).attr("y2", cy + Math.sin(r) * len)
        .attr("stroke", "#1e293b").attr("stroke-width", 0.4);
    });
    // Grid distance labels
    [100_000, 200_000, 300_000].forEach((km) => {
      g.append("text")
        .attr("x", cx + km * scale + 4)
        .attr("y", cy - 3)
        .attr("fill", "#334155")
        .attr("font-size", 8)
        .attr("font-family", "monospace")
        .text(`${km / 1000}k km`);
    });

    // ── Moon orbit ring ──────────────────────────────────────────────────
    g.append("circle")
      .attr("cx", cx).attr("cy", cy)
      .attr("r", EARTH_MOON_KM * scale)
      .attr("fill", "none")
      .attr("stroke", "#334155")
      .attr("stroke-width", 0.8)
      .attr("stroke-dasharray", "6 8");

    // ── trajectory ───────────────────────────────────────────────────────
    if (trajectory.length > 1) {
      // Draw segments with fading opacity (older = dimmer)
      const n = trajectory.length;
      for (let i = 1; i < n; i++) {
        const alpha = 0.15 + 0.75 * (i / n);   // 0.15 → 0.9
        const p0 = trajectory[i - 1];
        const p1 = trajectory[i];
        g.append("line")
          .attr("x1", toSVG(p0.x, p0.y)[0]).attr("y1", toSVG(p0.x, p0.y)[1])
          .attr("x2", toSVG(p1.x, p1.y)[0]).attr("y2", toSVG(p1.x, p1.y)[1])
          .attr("stroke", "#06b6d4")
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", alpha)
          .attr("stroke-linecap", "round");
      }
    }

    // ── Earth ────────────────────────────────────────────────────────────
    const EARTH_R = 14;
    g.append("circle")
      .attr("cx", cx).attr("cy", cy)
      .attr("r", EARTH_R + 6)
      .attr("fill", "none")
      .attr("stroke", "#1d4ed8")
      .attr("stroke-width", 0.6)
      .attr("stroke-opacity", 0.3);
    g.append("circle")
      .attr("cx", cx).attr("cy", cy)
      .attr("r", EARTH_R)
      .attr("fill", "url(#earthGrad)")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 1);
    g.append("text")
      .attr("x", cx).attr("y", cy + EARTH_R + 13)
      .attr("text-anchor", "middle")
      .attr("fill", "#60a5fa")
      .attr("font-size", 10)
      .attr("font-family", "monospace")
      .attr("letter-spacing", 1)
      .text("EARTH");

    // ── Moon ─────────────────────────────────────────────────────────────
    const moonKm = current
      ? moonPositionAt(new Date(current.timestamp))
      : moonPositionAt(new Date());
    const [msx, msy] = toSVG(moonKm.x, moonKm.y);
    const MOON_R = 8;

    g.append("circle")
      .attr("cx", msx).attr("cy", msy)
      .attr("r", MOON_R + 4)
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.3);
    g.append("circle")
      .attr("cx", msx).attr("cy", msy)
      .attr("r", MOON_R)
      .attr("fill", "url(#moonGrad)")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 0.8);
    g.append("text")
      .attr("x", msx).attr("y", msy + MOON_R + 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", 10)
      .attr("font-family", "monospace")
      .attr("letter-spacing", 1)
      .text("MOON");

    // ── Spacecraft ───────────────────────────────────────────────────────
    if (current) {
      const [sx, sy] = toSVG(current.position.x, current.position.y);

      // Direction away from Earth center
      const dx = sx - cx, dy = sy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist, uy = dy / dist;

      const CALLOUT = 56;
      const lx = sx + ux * CALLOUT;
      const ly = sy + uy * CALLOUT;
      const tx = sx + ux * 6;
      const ty = sy + uy * 6;

      // Callout line → arrowhead at spacecraft
      g.append("line")
        .attr("x1", lx).attr("y1", ly)
        .attr("x2", tx).attr("y2", ty)
        .attr("stroke", "#f97316")
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)");

      // Pulsing ring
      g.append("circle").attr("class", "orion-pulse")
        .attr("cx", sx).attr("cy", sy)
        .attr("r", 5)
        .attr("fill", "none")
        .attr("stroke", "#f97316")
        .attr("stroke-width", 1.5);

      // Center dot
      g.append("circle")
        .attr("cx", sx).attr("cy", sy)
        .attr("r", 4)
        .attr("fill", "#fff")
        .attr("stroke", "#f97316")
        .attr("stroke-width", 1.5);

      // Label box at callout anchor
      const LW = 52, LH = 15;
      g.append("rect")
        .attr("x", lx - LW / 2).attr("y", ly - LH / 2)
        .attr("width", LW).attr("height", LH)
        .attr("fill", "#0c1220")
        .attr("fill-opacity", 0.92)
        .attr("stroke", "#f97316")
        .attr("stroke-width", 0.8)
        .attr("rx", 3);
      g.append("text")
        .attr("x", lx).attr("y", ly + 5)
        .attr("text-anchor", "middle")
        .attr("fill", "#f97316")
        .attr("font-size", 10)
        .attr("font-weight", "bold")
        .attr("font-family", "monospace")
        .attr("letter-spacing", 1)
        .text("ORION");
    } else {
      g.append("text")
        .attr("x", cx).attr("y", cy - 50)
        .attr("text-anchor", "middle")
        .attr("fill", "#334155")
        .attr("font-size", 11)
        .attr("font-family", "monospace")
        .text("AWAITING POSITION DATA");
    }

    // ── scale bar (fixed, not in zoomable group) ─────────────────────────
    const BAR_KM = 50_000;
    const BAR_PX = BAR_KM * scale;
    const bx = 14, by = h - 14;
    svg.append("line")
      .attr("x1", bx).attr("y1", by)
      .attr("x2", bx + BAR_PX).attr("y2", by)
      .attr("stroke", "#475569").attr("stroke-width", 1.5);
    svg.append("line")
      .attr("x1", bx).attr("y1", by - 4)
      .attr("x2", bx).attr("y2", by + 4)
      .attr("stroke", "#475569").attr("stroke-width", 1.5);
    svg.append("line")
      .attr("x1", bx + BAR_PX).attr("y1", by - 4)
      .attr("x2", bx + BAR_PX).attr("y2", by + 4)
      .attr("stroke", "#475569").attr("stroke-width", 1.5);
    svg.append("text")
      .attr("x", bx + BAR_PX / 2).attr("y", by - 6)
      .attr("text-anchor", "middle")
      .attr("fill", "#475569")
      .attr("font-size", 9)
      .attr("font-family", "monospace")
      .text("50,000 km");

  }, [current, trajectory]);

  // Redraw on data change
  useEffect(() => { draw(); }, [draw]);

  // Redraw on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div className="relative flex flex-col">
      {/* Square canvas container */}
      <div
        ref={containerRef}
        className="relative w-full aspect-square rounded-xl border border-slate-800 bg-[#050d1a] overflow-hidden
                   shadow-[0_0_40px_rgba(6,182,212,0.06)] ring-1 ring-slate-800"
      >
        {!current && (
          <div className="absolute inset-0 flex items-center justify-center
                          text-slate-600 text-sm pointer-events-none font-mono tracking-widest">
            INITIALIZING...
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full" />

        {/* Trajectory selector — top-left overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5
                        bg-[#050d1a]/90 backdrop-blur-sm px-2.5 py-1.5
                        rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 font-mono tracking-widest mr-1">TRAJ</span>
          {TRAJECTORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onTrajectoryRangeChange(opt.value)}
              className={`text-[10px] px-2 py-0.5 rounded font-mono transition border ${
                trajectoryRange === opt.value
                  ? "bg-cyan-900/60 border-cyan-600 text-cyan-300"
                  : "bg-transparent border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {trajectoryRange !== "off" && trajectory.length > 0 && (
            <span className="text-[10px] text-slate-600 font-mono ml-1">
              {trajectory.length}pt
            </span>
          )}
        </div>

        {/* Zoom hint — bottom-right */}
        <div className="absolute bottom-2 right-3 text-[10px] text-slate-700 font-mono pointer-events-none">
          scroll:zoom · dblclick:reset
        </div>
      </div>
    </div>
  );
}
