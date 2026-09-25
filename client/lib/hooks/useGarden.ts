import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export interface GardenFlower {
  id: number;
  icon: string;
  flowerX: number;
  flowerY: number;
  // One of the user's first flowers, drawn in the center circle (lib/garden.ts).
  inCenter: boolean;
}

export function useGarden() {
  return useQuery({
    // Under 'entries' so every entry mutation's invalidation refreshes it too.
    queryKey: ['entries', 'garden'],
    queryFn: () => apiClient.get<{ flowers: GardenFlower[] }>('/api/garden').then((r) => r.flowers),
  });
}
