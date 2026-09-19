import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TimelineEntry } from '@eve-colors/shared';
import { apiClient } from '../lib/api';
import { useCurrentUser } from '../lib/useCurrentUser';
import { loadPostHogIfConsented } from '../lib/posthog';

export function Garden() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    loadPostHogIfConsented(user);
    void loadMore(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function loadMore(fromCursor: string | null) {
    // isLoadingRef guards against a rapid double-click firing two overlapping
    // requests with the same cursor (state updates aren't synchronous, so a
    // second click before the first request resolves would otherwise append
    // duplicate entries). It also absorbs React StrictMode's dev-only double
    // invocation of this effect on mount.
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoadingMore(true);
    try {
      const page = await apiClient.listEntries(fromCursor);
      setEntries((existing) => [...existing, ...page.entries]);
      setCursor(page.nextCursor);
      setHasLoadedOnce(true);
    } finally {
      isLoadingRef.current = false;
      setIsLoadingMore(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('Delete this Eve Moment? This cannot be undone.')) return;
    await apiClient.deleteEntry(id);
    setEntries((existing) => existing.filter((entry) => entry.id !== id));
  }

  return (
    <div>
      <h1>My Garden</h1>
      <nav>
        <a href="/today">Today</a> · <a href="/account">Account</a>
      </nav>
      {!hasLoadedOnce && <p>Loading…</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {entries.map((entry) => (
          <li key={entry.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <strong>{entry.color}</strong> — {entry.entry_date}
            <p>{entry.answer_text ?? '(not answered)'}</p>
            <p>Task: {entry.task_completed ? 'completed' : 'not completed'}</p>
            <button onClick={() => void deleteEntry(entry.id)}>Delete</button>
          </li>
        ))}
      </ul>
      {cursor && (
        <button disabled={isLoadingMore} onClick={() => void loadMore(cursor)}>
          {isLoadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
