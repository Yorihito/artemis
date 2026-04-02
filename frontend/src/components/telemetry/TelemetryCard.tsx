"use client";

interface Props {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  highlight?: boolean;
  accent?: "cyan" | "orange" | "default";
}

export function TelemetryCard({ label, value, unit, sub, highlight, accent = "default" }: Props) {
  const borderColor =
    highlight && accent === "orange" ? "border-orange-700/60 bg-orange-950/20" :
    highlight && accent === "cyan"   ? "border-cyan-700/60 bg-cyan-950/20" :
    "border-slate-800 bg-slate-900/40";

  const valueColor =
    highlight && accent === "orange" ? "text-orange-300" :
    highlight && accent === "cyan"   ? "text-cyan-300" :
    "text-white";

  return (
    <div className={`rounded-lg border px-3 py-2.5 flex flex-col gap-0.5 ${borderColor}`}>
      <div className="text-[9px] text-slate-500 uppercase tracking-[0.15em] font-mono">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className={`font-mono text-lg font-semibold tabular-nums leading-none ${valueColor}`}>
          {value}
        </span>
        {unit && (
          <span className="text-[10px] text-slate-500 font-mono">{unit}</span>
        )}
      </div>
      {sub && (
        <div className="text-[10px] text-slate-600 font-mono mt-0.5">{sub}</div>
      )}
    </div>
  );
}
