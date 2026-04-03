"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";
import type { MissionCurrentResponse, TrajectoryPoint } from "@/types/mission";
import { moonPositionAt } from "@/lib/coordinate-utils";

type TrajectoryRange = "off" | "1h" | "2h" | "8h" | "mission";
type ApproachMode = "moon" | "earth" | null;

interface Props {
  current: MissionCurrentResponse | undefined;
  trajectory: TrajectoryPoint[];
  trajectoryRange: TrajectoryRange;
  onTrajectoryRangeChange: (range: TrajectoryRange) => void;
}

const TRAJECTORY_OPTIONS: { label: string; value: TrajectoryRange }[] = [
  { label: "OFF",  value: "off" },
  { label: "1h",   value: "1h" },
  { label: "2h",   value: "2h" },
  { label: "8h",   value: "8h" },
  { label: "Full", value: "mission" },
];

const SAT_DEFS = [
  { id: "himawari", label: "Himawari", longDeg:  140.7, color: "#fbbf24" },
  { id: "goesE",    label: "GOES-E",   longDeg:  -75.2, color: "#34d399" },
  { id: "goesW",    label: "GOES-W",   longDeg: -137.0, color: "#34d399" },
] as const;

type SatId = typeof SAT_DEFS[number]["id"];

const EARTH_MOON_KM = 384_400;
const GEO_R_KM      = 42_164;
const EARTH_R_KM    = 6_371;
const MOON_R_KM     = 1_737;

// View extents for each mode (km from center to edge)
const VIEW_RADIUS: Record<NonNullable<ApproachMode> | "normal", number> = {
  moon:   120_000,
  earth:   60_000,
  normal: EARTH_MOON_KM,
};

const APPROACH_GRID: Record<NonNullable<ApproachMode>, number[]> = {
  moon:  [10_000, 30_000, 50_000, 100_000],
  earth: [ 5_000, 10_000, 20_000,  50_000],
};

function fmtKm(km: number): string {
  return km >= 1_000 ? `${km / 1_000}k km` : `${km} km`;
}

function getGAST(date: Date): number {
  const J2000_MS = new Date("2000-01-01T12:00:00Z").getTime();
  const T = (date.getTime() - J2000_MS) / (1000 * 86400 * 36525);
  return ((100.4606184 + 36000.77004 * T) % 360 + 360) % 360;
}

