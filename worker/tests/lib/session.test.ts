import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import {
  createSession,
  deleteSession,
  getSessionUser,
  parseBearerToken,
  parseSessionId,
  sessionCookie,
} from '../../src/lib/session';

async function seedUser(id: string) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(
      `INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, `sub-${id}`, `${id}@example.com`, now, now)
    .run();
}

describe('session lib', () => {
  it('creates a session and resolves it back to the user', async () => {
    await seedUser('u1');
    const session = await createSession(env.DB, 'u1');
    const user = await getSessionUser(env.DB, session.id);
    expect(user?.id).toBe('u1');
    expect(user?.email).toBe('u1@example.com');
  });

  it('returns null for an unknown session id', async () => {
    const user = await getSessionUser(env.DB, 'does-not-exist');
    expect(user).toBeNull();
  });

  it('parses the session id out of a cookie header', () => {
    expect(parseSessionId('other=1; eve_session=abc123; foo=bar')).toBe('abc123');
    expect(parseSessionId('other=1')).toBeNull();
    expect(parseSessionId(null)).toBeNull();
  });

  it('parses a bearer token out of an Authorization header', () => {
    expect(parseBearerToken('Bearer abc123')).toBe('abc123');
    expect(parseBearerToken('bearer abc123')).toBe('abc123');
    expect(parseBearerToken('Basic abc123')).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  it('builds a cookie string with the right attributes', () => {
    const cookie = sessionCookie('abc123', '.example.com', new Date('2027-01-01').toISOString());
    expect(cookie).toContain('eve_session=abc123');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Domain=.example.com');
  });

  it('deleteSession removes the row so lookups fail afterward', async () => {
    await seedUser('u2');
    const session = await createSession(env.DB, 'u2');
    await deleteSession(env.DB, session.id);
    const user = await getSessionUser(env.DB, session.id);
    expect(user).toBeNull();
  });
});
