"use client";
import useSWR from "swr";
import { apiFetch } from "@/lib/api-client";
import type { TrajectoryResponse } from "@/types/mission";

export function useTrajectory(range: "10m" | "1h" | "mission" = "mission") {
  const { data, error, isLoading } = useSWR<TrajectoryResponse>(
    `/api/mission/trajectory?range=${range}`,
    (path: string) => apiFetch<TrajectoryResponse>(path),
    {
      refreshInterval: 60_000, // trajectory updates every 60s
      keepPreviousData: true,
    }
  );
  return { data, isLoading, isError: !!error };
}
