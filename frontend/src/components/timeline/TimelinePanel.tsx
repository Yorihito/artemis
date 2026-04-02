"use client";
import { useState, useEffect } from "react";
import type { MissionEvent } from "@/types/mission";
import { formatUTC } from "@/lib/time-utils";

interface Props {
  events: MissionEvent[];
}

const statusConfig = {
  completed: { icon: "✓", color: "text-green-400", dot: "bg-green-500" },
  in_progress: { icon: "▶", color: "text-orange-400 animate-pulse", dot: "bg-orange-500 animate-pulse" },
  upcoming: { icon: "○", color: "text-slate-500", dot: "bg-slate-700" },
  unknown: { icon: "?", color: "text-slate-600", dot: "bg-slate-800" },
};

export function TimelinePanel({ events }: Props) {
  const [showPlanned, setShowPlanned] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("artemis_tl_planned") !== "false";
  });
  const [showActual, setShowActual] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("artemis_tl_actual") !== "false";
  });

  useEffect(() => { localStorage.setItem("artemis_tl_planned", String(showPlanned)); }, [showPlanned]);
  useEffect(() => { localStorage.setItem("artemis_tl_actual",  String(showActual));  }, [showActual]);

  // Prevent both from being off simultaneously
  const togglePlanned = () => {
    if (showPlanned && !showActual) return; // keep at least one on
    setShowPlanned((v) => !v);
  };
  const toggleActual = () => {
    if (showActual && !showPlanned) return;
    setShowActual((v) => !v);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Mission Timeline
        </div>
        <div className="flex gap-1">
          <button
            onClick={togglePlanned}
            className={`text-[10px] px-2 py-0.5 rounded font-mono transition border ${
              showPlanned
                ? "bg-slate-700 border-slate-500 text-slate-200"
                : "bg-transparent border-slate-700 text-slate-600 hover:border-slate-500"
            }`}
          >
            Plan
          </button>
          <button
            onClick={toggleActual}
            className={`text-[10px] px-2 py-0.5 rounded font-mono transition border ${
              showActual
                ? "bg-green-900/60 border-green-700 text-green-300"
                : "bg-transparent border-slate-700 text-slate-600 hover:border-slate-500"
            }`}
          >
            Actual
          </button>
        </div>
      </div>
      <div className="space-y-0">
        {events.map((event, i) => {
          const cfg = statusConfig[event.status];
          return (
            <div key={event.event_id} className="flex gap-3 relative">
              {/* Vertical line */}
              {i < events.length - 1 && (
                <div className="absolute left-[9px] top-5 bottom-0 w-px bg-slate-800" />
              )}
              {/* Dot */}
              <div className="flex flex-col items-center pt-1 shrink-0">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  event.status === "completed"
                    ? "border-green-600 bg-green-900"
                    : event.status === "in_progress"
                    ? "border-orange-500 bg-orange-900"
                    : "border-slate-700 bg-slate-900"
                }`}>
                  <span className={`text-[8px] leading-none ${cfg.color}`}>
                    {event.status === "completed" ? "✓" : event.status === "in_progress" ? "▶" : ""}
                  </span>
                </div>
              </div>
              {/* Content */}
              <div className={`pb-4 flex-1 ${i === events.length - 1 ? "pb-0" : ""}`}>
                <div className={`text-sm font-medium ${
                  event.status === "completed" ? "text-slate-300" :
                  event.status === "in_progress" ? "text-orange-300" :
                  "text-slate-500"
                }`}>
                  {event.name}
                </div>
                {showPlanned && (
                  <div className="text-xs text-slate-600 mt-0.5">
                    Planned: {formatUTC(event.planned_time)}
                  </div>
                )}
                {showActual && event.actual_time && (
                  <div className="text-xs text-green-600 mt-0.5">
                    Actual: {formatUTC(event.actual_time)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
