import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export function useConsentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (analyticsMarketing: boolean) => apiClient.post<{ ok: true }>('/api/me/consent', { analyticsMarketing }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
