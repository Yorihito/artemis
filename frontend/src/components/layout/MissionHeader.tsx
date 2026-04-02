"use client";
import type { MissionCurrentResponse } from "@/types/mission";
import { formatJST } from "@/lib/time-utils";

interface Props {
  data: MissionCurrentResponse | undefined;
  isError: boolean;
}

const phaseColors: Record<string, string> = {
  TranslunarCoast: "bg-cyan-900 text-cyan-300 border-cyan-700",
  LunarFlyby: "bg-yellow-900 text-yellow-300 border-yellow-700",
  ReturnCoast: "bg-orange-900 text-orange-300 border-orange-700",
  Reentry: "bg-red-900 text-red-300 border-red-700",
  Ascent: "bg-blue-900 text-blue-300 border-blue-700",
};

export function MissionHeader({ data, isError }: Props) {
  const statusColor = isError
    ? "bg-red-500"
    : data
    ? "bg-green-500"
    : "bg-yellow-500";

  const phaseClass =
    data ? phaseColors[data.phase] ?? "bg-slate-800 text-slate-300 border-slate-600" : "";

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 py-3">
      <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-3">
        {/* Logo / Title */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚀</span>
          <span className="font-bold text-white tracking-wide text-lg">
            Artemis II
          </span>
        </div>

        {/* Phase badge */}
        {data && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border ${phaseClass}`}
          >
            {data.phase_label}
          </span>
        )}

        <div className="flex-1" />

        {/* Source */}
        {data && (
          <span className="text-xs text-slate-400 hidden sm:block">
            Source:{" "}
            <span className="text-slate-200 font-mono">{data.source}</span>
          </span>
        )}

        {/* Last update */}
        {data?.last_success_at && (
          <span className="text-xs text-slate-400 hidden md:block">
            Updated: {formatJST(data.last_success_at)}
          </span>
        )}

        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-slate-400 hidden sm:block">
            {isError ? "Error" : data ? "Live" : "Connecting..."}
          </span>
        </div>
      </div>
    </header>
  );
}
