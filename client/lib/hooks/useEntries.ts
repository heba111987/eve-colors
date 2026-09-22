import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { Entry } from './useToday';

interface EntriesPage {
  entries: Entry[];
  nextCursor: string | null;
  total: number;
}

export function useEntries() {
  return useInfiniteQuery({
    queryKey: ['entries'],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const path = pageParam ? `/api/entries?cursor=${encodeURIComponent(pageParam)}` : '/api/entries';
      return apiClient.get<EntriesPage>(path);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
