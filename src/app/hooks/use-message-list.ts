import { useQuery } from "@tanstack/react-query";
import { fetchCommentCounts, fetchMessages } from "../services";
import { queryKeys } from "./query-keys";

export function useMessageList(type: "audio" | "video" | "text") {
  const messagesQuery = useQuery({
    queryKey: queryKeys.messages(type),
    queryFn: () => fetchMessages(type),
  });

  const commentCountsQuery = useQuery({
    queryKey: queryKeys.commentCounts(),
    queryFn: fetchCommentCounts,
  });

  return {
    messages: messagesQuery.data ?? [],
    commentCounts: commentCountsQuery.data ?? {},
    isLoading: messagesQuery.isLoading || commentCountsQuery.isLoading,
  };
}
