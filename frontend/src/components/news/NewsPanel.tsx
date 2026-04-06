"use client";
import type { NewsItem, NewsResponse } from "@/types/news";
import { useLocale } from "@/contexts/LocaleContext";
import { t, relativeTime } from "@/lib/i18n";

interface Props {
  data: NewsResponse | undefined;
  isLoading: boolean;
}

function SourceBadge({ item }: { item: NewsItem }) {
  if (item.is_nasa) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded
                       bg-blue-950 border border-blue-800 text-blue-300 shrink-0">
        NASA
      </span>
    );
  }
  return (
    <span className="text-[9px] font-mono text-slate-500 shrink-0">{item.source}</span>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const locale = useLocale();
  return (
    <li className="group py-2.5 border-b border-slate-800/60 last:border-0">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-1">
        <span className="text-[11px] leading-snug text-slate-200 group-hover:text-white transition-colors line-clamp-3">
          {item.title}
        </span>
        <div className="flex items-center gap-2">
          <SourceBadge item={item} />
          <span className="text-[9px] font-mono text-slate-600">
            {relativeTime(item.published, locale)}
          </span>
        </div>
      </a>
    </li>
  );
}

export function NewsPanel({ data, isLoading }: Props) {
  const locale = useLocale();

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {t("news.title", locale)}
        </span>
        {data?.last_crawled && (
          <span className="text-[9px] font-mono text-slate-700">
            {t("news.updated", locale)} {relativeTime(data.last_crawled, locale)}
          </span>
        )}
      </div>

      {isLoading && !data && (
        <p className="text-xs font-mono text-slate-600 py-4 text-center">
          {t("news.loading", locale)}
        </p>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <p className="text-xs font-mono text-slate-600 py-4 text-center">
          {t("news.empty", locale)}
        </p>
      )}

      {data && data.items.length > 0 && (
        <ul className="divide-y divide-transparent">
          {data.items.map((item) => (
            <NewsRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
