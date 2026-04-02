"use client";
import { formatJST } from "@/lib/time-utils";

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  level: "info" | "warn" | "error";
}

interface Props {
  entries: LogEntry[];
}

const levelColors = {
  info: "text-slate-400",
  warn: "text-orange-400",
  error: "text-red-400",
};

export function EventLogPanel({ entries }: Props) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
      <div className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wider">
        Event Log
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-xs">
        {entries.length === 0 && (
          <div className="text-slate-600">Waiting for events...</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="flex gap-2">
            <span className="text-slate-600 shrink-0">
              {formatJST(e.timestamp).slice(11, 19)}
            </span>
            <span className={levelColors[e.level]}>{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
