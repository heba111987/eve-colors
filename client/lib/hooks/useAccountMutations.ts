import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: true }>('/api/logout'),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<{ ok: true; analyticsPurged: boolean }>('/api/me'),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
