# Eve Colors: Cloudflare Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Wix/Astro app with a Cloudflare Worker API (Hono + D1) and a static Cloudflare Pages frontend implementing Google OAuth sign-in, the color → question → answer → task daily flow, a timeline, GDPR consent/deletion, and PostHog EU analytics.

**Architecture:** A single Cloudflare Worker (`/worker`) using Hono for routing exposes `/auth/*` and `/api/*`, backed by Cloudflare D1. A static site (`/frontend`) on Cloudflare Pages calls that API with `credentials: 'include'` session cookies. No build step on either side beyond `wrangler`.

**Tech Stack:** Cloudflare Workers, Hono, Cloudflare D1 (SQLite), Cloudflare Pages, Vitest + `@cloudflare/vitest-pool-workers`, plain HTML/CSS/vanilla JS, PostHog Cloud (EU region).

**Spec:** `docs/superpowers/specs/2026-09-18-cloudflare-rebuild-design.md`

## Global Constraints

- Not a medical tool: the wellness/"Support & Safety" disclaimer must stay visible in the daily check-in flow, not buried in a footer.
- No payment/paywall of any kind.
- No data migration — clean slate.
- No admin dashboard UI in this phase (schema must not block adding one later).
- One entry per user per UTC calendar day (`UNIQUE (user_id, entry_date)`).
- Question selection excludes anything used by that user in the last 7 days; if the whole bank was used in 7 days, fall back to the least-recently-used question — never fail with "no question available."
- Quadrant is a fixed 4-value enum: `mental | physical | emotional | spiritual`.
- Google OAuth is implemented directly in the Worker — no third-party auth vendor, so all account data (incl. deletion) lives in one system.
- Session cookie: `HttpOnly; Secure; SameSite=Lax`, `Domain=.<domain>` so both subdomains can read it.
- Analytics/marketing consent is opt-in, unchecked by default, and separate from the required wellness/terms consent.
- PostHog EU region only. Never sell user data. No tracking script loads without consent.
- Account deletion (`DELETE /api/me`) must purge both the D1 rows (entries, sessions, user) and the PostHog person record — "delete all trace" spans both systems.
- The frontend is intentionally a **rough prototype**: plain HTML/CSS/vanilla JS, minimal styling, no attempt at polished visuals. The owner is redesigning the look separately in claude.ai/design — do not invest effort in graphics, custom fonts, or animation.

---

## Task 1: Repo scaffolding — remove Wix/Astro, add /worker and /frontend

**Files:**
- Delete: `wix.config.json`, `astro.config.mjs`, `skills-lock.json`, `src/extensions.ts`, `src/env.d.ts`, `src/styles.d.ts`, `src/extensions/` (entire directory), `.agents/skills/wix-app/`, `.agents/skills/wix-auth/`, `.agents/skills/wix-base44-connector/`, `.agents/skills/wix-design-system/`, `.agents/skills/wix-docs/`, `.agents/skills/wix-manage/`, `.agents/skills/wix-vibe-headless/`
- Modify: `package.json` (root), `tsconfig.json` (root)
- Create: `worker/` (empty dir, populated in later tasks), `frontend/` (empty dir, populated in later tasks), `.gitignore` entries for `.dev.vars` and `node_modules`

**Interfaces:**
- Produces: root `package.json` scripts (`dev:worker`, `dev:frontend`, `test`, `db:migrate:local`, `db:migrate:remote`) that every later task's manual-verification steps rely on.

- [ ] **Step 1: Remove the Wix/Astro files**

```bash
git rm -r wix.config.json astro.config.mjs skills-lock.json \
  src/extensions.ts src/env.d.ts src/styles.d.ts src/extensions \
  .agents/skills/wix-app .agents/skills/wix-auth .agents/skills/wix-base44-connector \
  .agents/skills/wix-design-system .agents/skills/wix-docs .agents/skills/wix-manage \
  .agents/skills/wix-vibe-headless
```

- [ ] **Step 2: Replace root `package.json`**

```json
{
  "name": "eve-colors",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:worker": "wrangler dev --config worker/wrangler.toml",
    "dev:frontend": "wrangler pages dev frontend --port 8788",
    "test": "vitest --config worker/vitest.config.ts",
    "db:migrate:local": "wrangler d1 migrations apply eve-colors --local --config worker/wrangler.toml",
    "db:migrate:remote": "wrangler d1 migrations apply eve-colors --remote --config worker/wrangler.toml",
    "deploy:worker": "wrangler deploy --config worker/wrangler.toml",
    "deploy:frontend": "wrangler pages deploy frontend"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.6.0",
    "@cloudflare/workers-types": "^4.20250101.0",
    "typescript": "^5.8.3",
    "vitest": "^2.1.0",
    "wrangler": "^3.90.0"
  },
  "dependencies": {
    "hono": "^4.6.0"
  }
}
```

- [ ] **Step 3: Replace root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types", "vitest/globals"],
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["worker/src", "worker/tests"]
}
```

- [ ] **Step 4: Create directories and `.gitignore` entries**

```bash
mkdir -p worker/src/lib worker/src/routes worker/src/middleware worker/migrations worker/tests frontend/shared
```

Append to `.gitignore` (create it if it doesn't exist):

```
node_modules/
.wrangler/
worker/.dev.vars
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: installs succeed, `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Wix/Astro scaffolding, add Cloudflare worker/frontend skeleton"
```

---

## Task 2: D1 schema migration + test harness

**Files:**
- Create: `worker/wrangler.toml`
- Create: `worker/migrations/0001_init.sql`
- Create: `worker/vitest.config.ts`
- Create: `worker/tests/setup/apply-migrations.ts`
- Create: `worker/src/types.ts`
- Test: `worker/tests/schema.test.ts`

**Interfaces:**
- Produces: `Env` type (`worker/src/types.ts`) used by every later Worker file; D1 binding name `DB`.

- [ ] **Step 1: Write `worker/wrangler.toml`**

```toml
name = "eve-colors-api"
main = "src/index.ts"
compatibility_date = "2026-09-18"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "eve-colors"
database_id = "REPLACE_AFTER_WRANGLER_D1_CREATE"

[vars]
GOOGLE_REDIRECT_URI = "http://localhost:8787/auth/google/callback"
SESSION_COOKIE_DOMAIN = "localhost"
FRONTEND_BASE_URL = "http://localhost:8788"
POSTHOG_PROJECT_ID = "REPLACE_WITH_POSTHOG_PROJECT_ID"
```

- [ ] **Step 2: Write `worker/src/types.ts`**

```typescript
export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SESSION_COOKIE_DOMAIN: string;
  FRONTEND_BASE_URL: string;
  POSTHOG_PROJECT_ID: string;
  POSTHOG_DELETION_API_KEY: string;
}
```

- [ ] **Step 3: Write `worker/migrations/0001_init.sql`**

