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
import { useLocale } from "@/contexts/LocaleContext";
import { t } from "@/lib/i18n";

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

type MainView = "news" | "artemis-ii" | "artemis-iii";

export default function DashboardPage() {
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL_MS);
  const [showApproachAlert, setShowApproachAlert] = useState(false);
  const locale = useLocale();
  const [mainView, setMainView] = useState<MainView>("news");
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

  const isComplete = data?.phase_label === "Mission Complete";

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col text-slate-200">
      <MissionHeader data={data} isError={isError} />

      {/* Top navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10 px-4">
        <div className="mx-auto max-w-[1600px] flex">
          {(
            [
              { id: "news" as MainView,        label: t("nav.news", locale),  badge: null },
              { id: "artemis-ii" as MainView,  label: "ARTEMIS II",           badge: isComplete ? t("nav.complete", locale) : null },
              { id: "artemis-iii" as MainView, label: "ARTEMIS III",          badge: t("nav.upcoming", locale) },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setMainView(item.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[11px] font-mono tracking-widest transition-colors border-b-2
                ${mainView === item.id
                  ? "text-white border-white"
                  : "text-slate-500 hover:text-slate-300 border-transparent"
                }`}
            >
              {item.label}
              {item.badge && (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {isError && (
        <ErrorBanner
          lastSuccessAt={data?.last_success_at ?? null}
          onRetry={async () => { await refresh(); }}
        />
      )}
      {showApproachAlert && data?.is_approaching && data.approach_type && mainView === "artemis-ii" && (
        <ApproachAlert
          approachType={data.approach_type}
          onSelectInterval={handleSetInterval}
          onDismiss={() => setShowApproachAlert(false)}
        />
      )}

      {/* NEWS view */}
      {mainView === "news" && (
        <main className="flex-1 mx-auto w-full max-w-[860px] px-3 py-4">
          <NewsPanel data={newsData} isLoading={newsLoading} />
        </main>
      )}

      {/* ARTEMIS II archive view */}
      {mainView === "artemis-ii" && (
        <main className="flex-1 mx-auto w-full max-w-[1600px] px-3 py-3
                         grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3 items-start">
          <OrbitCanvas2D
            current={data}
            trajectory={trajectoryRange === "off" ? [] : (trajectoryData?.points ?? [])}
            trajectoryRange={trajectoryRange}
            onTrajectoryRangeChange={setTrajectoryRange}
          />
          <div className="flex flex-col gap-3">
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
          </div>
        </main>
      )}

      {/* ARTEMIS III placeholder */}
      {mainView === "artemis-iii" && (
        <main className="flex-1 flex flex-col items-center justify-center py-24 px-4">
          <div className="text-center max-w-lg">
            <div className="text-5xl mb-6">🌕</div>
            <h2 className="text-xl font-bold text-white mb-3 font-mono tracking-widest">ARTEMIS III</h2>
            <p className="text-slate-400 text-sm mb-6">
              {locale === "ja"
                ? "アポロ17号以来初の有人月面着陸ミッション"
                : "First crewed lunar landing since Apollo 17"}
            </p>
            <p className="text-slate-600 text-xs font-mono leading-relaxed">
              {locale === "ja"
                ? "打ち上げ日は未定です。ミッションスケジュールが確定次第、トラッキングを開始します。"
                : "Launch date not yet announced. Tracking will begin once the mission schedule is confirmed."}
            </p>
            <button
              onClick={() => setMainView("news")}
              className="mt-8 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
            >
              → {locale === "ja" ? "最新ニュースを見る" : "See latest news"}
            </button>
          </div>
        </main>
      )}

      {/* Static content for search engine indexing */}
      <section className="border-t border-slate-900 mt-4 px-4 py-8 max-w-[1600px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-600 text-xs font-mono leading-relaxed">
          <div>
            <h2 className="text-slate-500 text-[11px] tracking-widest uppercase mb-3">About Artemis II</h2>
            <p>
              Artemis II is NASA&apos;s first crewed lunar mission since Apollo 17 in 1972. Launched on April 1,
              2026, the Orion spacecraft — nicknamed &ldquo;Integrity&rdquo; — carries four astronauts on a
              free-return lunar flyby trajectory, reaching a maximum distance of approximately 400,000 km
              from Earth before returning for splashdown around April 10, 2026.
            </p>
          </div>
          <div>
            <h2 className="text-slate-500 text-[11px] tracking-widest uppercase mb-3">Data Source</h2>
            <p>
              Position and velocity data are sourced from JPL Horizons, NASA&apos;s solar system ephemeris
              service operated by the Jet Propulsion Laboratory. State vectors are fetched in the
              J2000 Earth-centered inertial frame and updated every 30 seconds during cruise phase,
              increasing to every minute during lunar approach and departure.
            </p>
          </div>
          <div>
            <h2 className="text-slate-500 text-[11px] tracking-widest uppercase mb-3">How to Use</h2>
            <p>
              The orbit canvas displays the spacecraft trajectory relative to Earth and the Moon in the
              ecliptic plane. Scroll to zoom, drag to pan, and double-click to reset the view.
              Switch to MOON or EARTH view for close-approach detail. The SUN button activates a
              heliocentric view showing Mercury, Venus, Earth, and Mars.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900 font-mono">
        <VisitorCounter />
        <p className="text-center text-[10px] text-slate-800 pb-2">
          DATA: JPL HORIZONS · NOT OFFICIAL NASA DATA
        </p>
      </footer>
    </div>
  );
}
