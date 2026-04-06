"use client";
import { REFRESH_INTERVALS } from "@/constants/mission-config";
import { useLocale } from "@/contexts/LocaleContext";
import { t } from "@/lib/i18n";

interface Props {
  current: number;
  isApproaching: boolean;
  onChange: (ms: number) => void;
  onManualRefresh: () => void;
}

export function RefreshIntervalSelector({
  current,
  isApproaching,
  onChange,
  onManualRefresh,
}: Props) {
  const locale = useLocale();
  const visible = REFRESH_INTERVALS.filter(
    (opt) => !opt.approachOnly || isApproaching
  );

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="text-slate-400 shrink-0">{t("refresh.label", locale)}</span>
      <div className="flex gap-1 flex-wrap">
        {visible.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 rounded font-mono transition border ${
              current === opt.value
                ? "bg-cyan-800 border-cyan-600 text-cyan-100"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
            } ${opt.approachOnly ? "border-orange-700" : ""}`}
          >
            {opt.label === "Manual" ? t("refresh.manual", locale) : opt.label}
          </button>
        ))}
      </div>
      {current === 0 && (
        <button
          onClick={onManualRefresh}
          className="px-3 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition"
        >
          {t("refresh.button", locale)}
        </button>
      )}
    </div>
  );
}