Note: `consent_accepted_at` is nullable here, not `NOT NULL` as the spec's SQL sketch showed — the OAuth callback must create the user row *before* the consent screen can capture a timestamp, so it starts null and `POST /api/me/consent` fills it in. Enforced at the route layer (Task 6), not the schema.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  consent_accepted_at TEXT,
  analytics_marketing_consent_at TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  quadrant TEXT NOT NULL CHECK (quadrant IN ('mental','physical','emotional','spiritual')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  quadrant TEXT NOT NULL CHECK (quadrant IN ('mental','physical','emotional','spiritual')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  color TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  answer_text TEXT,
  task_id TEXT REFERENCES tasks(id),
  task_completed INTEGER NOT NULL DEFAULT 0,
  entry_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (user_id, entry_date)
);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_user_created ON entries(user_id, created_at);
```

- [ ] **Step 4: Write `worker/vitest.config.ts`**

```typescript
import path from 'node:path';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

const migrationsPath = path.join(__dirname, 'migrations');
const migrations = await readD1Migrations(migrationsPath);

export default defineWorkersConfig({
  test: {
    setupFiles: ['./tests/setup/apply-migrations.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      },
    },
  },
});
```

- [ ] **Step 5: Write `worker/tests/setup/apply-migrations.ts`**

```typescript
import { applyD1Migrations, env } from 'cloudflare:test';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

- [ ] **Step 6: Write the failing test `worker/tests/schema.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';

describe('D1 schema', () => {
  it('creates all five tables', async () => {
    const result = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>();
    const names = result.results.map((row) => row.name);
    expect(names).toEqual(
      expect.arrayContaining(['users', 'sessions', 'questions', 'tasks', 'entries']),
    );
  });

  it('enforces one entry per user per day', async () => {
    const now = new Date().toISOString();
    await env.DB
      .prepare(
        `INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES ('u1', 'sub1', 'a@example.com', ?, ?)`,
      )
      .bind(now, now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO questions (id, text, quadrant, created_at) VALUES ('q1', 'Q?', 'mental', ?)`,
      )
      .bind(now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e1', 'u1', 'Teal', 'q1', '2026-09-18', ?)`,
      )
      .bind(now)
      .run();

    await expect(
      env.DB
        .prepare(
          `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e2', 'u1', 'Gold', 'q1', '2026-09-18', ?)`,
        )
        .bind(now)
        .run(),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — no `wrangler.toml` D1 config error or module resolution error, since nothing is wired yet. (If `npm install` in Task 1 hasn't pulled in `@cloudflare/vitest-pool-workers`, add it now: `npm install -D @cloudflare/vitest-pool-workers`.)

- [ ] **Step 8: Run again after the files above exist**

Run: `npm test`
Expected: PASS — both tests green.

- [ ] **Step 9: Commit**

```bash
git add worker/wrangler.toml worker/migrations/0001_init.sql worker/vitest.config.ts \
  worker/tests/setup/apply-migrations.ts worker/tests/schema.test.ts worker/src/types.ts
git commit -m "feat(worker): add D1 schema migration and vitest-pool-workers test harness"
```

---

## Task 3: Seed content migration (11 questions, 33 tasks)

**Files:**
- Create: `worker/migrations/0002_seed_content.sql`
- Test: `worker/tests/seed-content.test.ts`

**Interfaces:**
- Produces: `questions` rows with ids `q-indigo` … `q-smoke`; `tasks` rows with ids `t-<color>-1/2/3`. Later tasks (`pickQuestion`, `pickTask`) query these tables by `active = 1` and `quadrant`, not by id, so exact ids only matter for this test.

- [ ] **Step 1: Write `worker/migrations/0002_seed_content.sql`**

```sql
INSERT INTO questions (id, text, quadrant, created_at) VALUES
  ('q-indigo', 'What truth do you already know but need to trust?', 'spiritual', '2026-09-18T00:00:00.000Z'),
  ('q-teal', 'What would help you feel steady in this moment?', 'physical', '2026-09-18T00:00:00.000Z'),
  ('q-sage', 'Where can you give yourself permission to slow down?', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('q-gold', 'What possibility feels worth taking one small step toward?', 'mental', '2026-09-18T00:00:00.000Z'),
  ('q-peach', 'What do you need to receive—or offer—with openness?', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('q-pink', 'How can you speak to yourself with more kindness today?', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('q-lilac', 'What is your intuition quietly asking you to notice?', 'spiritual', '2026-09-18T00:00:00.000Z'),
  ('q-ember', 'What is your frustration trying to protect or change?', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('q-tangerine', 'What can you set down so one thing can receive your attention?', 'mental', '2026-09-18T00:00:00.000Z'),
  ('q-voltage', 'What kind of movement or focus would help this energy feel useful?', 'physical', '2026-09-18T00:00:00.000Z'),
  ('q-smoke', 'What is the smallest burden you can reduce right now?', 'physical', '2026-09-18T00:00:00.000Z');

INSERT INTO tasks (id, text, quadrant, created_at) VALUES
  ('t-indigo-1', 'Take three unhurried breaths and let your shoulders soften.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-indigo-2', 'Write one sentence beginning, "What I know right now is…"', 'spiritual', '2026-09-18T00:00:00.000Z'),
  ('t-indigo-3', 'Take one small action that honors that truth without requiring complete certainty.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-teal-1', 'Notice both feet and name three things you can see around you.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-teal-2', 'Identify the one need that matters most in this moment.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-teal-3', 'Choose one practical step—water, food, rest, fresh air, or a clear boundary.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-sage-1', 'Lower your pace for one minute and lengthen each exhale.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-sage-2', 'Name one expectation you can soften or postpone today.', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('t-sage-3', 'Give yourself ten quiet minutes for rest, stretching, or time outside.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-gold-1', 'Name the idea or possibility that gives you the most energy.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-gold-2', 'Turn it into a step you can finish in ten minutes or less.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-gold-3', 'Start before you feel fully ready, then acknowledge that you moved forward.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-peach-1', 'Ask what kind of care would feel nourishing rather than demanding.', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('t-peach-2', 'Reach toward one safe person or comforting practice.', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('t-peach-3', 'Share one small act of warmth while keeping your own limits intact.', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('t-pink-1', 'Place a hand over your heart and take one slow, comfortable breath.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-pink-2', 'Replace one harsh thought with words that are honest and compassionate.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-pink-3', 'Do one small thing that makes today easier for your future self.', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('t-lilac-1', 'Put away one source of stimulation for five minutes.', 'spiritual', '2026-09-18T00:00:00.000Z'),
  ('t-lilac-2', 'Notice the thought, feeling, or body sensation that keeps returning.', 'spiritual', '2026-09-18T00:00:00.000Z'),
  ('t-lilac-3', 'Record what you noticed and choose whether it needs action, patience, or support.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-ember-1', 'Unclench your jaw, lower your shoulders, and press both feet firmly into the floor.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-ember-2', 'Complete the sentence, "What I need or wish were different is…"', 'emotional', '2026-09-18T00:00:00.000Z'),
  ('t-ember-3', 'Choose one respectful next step, or give yourself time before responding.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-tangerine-1', 'Write down your open loops and circle only the one that matters now.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-tangerine-2', 'Look away from the screen, sip water, and take three comfortable breaths.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-tangerine-3', 'Give the circled task five uninterrupted minutes, then reassess.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-voltage-1', 'Walk, stretch, or shake out your hands for one or two minutes.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-voltage-2', 'Notice five things you can see and three physical sensations you can feel.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-voltage-3', 'Choose one absorbing, low-stakes activity and stay with it for ten minutes.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-smoke-1', 'Postpone, delegate, or remove one nonessential demand.', 'mental', '2026-09-18T00:00:00.000Z'),
  ('t-smoke-2', 'Drink water and let your exhale be a little longer than your inhale.', 'physical', '2026-09-18T00:00:00.000Z'),
  ('t-smoke-3', 'Identify the smallest next step, or decide that rest is the next step.', 'mental', '2026-09-18T00:00:00.000Z');
```

- [ ] **Step 2: Write the failing test `worker/tests/seed-content.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';

const VALID_QUADRANTS = ['mental', 'physical', 'emotional', 'spiritual'];

describe('seed content', () => {
  it('has 11 active questions, all with a valid quadrant', async () => {
    const result = await env.DB
      .prepare('SELECT quadrant FROM questions WHERE active = 1')
      .all<{ quadrant: string }>();
    expect(result.results).toHaveLength(11);
    for (const row of result.results) {
      expect(VALID_QUADRANTS).toContain(row.quadrant);
    }
  });

  it('has 33 active tasks, all with a valid quadrant', async () => {
    const result = await env.DB
      .prepare('SELECT quadrant FROM tasks WHERE active = 1')
      .all<{ quadrant: string }>();
    expect(result.results).toHaveLength(33);
    for (const row of result.results) {
      expect(VALID_QUADRANTS).toContain(row.quadrant);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — 0 rows returned, since the migration doesn't exist yet in this step order. (If running after Step 1 is already written, it should PASS — reorder isn't critical here since this is seed data, not logic; just confirm the assertion actually exercises real data by temporarily commenting out the migration's INSERT statements once, confirming a failure, then restoring them.)

- [ ] **Step 4: Confirm it passes with the migration in place**

Run: `npm test`
Expected: PASS — both counts match.

- [ ] **Step 5: Commit**

```bash
git add worker/migrations/0002_seed_content.sql worker/tests/seed-content.test.ts
git commit -m "feat(worker): seed initial question and task content"
```

---

## Task 4: Session module

**Files:**
- Create: `worker/src/lib/session.ts`
- Test: `worker/tests/lib/session.test.ts`

**Interfaces:**
- Produces: `SESSION_COOKIE_NAME`, `SessionUser`, `createSession(db, userId)`, `sessionCookie(sessionId, domain, expiresAt)`, `clearSessionCookie(domain)`, `parseSessionId(cookieHeader)`, `getSessionUser(db, sessionId)`, `deleteSession(db, sessionId)` — consumed by Task 6's `requireAuth` middleware and Task 5's OAuth callback.

- [ ] **Step 1: Write the failing test `worker/tests/lib/session.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import {
  createSession,
  deleteSession,
  getSessionUser,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- session.test`
Expected: FAIL with "Cannot find module '../../src/lib/session'"

- [ ] **Step 3: Write `worker/src/lib/session.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- session.test`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/session.ts worker/tests/lib/session.test.ts
git commit -m "feat(worker): add session creation, cookie, and lookup helpers"
```

---

## Task 5: Google OAuth routes

**Files:**
- Create: `worker/src/lib/auth-google.ts`
- Create: `worker/src/routes/auth.ts`
- Test: `worker/tests/lib/auth-google.test.ts`
- Test: `worker/tests/routes/auth.test.ts`

**Interfaces:**
- Consumes: `createSession`, `sessionCookie` from `worker/src/lib/session.ts` (Task 4).
- Produces: `authRoutes` (a `Hono<{ Bindings: Env }>` instance) mounted at `/auth` in Task 13's `src/index.ts`.

- [ ] **Step 1: Write the failing test `worker/tests/lib/auth-google.test.ts`**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeCodeForTokens, googleAuthUrl, verifyIdToken } from '../../src/lib/auth-google';

const env = {
  GOOGLE_CLIENT_ID: 'client-123',
  GOOGLE_CLIENT_SECRET: 'secret-abc',
  GOOGLE_REDIRECT_URI: 'http://localhost:8787/auth/google/callback',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('googleAuthUrl', () => {
  it('builds an authorization URL with the required params', () => {
    const url = new URL(googleAuthUrl(env, 'state-xyz'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe(env.GOOGLE_REDIRECT_URI);
    expect(url.searchParams.get('state')).toBe('state-xyz');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
  });
});

describe('exchangeCodeForTokens', () => {
  it('posts the code to the Google token endpoint and returns the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'a', id_token: 'b', expires_in: 3600, token_type: 'Bearer' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await exchangeCodeForTokens(env, 'code-1');
    expect(tokens.id_token).toBe('b');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when Google responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));
    await expect(exchangeCodeForTokens(env, 'bad-code')).rejects.toThrow();
  });
});

describe('verifyIdToken', () => {
  it('returns the decoded user info when the audience matches and email is verified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ sub: 'sub-1', email: 'a@example.com', email_verified: true, aud: 'client-123' }),
          { status: 200 },
        ),
      ),
    );
    const info = await verifyIdToken('id-token-1', 'client-123');
    expect(info.sub).toBe('sub-1');
  });

  it('throws when the audience does not match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ sub: 'sub-1', email: 'a@example.com', email_verified: true, aud: 'someone-else' }),
          { status: 200 },
        ),
      ),
    );
    await expect(verifyIdToken('id-token-1', 'client-123')).rejects.toThrow('audience mismatch');
  });

  it('throws when the email is not verified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ sub: 'sub-1', email: 'a@example.com', email_verified: false, aud: 'client-123' }),
          { status: 200 },
        ),
      ),
    );
    await expect(verifyIdToken('id-token-1', 'client-123')).rejects.toThrow('not verified');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth-google.test`
Expected: FAIL with "Cannot find module '../../src/lib/auth-google'"

- [ ] **Step 3: Write `worker/src/lib/auth-google.ts`**

```typescript
import type { Env } from '../types';

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  aud: string;
}

type GoogleAuthEnv = Pick<Env, 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'GOOGLE_REDIRECT_URI'>;

