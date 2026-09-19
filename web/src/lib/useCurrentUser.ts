import { useCallback, useEffect, useState } from 'react';
import type { SessionUser } from '@eve-colors/shared';
import { apiClient } from './api';

export function useCurrentUser() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const refetch = useCallback(async () => {
    try {
      const { user: fetchedUser } = await apiClient.getMe();
      setUser(fetchedUser);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { user, loading: user === undefined, refetch };
}
