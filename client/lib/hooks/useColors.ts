import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export interface Color {
  id: number;
  name: string;
  hex: string;
  description: string;
  icon: string;
}

export function useColors() {
  return useQuery({
    queryKey: ['colors'],
    queryFn: () => apiClient.get<{ colors: Color[] }>('/api/colors').then((r) => r.colors),
    staleTime: Infinity, // colors change rarely (see spec §8) — no need to refetch within a session
  });
}
