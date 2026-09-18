# Eve Colors: Cloudflare Rebuild — Design Spec

Date: 2026-09-18
Status: Approved by owner, ready for implementation planning

## 1. Purpose

Eve Colors is a wellness web app, currently hosted on Wix. This spec
covers a full rebuild onto Cloudflare (Pages + Workers + D1), replacing
Wix Data/Site Members with our own database and Google SSO, and
evolving the product from "one fixed prompt per color" to "color as a
mood label, question and task drawn from growing, quadrant-tagged
content banks."

**Explicit non-goals for this build:**
- Not a medical, diagnostic, or therapeutic tool. This must be visible
  throughout the product, not just in a footer.
- No payment/paywall (the old "Founding Member" pricing-plan gate is
  dropped; everything is free for any signed-in Google account).
- No data migration (no existing users to carry over).
- No admin dashboard in this phase (schema must not block adding one
  later).

## 2. Architecture

```
Google Cloud (OAuth client)
        │
        ▼
┌─────────────────────┐        ┌──────────────────────┐
│ Cloudflare Pages     │  API   │ Cloudflare Worker      │
│ (static HTML/CSS/JS) │───────▶│ (Hono router)           │
│ app.<domain>         │  calls │ api.<domain>            │
└─────────────────────┘        │  - /auth/google/*       │
                                │  - /api/me, /api/today  │
                                │  - /api/entries/*       │
                                └───────────┬─────────────┘
                                            │
                                            ▼
                                   ┌─────────────────┐
                                   │ Cloudflare D1    │
                                   │ (SQLite)         │
                                   │ users, sessions, │
                                   │ questions, tasks,│
                                   │ entries          │
                                   └─────────────────┘
```

- **Frontend**: plain HTML/CSS/vanilla JS on Cloudflare Pages. Views:
  sign-in, today's check-in (color → question → answer → task →
  done), timeline ("My Garden"), account/privacy settings.
- **API**: one Cloudflare Worker using Hono for routing, auth, and D1
  access.
- **Sessions**: opaque session ID in an `HttpOnly; Secure; SameSite=Lax`
  cookie, `Domain=.<domain>` so both subdomains can read it. Session
  rows live in D1 (`sessions` table) so logout/deletion is a row
  delete, not JWT revocation plumbing.
- **Database**: Cloudflare D1, schema managed via
  `wrangler d1 migrations`.

### Repo restructuring

The current repo is Wix/Astro-specific end to end. As part of this
build:
- Remove: `wix.config.json`, `astro.config.mjs`, `src/extensions/*`,
  `.agents/skills/wix-*`, and Wix-only deps in `package.json`.
- Add:
  ```
  /worker      — Hono API, D1 schema/migrations, seed content
  /frontend    — static Pages site
  README.md
  ```

