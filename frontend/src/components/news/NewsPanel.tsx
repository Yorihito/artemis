"use client";
import type { NewsItem, NewsResponse } from "@/types/news";

interface Props {
  data: NewsResponse | undefined;
  isLoading: boolean;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)    return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)    return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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
    <span className="text-[9px] font-mono text-slate-500 shrink-0">
      {item.source}
    </span>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <li className="group py-2.5 border-b border-slate-800/60 last:border-0">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-1"
      >
        <span className="text-[11px] leading-snug text-slate-200
                         group-hover:text-white transition-colors line-clamp-3">
          {item.title}
        </span>
        <div className="flex items-center gap-2">
          <SourceBadge item={item} />
          <span className="text-[9px] font-mono text-slate-600">
            {relativeTime(item.published)}
          </span>
        </div>
      </a>
    </li>
  );
}

export function NewsPanel({ data, isLoading }: Props) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Latest News
        </span>
        {data?.last_crawled && (
          <span className="text-[9px] font-mono text-slate-700">
            updated {relativeTime(data.last_crawled)}
          </span>
        )}
      </div>

      {isLoading && !data && (
        <p className="text-xs font-mono text-slate-600 py-4 text-center">
          LOADING...
        </p>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <p className="text-xs font-mono text-slate-600 py-4 text-center">
          No recent articles found.
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
