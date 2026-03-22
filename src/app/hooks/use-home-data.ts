import { useQuery } from "@tanstack/react-query";
import { fetchAllSeries, fetchMessages } from "../services";
import { queryKeys } from "./query-keys";

export function useHomeData() {
  return useQuery({
    queryKey: queryKeys.home(),
    queryFn: async () => {
      const [messages, series] = await Promise.all([fetchMessages(), fetchAllSeries()]);
      return { messages, series };
    },
  });
}
