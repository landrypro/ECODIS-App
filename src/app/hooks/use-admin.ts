import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteUser, fetchAdminStats, fetchAllUsers, updateUserRole } from "../services";
import { queryKeys } from "./query-keys";

export function useAdminUsers(accessToken?: string | null, isEnabled = false, userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.users(userId),
    queryFn: () => fetchAllUsers(accessToken!),
    enabled: Boolean(accessToken && isEnabled),
  });
}

export function useAdminUserMutations(accessToken?: string | null, userId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.users(userId) });
  };
  return {
    updateRoleMutation: useMutation({
      mutationFn: ({ targetUserId, role }: { targetUserId: string; role: string }) => updateUserRole(targetUserId, role, accessToken!),
      onSuccess: invalidate,
    }),
    deleteUserMutation: useMutation({
      mutationFn: (targetUserId: string) => deleteUser(targetUserId, accessToken!),
      onSuccess: invalidate,
    }),
  };
}

export function useAdminStats(accessToken?: string | null, isEnabled = false, userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.adminStats(userId),
    queryFn: () => fetchAdminStats(accessToken!),
    enabled: Boolean(accessToken && isEnabled),
  });
}