export function OrbitCanvas2D({ current, trajectory, trajectoryRange, onTrajectoryRangeChange }: Props) {
  const svgRef        = useRef<SVGSVGElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const prevModeRef   = useRef<string>("normal");
  const [manualApproach, setManualApproach] = useState<ApproachMode>(null);

  const [showSats, setShowSats] = useState<Record<SatId, boolean>>(() => {
    if (typeof window === "undefined") return { himawari: false, goesE: false, goesW: false };
    try {
      const s = localStorage.getItem("artemis_sats");
      return s ? JSON.parse(s) : { himawari: false, goesE: false, goesW: false };
    } catch { return { himawari: false, goesE: false, goesW: false }; }
  });

  useEffect(() => {
    localStorage.setItem("artemis_sats", JSON.stringify(showSats));
  }, [showSats]);

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const size = containerRef.current.clientWidth || 500;
    const w = size, h = size;

    const svg = d3.select(svgRef.current);
    svg.attr("width", w).attr("height", h);
    svg.selectAll("*").remove();

    // ── Moon position (needed early for approach-mode centering) ─────────
    const moonKm = current?.moon_position
      ?? (current ? moonPositionAt(new Date(current.timestamp)) : moonPositionAt(new Date()));

    // ── Approach mode & view parameters ─────────────────────────────────
    const autoApproachDraw: ApproachMode =
      current?.is_approaching && current.approach_type
        ? (current.approach_type as ApproachMode)
        : null;
    const approaching: ApproachMode = manualApproach ?? autoApproachDraw;

    const viewRadius = VIEW_RADIUS[approaching ?? "normal"];
    const viewMargin = approaching ? 20 : 40;
    const scale      = (Math.min(w, h) / 2 - viewMargin) / viewRadius;

    // View center in world coords (Earth or Moon position)
    const vcx = approaching === "moon" ? moonKm.x : 0;
    const vcy = approaching === "moon" ? moonKm.y : 0;

    const ccx = w / 2, ccy = h / 2;  // canvas center (SVG pixels)

    function toSVG(x: number, y: number): [number, number] {
      return [ccx + (x - vcx) * scale, ccy - (y - vcy) * scale];
    }

    // Body radii: to-scale in approach mode, symbolic otherwise
    const earthR = approaching ? Math.max(EARTH_R_KM * scale, 3) : 14;
    const moonR  = approaching ? Math.max(MOON_R_KM  * scale, 2) : 8;

    // Marker sizes
    const orionDotR     = approaching ? 3   : 4;
    const orionPulseMax = approaching ? 8   : 18;
    const satS          = approaching ? 2   : 3.5;
    const calloutLen    = approaching ? 32  : 56;

    // ── defs ────────────────────────────────────────────────────────────
    const defs = svg.append("defs");

    defs.append("marker").attr("id", "arrowhead")
      .attr("markerWidth", 7).attr("markerHeight", 7)
      .attr("refX", 6).attr("refY", 3.5).attr("orient", "auto")
      .append("polygon").attr("points", "0 0, 7 3.5, 0 7").attr("fill", "#f97316");

    defs.append("marker").attr("id", "moonArrow")
      .attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("refX", 5).attr("refY", 3).attr("orient", "auto")
      .append("polygon").attr("points", "0 0, 6 3, 0 6").attr("fill", "#94a3b8");

    const earthGrad = defs.append("radialGradient").attr("id", "earthGrad");
    earthGrad.append("stop").attr("offset", "0%").attr("stop-color", "#60a5fa");
    earthGrad.append("stop").attr("offset", "100%").attr("stop-color", "#1e3a8a");

    const moonGrad = defs.append("radialGradient").attr("id", "moonGrad");
    moonGrad.append("stop").attr("offset", "0%").attr("stop-color", "#94a3b8");
    moonGrad.append("stop").attr("offset", "100%").attr("stop-color", "#334155");

    defs.append("style").text(`
      @keyframes orion-pulse {
        0%   { r: ${orionDotR + 1};  opacity: 0.8; }
        100% { r: ${orionPulseMax};  opacity: 0;   }
      }
      .orion-pulse { animation: orion-pulse 2s ease-out infinite; }
    `);

    // ── background: real stars (BSC5 PNG, fixed — not affected by zoom) ──
    svg.append("image")
      .attr("href", "/starfield.png")
      .attr("x", 0).attr("y", 0)
      .attr("width", w).attr("height", h)
      .attr("preserveAspectRatio", "xMidYMid slice")
      .attr("opacity", 0.85);

    // ── zoomable group + zoom ────────────────────────────────────────────
    const g = svg.append("g").attr("class", "zoomable");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 30])
      .on("zoom", (e) => g.attr("transform", e.transform.toString()));
    svg.call(zoom);
    svg.on("dblclick.zoom", () =>
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity));

    // Reset zoom when approach mode changes
    const modeKey = approaching ?? "normal";
    if (prevModeRef.current !== modeKey) {
      svg.call(zoom.transform, d3.zoomIdentity);
      prevModeRef.current = modeKey;
    }

    // ── grid ─────────────────────────────────────────────────────────────
    if (approaching) {
      APPROACH_GRID[approaching].forEach((km) => {
        g.append("circle")
          .attr("cx", ccx).attr("cy", ccy).attr("r", km * scale)
          .attr("fill", "none").attr("stroke", "#1e293b")
          .attr("stroke-width", 0.5).attr("stroke-dasharray", "3 8");
        g.append("text")
          .attr("x", ccx + km * scale + 3).attr("y", ccy - 3)
          .attr("fill", "#334155").attr("font-size", 8).attr("font-family", "monospace")
          .text(fmtKm(km));
      });
    } else {
      [100_000, 200_000, 300_000, EARTH_MOON_KM].forEach((km) => {
        g.append("circle")
          .attr("cx", ccx).attr("cy", ccy).attr("r", km * scale)
          .attr("fill", "none")
          .attr("stroke", km === EARTH_MOON_KM ? "#1e3a5f" : "#1e293b")
          .attr("stroke-width", km === EARTH_MOON_KM ? 0.8 : 0.5)
          .attr("stroke-dasharray", "3 8");
      });
      [0, 45, 90, 135].forEach((deg) => {
        const r = (deg * Math.PI) / 180;
        const len = EARTH_MOON_KM * scale * 1.05;
        g.append("line")
          .attr("x1", ccx - Math.cos(r) * len).attr("y1", ccy - Math.sin(r) * len)
          .attr("x2", ccx + Math.cos(r) * len).attr("y2", ccy + Math.sin(r) * len)
          .attr("stroke", "#1e293b").attr("stroke-width", 0.4);
      });
      [100_000, 200_000, 300_000].forEach((km) => {
        g.append("text")
          .attr("x", ccx + km * scale + 4).attr("y", ccy - 3)
          .attr("fill", "#334155").attr("font-size", 8).attr("font-family", "monospace")
          .text(`${km / 1000}k km`);
      });
    }

    // ── trajectory ───────────────────────────────────────────────────────
    if (trajectory.length > 1) {
      const n = trajectory.length;
      for (let i = 1; i < n; i++) {
        const alpha = 0.15 + 0.75 * (i / n);
        const p0 = trajectory[i - 1], p1 = trajectory[i];
        g.append("line")
          .attr("x1", toSVG(p0.x, p0.y)[0]).attr("y1", toSVG(p0.x, p0.y)[1])
          .attr("x2", toSVG(p1.x, p1.y)[0]).attr("y2", toSVG(p1.x, p1.y)[1])
          .attr("stroke", "#06b6d4").attr("stroke-width", 1.5)
          .attr("stroke-opacity", alpha).attr("stroke-linecap", "round");
      }
    }

    // ── Earth ────────────────────────────────────────────────────────────
    const [esx, esy] = toSVG(0, 0);
    if (!approaching) {
      g.append("circle")
        .attr("cx", esx).attr("cy", esy).attr("r", earthR + 6)
        .attr("fill", "none").attr("stroke", "#1d4ed8")
        .attr("stroke-width", 0.6).attr("stroke-opacity", 0.3);
    }
    g.append("circle")
      .attr("cx", esx).attr("cy", esy).attr("r", earthR)
      .attr("fill", "url(#earthGrad)").attr("stroke", "#60a5fa")
      .attr("stroke-width", approaching ? 0.8 : 1);
    g.append("text")
      .attr("x", esx).attr("y", esy + earthR + (approaching ? 8 : 13))
      .attr("text-anchor", "middle").attr("fill", "#60a5fa")
      .attr("font-size", 10).attr("font-family", "monospace").attr("letter-spacing", 1)
      .text("EARTH");

    // ── Geostationary satellites ─────────────────────────────────────────
    const satTimestamp = current ? new Date(current.timestamp) : new Date();
    const gast = getGAST(satTimestamp);
    SAT_DEFS.forEach((sat) => {
      if (!showSats[sat.id]) return;
      const angle = ((sat.longDeg + gast) * Math.PI) / 180;
      const [ssx, ssy] = toSVG(GEO_R_KM * Math.cos(angle), GEO_R_KM * Math.sin(angle));
      const S = satS;
      g.append("polygon")
        .attr("points", `${ssx},${ssy - S} ${ssx + S},${ssy} ${ssx},${ssy + S} ${ssx - S},${ssy}`)
        .attr("fill", sat.color).attr("opacity", 0.9);
      g.append("text")
        .attr("x", ssx + S + 3).attr("y", ssy + 3)
        .attr("fill", sat.color).attr("font-size", 7).attr("font-family", "monospace")
        .text(sat.label);
    });

    // ── Moon ─────────────────────────────────────────────────────────────
    const [msx, msy] = toSVG(moonKm.x, moonKm.y);
    if (!approaching) {
      g.append("circle")
        .attr("cx", msx).attr("cy", msy).attr("r", moonR + 4)
        .attr("fill", "none").attr("stroke", "#94a3b8")
        .attr("stroke-width", 0.5).attr("stroke-opacity", 0.3);
    }
    g.append("circle")
      .attr("cx", msx).attr("cy", msy).attr("r", moonR)
      .attr("fill", "url(#moonGrad)").attr("stroke", "#94a3b8")
      .attr("stroke-width", approaching ? 0.8 : 0.8);
    g.append("text")
      .attr("x", msx).attr("y", msy + moonR + (approaching ? 8 : 12))
      .attr("text-anchor", "middle").attr("fill", "#94a3b8")
      .attr("font-size", 10).attr("font-family", "monospace").attr("letter-spacing", 1)
      .text("MOON");

    // ── Moon velocity direction arrow ─────────────────────────────────────
    if (!approaching) {
      const moonR2D = Math.sqrt(moonKm.x * moonKm.x + moonKm.y * moonKm.y);
      if (moonR2D > 0) {
        const tx = -moonKm.y / moonR2D;
        const ty =  moonKm.x / moonR2D;
        const ARROW_PX = 26;
        g.append("line")
          .attr("x1", msx).attr("y1", msy)
          .attr("x2", msx + tx * ARROW_PX).attr("y2", msy - ty * ARROW_PX)
          .attr("stroke", "#64748b").attr("stroke-width", 1.2).attr("stroke-opacity", 0.9)
          .attr("marker-end", "url(#moonArrow)");
      }
    }

    // ── Spacecraft ───────────────────────────────────────────────────────
    if (current) {
      const [sx, sy] = toSVG(current.position.x, current.position.y);
      const dx = sx - ccx, dy = sy - ccy;

      // In approach mode, callout points away from the APPROACH TARGET (canvas center)
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      const lx = sx + ux * calloutLen;
      const ly = sy + uy * calloutLen;

      g.append("line")
        .attr("x1", lx).attr("y1", ly)
        .attr("x2", sx + ux * (orionDotR + 2)).attr("y2", sy + uy * (orionDotR + 2))
        .attr("stroke", "#f97316").attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)");
      g.append("circle").attr("class", "orion-pulse")
        .attr("cx", sx).attr("cy", sy).attr("r", orionDotR + 1)
        .attr("fill", "none").attr("stroke", "#f97316").attr("stroke-width", 1.5);
      g.append("circle")
        .attr("cx", sx).attr("cy", sy).attr("r", orionDotR)
        .attr("fill", "#fff").attr("stroke", "#f97316").attr("stroke-width", 1.5);

      const LW = 52, LH = 15;
      g.append("rect")
        .attr("x", lx - LW / 2).attr("y", ly - LH / 2)
        .attr("width", LW).attr("height", LH)
        .attr("fill", "#0c1220").attr("fill-opacity", 0.92)
        .attr("stroke", "#f97316").attr("stroke-width", 0.8).attr("rx", 3);
      g.append("text")
        .attr("x", lx).attr("y", ly + 5)
        .attr("text-anchor", "middle").attr("fill", "#f97316")
        .attr("font-size", 10).attr("font-weight", "bold")
        .attr("font-family", "monospace").attr("letter-spacing", 1)
        .text("ORION");
    } else {
      g.append("text")
        .attr("x", ccx).attr("y", ccy - 50)
        .attr("text-anchor", "middle").attr("fill", "#334155")
        .attr("font-size", 11).attr("font-family", "monospace")
        .text("AWAITING POSITION DATA");
    }

    // ── Approach mode badge ───────────────────────────────────────────────
    if (approaching) {
      const label = approaching === "moon" ? "CLOSE APPROACH · MOON" : "CLOSE APPROACH · EARTH";
      svg.append("text")
        .attr("x", w / 2).attr("y", h - 26)
        .attr("text-anchor", "middle").attr("fill", "#f97316")
        .attr("font-size", 9).attr("font-family", "monospace")
        .attr("letter-spacing", 2).attr("opacity", 0.7)
        .text(label);
    }

    // ── Scale bar ─────────────────────────────────────────────────────────
    const barKm = approaching === "moon" ? 30_000 : approaching === "earth" ? 20_000 : 50_000;
    const barPx = barKm * scale;
    const bx = 14, by = h - 14;
    svg.append("line")
      .attr("x1", bx).attr("y1", by).attr("x2", bx + barPx).attr("y2", by)
      .attr("stroke", "#475569").attr("stroke-width", 1.5);
    svg.append("line")
      .attr("x1", bx).attr("y1", by - 4).attr("x2", bx).attr("y2", by + 4)
      .attr("stroke", "#475569").attr("stroke-width", 1.5);
    svg.append("line")
      .attr("x1", bx + barPx).attr("y1", by - 4).attr("x2", bx + barPx).attr("y2", by + 4)
      .attr("stroke", "#475569").attr("stroke-width", 1.5);
    svg.append("text")
      .attr("x", bx + barPx / 2).attr("y", by - 6)
      .attr("text-anchor", "middle").attr("fill", "#475569")
      .attr("font-size", 9).attr("font-family", "monospace")
      .text(fmtKm(barKm));

  }, [current, trajectory, showSats, manualApproach]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  const autoApproach: ApproachMode =
    current?.is_approaching && current.approach_type
      ? (current.approach_type as ApproachMode)
      : null;

  // manualApproach overrides auto; null = follow auto
  const approaching: ApproachMode = manualApproach ?? autoApproach;

  const toggleApproach = (mode: NonNullable<ApproachMode>) => {
    setManualApproach((prev) => (prev === mode ? null : mode));
  };

  return (
    <div className="relative flex flex-col">
      <div
        ref={containerRef}
        className="relative w-full aspect-square max-w-[calc(100svh-6rem)] mx-auto xl:mr-0 rounded-xl border border-slate-800 bg-[#050d1a] overflow-hidden
                   shadow-[0_0_40px_rgba(6,182,212,0.06)] ring-1 ring-slate-800"
      >
        {!current && (
          <div className="absolute inset-0 flex items-center justify-center
                          text-slate-600 text-sm pointer-events-none font-mono tracking-widest">
            INITIALIZING...
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full" />

        {/* Controls — top-left, stacked with 2px gap */}
        <div className="absolute top-3 left-3 flex flex-col gap-0.5">
          {/* TRAJ */}
          <div className="flex items-center gap-1.5
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

          {/* SAT */}
          <div className="flex items-center gap-1.5
                          bg-[#050d1a]/90 backdrop-blur-sm px-2.5 py-1.5
                          rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono tracking-widest mr-1">SAT</span>
            {SAT_DEFS.map((sat) => (
              <button
                key={sat.id}
                onClick={() => setShowSats((s) => ({ ...s, [sat.id]: !s[sat.id] }))}
                style={showSats[sat.id] ? { borderColor: sat.color, color: sat.color } : {}}
                className={`text-[10px] px-2 py-0.5 rounded font-mono transition border ${
                  showSats[sat.id]
                    ? "bg-slate-800/60"
                    : "bg-transparent border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                }`}
              >
                {sat.label}
              </button>
            ))}
          </div>

          {/* VIEW mode buttons — always visible, double as approach badge */}
          <div className="flex items-center gap-1.5
                          bg-[#050d1a]/90 backdrop-blur-sm px-2.5 py-1.5
                          rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono tracking-widest mr-1">VIEW</span>
            {(["moon", "earth"] as const).map((mode) => {
              const isActive = approaching === mode;
              const isAuto   = autoApproach === mode && manualApproach === null;
              return (
                <button
                  key={mode}
                  onClick={() => toggleApproach(mode)}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono transition border ${
                    isActive
                      ? "bg-orange-900/60 border-orange-600 text-orange-300"
                      : "bg-transparent border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                  }`}
                >
                  {isAuto ? "⚠ " : ""}{mode === "moon" ? "MOON" : "EARTH"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Zoom hint */}
        <div className="absolute bottom-2 right-3 text-[10px] text-slate-700 font-mono pointer-events-none">
          scroll:zoom · dblclick:reset
        </div>
      </div>
    </div>
  );
}