export function googleAuthUrl(env: GoogleAuthEnv, state: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function exchangeCodeForTokens(
  env: GoogleAuthEnv,
  code: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  return response.json();
}

export async function verifyIdToken(idToken: string, expectedAudience: string): Promise<GoogleUserInfo> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!response.ok) throw new Error(`Google tokeninfo failed: ${response.status}`);
  const info = await response.json<GoogleUserInfo>();
  if (info.aud !== expectedAudience) throw new Error('ID token audience mismatch');
  if (!info.email_verified) throw new Error('Google email not verified');
  return info;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth-google.test`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Write the failing test `worker/tests/routes/auth.test.ts`**

```typescript
import { describe, expect, it, vi, afterEach } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { Hono } from 'hono';
import { authRoutes } from '../../src/routes/auth';
import type { Env } from '../../src/types';

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/auth', authRoutes);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /auth/google/start', () => {
  it('redirects to Google and sets a state cookie', async () => {
    const app = buildApp();
    const res = await app.request('/auth/google/start', {}, env, createExecutionContext());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('accounts.google.com');
    expect(res.headers.get('Set-Cookie')).toContain('eve_oauth_state=');
  });
});

describe('GET /auth/google/callback', () => {
  it('rejects when state does not match the cookie', async () => {
    const app = buildApp();
    const res = await app.request(
      '/auth/google/callback?code=abc&state=mismatched',
      { headers: { Cookie: 'eve_oauth_state=different' } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(400);
  });

  it('creates a new user, session, and redirects to /consent.html on first login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/token')) {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: 'a', id_token: 'id-1', expires_in: 3600, token_type: 'Bearer' })),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              sub: 'google-sub-1',
              email: 'new-user@example.com',
              email_verified: true,
              aud: env.GOOGLE_CLIENT_ID,
              name: 'New User',
            }),
          ),
        );
      }),
    );

    const app = buildApp();
    const res = await app.request(
      '/auth/google/callback?code=abc&state=same',
      { headers: { Cookie: 'eve_oauth_state=same' } },
      env,
      createExecutionContext(),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${env.FRONTEND_BASE_URL}/consent.html`);
    expect(res.headers.get('Set-Cookie')).toContain('eve_session=');

    const user = await env.DB
      .prepare('SELECT email FROM users WHERE google_sub = ?')
      .bind('google-sub-1')
      .first<{ email: string }>();
    expect(user?.email).toBe('new-user@example.com');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- routes/auth.test`
Expected: FAIL with "Cannot find module '../../src/routes/auth'"

- [ ] **Step 7: Write `worker/src/routes/auth.ts`**

```typescript
import { Hono } from 'hono';
import type { Env } from '../types';
import { exchangeCodeForTokens, googleAuthUrl, verifyIdToken } from '../lib/auth-google';
import { createSession, sessionCookie } from '../lib/session';

const OAUTH_STATE_COOKIE = 'eve_oauth_state';

function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.get('/google/start', (c) => {
  const state = crypto.randomUUID();
  const url = googleAuthUrl(c.env, state);
  c.header(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=300`,
  );
  return c.redirect(url, 302);
});

authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const cookieState = readCookie(c.req.header('Cookie') ?? '', OAUTH_STATE_COOKIE);

  if (!code || !state || !cookieState || state !== cookieState) {
    return c.json({ error: 'invalid_oauth_state' }, 400);
  }

  const tokens = await exchangeCodeForTokens(c.env, code);
  const userInfo = await verifyIdToken(tokens.id_token, c.env.GOOGLE_CLIENT_ID);

  const now = new Date().toISOString();
  const existing = await c.env.DB
    .prepare('SELECT id FROM users WHERE google_sub = ?')
    .bind(userInfo.sub)
    .first<{ id: string }>();

  let userId: string;
  if (existing) {
    userId = existing.id;
    await c.env.DB
      .prepare('UPDATE users SET last_login_at = ?, email = ?, display_name = ? WHERE id = ?')
      .bind(now, userInfo.email, userInfo.name ?? null, userId)
      .run();
  } else {
    userId = crypto.randomUUID();
    await c.env.DB
      .prepare(
        `INSERT INTO users (id, google_sub, email, display_name, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(userId, userInfo.sub, userInfo.email, userInfo.name ?? null, now, now)
      .run();
  }

  const session = await createSession(c.env.DB, userId);
  c.header('Set-Cookie', sessionCookie(session.id, c.env.SESSION_COOKIE_DOMAIN, session.expiresAt));
  const destination = existing ? '/today.html' : '/consent.html';
  return c.redirect(`${c.env.FRONTEND_BASE_URL}${destination}`, 302);
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- routes/auth.test`
Expected: PASS — all 3 tests green.

- [ ] **Step 9: Commit**

```bash
git add worker/src/lib/auth-google.ts worker/src/routes/auth.ts \
  worker/tests/lib/auth-google.test.ts worker/tests/routes/auth.test.ts
git commit -m "feat(worker): implement Google OAuth start/callback routes"
```

---

## Task 6: requireAuth middleware + GET /api/me + POST /api/me/consent

**Files:**
- Create: `worker/src/middleware/require-auth.ts`
- Create: `worker/src/routes/me.ts`
- Test: `worker/tests/routes/me.test.ts`

**Interfaces:**
- Consumes: `getSessionUser`, `parseSessionId`, `SessionUser` from `worker/src/lib/session.ts` (Task 4).
- Produces: `requireAuth` middleware (sets `c.set('user', SessionUser)`), consumed by every route in Tasks 7–9; `meRoutes` mounted at `/api/me` in Task 13.

- [ ] **Step 1: Write `worker/src/middleware/require-auth.ts`**

```typescript
import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { getSessionUser, parseSessionId, type SessionUser } from '../lib/session';

export type AuthedBindings = { Bindings: Env; Variables: { user: SessionUser } };

export async function requireAuth(c: Context<AuthedBindings>, next: Next) {
  const sessionId = parseSessionId(c.req.header('Cookie') ?? null);
  const user = sessionId ? await getSessionUser(c.env.DB, sessionId) : null;
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  await next();
}
```

- [ ] **Step 2: Write the failing test `worker/tests/routes/me.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { Hono } from 'hono';
import { meRoutes } from '../../src/routes/me';
import { createSession, sessionCookie } from '../../src/lib/session';
import type { Env } from '../../src/types';
import type { AuthedBindings } from '../../src/middleware/require-auth';

function buildApp() {
  const app = new Hono<AuthedBindings>();
  app.route('/api/me', meRoutes);
  return app;
}

async function seedSignedInUser(id: string) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(
      `INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, `sub-${id}`, `${id}@example.com`, now, now)
    .run();
  const session = await createSession(env.DB, id);
  return sessionCookie(session.id, 'localhost', session.expiresAt).split(';')[0];
}

describe('GET /api/me', () => {
  it('returns 401 with no session cookie', async () => {
    const app = buildApp();
    const res = await app.request('/api/me', {}, env, createExecutionContext());
    expect(res.status).toBe(401);
  });

  it('returns the user with null consent fields for a fresh signup', async () => {
    const cookie = await seedSignedInUser('u1');
    const app = buildApp();
    const res = await app.request('/api/me', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(res.status).toBe(200);
    const body = await res.json<{ user: { email: string; consentAcceptedAt: string | null } }>();
    expect(body.user.email).toBe('u1@example.com');
    expect(body.user.consentAcceptedAt).toBeNull();
  });
});

describe('POST /api/me/consent', () => {
  it('stamps consentAcceptedAt once and lets analytics consent be toggled afterward', async () => {
    const cookie = await seedSignedInUser('u2');
    const app = buildApp();

    const first = await app.request(
      '/api/me/consent',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ analyticsMarketing: true }) },
      env,
      createExecutionContext(),
    );
    expect(first.status).toBe(200);

    const afterFirst = await env.DB
      .prepare('SELECT consent_accepted_at, analytics_marketing_consent_at FROM users WHERE id = ?')
      .bind('u2')
      .first<{ consent_accepted_at: string; analytics_marketing_consent_at: string }>();
    expect(afterFirst?.consent_accepted_at).not.toBeNull();
    expect(afterFirst?.analytics_marketing_consent_at).not.toBeNull();

    await app.request(
      '/api/me/consent',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ analyticsMarketing: false }) },
      env,
      createExecutionContext(),
    );
    const afterSecond = await env.DB
      .prepare('SELECT consent_accepted_at, analytics_marketing_consent_at FROM users WHERE id = ?')
      .bind('u2')
      .first<{ consent_accepted_at: string; analytics_marketing_consent_at: string | null }>();
    expect(afterSecond?.consent_accepted_at).toBe(afterFirst?.consent_accepted_at);
    expect(afterSecond?.analytics_marketing_consent_at).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- routes/me.test`
Expected: FAIL with "Cannot find module '../../src/routes/me'"

- [ ] **Step 4: Write `worker/src/routes/me.ts`**

```typescript
import { Hono } from 'hono';
import { requireAuth, type AuthedBindings } from '../middleware/require-auth';

export const meRoutes = new Hono<AuthedBindings>();

meRoutes.get('/', requireAuth, (c) => {
  return c.json({ user: c.get('user') });
});

meRoutes.post('/consent', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ analyticsMarketing?: boolean }>();
  const now = new Date().toISOString();
  await c.env.DB
    .prepare(
      `UPDATE users
       SET consent_accepted_at = COALESCE(consent_accepted_at, ?),
           analytics_marketing_consent_at = ?
       WHERE id = ?`,
    )
    .bind(now, body.analyticsMarketing ? now : null, user.id)
    .run();
  return c.json({ ok: true });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- routes/me.test`
Expected: PASS — all 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add worker/src/middleware/require-auth.ts worker/src/routes/me.ts worker/tests/routes/me.test.ts
git commit -m "feat(worker): add requireAuth middleware and GET/POST /api/me endpoints"
```

---

## Task 7: DELETE /api/me (account deletion incl. PostHog purge)

**Files:**
- Create: `worker/src/lib/posthog.ts`
- Modify: `worker/src/routes/me.ts`
- Test: `worker/tests/lib/posthog.test.ts`
- Test: `worker/tests/routes/me.test.ts` (extend)

