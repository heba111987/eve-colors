import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export interface Me {
  id: number;
  email: string;
  displayName: string;
  consentAcceptedAt: string | null;
  analyticsMarketingConsentAt: string | null;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<{ user: Me }>('/api/me').then((r) => r.user),
    retry: false,
  });
}