## 3. Data model

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  consent_accepted_at TEXT NOT NULL,       -- required wellness/terms consent
  analytics_marketing_consent_at TEXT,     -- nullable; opt-in, revocable
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

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
  entry_date TEXT NOT NULL,                -- UTC calendar date, e.g. '2026-09-18'
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (user_id, entry_date)              -- enforces one entry per day
);
```

### Quadrant definitions

- **Mental** — thoughts, clarity, focus, decision-making, planning.
- **Physical** — body, movement, rest, breath, basic needs.
- **Emotional** — feelings, self-compassion, relationships, warmth.
- **Spiritual** — inner wisdom/intuition, meaning, quiet reflection.

Quadrants are a fixed 4-value enum in this phase — not user-editable,
not stored in their own table, to keep the model simple. If a 5th
quadrant is ever needed, add it to the `CHECK` constraint.

### Question/task selection logic

- **Question**: exclude any `question_id` used by this user in
  `entries` in the last 7 days; pick uniformly at random from the
  remainder. If the bank is small enough that everything's been used
  in the last 7 days, fall back to the least-recently-used question
  (so the app never has "no question available").
- **Task**: pick uniformly at random from all active tasks, no repeat
  constraint. User may re-roll before committing to one (pre-answer
  only — matches today's "give me another idea").
- **One entry per day**: enforced by the `UNIQUE (user_id, entry_date)`
  constraint; `entry_date` is computed server-side from UTC, not
  client time.

## 4. Seed content (11 questions, 33 tasks)

The 11 existing color prompts seed `questions`; the 33 existing
routine steps seed `tasks`. Colors themselves are unchanged (11
colors, used only as the entry's mood label — not linked to question
selection).

**Questions:**

| Color (label only) | Question | Quadrant |
|---|---|---|
| Indigo | What truth do you already know but need to trust? | spiritual |
| Teal | What would help you feel steady in this moment? | physical |
| Sage | Where can you give yourself permission to slow down? | emotional |
| Gold | What possibility feels worth taking one small step toward? | mental |
| Peach | What do you need to receive—or offer—with openness? | emotional |
| Pink | How can you speak to yourself with more kindness today? | emotional |
| Lilac | What is your intuition quietly asking you to notice? | spiritual |
| Ember | What is your frustration trying to protect or change? | emotional |
| Tangerine | What can you set down so one thing can receive your attention? | mental |
| Voltage | What kind of movement or focus would help this energy feel useful? | physical |
| Smoke | What is the smallest burden you can reduce right now? | physical |

**Tasks** (from the existing 3-step routines, now independent of color):

| Source | Task | Quadrant |
|---|---|---|
| Indigo | Take three unhurried breaths and let your shoulders soften. | physical |
| Indigo | Write one sentence beginning, "What I know right now is…" | spiritual |
| Indigo | Take one small action that honors that truth without requiring complete certainty. | mental |
| Teal | Notice both feet and name three things you can see around you. | physical |
| Teal | Identify the one need that matters most in this moment. | mental |
| Teal | Choose one practical step—water, food, rest, fresh air, or a clear boundary. | physical |
| Sage | Lower your pace for one minute and lengthen each exhale. | physical |
| Sage | Name one expectation you can soften or postpone today. | emotional |
| Sage | Give yourself ten quiet minutes for rest, stretching, or time outside. | physical |
| Gold | Name the idea or possibility that gives you the most energy. | mental |
| Gold | Turn it into a step you can finish in ten minutes or less. | mental |
| Gold | Start before you feel fully ready, then acknowledge that you moved forward. | mental |
| Peach | Ask what kind of care would feel nourishing rather than demanding. | emotional |
| Peach | Reach toward one safe person or comforting practice. | emotional |
| Peach | Share one small act of warmth while keeping your own limits intact. | emotional |
| Pink | Place a hand over your heart and take one slow, comfortable breath. | physical |
| Pink | Replace one harsh thought with words that are honest and compassionate. | mental |
| Pink | Do one small thing that makes today easier for your future self. | emotional |
| Lilac | Put away one source of stimulation for five minutes. | spiritual |
| Lilac | Notice the thought, feeling, or body sensation that keeps returning. | spiritual |
| Lilac | Record what you noticed and choose whether it needs action, patience, or support. | mental |
| Ember | Unclench your jaw, lower your shoulders, and press both feet firmly into the floor. | physical |
| Ember | Complete the sentence, "What I need or wish were different is…" | emotional |
| Ember | Choose one respectful next step, or give yourself time before responding. | mental |
| Tangerine | Write down your open loops and circle only the one that matters now. | mental |
| Tangerine | Look away from the screen, sip water, and take three comfortable breaths. | physical |
| Tangerine | Give the circled task five uninterrupted minutes, then reassess. | mental |
| Voltage | Walk, stretch, or shake out your hands for one or two minutes. | physical |
| Voltage | Notice five things you can see and three physical sensations you can feel. | physical |
| Voltage | Choose one absorbing, low-stakes activity and stay with it for ten minutes. | mental |
| Smoke | Postpone, delegate, or remove one nonessential demand. | mental |
| Smoke | Drink water and let your exhale be a little longer than your inhale. | physical |
| Smoke | Identify the smallest next step, or decide that rest is the next step. | mental |

Quadrant distribution is naturally uneven from this seed content
(spiritual is thin at 3 tasks / 2 questions). That's expected for v1 —
content curation is ongoing (per the original ask: "questions will be
continuously added to the system"), and a future admin tool would let
this be balanced over time. Not a blocker for this build.

## 5. API surface

- `GET /auth/google/start` → redirect to Google OAuth consent.
- `GET /auth/google/callback` → verify ID token, upsert `users` row,
  create `sessions` row, set cookie. First-ever login routes to the
  consent screen (see §6) before the app is usable.
- `GET /api/me` → current user or 401.
- `POST /api/me/consent` → record consent (`consent_accepted_at`
  and/or `analytics_marketing_consent_at`), can be called again later
  to change the analytics/marketing opt-in.
- `DELETE /api/me` → full account deletion: delete `entries`,
  `sessions`, and the `users` row in one transaction, plus call
  PostHog's person-deletion API. Client requires typed confirmation.
- `GET /api/today` → today's entry if one exists, else "no entry yet."
- `POST /api/entries {color}` → create today's entry with a freshly
  picked question; fails with 409 if today's entry already exists.
- `PATCH /api/entries/:id {answer}` → save answer, pick a random task,
  return it.
- `POST /api/entries/:id/reroll-task` → pick a different random task
  (only before the task is marked complete).
- `PATCH /api/entries/:id {task_completed: true}` → mark the task
  done ("flower planted").
- `GET /api/entries?cursor=...` → paginated timeline, newest first.
- `DELETE /api/entries/:id` → delete one entry (must belong to the
  caller).

All `/api/*` routes (except `/auth/*`) require a valid session.

## 6. Auth: custom Google OAuth

Implemented directly in the Worker (no third-party auth vendor):
Google Cloud OAuth client (owner creates it in Google Cloud Console),
standard authorization-code flow, verify the returned ID token,
upsert the user by `google_sub`, issue our own session. This keeps
account data and deletion entirely inside our own system — required
for the GDPR "delete all trace of this user" promise, since a
third-party auth vendor would be a second place user data lives.

## 7. GDPR, consent, and wellness guardrails

- **Wellness, not medical**: a visible "Support & Safety" note
  (carried over from the current app, including the 988 crisis line)
  stays attached to the daily check-in flow, not buried in a footer.
- **Two-tier consent**, both timestamped on the user row:
  1. **Required** (`consent_accepted_at`) — acknowledge the wellness
     disclaimer and account/data terms. Must accept to use the app.
  2. **Opt-in, unchecked by default** (`analytics_marketing_consent_at`)
     — "I agree to analytics tracking and to being contacted by email
     for marketing purposes. Eve Colors will never sell my email
     address." Changeable anytime from the account/privacy page.
- **Privacy policy page**: states we use PostHog EU for analytics, may
  email opted-in users for marketing, never sell data, and that users
  can withdraw consent or delete their account anytime.
- **Account deletion**: `DELETE /api/me` removes all D1 rows for the
  user (entries, sessions, user) and calls PostHog's person-deletion
  API so analytics data is also purged — the "delete all trace"
  promise spans both systems.
- **No tracking without consent**: the PostHog script only loads/fires
  if `analytics_marketing_consent_at` is set.

## 8. Analytics: PostHog EU

- PostHog Cloud, **EU region**, loaded client-side on Pages, gated
  behind the marketing/analytics opt-in.
- A PostHog project API key (public, for the client script) and a
  personal/project API key with person-deletion permission (Worker
  secret, for `DELETE /api/me`) are both needed — documented as setup
  steps for Hiba.

## 9. Testing

- Worker unit tests via Vitest + `@cloudflare/vitest-pool-workers`
  (the standard Cloudflare Workers testing setup), covering: question
  selection (7-day no-repeat + exhaustion fallback), one-entry-per-day
  enforcement, task selection/reroll, and session/auth handling.
- Frontend: plain JS with no component framework, so verified manually
  in-browser (color → question → answer → task → timeline → delete →
  account deletion) rather than with an automated test suite.

## 10. Deployment (owner/Hiba responsibilities, not run by the agent)

1. Create a Google Cloud OAuth client (External consent screen),
   authorized redirect URI = `https://api.<domain>/auth/google/callback`.
2. Create a PostHog Cloud project in the **EU** region; get the public
   project API key and a person-deletion-capable API key.
3. Point DNS at Cloudflare (apex + `app.` + `api.` subdomains).
4. `wrangler d1 create eve-colors` and run migrations.
5. `wrangler pages deploy` for `/frontend`.
6. `wrangler deploy` for `/worker`; set secrets via `wrangler secret put`:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`,
   `POSTHOG_EU_PROJECT_KEY`, `POSTHOG_DELETION_API_KEY`.

## 11. Out of scope (future work)

- Admin dashboard (schema already supports it via `quadrant` tags and
  timestamps — no UI built now).
- Any paid tier / payment provider.
- Data migration from the old Wix collection (none needed).
