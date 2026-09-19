import type { Context, Next } from 'hono';
import type { AuthedBindings } from './require-auth';

/**
 * Blocks "using the app" for a signed-in user who has not accepted the
 * required wellness/terms consent.
 *
 * Must run AFTER `requireAuth`, which is what puts `user` on the context.
 *
 * The React app already redirects such a user to /consent, but that is only a
 * client-side convention — a direct API call bypasses it entirely. The spec
 * requires consent to be recorded before the app is used, so the system
 * holding the data has to be the one enforcing it.
 *
 * Deliberately NOT applied to /api/me: `POST /api/me/consent` is how a user
 * consents in the first place, `GET /api/me` is how the client discovers they
 * still need to, and `DELETE /api/me` must always work so a user can delete
 * their account regardless of consent state.
 */
export async function requireConsent(c: Context<AuthedBindings>, next: Next) {
  const user = c.get('user');
  if (!user?.consentAcceptedAt) return c.json({ error: 'consent_required' }, 403);
  await next();
}
