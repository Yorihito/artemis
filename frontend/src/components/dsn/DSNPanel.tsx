"use client";
import type { DSNStatus, DSNDish, DSNSignalInfo } from "@/types/dsn";
import { useLocale } from "@/contexts/LocaleContext";
import { t, type Locale } from "@/lib/i18n";

interface Props {
  data: DSNStatus | undefined;
  isLoading: boolean;
}

function fmtRate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000)     return `${(bps / 1_000).toFixed(1)} kbps`;
  return `${bps.toFixed(0)} bps`;
}

function fmtRange(km: number): string {
  if (km >= 1_000) return `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
  return `${km.toFixed(1)} km`;
}

function SignalBadge({ sig, dir }: { sig: DSNSignalInfo | null; dir: "↓" | "↑" }) {
  if (!sig || sig.signal_type === "none") {
    return <span className="text-slate-700 text-[10px] font-mono">{dir} —</span>;
  }
  return (
    <span className={`text-[10px] font-mono flex items-center gap-1 ${sig.active ? "text-green-400" : "text-slate-500"}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${sig.active ? "bg-green-400" : "bg-slate-600"}`} />
      {dir} {sig.band}-band {sig.active ? fmtRate(sig.data_rate_bps) : "idle"}
    </span>
  );
}

function DishCard({ dish, primary, locale }: { dish: DSNDish; primary: boolean; locale: Locale }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${primary ? "border-cyan-800 bg-cyan-950/30" : "border-slate-800 bg-slate-900/30"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{dish.flag}</span>
          <div>
            <span className="text-sm font-mono font-semibold text-slate-200">{dish.dish_name}</span>
            <span className="text-xs text-slate-500 ml-1.5">{dish.complex_name}</span>
          </div>
        </div>
        {dish.has_active_signal && (
          <span className="text-[10px] text-green-400 font-mono bg-green-950/50 border border-green-900 px-1.5 py-0.5 rounded">
            ACTIVE
          </span>
        )}
      </div>

      {dish.activity && (
        <p className="text-[10px] text-slate-600 mb-2 truncate" title={dish.activity}>
          {dish.activity}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div>
          <div className="text-slate-600 text-[10px] uppercase tracking-wider">RTLT</div>
          <div className="text-cyan-300 font-mono">{dish.rtlt_sec.toFixed(3)} s</div>
          <div className="text-slate-600 font-mono text-[10px]">{t("dsn.oneWay", locale)} {(dish.rtlt_sec / 2).toFixed(3)} s</div>
        </div>
        <div>
          <div className="text-slate-600 text-[10px] uppercase tracking-wider">Range</div>
          <div className="text-slate-300 font-mono">{fmtRange(dish.range_km)}</div>
        </div>
        <div>
          <div className="text-slate-600 text-[10px] uppercase tracking-wider">Pointing</div>
          <div className="text-slate-400 font-mono">AZ {dish.azimuth_deg.toFixed(1)}°</div>
          <div className="text-slate-400 font-mono">EL {dish.elevation_deg.toFixed(1)}°</div>
        </div>
        <div>
          <div className="text-slate-600 text-[10px] uppercase tracking-wider">Signal</div>
          <SignalBadge sig={dish.down_signal} dir="↓" />
          <SignalBadge sig={dish.up_signal}   dir="↑" />
        </div>
        {dish.down_signal && dish.down_signal.power_dbm !== 0 && (
          <div>
            <div className="text-slate-600 text-[10px] uppercase tracking-wider">↓ Power</div>
            <div className="text-slate-400 font-mono">{dish.down_signal.power_dbm.toFixed(1)} dBm</div>
          </div>
        )}
        {dish.down_signal && dish.down_signal.active && (
          <div>
            <div className="text-slate-600 text-[10px] uppercase tracking-wider">↓ Rate</div>
            <div className="text-green-400 font-mono">{fmtRate(dish.down_signal.data_rate_bps)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DSNPanel({ data, isLoading }: Props) {
  const locale = useLocale();

  if (isLoading && !data) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          {t("dsn.title", locale)}
        </div>
        <div className="text-slate-700 text-xs font-mono animate-pulse">{t("dsn.fetching", locale)}</div>
      </div>
    );
  }

  const tracking = data?.is_tracking ?? false;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {t("dsn.title", locale)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 rounded-full ${
            tracking ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse" : "bg-red-700"
          }`} />
          <span className={`text-xs font-mono font-semibold tracking-widest ${
            tracking ? "text-green-400" : "text-red-500"
          }`}>
            {tracking ? t("dsn.tracking", locale) : t("dsn.noContact", locale)}
          </span>
        </div>
      </div>

      {data?.primary_dish && (
        <DishCard dish={data.primary_dish} primary locale={locale} />
      )}

      {(data?.dishes?.length ?? 0) > 1 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">{t("dsn.also", locale)}</div>
          {data!.dishes.slice(1).map((d) => (
            <DishCard key={`${d.complex_id}-${d.dish_name}`} dish={d} primary={false} locale={locale} />
          ))}
        </div>
      )}

      {!tracking && (
        <div className="text-xs text-slate-600 font-mono py-2 text-center">
          {t("dsn.noWindow", locale)}
        </div>
      )}

      {data && data.complexes.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
            {t("dsn.complexes", locale)}
          </div>
          <div className="flex gap-2">
            {data.complexes.map((c) => (
              <div key={c.complex_id} className="flex-1">
                <div className={`text-center rounded px-1.5 py-1.5 border ${
                  c.is_tracking
                    ? "border-cyan-800 bg-cyan-950/40"
                    : "border-slate-800 bg-slate-900/30"
                }`}>
                  <div className="text-base leading-none mb-1">{c.flag}</div>
                  <div className={`text-[9px] font-mono ${c.is_tracking ? "text-cyan-400" : "text-slate-600"}`}>
                    {c.complex_name}
                  </div>
                  {c.is_tracking && (
                    <div className="text-[8px] text-green-500 mt-0.5">
                      {c.dish_count} {t(c.dish_count !== 1 ? "dsn.dishes" : "dsn.dish", locale)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.fetched_at && (
        <div className="text-[9px] text-slate-700 font-mono text-right">
          {t("dsn.updated", locale)} {new Date(data.fetched_at).toLocaleTimeString("en-US", { hour12: false })} UTC
        </div>
      )}
    </div>
  );
}
