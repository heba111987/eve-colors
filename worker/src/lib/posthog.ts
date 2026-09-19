import type { Env } from '../types';

type PostHogEnv = Pick<Env, 'POSTHOG_PROJECT_ID' | 'POSTHOG_DELETION_API_KEY'>;

export async function deletePostHogPerson(env: PostHogEnv, distinctId: string): Promise<void> {
  const lookupResponse = await fetch(
    `https://eu.posthog.com/api/projects/${env.POSTHOG_PROJECT_ID}/persons/?distinct_id=${encodeURIComponent(distinctId)}`,
    {
      headers: { Authorization: `Bearer ${env.POSTHOG_DELETION_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!lookupResponse.ok) throw new Error(`PostHog person lookup failed: ${lookupResponse.status}`);

  const data = await lookupResponse.json<{ results: Array<{ id: string }> }>();
  for (const person of data.results) {
    const deleteResponse = await fetch(
      `https://eu.posthog.com/api/projects/${env.POSTHOG_PROJECT_ID}/persons/${person.id}/`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${env.POSTHOG_DELETION_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      throw new Error(`PostHog person deletion failed: ${deleteResponse.status}`);
    }
  }
}
