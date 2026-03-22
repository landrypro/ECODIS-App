import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllSeries, fetchAllSeriesProgress, fetchSeries, fetchSeriesProgress, markSeriesProgress } from "../services";
import { queryKeys } from "./query-keys";

export function useAllSeries() {
  return useQuery({
    queryKey: queryKeys.series(),
    queryFn: fetchAllSeries,
  });
}

export function useSeriesDetail(id?: string) {
  return useQuery({
    queryKey: queryKeys.seriesDetail(id),
    queryFn: () => fetchSeries(id!),
    enabled: Boolean(id),
  });
}

export function useSeriesProgress(seriesId?: string, accessToken?: string | null, userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.seriesProgress(seriesId, userId),
    queryFn: () => fetchSeriesProgress(seriesId!, accessToken!),
    enabled: Boolean(seriesId && accessToken),
  });
}

export function useAllSeriesProgress(accessToken?: string | null, userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.allSeriesProgress(userId),
    queryFn: () => fetchAllSeriesProgress(accessToken!),
    enabled: Boolean(accessToken),
  });
}

export function useMarkSeriesProgress(accessToken?: string | null, userId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ seriesId, messageId }: { seriesId: string; messageId: string }) =>
      markSeriesProgress(seriesId, messageId, accessToken!),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.seriesProgress(variables.seriesId, userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allSeriesProgress(userId) });
    },
  });
}
