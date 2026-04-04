"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { MissionHeader } from "@/components/layout/MissionHeader";
import { TelemetryGrid } from "@/components/telemetry/TelemetryGrid";
import { TimelinePanel } from "@/components/timeline/TimelinePanel";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { ApproachAlert } from "@/components/common/ApproachAlert";
import { RefreshIntervalSelector } from "@/components/common/RefreshIntervalSelector";
import { VisitorCounter } from "@/components/common/VisitorCounter";
import { DSNPanel } from "@/components/dsn/DSNPanel";
import { NewsPanel } from "@/components/news/NewsPanel";
import { useMissionCurrent } from "@/hooks/useMissionCurrent";
import { useTrajectory } from "@/hooks/useTrajectory";
import { useMissionEvents } from "@/hooks/useMissionEvents";
import { useDSN } from "@/hooks/useDSN";
import { useNews } from "@/hooks/useNews";
import {
  DEFAULT_REFRESH_INTERVAL_MS,
} from "@/constants/mission-config";
import { apiPost } from "@/lib/api-client";

const OrbitCanvas2D = dynamic(
  () => import("@/components/orbit/OrbitCanvas2D").then((m) => m.OrbitCanvas2D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-square max-w-[calc(100svh-6rem)] mx-auto xl:mr-0 rounded-xl border border-slate-800 bg-[#050d1a]
                      flex items-center justify-center text-slate-600 text-sm font-mono tracking-widest">
        INITIALIZING...
      </div>
    ),
  }
);

type SidebarTab = "mission" | "news";

export default function DashboardPage() {
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL_MS);
  const [showApproachAlert, setShowApproachAlert] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("mission");
  const [trajectoryRange, setTrajectoryRange] = useState<"off" | "1h" | "2h" | "8h" | "mission">(() => {
    if (typeof window === "undefined") return "mission";
    const s = localStorage.getItem("artemis_traj_range");
    return (["off","1h","2h","8h","mission"] as string[]).includes(s ?? "")
      ? s as "off" | "1h" | "2h" | "8h" | "mission"
      : "mission";
  });
  const prevApproachingRef = useRef<boolean>(false);

  const { data, isError, refresh } = useMissionCurrent(refreshInterval);
  const { data: trajectoryData } = useTrajectory(trajectoryRange === "off" ? "mission" : trajectoryRange as "1h" | "2h" | "8h" | "mission");
  const { data: eventsData } = useMissionEvents();
  const { data: dsnData, isLoading: dsnLoading } = useDSN();
  const { data: newsData, isLoading: newsLoading } = useNews();

  useEffect(() => {
    localStorage.setItem("artemis_traj_range", trajectoryRange);
  }, [trajectoryRange]);

  useEffect(() => {
    if (!data) return;
    if (!prevApproachingRef.current && data.is_approaching) {
      setShowApproachAlert(true);
    }
    prevApproachingRef.current = data.is_approaching;
  }, [data]);

  const handleSetInterval = (ms: number) => setRefreshInterval(ms);

  const handleManualRefresh = async () => {
    try {
      await apiPost("/api/mission/poll-now");
      await refresh();
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col text-slate-200">
      <MissionHeader data={data} isError={isError} />

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

      <main className="flex-1 mx-auto w-full max-w-[1600px] px-3 py-3
                       grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3 items-start">

        <OrbitCanvas2D
          current={data}
          trajectory={trajectoryRange === "off" ? [] : (trajectoryData?.points ?? [])}
          trajectoryRange={trajectoryRange}
          onTrajectoryRangeChange={setTrajectoryRange}
        />

        <div className="flex flex-col gap-3">
          {/* Tab bar */}
          <div className="flex rounded-lg border border-slate-800 overflow-hidden text-[11px] font-mono tracking-widest">
            {(["mission", "news"] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2 uppercase transition-colors
                  ${sidebarTab === tab
                    ? "bg-slate-800 text-slate-100"
                    : "bg-slate-900/40 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Mission tab */}
          {sidebarTab === "mission" && (
            <>
              <TelemetryGrid data={data} />
              <DSNPanel data={dsnData} isLoading={dsnLoading} />
              {eventsData && <TimelinePanel events={eventsData.events} />}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <RefreshIntervalSelector
                  current={refreshInterval}
                  isApproaching={data?.is_approaching ?? false}
                  onChange={handleSetInterval}
                  onManualRefresh={handleManualRefresh}
                />
              </div>
            </>
          )}

          {/* News tab */}
          {sidebarTab === "news" && (
            <NewsPanel data={newsData} isLoading={newsLoading} />
          )}
        </div>
      </main>

      <footer className="border-t border-slate-900 font-mono">
        <VisitorCounter />
        <p className="text-center text-[10px] text-slate-800 pb-2">
          DATA: JPL HORIZONS · NOT OFFICIAL NASA DATA
        </p>
      </footer>
    </div>
  );
}
