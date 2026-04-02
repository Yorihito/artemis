"use client";
import type { MissionEvent } from "@/types/mission";
import { formatJST } from "@/lib/time-utils";

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
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="text-xs font-semibold text-slate-500 uppercase mb-3 tracking-wider">
        Mission Timeline
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
                <div className="text-xs text-slate-600 mt-0.5">
                  {event.actual_time
                    ? `Actual: ${formatJST(event.actual_time)}`
                    : `Planned: ${formatJST(event.planned_time)}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
