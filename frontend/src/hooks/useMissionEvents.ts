"use client";
import useSWR from "swr";
import { apiFetch } from "@/lib/api-client";
import type { EventsResponse } from "@/types/mission";

export function useMissionEvents() {
  const { data, error, isLoading } = useSWR<EventsResponse>(
    "/api/mission/events",
    (path: string) => apiFetch<EventsResponse>(path),
    { refreshInterval: 300_000 } // 5 min
  );
  return { data, isLoading, isError: !!error };
}
