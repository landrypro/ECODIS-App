import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addComment, deleteComment, fetchComments } from "../services";
import { queryKeys } from "./query-keys";

export function useComments(messageId?: string) {
  return useQuery({
    queryKey: queryKeys.comments(messageId),
    queryFn: () => fetchComments(messageId!),
    enabled: Boolean(messageId),
  });
}

export function useCommentMutations(messageId: string, accessToken?: string | null) {
  const queryClient = useQueryClient();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.comments(messageId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.commentCounts() });
  };

  return {
    addMutation: useMutation({
      mutationFn: (text: string) => addComment(messageId, text, accessToken!),
      onSuccess: refresh,
    }),
    deleteMutation: useMutation({
      mutationFn: (commentId: string) => deleteComment(messageId, commentId, accessToken!),
      onSuccess: refresh,
    }),
  };
}
