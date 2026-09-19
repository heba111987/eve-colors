export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  consentAcceptedAt: string | null;
  analyticsMarketingConsentAt: string | null;
}

export const SESSION_COOKIE_NAME = 'eve_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(
  db: D1Database,
  userId: string,
): Promise<{ id: string; expiresAt: string }> {
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, expiresAt, now.toISOString())
    .run();
  return { id, expiresAt };
}

export function sessionCookie(sessionId: string, domain: string, expiresAt: string): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Domain=${domain}; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function clearSessionCookie(domain: string): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Domain=${domain}; Max-Age=0`;
}

export function parseSessionId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return match ? match.slice(SESSION_COOKIE_NAME.length + 1) : null;
}

export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function getSessionUser(db: D1Database, sessionId: string): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.consent_accepted_at, u.analytics_marketing_consent_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, new Date().toISOString())
    .first<{
      id: string;
      email: string;
      display_name: string | null;
      consent_accepted_at: string | null;
      analytics_marketing_consent_at: string | null;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    consentAcceptedAt: row.consent_accepted_at,
    analyticsMarketingConsentAt: row.analytics_marketing_consent_at,
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}
