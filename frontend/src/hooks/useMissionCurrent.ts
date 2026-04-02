"use client";
import useSWR from "swr";
import { apiFetch } from "@/lib/api-client";
import type { MissionCurrentResponse } from "@/types/mission";

export function useMissionCurrent(refreshIntervalMs: number) {
  const { data, error, isLoading, mutate } = useSWR<MissionCurrentResponse>(
    "/api/mission/current",
    (path: string) => apiFetch<MissionCurrentResponse>(path),
    {
      refreshInterval: refreshIntervalMs > 0 ? refreshIntervalMs : undefined,
      keepPreviousData: true,
      onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), 5000);
      },
    }
  );

  return {
    data,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