**Interfaces:**
- Consumes: `AuthedBindings`, `requireAuth` from Task 6; `SessionUser`, `parseSessionId`, `clearSessionCookie` from Task 4.
- Produces: `deletePostHogPerson(env, distinctId)`, used only here.

- [ ] **Step 1: Write the failing test `worker/tests/lib/posthog.test.ts`**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deletePostHogPerson } from '../../src/lib/posthog';

const env = { POSTHOG_PROJECT_ID: 'proj-1', POSTHOG_DELETION_API_KEY: 'key-1' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deletePostHogPerson', () => {
  it('looks up the person by distinct_id and deletes each match', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 'person-1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await deletePostHogPerson(env, 'user@example.com');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('distinct_id=user%40example.com'),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/persons/person-1/'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('does nothing when no person is found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );
    await expect(deletePostHogPerson(env, 'nobody@example.com')).resolves.toBeUndefined();
  });

  it('throws when the lookup request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('error', { status: 500 })));
    await expect(deletePostHogPerson(env, 'user@example.com')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/posthog.test`
Expected: FAIL with "Cannot find module '../../src/lib/posthog'"

- [ ] **Step 3: Write `worker/src/lib/posthog.ts`**

```typescript
import type { Env } from '../types';

type PostHogEnv = Pick<Env, 'POSTHOG_PROJECT_ID' | 'POSTHOG_DELETION_API_KEY'>;

export async function deletePostHogPerson(env: PostHogEnv, distinctId: string): Promise<void> {
  const lookupResponse = await fetch(
    `https://eu.posthog.com/api/projects/${env.POSTHOG_PROJECT_ID}/persons/?distinct_id=${encodeURIComponent(distinctId)}`,
    { headers: { Authorization: `Bearer ${env.POSTHOG_DELETION_API_KEY}` } },
  );
  if (!lookupResponse.ok) throw new Error(`PostHog person lookup failed: ${lookupResponse.status}`);

  const data = await lookupResponse.json<{ results: Array<{ id: string }> }>();
  for (const person of data.results) {
    const deleteResponse = await fetch(
      `https://eu.posthog.com/api/projects/${env.POSTHOG_PROJECT_ID}/persons/${person.id}/`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${env.POSTHOG_DELETION_API_KEY}` } },
    );
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      throw new Error(`PostHog person deletion failed: ${deleteResponse.status}`);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/posthog.test`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Write the failing test — append to `worker/tests/routes/me.test.ts`**

```typescript
describe('DELETE /api/me', () => {
  it('deletes the user, their sessions and entries, purges PostHog, and clears the cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );
    const cookie = await seedSignedInUser('u3');
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES ('q-del', 'Q?', 'mental', ?)`)
      .bind(now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e-del', 'u3', 'Teal', 'q-del', '2026-09-18', ?)`,
      )
      .bind(now)
      .run();

    const app = buildApp();
    const res = await app.request(
      '/api/me',
      { method: 'DELETE', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');

    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind('u3').first();
    const entry = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind('e-del').first();
    expect(user).toBeNull();
    expect(entry).toBeNull();
  });
});
```

Add `vi` to the existing `import { describe, expect, it } from 'vitest';` line at the top of the file, changing it to `import { describe, expect, it, vi, afterEach } from 'vitest';`, and add `afterEach(() => { vi.restoreAllMocks(); });` near the top of the file.

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- routes/me.test`
Expected: FAIL — `DELETE /api/me` returns 404 (no route registered).

- [ ] **Step 7: Extend `worker/src/routes/me.ts`**

Add to the top of the file:

```typescript
import { deletePostHogPerson } from '../lib/posthog';
import { clearSessionCookie, parseSessionId } from '../lib/session';
```

Append this route:

```typescript
meRoutes.delete('/', requireAuth, async (c) => {
  const user = c.get('user');

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM entries WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);

  await deletePostHogPerson(c.env, user.email);

  c.header('Set-Cookie', clearSessionCookie(c.env.SESSION_COOKIE_DOMAIN));
  return c.json({ ok: true });
});
```

(`parseSessionId` is imported for consistency with the rest of the module's session helpers even though this route only needs `clearSessionCookie`; `requireAuth` already resolved the session upstream.)

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- routes/me.test`
Expected: PASS — all 4 tests green.

- [ ] **Step 9: Commit**

```bash
git add worker/src/lib/posthog.ts worker/src/routes/me.ts \
  worker/tests/lib/posthog.test.ts worker/tests/routes/me.test.ts
git commit -m "feat(worker): add account deletion with PostHog person purge"
```

---

## Task 8: Question selection logic

**Files:**
- Create: `worker/src/lib/questions.ts`
- Test: `worker/tests/lib/questions.test.ts`

**Interfaces:**
- Produces: `QuestionRow { id, text, quadrant }`, `pickQuestion(db, userId): Promise<QuestionRow>` — consumed by Task 9's `POST /api/entries`.

- [ ] **Step 1: Write the failing test `worker/tests/lib/questions.test.ts`**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { pickQuestion } from '../../src/lib/questions';

async function seedQuestion(id: string, textSuffix: string) {
  await env.DB
    .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES (?, ?, 'mental', ?)`)
    .bind(id, `Question ${textSuffix}`, new Date().toISOString())
    .run();
}

async function seedUser(id: string) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, `sub-${id}`, `${id}@example.com`, now, now)
    .run();
}

async function seedEntry(id: string, userId: string, questionId: string, createdAt: string) {
  await env.DB
    .prepare(
      `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES (?, ?, 'Teal', ?, ?, ?)`,
    )
    .bind(id, userId, questionId, createdAt.slice(0, 10), createdAt)
    .run();
}

