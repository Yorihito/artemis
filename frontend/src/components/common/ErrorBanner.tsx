"use client";
import { formatJST } from "@/lib/time-utils";

interface Props {
  lastSuccessAt: string | null;
  onRetry: () => void;
}

export function ErrorBanner({ lastSuccessAt, onRetry }: Props) {
  return (
    <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 flex items-center gap-3">
      <span className="text-xl">⚠️</span>
      <div className="flex-1 text-sm">
        <span className="font-semibold">データ取得エラー</span>
        {lastSuccessAt && (
          <span className="ml-2 text-red-400">
            最終正常更新: {formatJST(lastSuccessAt)}
          </span>
        )}
      </div>
      <button
        onClick={onRetry}
        className="text-xs bg-red-800 hover:bg-red-700 text-red-200 px-3 py-1 rounded transition"
      >
        再試行
      </button>
    </div>
  );
}
