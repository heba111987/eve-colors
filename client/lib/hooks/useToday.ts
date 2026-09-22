import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export interface Entry {
  id: number;
  color: string;
  answerText: string | null;
  activityCompleted: boolean;
  entryDate: string;
  flowerX: number | null;
  flowerY: number | null;
  question: { id: number; text: string; quadrant: string };
  activity: { id: number; text: string; note: string | null; quadrant: string } | null;
}

export function useToday() {
  return useQuery({
    queryKey: ['today'],
    queryFn: () => apiClient.get<{ entry: Entry | null }>('/api/today').then((r) => r.entry),
  });
}