describe('pickQuestion', () => {
  beforeEach(async () => {
    await seedUser('u1');
  });

  it('excludes a question the user answered within the last 7 days', async () => {
    await seedQuestion('qa', 'A');
    await seedQuestion('qb', 'B');
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await seedEntry('e1', 'u1', 'qa', twoDaysAgo);

    for (let i = 0; i < 10; i += 1) {
      const question = await pickQuestion(env.DB, 'u1');
      expect(question.id).toBe('qb');
    }
  });

  it('makes a question eligible again after 7 days', async () => {
    await seedQuestion('qa', 'A');
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await seedEntry('e1', 'u1', 'qa', eightDaysAgo);

    const question = await pickQuestion(env.DB, 'u1');
    expect(question.id).toBe('qa');
  });

  it('falls back to the least-recently-used question when every question was used in the last 7 days', async () => {
    await seedQuestion('qa', 'A');
    await seedQuestion('qb', 'B');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    await seedEntry('e1', 'u1', 'qa', threeDaysAgo);
    await seedEntry('e2', 'u1', 'qb', oneDayAgo);

    const question = await pickQuestion(env.DB, 'u1');
    expect(question.id).toBe('qa');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/questions.test`
Expected: FAIL with "Cannot find module '../../src/lib/questions'"

- [ ] **Step 3: Write `worker/src/lib/questions.ts`**

```typescript
export interface QuestionRow {
  id: string;
  text: string;
  quadrant: string;
}

export async function pickQuestion(db: D1Database, userId: string): Promise<QuestionRow> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const recentlyUsed = await db
    .prepare('SELECT DISTINCT question_id FROM entries WHERE user_id = ? AND created_at >= ?')
    .bind(userId, sevenDaysAgo)
    .all<{ question_id: string }>();
  const excludedIds = recentlyUsed.results.map((row) => row.question_id);

  const eligible = excludedIds.length
    ? await db
        .prepare(
          `SELECT id, text, quadrant FROM questions WHERE active = 1 AND id NOT IN (${excludedIds.map(() => '?').join(',')})`,
        )
        .bind(...excludedIds)
        .all<QuestionRow>()
    : await db.prepare('SELECT id, text, quadrant FROM questions WHERE active = 1').all<QuestionRow>();

  if (eligible.results.length > 0) {
    return eligible.results[Math.floor(Math.random() * eligible.results.length)];
  }

  const fallback = await db
    .prepare(
      `SELECT q.id, q.text, q.quadrant
       FROM questions q
       LEFT JOIN entries e ON e.question_id = q.id AND e.user_id = ?
       WHERE q.active = 1
       GROUP BY q.id
       ORDER BY MAX(e.created_at) ASC
       LIMIT 1`,
    )
    .bind(userId)
    .first<QuestionRow>();

  if (!fallback) throw new Error('No active questions available.');
  return fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/questions.test`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/questions.ts worker/tests/lib/questions.test.ts
git commit -m "feat(worker): add 7-day no-repeat question selection with fallback"
```

---

## Task 9: Task selection logic

**Files:**
- Create: `worker/src/lib/tasks.ts`
- Test: `worker/tests/lib/tasks.test.ts`

**Interfaces:**
- Produces: `TaskRow { id, text, quadrant }`, `pickTask(db, excludeTaskId?): Promise<TaskRow>` — consumed by Task 10's `PATCH /api/entries/:id` (answer) and `POST /api/entries/:id/reroll-task`.

- [ ] **Step 1: Write the failing test `worker/tests/lib/tasks.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { pickTask } from '../../src/lib/tasks';

async function seedTask(id: string, textSuffix: string) {
  await env.DB
    .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES (?, ?, 'physical', ?)`)
    .bind(id, `Task ${textSuffix}`, new Date().toISOString())
    .run();
}

describe('pickTask', () => {
  it('returns a task from the active pool', async () => {
    await seedTask('ta', 'A');
    const task = await pickTask(env.DB);
    expect(task.id).toBe('ta');
  });

  it('excludes the given task id when rerolling, if another task exists', async () => {
    await seedTask('ta', 'A');
    await seedTask('tb', 'B');
    for (let i = 0; i < 10; i += 1) {
      const task = await pickTask(env.DB, 'ta');
      expect(task.id).toBe('tb');
    }
  });

  it('falls back to the excluded task if it is the only one available', async () => {
    await seedTask('ta', 'A');
    const task = await pickTask(env.DB, 'ta');
    expect(task.id).toBe('ta');
  });

  it('throws when there are no active tasks at all', async () => {
    await expect(pickTask(env.DB)).rejects.toThrow('No active tasks available.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/tasks.test`
Expected: FAIL with "Cannot find module '../../src/lib/tasks'"

- [ ] **Step 3: Write `worker/src/lib/tasks.ts`**

```typescript
export interface TaskRow {
  id: string;
  text: string;
  quadrant: string;
}

export async function pickTask(db: D1Database, excludeTaskId?: string): Promise<TaskRow> {
  const withExclusion = excludeTaskId
    ? await db
        .prepare('SELECT id, text, quadrant FROM tasks WHERE active = 1 AND id != ?')
        .bind(excludeTaskId)
        .all<TaskRow>()
    : null;

  const pool = withExclusion && withExclusion.results.length > 0
    ? withExclusion.results
    : (await db.prepare('SELECT id, text, quadrant FROM tasks WHERE active = 1').all<TaskRow>()).results;

  if (pool.length === 0) throw new Error('No active tasks available.');
  return pool[Math.floor(Math.random() * pool.length)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/tasks.test`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/tasks.ts worker/tests/lib/tasks.test.ts
git commit -m "feat(worker): add random task selection with reroll support"
```

---

## Task 10: GET /api/today + POST /api/entries

**Files:**
- Create: `worker/src/lib/entries.ts`
- Create: `worker/src/routes/entries.ts`
- Test: `worker/tests/lib/entries.test.ts`
- Test: `worker/tests/routes/entries.test.ts`

**Interfaces:**
- Consumes: `AuthedBindings`, `requireAuth` (Task 6); `pickQuestion` (Task 8).
- Produces: `todayUtc()`, `loadTodayEntry(db, userId)` (used by both this task's `GET /api/today` handler in `index.ts` and internally here); `entryRoutes` (Hono instance) mounted at `/api/entries` in Task 13, extended by Task 11 and Task 12.

- [ ] **Step 1: Write the failing test `worker/tests/lib/entries.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { loadTodayEntry, todayUtc } from '../../src/lib/entries';

describe('todayUtc', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('loadTodayEntry', () => {
  it('returns null when the user has no entry today', async () => {
    const entry = await loadTodayEntry(env.DB, 'no-such-user');
    expect(entry).toBeNull();
  });

  it('returns the joined entry, question, and task when one exists', async () => {
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES ('u1','s1','u1@example.com', ?, ?)`)
      .bind(now, now)
      .run();
    await env.DB
      .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES ('q1', 'Q?', 'mental', ?)`)
      .bind(now)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES ('e1', 'u1', 'Teal', 'q1', ?, ?)`,
      )
      .bind(todayUtc(), now)
      .run();

    const entry = await loadTodayEntry(env.DB, 'u1');
    expect(entry?.id).toBe('e1');
    expect(entry?.question_text).toBe('Q?');
    expect(entry?.task_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/entries.test`
Expected: FAIL with "Cannot find module '../../src/lib/entries'"

- [ ] **Step 3: Write `worker/src/lib/entries.ts`**

```typescript
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface TodayEntryRow {
  id: string;
  color: string;
  answer_text: string | null;
  task_completed: number;
  entry_date: string;
  question_id: string;
  question_text: string;
  question_quadrant: string;
  task_id: string | null;
  task_text: string | null;
  task_quadrant: string | null;
}

export async function loadTodayEntry(db: D1Database, userId: string): Promise<TodayEntryRow | null> {
  const row = await db
    .prepare(
      `SELECT e.id, e.color, e.answer_text, e.task_completed, e.entry_date,
              q.id as question_id, q.text as question_text, q.quadrant as question_quadrant,
              t.id as task_id, t.text as task_text, t.quadrant as task_quadrant
       FROM entries e
       JOIN questions q ON q.id = e.question_id
       LEFT JOIN tasks t ON t.id = e.task_id
       WHERE e.user_id = ? AND e.entry_date = ?`,
    )
    .bind(userId, todayUtc())
    .first<TodayEntryRow>();
  return row ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/entries.test`
Expected: PASS — both tests green.

- [ ] **Step 5: Write the failing test `worker/tests/routes/entries.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { Hono } from 'hono';
import { entryRoutes } from '../../src/routes/entries';
import { createSession, sessionCookie } from '../../src/lib/session';
import { todayUtc } from '../../src/lib/entries';
import type { AuthedBindings } from '../../src/middleware/require-auth';

function buildApp() {
  const app = new Hono<AuthedBindings>();
  app.route('/api/entries', entryRoutes);
  return app;
}

async function seedSignedInUser(id: string) {
  const now = new Date().toISOString();
  await env.DB
    .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, `sub-${id}`, `${id}@example.com`, now, now)
    .run();
  const session = await createSession(env.DB, id);
  return sessionCookie(session.id, 'localhost', session.expiresAt).split(';')[0];
}

async function seedQuestion(id: string) {
  await env.DB
    .prepare(`INSERT INTO questions (id, text, quadrant, created_at) VALUES (?, 'Q?', 'mental', ?)`)
    .bind(id, new Date().toISOString())
    .run();
}

describe('POST /api/entries', () => {
  it('creates today\'s entry with a picked question', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u1');
    const app = buildApp();

    const res = await app.request(
      '/api/entries',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ color: 'Teal' }) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(201);
    const body = await res.json<{ entry: { question: { id: string } } }>();
    expect(body.entry.question.id).toBe('q1');
  });

  it('rejects a second entry the same day with 409', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u2');
    const app = buildApp();

    await app.request(
      '/api/entries',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ color: 'Teal' }) },
      env,
      createExecutionContext(),
    );
    const second = await app.request(
      '/api/entries',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ color: 'Gold' }) },
      env,
      createExecutionContext(),
    );
    expect(second.status).toBe(409);
  });

  it('rejects a request with no color with 400', async () => {
    const cookie = await seedSignedInUser('u3');
    const app = buildApp();
    const res = await app.request(
      '/api/entries',
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- routes/entries.test`
Expected: FAIL with "Cannot find module '../../src/routes/entries'"

- [ ] **Step 7: Write `worker/src/routes/entries.ts`**

```typescript
import { Hono } from 'hono';
import { requireAuth, type AuthedBindings } from '../middleware/require-auth';
import { pickQuestion } from '../lib/questions';
import { todayUtc } from '../lib/entries';

export const entryRoutes = new Hono<AuthedBindings>();

entryRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ color?: string }>();
  if (!body.color) return c.json({ error: 'color is required' }, 400);

  const existing = await c.env.DB
    .prepare('SELECT id FROM entries WHERE user_id = ? AND entry_date = ?')
    .bind(user.id, todayUtc())
    .first();
  if (existing) return c.json({ error: 'entry_already_exists_today' }, 409);

  const question = await pickQuestion(c.env.DB, user.id);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB
    .prepare(
      `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at, task_completed)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
    )
    .bind(id, user.id, body.color, question.id, todayUtc(), now)
    .run();

  return c.json({ entry: { id, color: body.color, entryDate: todayUtc(), question } }, 201);
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- routes/entries.test`
Expected: PASS — all 3 tests green.

- [ ] **Step 9: Commit**

```bash
git add worker/src/lib/entries.ts worker/src/routes/entries.ts \
  worker/tests/lib/entries.test.ts worker/tests/routes/entries.test.ts
git commit -m "feat(worker): add entry-loading helper and POST /api/entries"
```

---

## Task 11: PATCH /api/entries/:id (answer, task complete) + reroll-task

**Files:**
- Modify: `worker/src/routes/entries.ts`
- Modify: `worker/tests/routes/entries.test.ts`

**Interfaces:**
- Consumes: `pickTask` (Task 9).
- Produces: nothing new consumed elsewhere — this completes the daily-flow contract described in the spec's §5 API surface.

- [ ] **Step 1: Write the failing tests — append to `worker/tests/routes/entries.test.ts`**

```typescript
async function createTodayEntry(app: Hono<AuthedBindings>, cookie: string): Promise<string> {
  const res = await app.request(
    '/api/entries',
    { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ color: 'Teal' }) },
    env,
    createExecutionContext(),
  );
  const body = await res.json<{ entry: { id: string } }>();
  return body.entry.id;
}

describe('PATCH /api/entries/:id (answer)', () => {
  it('saves the answer and assigns a task', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?)`)
      .bind(new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u4');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);

    const res = await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'I feel steady today.' }) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ entry: { task: { id: string } } }>();
    expect(body.entry.task.id).toBe('t1');
  });

  it('rejects answering the same entry twice with 409', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?)`)
      .bind(new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u5');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);

    await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'first' }) },
      env,
      createExecutionContext(),
    );
    const second = await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'second' }) },
      env,
      createExecutionContext(),
    );
    expect(second.status).toBe(409);
  });
});

