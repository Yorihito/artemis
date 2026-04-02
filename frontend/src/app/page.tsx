"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { MissionHeader } from "@/components/layout/MissionHeader";
import { TelemetryGrid } from "@/components/telemetry/TelemetryGrid";
import { TimelinePanel } from "@/components/timeline/TimelinePanel";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ApproachAlert } from "@/components/common/ApproachAlert";
import { RefreshIntervalSelector } from "@/components/common/RefreshIntervalSelector";
import { EventLogPanel, type LogEntry } from "@/components/common/EventLogPanel";
import { VisitorCounter } from "@/components/common/VisitorCounter";
import { useMissionCurrent } from "@/hooks/useMissionCurrent";
import { useTrajectory } from "@/hooks/useTrajectory";
import { useMissionEvents } from "@/hooks/useMissionEvents";
import {
  DEFAULT_REFRESH_INTERVAL_MS,
  APPROACH_REFRESH_INTERVAL_MS,
} from "@/constants/mission-config";
import { apiPost } from "@/lib/api-client";

const OrbitCanvas2D = dynamic(
  () => import("@/components/orbit/OrbitCanvas2D").then((m) => m.OrbitCanvas2D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-square rounded-xl border border-slate-800 bg-[#050d1a]
                      flex items-center justify-center text-slate-600 text-sm font-mono tracking-widest">
        INITIALIZING...
      </div>
    ),
  }
);

let logIdCounter = 0;

export default function DashboardPage() {
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL_MS);
  const [showApproachAlert, setShowApproachAlert] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [trajectoryRange, setTrajectoryRange] = useState<"off" | "10m" | "1h" | "mission">("mission");
  const prevPhaseRef = useRef<string | null>(null);
  const prevApproachingRef = useRef<boolean>(false);

  const { data, isError, refresh } = useMissionCurrent(refreshInterval);
  const { data: trajectoryData } = useTrajectory(trajectoryRange === "off" ? "mission" : trajectoryRange);
  const { data: eventsData } = useMissionEvents();

  const addLog = useCallback((message: string, level: "info" | "warn" | "error" = "info") => {
    setLogs((prev) => [
      { id: String(logIdCounter++), timestamp: new Date(), message, level },
      ...prev.slice(0, 29),
    ]);
  }, []);

  useEffect(() => {
    if (!data) return;
    if (prevPhaseRef.current !== null && prevPhaseRef.current !== data.phase) {
      addLog(`Phase: ${prevPhaseRef.current} → ${data.phase_label}`, "info");
    }
    prevPhaseRef.current = data.phase;
    if (!prevApproachingRef.current && data.is_approaching) {
      setShowApproachAlert(true);
      addLog(`Approaching ${data.approach_type === "moon" ? "Moon" : "Earth"}!`, "warn");
    }
    prevApproachingRef.current = data.is_approaching;
  }, [data, addLog]);

  useEffect(() => {
    if (data) addLog(`[${data.source}] Updated`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.last_success_at]);

  useEffect(() => {
    if (isError) addLog("Data fetch failed", "error");
  }, [isError, addLog]);

  const handleSetInterval = (ms: number) => {
    setRefreshInterval(ms);
    addLog(`Interval → ${ms === 0 ? "manual" : `${ms / 1000}s`}`);
  };

  const handleManualRefresh = async () => {
    try {
      await apiPost("/api/mission/poll-now");
      await refresh();
      addLog("Manual refresh OK");
    } catch {
      addLog("Manual refresh failed", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col text-slate-200">
      <MissionHeader data={data} isError={isError} />

      {/* Alert banners */}
      {isError && (
        <ErrorBanner
          lastSuccessAt={data?.last_success_at ?? null}
          onRetry={async () => { await refresh(); }}
        />
      )}
      {showApproachAlert && data?.is_approaching && data.approach_type && (
        <ApproachAlert
          approachType={data.approach_type}
          onSelectInterval={handleSetInterval}
          onDismiss={() => setShowApproachAlert(false)}
        />
      )}

      {/* Main layout: orbit left | data right */}
      <main className="flex-1 mx-auto w-full max-w-[1600px] px-3 py-3
                       grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3 items-start">

        {/* ── Left: square orbit canvas ── */}
        <OrbitCanvas2D
          current={data}
          trajectory={trajectoryRange === "off" ? [] : (trajectoryData?.points ?? [])}
          trajectoryRange={trajectoryRange}
          onTrajectoryRangeChange={setTrajectoryRange}
        />

        {/* ── Right: data panel ── */}
        <div className="flex flex-col gap-3">

          {/* Telemetry cards */}
          <TelemetryGrid data={data} />

          {/* Mission timeline */}
          {eventsData && <TimelinePanel events={eventsData.events} />}

          {/* Refresh controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <RefreshIntervalSelector
              current={refreshInterval}
              isApproaching={data?.is_approaching ?? false}
              onChange={handleSetInterval}
              onManualRefresh={handleManualRefresh}
            />
          </div>

          {/* Event log */}
          <EventLogPanel entries={logs} />
        </div>
      </main>

      <footer className="border-t border-slate-900 font-mono">
        <VisitorCounter />
        <p className="text-center text-[10px] text-slate-800 pb-2">
          DATA: JPL HORIZONS / NASA AROW · NOT OFFICIAL NASA DATA
        </p>
      </footer>
    </div>
  );
}
