import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../apiClient';
import { Entry } from './useToday';

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (colorId: number) => apiClient.post<{ entry: Entry }>('/api/entries', { color_id: colorId }).then((r) => r.entry),
    onSuccess: (entry) => {
      queryClient.setQueryData(['today'], entry);
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
    },
  });
}

export { ApiError };
