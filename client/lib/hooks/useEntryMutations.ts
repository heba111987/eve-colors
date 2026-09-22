import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../apiClient';
import { Entry } from './useToday';

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (colorId: number) => apiClient.post<{ entry: Entry }>('/api/entries', { color_id: colorId }).then((r) => r.entry),
    onSuccess: (entry) => {
      queryClient.setQueryData(['today'], entry);
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export function useSubmitAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer }: { id: number; answer: string }) =>
      apiClient.patch<{ entry: Entry }>(`/api/entries/${id}`, { answer }).then((r) => r.entry),
    onSuccess: (entry) => {
      queryClient.setQueryData(['today'], entry);
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export function useRerollActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.post<{ activity: { id: number; text: string; note: string | null; quadrant: string } }>(
        `/api/entries/${id}/reroll-activity`,
      ),
    onSuccess: (result, id) => {
      queryClient.setQueryData(['today'], (current: Entry | null | undefined) =>
        current && current.id === id ? { ...current, activity: result.activity } : current,
      );
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export function useCompleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.patch<{ entry: Entry }>(`/api/entries/${id}`, { activityCompleted: true }).then((r) => r.entry),
    onSuccess: (entry) => {
      queryClient.setQueryData(['today'], entry);
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete<{ ok: true }>(`/api/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      // The deleted entry may be today's — without this, useToday() keeps
      // serving the stale cached entry (set by useCreateEntry/useCompleteActivity's
      // setQueryData) and the Today screen keeps showing "Already planted
      // today" for a day that was just deleted, until an unrelated refetch.
      queryClient.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export { ApiError };