describe('PATCH /api/entries/:id (taskCompleted)', () => {
  it('marks the task complete', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?)`)
      .bind(new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u6');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);
    await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'answer' }) },
      env,
      createExecutionContext(),
    );

    const res = await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ taskCompleted: true }) },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT task_completed FROM entries WHERE id = ?').bind(entryId).first<{ task_completed: number }>();
    expect(row?.task_completed).toBe(1);
  });
});

describe('POST /api/entries/:id/reroll-task', () => {
  it('assigns a different task before completion', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(
        `INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?), ('t2', 'Meditate.', 'spiritual', ?)`,
      )
      .bind(new Date().toISOString(), new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u7');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);
    const answerRes = await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'answer' }) },
      env,
      createExecutionContext(),
    );
    const answerBody = await answerRes.json<{ entry: { task: { id: string } } }>();
    const firstTaskId = answerBody.entry.task.id;

    const res = await app.request(
      `/api/entries/${entryId}/reroll-task`,
      { method: 'POST', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ task: { id: string } }>();
    expect(body.task.id).not.toBe(firstTaskId);
  });

  it('rejects rerolling after the task is completed', async () => {
    await seedQuestion('q1');
    await env.DB
      .prepare(`INSERT INTO tasks (id, text, quadrant, created_at) VALUES ('t1', 'Take a walk.', 'physical', ?)`)
      .bind(new Date().toISOString())
      .run();
    const cookie = await seedSignedInUser('u8');
    const app = buildApp();
    const entryId = await createTodayEntry(app, cookie);
    await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'answer' }) },
      env,
      createExecutionContext(),
    );
    await app.request(
      `/api/entries/${entryId}`,
      { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ taskCompleted: true }) },
      env,
      createExecutionContext(),
    );

    const res = await app.request(
      `/api/entries/${entryId}/reroll-task`,
      { method: 'POST', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(409);
  });
});
```

Add `import { Hono } from 'hono';` is already present; the new tests reuse `buildApp`, `seedSignedInUser`, and `seedQuestion` already defined earlier in the file from Task 10.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- routes/entries.test`
Expected: FAIL — `PATCH`/reroll routes return 404 (not yet registered).

- [ ] **Step 3: Append to `worker/src/routes/entries.ts`**

Add to the top imports:

```typescript
import { pickTask } from '../lib/tasks';
```

Append these routes:

```typescript
interface EntryRow {
  id: string;
  user_id: string;
  color: string;
  question_id: string;
  answer_text: string | null;
  task_id: string | null;
  task_completed: number;
  entry_date: string;
}

async function loadOwnedEntry(db: D1Database, userId: string, entryId: string): Promise<EntryRow | null> {
  const row = await db
    .prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?')
    .bind(entryId, userId)
    .first<EntryRow>();
  return row ?? null;
}

entryRoutes.patch('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const entryId = c.req.param('id');
  const entry = await loadOwnedEntry(c.env.DB, user.id, entryId);
  if (!entry) return c.json({ error: 'not_found' }, 404);

  const body = await c.req.json<{ answer?: string; taskCompleted?: boolean }>();

  if (typeof body.answer === 'string') {
    if (entry.answer_text !== null) return c.json({ error: 'already_answered' }, 409);
    const task = await pickTask(c.env.DB);
    await c.env.DB
      .prepare('UPDATE entries SET answer_text = ?, task_id = ? WHERE id = ?')
      .bind(body.answer, task.id, entryId)
      .run();
    return c.json({ entry: { ...entry, answerText: body.answer, task } });
  }

  if (body.taskCompleted === true) {
    if (!entry.task_id) return c.json({ error: 'no_task_assigned' }, 409);
    const completedAt = new Date().toISOString();
    await c.env.DB
      .prepare('UPDATE entries SET task_completed = 1, completed_at = ? WHERE id = ?')
      .bind(completedAt, entryId)
      .run();
    return c.json({ entry: { ...entry, taskCompleted: true, completedAt } });
  }

  return c.json({ error: 'no_recognized_update' }, 400);
});

