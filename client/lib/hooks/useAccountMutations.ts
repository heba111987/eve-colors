import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

// invalidateQueries(), not clear(): clear() wipes the cache but doesn't
// reliably guarantee an immediate refetch for active observers, which left
// AuthGate's useMe() query stuck showing stale "signed in" data for up to
// 15s (or until an unrelated interaction) after a real sign-out/delete in
// testing. invalidateQueries() is the same proven-reliable mechanism the
// consent-accept flow already uses to make AuthGate redirect reactively.
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: true }>('/api/logout'),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<{ ok: true; analyticsPurged: boolean }>('/api/me'),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
