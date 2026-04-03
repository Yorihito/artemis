"use client";
import useSWR from "swr";
import { apiFetch } from "@/lib/api-client";
import type { DSNStatus } from "@/types/dsn";

export function useDSN() {
  const { data, error, isLoading } = useSWR<DSNStatus>(
    "/api/dsn",
    (path: string) => apiFetch<DSNStatus>(path),
    {
      refreshInterval: 30_000, // DSN updates every 5s; we poll every 30s
      keepPreviousData: true,
    }
  );
  return { data, isLoading, isError: !!error };
}