entryRoutes.post('/:id/reroll-task', requireAuth, async (c) => {
  const user = c.get('user');
  const entryId = c.req.param('id');
  const entry = await loadOwnedEntry(c.env.DB, user.id, entryId);
  if (!entry) return c.json({ error: 'not_found' }, 404);
  if (entry.task_completed) return c.json({ error: 'task_already_completed' }, 409);
  if (!entry.task_id) return c.json({ error: 'no_task_assigned_yet' }, 409);

  const task = await pickTask(c.env.DB, entry.task_id);
  await c.env.DB.prepare('UPDATE entries SET task_id = ? WHERE id = ?').bind(task.id, entryId).run();
  return c.json({ task });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- routes/entries.test`
Expected: PASS — all 8 tests in this file green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/entries.ts worker/tests/routes/entries.test.ts
git commit -m "feat(worker): add answer/task-complete PATCH and reroll-task routes"
```

---

## Task 12: GET /api/entries (timeline) + DELETE /api/entries/:id

**Files:**
- Modify: `worker/src/routes/entries.ts`
- Modify: `worker/tests/routes/entries.test.ts`

**Interfaces:**
- Produces: nothing new consumed elsewhere — completes the entries route contract.

- [ ] **Step 1: Write the failing tests — append to `worker/tests/routes/entries.test.ts`**

```typescript
async function seedManualEntry(userId: string, id: string, daysAgo: number) {
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  await env.DB
    .prepare(
      `INSERT INTO entries (id, user_id, color, question_id, entry_date, created_at) VALUES (?, ?, 'Teal', 'q1', ?, ?)`,
    )
    .bind(id, userId, createdAt.slice(0, 10), createdAt)
    .run();
}

describe('GET /api/entries', () => {
  it('returns entries newest first with pagination', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u9');
    await seedManualEntry('u9', 'e1', 10);
    await seedManualEntry('u9', 'e2', 5);
    await seedManualEntry('u9', 'e3', 1);
    const app = buildApp();

    const firstPage = await app.request(
      '/api/entries?cursor=' + encodeURIComponent(''),
      { headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    // No cursor on first call:
    const res = await app.request('/api/entries', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(res.status).toBe(200);
    const body = await res.json<{ entries: Array<{ id: string }>; nextCursor: string | null }>();
    expect(body.entries.map((e) => e.id)).toEqual(['e3', 'e2', 'e1']);
    expect(body.nextCursor).toBeNull();
    void firstPage;
  });

  it('only returns the requesting user\'s entries', async () => {
    await seedQuestion('q1');
    const cookieA = await seedSignedInUser('u10');
    await seedSignedInUser('u11');
    await seedManualEntry('u10', 'e-a', 1);
    await seedManualEntry('u11', 'e-b', 1);
    const app = buildApp();

    const res = await app.request('/api/entries', { headers: { Cookie: cookieA } }, env, createExecutionContext());
    const body = await res.json<{ entries: Array<{ id: string }> }>();
    expect(body.entries.map((e) => e.id)).toEqual(['e-a']);
  });
});

describe('DELETE /api/entries/:id', () => {
  it('deletes an entry the user owns', async () => {
    await seedQuestion('q1');
    const cookie = await seedSignedInUser('u12');
    await seedManualEntry('u12', 'e-owned', 1);
    const app = buildApp();

    const res = await app.request(
      '/api/entries/e-owned',
      { method: 'DELETE', headers: { Cookie: cookie } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind('e-owned').first();
    expect(row).toBeNull();
  });

  it('returns 404 for an entry owned by someone else', async () => {
    await seedQuestion('q1');
    await seedSignedInUser('u13');
    const cookieB = await seedSignedInUser('u14');
    await seedManualEntry('u13', 'e-not-mine', 1);
    const app = buildApp();

    const res = await app.request(
      '/api/entries/e-not-mine',
      { method: 'DELETE', headers: { Cookie: cookieB } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(404);
    const row = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind('e-not-mine').first();
    expect(row).not.toBeNull();
  });
});
```

(The `firstPage`/`void firstPage` lines exercise the cursor query param with an empty string without asserting on it, just to confirm it doesn't throw; the real pagination assertion is the no-cursor call.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- routes/entries.test`
Expected: FAIL — `GET /` and `DELETE /:id` return 404 (not yet registered).

- [ ] **Step 3: Append to `worker/src/routes/entries.ts`**

```typescript
entryRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const cursor = c.req.query('cursor');
  const limit = 20;

  const rows = cursor
    ? await c.env.DB
        .prepare('SELECT * FROM entries WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?')
        .bind(user.id, cursor, limit + 1)
        .all<EntryRow & { created_at: string }>()
    : await c.env.DB
        .prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
        .bind(user.id, limit + 1)
        .all<EntryRow & { created_at: string }>();

  const hasMore = rows.results.length > limit;
  const page = hasMore ? rows.results.slice(0, limit) : rows.results;
  return c.json({
    entries: page,
    nextCursor: hasMore ? page[page.length - 1].created_at : null,
  });
});

entryRoutes.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const entryId = c.req.param('id');
  const result = await c.env.DB
    .prepare('DELETE FROM entries WHERE id = ? AND user_id = ?')
    .bind(entryId, user.id)
    .run();
  if (result.meta.changes === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- routes/entries.test`
Expected: PASS — all 12 tests in this file green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/entries.ts worker/tests/routes/entries.test.ts
git commit -m "feat(worker): add paginated timeline GET and entry DELETE routes"
```

---

## Task 13: Assemble the Hono app (src/index.ts)

**Files:**
- Create: `worker/src/index.ts`
- Test: `worker/tests/index.test.ts`

**Interfaces:**
- Consumes: `authRoutes` (Task 5), `meRoutes` (Task 6/7), `entryRoutes` (Tasks 10–12), `loadTodayEntry` (Task 10), `requireAuth` (Task 6).
- Produces: the default-exported Hono `app`, the Worker's actual entry point per `wrangler.toml`'s `main = "src/index.ts"`.

- [ ] **Step 1: Write the failing test `worker/tests/index.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import app from '../src/index';
import { createSession, sessionCookie } from '../src/lib/session';

describe('assembled app', () => {
  it('routes /auth/google/start', async () => {
    const res = await app.request('/auth/google/start', {}, env, createExecutionContext());
    expect(res.status).toBe(302);
  });

  it('routes GET /api/today for a signed-in user with no entry yet', async () => {
    const now = new Date().toISOString();
    await env.DB
      .prepare(`INSERT INTO users (id, google_sub, email, created_at, last_login_at) VALUES ('u1','s1','u1@example.com', ?, ?)`)
      .bind(now, now)
      .run();
    const session = await createSession(env.DB, 'u1');
    const cookie = sessionCookie(session.id, 'localhost', session.expiresAt).split(';')[0];

    const res = await app.request('/api/today', { headers: { Cookie: cookie } }, env, createExecutionContext());
    expect(res.status).toBe(200);
    const body = await res.json<{ entry: null }>();
    expect(body.entry).toBeNull();
  });

  it('routes /api/entries', async () => {
    const res = await app.request('/api/entries', {}, env, createExecutionContext());
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/index.test`
Expected: FAIL with "Cannot find module '../src/index'"

- [ ] **Step 3: Write `worker/src/index.ts`**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import type { AuthedBindings } from './middleware/require-auth';
import { requireAuth } from './middleware/require-auth';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { entryRoutes } from './routes/entries';
import { loadTodayEntry } from './lib/entries';

const app = new Hono<AuthedBindings>();

app.use('*', async (c, next) => {
  const middleware = cors({ origin: c.env.FRONTEND_BASE_URL, credentials: true });
  return middleware(c, next);
});

app.route('/auth', authRoutes);
app.route('/api/me', meRoutes);
app.route('/api/entries', entryRoutes);

app.get('/api/today', requireAuth, async (c) => {
  const user = c.get('user');
  const entry = await loadTodayEntry(c.env.DB, user.id);
  return c.json({ entry });
});

export default app;
export type { Env };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/index.test`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file from Tasks 2–13 green.

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/tests/index.test.ts
git commit -m "feat(worker): assemble the Hono app entry point"
```

---

## Task 14: Frontend — sign-in + first-login consent screen (rough prototype)

**Files:**
- Create: `frontend/shared/config.js`
- Create: `frontend/shared/api.js`
- Create: `frontend/shared/base.css`
- Create: `frontend/index.html`
- Create: `frontend/consent.html`
- Create: `frontend/consent.js`

**Interfaces:**
- Produces: `API_BASE` (config.js), `apiFetch(path, options)` (api.js) — consumed by every later frontend task.
- No automated tests for the frontend per the spec (§9) — this task's verification step is running two local dev servers and checking the flow by hand in a browser.

- [ ] **Step 1: Write `frontend/shared/config.js`**

```javascript
// Rough prototype — hardcode dev values here. Update for each deploy target
// (local dev vs. the real api.<domain> once DNS is live).
export const API_BASE = 'http://localhost:8787';
export const POSTHOG_EU_PROJECT_KEY = 'REPLACE_WITH_POSTHOG_PUBLIC_KEY';
```

- [ ] **Step 2: Write `frontend/shared/api.js`**

```javascript
import { API_BASE } from './config.js';

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (response.status === 401) {
    window.location.href = '/index.html';
    throw new Error('Not signed in.');
  }
  return response;
}

export async function getCurrentUser() {
  const res = await apiFetch('/api/me');
  if (!res.ok) return null;
  const body = await res.json();
  return body.user;
}
```

- [ ] **Step 3: Write `frontend/shared/base.css`**

Intentionally minimal — this is a functional prototype, not the final design.

```css
body {
  font-family: system-ui, sans-serif;
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
  color: #222;
}
button {
  font: inherit;
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid #444;
  background: #fff;
  cursor: pointer;
}
button.primary {
  background: #222;
  color: #fff;
}
textarea, input[type="text"] {
  font: inherit;
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
}
.color-swatch {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 88px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.color-swatch span.dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: block;
}
.notice {
  margin-top: 24px;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 13px;
  color: #555;
}
```

- [ ] **Step 4: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Eve Colors</title>
  <link rel="stylesheet" href="/shared/base.css" />
</head>
<body>
  <h1>Eve Colors</h1>
  <p>A daily wellness check-in. Not a medical tool — see the note below.</p>
  <a class="primary" href="http://localhost:8787/auth/google/start" style="display:inline-block; padding:10px 18px; border-radius:8px; background:#222; color:#fff; text-decoration:none;">
    Sign in with Google
  </a>
  <p class="notice">
    Eve Colors is a wellness self-reflection tool. It does not provide medical advice, diagnosis, or treatment.
    If you are in the U.S. and need immediate support, call or text 988. If you are in immediate danger, contact local emergency services.
  </p>
</body>
</html>
```

(The sign-in link's `href` is hardcoded to the local Worker URL to match `config.js`'s `API_BASE` for this prototype — update alongside `config.js` for other environments.)

- [ ] **Step 5: Write `frontend/consent.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Eve Colors — Before you start</title>
  <link rel="stylesheet" href="/shared/base.css" />
</head>
<body>
  <h1>Before you start</h1>
  <div class="notice">
    <p><strong>Eve Colors is a wellness tool, not a medical device.</strong> It does not provide medical advice, diagnosis, or treatment.</p>
    <p>We store your Google email and display name to run your account, plus the entries you write. Deleting your account permanently removes all of it.</p>
  </div>
  <p><label><input type="checkbox" id="analytics-consent" /> I agree to analytics tracking and to being contacted by email for marketing purposes. Eve Colors will never sell my email address.</label></p>
  <button class="primary" id="continue-button">I understand, continue</button>
  <p id="status" role="status"></p>
  <script type="module" src="/consent.js"></script>
</body>
</html>
```

- [ ] **Step 6: Write `frontend/consent.js`**

```javascript
import { apiFetch, getCurrentUser } from './shared/api.js';

const status = document.getElementById('status');

const user = await getCurrentUser();
if (user && user.consentAcceptedAt) {
  window.location.href = '/today.html';
}

document.getElementById('continue-button').addEventListener('click', async () => {
  const analyticsMarketing = document.getElementById('analytics-consent').checked;
  status.textContent = 'Saving…';
  const res = await apiFetch('/api/me/consent', {
    method: 'POST',
    body: JSON.stringify({ analyticsMarketing }),
  });
  if (!res.ok) {
    status.textContent = 'Something went wrong. Please try again.';
    return;
  }
  window.location.href = '/today.html';
});
```

- [ ] **Step 7: Manual verification**

Run in two terminals: `npm run dev:worker` and `npm run dev:frontend`.
Open `http://localhost:8788/index.html`, click "Sign in with Google" — Google's real consent screen should appear (this requires `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` to be set in `worker/.dev.vars`; if they aren't yet, confirm instead that the click redirects to `accounts.google.com` with a `400: redirect_uri_mismatch` or similar Google-side error, which still proves the Worker-side redirect logic fired correctly).
Expected: browser navigates to `accounts.google.com`.

- [ ] **Step 8: Commit**

```bash
git add frontend/shared/config.js frontend/shared/api.js frontend/shared/base.css \
  frontend/index.html frontend/consent.html frontend/consent.js
git commit -m "feat(frontend): add sign-in landing and first-login consent screen (rough prototype)"
```

---

## Task 15: Frontend — today check-in flow

**Files:**
- Create: `frontend/today.html`
- Create: `frontend/today.js`

**Interfaces:**
- Consumes: `apiFetch`, `getCurrentUser` (Task 14).

- [ ] **Step 1: Write `frontend/today.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Eve Colors — Today</title>
  <link rel="stylesheet" href="/shared/base.css" />
</head>
<body>
  <h1>Today</h1>
  <nav><a href="/garden.html">My Garden</a> · <a href="/account.html">Account</a></nav>
  <div id="app"></div>
  <p class="notice">
    Eve Colors is a wellness self-reflection tool. It does not provide medical advice, diagnosis, or treatment.
    If you are in the U.S. and need immediate support, call or text 988. If you are in immediate danger, contact local emergency services.
  </p>
  <script type="module" src="/today.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `frontend/today.js`**

```javascript
import { apiFetch, getCurrentUser } from './shared/api.js';

const COLORS = [
  ['Indigo', '#34435f'], ['Teal', '#4f8f86'], ['Sage', '#859873'], ['Gold', '#b79239'],
  ['Peach', '#c48665'], ['Pink', '#b85e78'], ['Lilac', '#75658d'], ['Ember', '#9f493d'],
  ['Tangerine', '#c96f35'], ['Voltage', '#5868a6'], ['Smoke', '#68716d'],
];

const app = document.getElementById('app');

const user = await getCurrentUser();
if (!user) {
  window.location.href = '/index.html';
} else if (!user.consentAcceptedAt) {
  window.location.href = '/consent.html';
} else {
  await render();
}

async function render() {
  const res = await apiFetch('/api/today');
  const { entry } = await res.json();

  if (!entry) return renderColorPicker();
  if (entry.answer_text === null) return renderQuestion(entry);
  if (!entry.task_completed) return renderTask(entry);
  return renderDone(entry);
}

function renderColorPicker() {
  app.innerHTML = `
    <p>Pick the color that matches how you feel today.</p>
    <div id="colors" style="display:flex; flex-wrap:wrap; gap:10px;"></div>
  `;
  const container = document.getElementById('colors');
  for (const [name, hex] of COLORS) {
    const button = document.createElement('button');
    button.className = 'color-swatch';
    button.innerHTML = `<span class="dot" style="background:${hex}"></span>${name}`;
    button.addEventListener('click', () => startEntry(name));
    container.appendChild(button);
  }
}

async function startEntry(color) {
  const res = await apiFetch('/api/entries', { method: 'POST', body: JSON.stringify({ color }) });
  if (!res.ok) {
    app.innerHTML = `<p>Could not start today's entry. Please refresh and try again.</p>`;
    return;
  }
  const { entry } = await res.json();
  renderQuestion({ id: entry.id, question_text: entry.question.text });
}

function renderQuestion(entry) {
  app.innerHTML = `
    <p><strong>${entry.question_text}</strong></p>
    <textarea id="answer" rows="6" maxlength="5000"></textarea>
    <p><button class="primary" id="save-answer">Save my reflection</button></p>
    <p id="status"></p>
  `;
  document.getElementById('save-answer').addEventListener('click', async () => {
    const answer = document.getElementById('answer').value.trim();
    if (!answer) {
      document.getElementById('status').textContent = 'Write anything that feels true for you.';
      return;
    }
    const res = await apiFetch(`/api/entries/${entry.id}`, { method: 'PATCH', body: JSON.stringify({ answer }) });
    const body = await res.json();
    renderTask({ id: entry.id, task_text: body.entry.task.text });
  });
}

function renderTask(entry) {
  app.innerHTML = `
    <p>One small thing for today:</p>
    <p><strong>${entry.task_text}</strong></p>
    <p>
      <button class="primary" id="complete-task">I did it</button>
      <button id="reroll-task">Give me another idea</button>
    </p>
  `;
  document.getElementById('reroll-task').addEventListener('click', async () => {
    const res = await apiFetch(`/api/entries/${entry.id}/reroll-task`, { method: 'POST' });
    const body = await res.json();
    renderTask({ id: entry.id, task_text: body.task.text });
  });
  document.getElementById('complete-task').addEventListener('click', async () => {
    await apiFetch(`/api/entries/${entry.id}`, { method: 'PATCH', body: JSON.stringify({ taskCompleted: true }) });
    renderDone(entry);
  });
}

function renderDone() {
  app.innerHTML = `
    <p>You showed up for yourself today. 🌸</p>
    <p><a href="/garden.html">View My Garden</a></p>
  `;
}
```

- [ ] **Step 3: Manual verification**

With both dev servers running and a session cookie present (after completing Task 14's sign-in flow against a real or test Google OAuth client), open `http://localhost:8788/today.html`.
Expected: color picker renders; clicking a color shows a question; submitting an answer shows a task; "Give me another idea" swaps the task; "I did it" shows the done screen; reloading the page after completion still shows the done screen (via `GET /api/today`); reloading the page again to try creating a second entry the same day should be prevented (no picker shown).

- [ ] **Step 4: Commit**

```bash
git add frontend/today.html frontend/today.js
git commit -m "feat(frontend): add today check-in flow (rough prototype)"
```

---

## Task 16: Frontend — timeline ("My Garden")

**Files:**
- Create: `frontend/garden.html`
- Create: `frontend/garden.js`

**Interfaces:**
- Consumes: `apiFetch`, `getCurrentUser` (Task 14).

- [ ] **Step 1: Write `frontend/garden.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Eve Colors — My Garden</title>
  <link rel="stylesheet" href="/shared/base.css" />
</head>
<body>
  <h1>My Garden</h1>
  <nav><a href="/today.html">Today</a> · <a href="/account.html">Account</a></nav>
  <div id="app"></div>
  <script type="module" src="/garden.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `frontend/garden.js`**

```javascript
import { apiFetch, getCurrentUser } from './shared/api.js';

const app = document.getElementById('app');
let cursor = null;

const user = await getCurrentUser();
if (!user) {
  window.location.href = '/index.html';
} else {
  app.innerHTML = '<ul id="entries" style="list-style:none; padding:0;"></ul><button id="load-more">Load more</button>';
  document.getElementById('load-more').addEventListener('click', loadMore);
  await loadMore();
}

async function loadMore() {
  const url = cursor ? `/api/entries?cursor=${encodeURIComponent(cursor)}` : '/api/entries';
  const res = await apiFetch(url);
  const body = await res.json();
  cursor = body.nextCursor;
  const list = document.getElementById('entries');
  for (const entry of body.entries) {
    const item = document.createElement('li');
    item.style.cssText = 'border:1px solid #ccc; border-radius:8px; padding:12px; margin-bottom:8px;';
    item.innerHTML = `
      <strong>${entry.color}</strong> — ${entry.entry_date}
      <p>${entry.answer_text ?? '(not answered)'}</p>
      <p>Task: ${entry.task_completed ? 'completed' : 'not completed'}</p>
      <button data-id="${entry.id}" class="delete-entry">Delete</button>
    `;
    item.querySelector('.delete-entry').addEventListener('click', () => deleteEntry(entry.id, item));
    list.appendChild(item);
  }
  document.getElementById('load-more').style.display = cursor ? 'inline-block' : 'none';
}

async function deleteEntry(id, item) {
  if (!window.confirm('Delete this Eve Moment? This cannot be undone.')) return;
  const res = await apiFetch(`/api/entries/${id}`, { method: 'DELETE' });
  if (res.ok) item.remove();
}
```

- [ ] **Step 3: Manual verification**

After creating at least one entry via `today.html`, open `http://localhost:8788/garden.html`.
Expected: the entry appears in the list with its color, date, answer, and task status; "Delete" removes it after confirmation and the item disappears from the page.

- [ ] **Step 4: Commit**

```bash
git add frontend/garden.html frontend/garden.js
git commit -m "feat(frontend): add My Garden timeline (rough prototype)"
```

---

## Task 17: Frontend — account/privacy page + PostHog EU loader

**Files:**
- Create: `frontend/account.html`
- Create: `frontend/account.js`
- Create: `frontend/shared/posthog.js`
- Modify: `frontend/today.js`, `frontend/garden.js` (wire in the PostHog loader)

**Interfaces:**
- Consumes: `apiFetch`, `getCurrentUser` (Task 14); `POSTHOG_EU_PROJECT_KEY` (Task 14's `config.js`).
- Produces: `loadPostHogIfConsented(user)`.

- [ ] **Step 1: Write `frontend/shared/posthog.js`**

```javascript
import { POSTHOG_EU_PROJECT_KEY } from './config.js';

let loaded = false;

export function loadPostHogIfConsented(user) {
  if (loaded || !user || !user.analyticsMarketingConsentAt) return;
  loaded = true;

  const script = document.createElement('script');
  script.textContent = `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on identify getGroups".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('${POSTHOG_EU_PROJECT_KEY}', { api_host: 'https://eu.i.posthog.com' });
    posthog.identify('${user.email}');
  `;
  document.head.appendChild(script);
}
```

(This is the standard PostHog snippet loader, parameterized with the EU host and the project key from `config.js`, gated entirely behind the `analyticsMarketingConsentAt` check.)

- [ ] **Step 2: Write `frontend/account.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Eve Colors — Account</title>
  <link rel="stylesheet" href="/shared/base.css" />
</head>
<body>
  <h1>Account &amp; Privacy</h1>
  <nav><a href="/today.html">Today</a> · <a href="/garden.html">My Garden</a></nav>
  <div id="app"></div>
  <script type="module" src="/account.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `frontend/account.js`**

```javascript
import { apiFetch, getCurrentUser } from './shared/api.js';

const app = document.getElementById('app');

const user = await getCurrentUser();
if (!user) {
  window.location.href = '/index.html';
} else {
  render(user);
}

function render(user) {
  app.innerHTML = `
    <p>Signed in as <strong>${user.email}</strong></p>
    <p><label><input type="checkbox" id="analytics-consent" ${user.analyticsMarketingConsentAt ? 'checked' : ''} />
      I agree to analytics tracking and to being contacted by email for marketing purposes. Eve Colors will never sell my email address.
    </label></p>
    <p><button id="save-consent">Save</button></p>
    <hr />
    <h2>Delete my account</h2>
    <p>This permanently removes your account and every Eve Moment you've saved. Type DELETE to confirm.</p>
    <input type="text" id="delete-confirm" />
    <p><button id="delete-account">Delete My Account</button></p>
    <p id="status"></p>
  `;

  document.getElementById('save-consent').addEventListener('click', async () => {
    const analyticsMarketing = document.getElementById('analytics-consent').checked;
    await apiFetch('/api/me/consent', { method: 'POST', body: JSON.stringify({ analyticsMarketing }) });
    document.getElementById('status').textContent = 'Saved.';
  });

  document.getElementById('delete-account').addEventListener('click', async () => {
    if (document.getElementById('delete-confirm').value !== 'DELETE') {
      document.getElementById('status').textContent = 'Type DELETE to confirm.';
      return;
    }
    const res = await apiFetch('/api/me', { method: 'DELETE' });
    if (res.ok) window.location.href = '/index.html';
  });
}
```

- [ ] **Step 4: Wire the PostHog loader into `today.js` and `garden.js`**

In `frontend/today.js`, add near the top:

```javascript
import { loadPostHogIfConsented } from './shared/posthog.js';
```

Immediately after the existing `const user = await getCurrentUser();` block resolves to a signed-in user (right before `await render();`), add:

```javascript
loadPostHogIfConsented(user);
```

Make the identical two edits in `frontend/garden.js` (import + call right after `const user = await getCurrentUser();` resolves to a non-null user, before the entries are loaded).

- [ ] **Step 5: Manual verification**

Open `http://localhost:8788/account.html` while signed in. Check the analytics checkbox, click Save, reload the page — checkbox should stay checked. Open `today.html` and confirm (via browser devtools' Network tab) that a request to `eu.i.posthog.com` fires. Uncheck the box on `account.html`, reload `today.html`, and confirm no PostHog request fires. Then test account deletion: type "DELETE", click "Delete My Account", confirm it redirects to `index.html` and that signing in again creates a brand-new account (no leftover entries).

- [ ] **Step 6: Commit**

```bash
git add frontend/account.html frontend/account.js frontend/shared/posthog.js \
  frontend/today.js frontend/garden.js
git commit -m "feat(frontend): add account/privacy page and consent-gated PostHog EU loader"
```

---

## Task 18: Deployment config finalization

**Files:**
- Create: `worker/.dev.vars.example`
- Modify: `README.md`

**Interfaces:**
- None — this task wires up local/prod configuration and documentation only.

- [ ] **Step 1: Write `worker/.dev.vars.example`**

```
GOOGLE_CLIENT_ID=replace-with-your-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=replace-with-your-oauth-client-secret
POSTHOG_DELETION_API_KEY=replace-with-a-posthog-personal-api-key-with-person-deletion-scope
```

Instruct the developer running this locally to copy it: `cp worker/.dev.vars.example worker/.dev.vars` and fill in real values (this file is already gitignored from Task 1).

- [ ] **Step 2: Update `README.md`'s "Status" section**

Replace the existing `## Status` section (currently reading "Design is complete and approved; implementation has not started yet...") with:

```markdown
## Status

Core implementation complete: Worker API (auth, entries, consent, account
deletion), D1 schema and seed content, and a rough-prototype frontend
(plain HTML/CSS/JS — visual design is being redone separately).

To run locally:

1. `npm install`
2. `cp worker/.dev.vars.example worker/.dev.vars` and fill in real values
   (Google OAuth client credentials, a PostHog personal API key).
3. `npm run db:migrate:local`
4. `npm run dev:worker` (in one terminal) and `npm run dev:frontend` (in another)
5. Open `http://localhost:8788/index.html`

See the design spec for full deployment steps (DNS, `wrangler d1 create`,
`wrangler secret put`, PostHog project setup) — those remain the repo
owner's responsibility, not something run from this codebase.
```

- [ ] **Step 3: Manual verification**

Run: `npm run db:migrate:local` on a clean checkout, then `npm test`.
Expected: migrations apply without error, full test suite passes.

- [ ] **Step 4: Commit**

```bash
git add worker/.dev.vars.example README.md
git commit -m "docs: document local dev setup and add .dev.vars example"
```
