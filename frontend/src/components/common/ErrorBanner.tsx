"use client";
import { formatUTC } from "@/lib/time-utils";

interface Props {
  lastSuccessAt: string | null;
  onRetry: () => void;
}

export function ErrorBanner({ lastSuccessAt, onRetry }: Props) {
  return (
    <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 flex items-center gap-3">
      <span className="text-xl">⚠️</span>
      <div className="flex-1 text-sm">
        <span className="font-semibold">Data Fetch Error</span>
        {lastSuccessAt && (
          <span className="ml-2 text-red-400">
            Last success: {formatUTC(lastSuccessAt)}
          </span>
        )}
      </div>
      <button
        onClick={onRetry}
        className="text-xs bg-red-800 hover:bg-red-700 text-red-200 px-3 py-1 rounded transition"
      >
        Retry
      </button>
    </div>
  );
}
