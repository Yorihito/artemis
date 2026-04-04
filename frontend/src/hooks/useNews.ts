import useSWR from "swr";
import { apiFetch } from "@/lib/api-client";
import type { NewsResponse } from "@/types/news";

export function useNews() {
  const { data, error, isLoading } = useSWR<NewsResponse>(
    "/api/news",
    (path: string) => apiFetch<NewsResponse>(path),
    {
      refreshInterval: 30 * 60 * 1000, // 30 min
      revalidateOnFocus: false,
    }
  );
  return { data, isLoading, isError: !!error };
}
