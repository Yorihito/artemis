"use client";
import { useState, useEffect } from "react";
import type { MissionCurrentResponse } from "@/types/mission";
import { TelemetryCard } from "./TelemetryCard";
import { formatMET, formatDistance } from "@/lib/time-utils";
import { LAUNCH_EPOCH } from "@/constants/mission-config";

interface Props {
  data: MissionCurrentResponse | undefined;
}

const PH = "———";

function useLiveMET(): string {
  const [met, setMet] = useState(() =>
    formatMET((Date.now() - LAUNCH_EPOCH.getTime()) / 1000)
  );
  useEffect(() => {
    const id = setInterval(() => {
      setMet(formatMET((Date.now() - LAUNCH_EPOCH.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return met;
}

export function TelemetryGrid({ data }: Props) {
  const liveMET = useLiveMET();

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-3 space-y-2">
      <div className="text-[9px] font-mono text-slate-600 uppercase tracking-[0.2em] mb-1">
        Telemetry
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TelemetryCard
          label="Mission Elapsed"
          value={liveMET}
        />
        <TelemetryCard
          label="Velocity"
          value={data ? data.relative_velocity_kms.toFixed(3) : PH}
          unit="km/s"
        />
        <TelemetryCard
          label="Earth Distance"
          value={data ? formatDistance(data.distance_from_earth_km) : PH}
          highlight={data?.approach_type === "earth"}
          accent="orange"
        />
        <TelemetryCard
          label="Moon Distance"
          value={data ? formatDistance(data.distance_from_moon_km) : PH}
          highlight={data?.approach_type === "moon"}
          accent="orange"
        />
        <TelemetryCard
          label="Phase"
          value={data ? data.phase_label : PH}
        />
        <TelemetryCard
          label="Source"
          value={data ? data.source : PH}
          sub={data?.is_approaching ? "⚠ APPROACHING" : undefined}
        />
      </div>
    </div>
  );
}
