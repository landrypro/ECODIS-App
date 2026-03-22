import { useQuery } from "@tanstack/react-query";
import { fetchMessage, fetchMessageSeries, fetchSeries } from "../services";
import { queryKeys } from "./query-keys";

export function useMessageDetail(id?: string) {
  return useQuery({
    queryKey: queryKeys.message(id),
    queryFn: () => fetchMessage(id!),
    enabled: Boolean(id),
  });
}

export function useMessageSeriesContext(messageId?: string, seriesIdParam?: string | null) {
  return useQuery({
    queryKey: ["message-series-context", messageId ?? "unknown", seriesIdParam ?? "auto"],
    enabled: Boolean(messageId),
    queryFn: async () => {
      if (!messageId) return null;
      let targetSeriesId = seriesIdParam ?? null;
      if (!targetSeriesId) {
        const seriesList = await fetchMessageSeries(messageId);
        targetSeriesId = seriesList[0]?.id ?? null;
      }
      if (!targetSeriesId) return null;
      const data = await fetchSeries(targetSeriesId);
      if (!data) return null;
      const currentIndex = data.messages.findIndex((message) => message.id === messageId);
      if (currentIndex < 0) return null;
      return {
        series: data.series,
        messages: data.messages,
        currentIndex,
      };
    },
  });
}
