import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

interface ConsentInput {
  analytics: boolean;
  marketing: boolean;
  [key: string]: boolean;
}

export function useConsentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (consent: ConsentInput) => apiClient.post<{ ok: true }>('/api/me/consent', consent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
