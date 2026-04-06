"use client";
import { useEffect, useRef } from "react";
import useSWR from "swr";
import { apiFetch, apiPost } from "@/lib/api-client";
import { useLocale } from "@/contexts/LocaleContext";
import { t } from "@/lib/i18n";

interface VisitorStats {
  unique_visitors: number;
  total_visits: number;
  since: string;
}

function getOrCreateSessionId(): string {
  try {
    const key = "artemis_session_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function VisitorCounter() {
  const locale = useLocale();
  const reported = useRef(false);

  const { data } = useSWR<VisitorStats>(
    "/api/system/visitors",
    (path: string) => apiFetch<VisitorStats>(path),
    { refreshInterval: 60_000 }
  );

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    const sessionId = getOrCreateSessionId();
    apiPost("/api/system/visit", { session_id: sessionId }).catch(() => {});
  }, []);

  const fmt = (n: number) => n.toLocaleString("ja-JP");

  return (
    <div className="flex items-center justify-center gap-6 py-2 text-[11px] font-mono text-slate-600">
      <span className="flex items-center gap-1.5">
        <span className="text-slate-500">{t("visit.unique", locale)}</span>
        <span className="text-slate-400 tabular-nums">{data ? fmt(data.unique_visitors) : "—"}</span>
      </span>
      <span className="text-slate-800">·</span>
      <span className="flex items-center gap-1.5">
        <span className="text-slate-500">{t("visit.total", locale)}</span>
        <span className="text-slate-400 tabular-nums">{data ? fmt(data.total_visits) : "—"}</span>
      </span>
    </div>
  );
}
