# Eve Colors: Laravel Rebuild — Design Spec (Server-Side Phase)

Date: 2026-09-21
Status: Approved by owner, ready for implementation planning
Supersedes: `2026-09-18-cloudflare-rebuild-design.md` (Cloudflare/D1/React implementation —
being removed entirely per this spec, not kept as a fallback)

## 1. Purpose

Eve Colors is a wellness journaling app. This spec covers a full re-platform from the
just-built Cloudflare Workers + D1 + React stack onto **Laravel + Filament + MySQL**,
hosted on **Laravel Cloud**, with a future **Expo** (React Native + web) client. The
underlying product is unchanged — this is a backend/hosting swap, not a product redesign
— plus one new feature: a visual garden where each completed daily entry places a flower
at a stored `(x, y)` position.

**This phase covers the server side only**: the Laravel app, its database, its API, and
the Filament admin panel. The Expo client (web + iOS + Android from one codebase, at
`client/` in the eventual monorepo) is explicitly a **future phase** — not designed or
built here.

**Explicit non-goals for this phase:**
- No client app of any kind (no web UI, no mobile app). The API is built and tested
  (via Laravel's own test suite hitting real HTTP routes), not exercised by a UI.
- Not a medical, diagnostic, or therapeutic tool — this constraint carries over unchanged
  and must remain visible in whatever client eventually consumes this API (documented
  here so the future client work doesn't drop it).
- No payment/paywall (unchanged from before).
- No data migration from the Cloudflare/D1 build — it had no real users, clean slate.
- No admin dashboard beyond what Filament resources are listed below (no analytics
  dashboards, no bulk-messaging tools, etc. in this phase).

## 2. Architecture

```
                      ┌────────────────────────────┐
                      │   Laravel Cloud             │
                      │   (git-connected deploys)   │
                      │                              │
  Google OAuth ───────▶  Laravel 13 app              │
                      │   ├─ Filament admin (/admin) │
                      │   ├─ Socialite (SSO)         │
                      │   ├─ Sanctum (API auth)      │
                      │   └─ REST API (/api/*)       │
                      │                              │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                      ┌────────────────────────────┐
                      │  Laravel Cloud MySQL         │
                      │  (managed, daily backups)    │
                      └────────────────────────────┘
```

- **Framework**: Laravel 13 (current stable as of this writing).
- **Admin**: Filament (current v4/v5 line), mounted at `/admin`, restricted to users
  with `is_admin = true`.
- **Auth**: Laravel Socialite (Google SSO) + Laravel Sanctum (API auth — cookie-based
  for a same-site SPA, personal-access-token-based for mobile). Both are Laravel's own
  first-party packages, not third-party vendors, matching the "standard packages" ask
  and preserving the same "account data lives in one system" property the Cloudflare
  build had.
- **Database**: MySQL, via Laravel Cloud's managed MySQL resource.
- **Hosting**: Laravel Cloud, connected directly to this GitHub repo, git-push deploys.

### Repo restructuring

The Cloudflare implementation is removed entirely:
- Delete: `worker/`, `shared/`, `web/`, root `package.json`/`package-lock.json`
  (npm-workspaces config), `docs/superpowers/specs/2026-09-18-cloudflare-rebuild-design.md`
  and `docs/superpowers/plans/2026-09-18-cloudflare-rebuild.md` stay in git history but
  are superseded — leave them in place as historical record (git log preserves the
  "why"), don't delete the docs themselves.
- Add: a standard Laravel 13 application at the repo root (`app/`, `bootstrap/`,
  `config/`, `database/`, `routes/`, `tests/`, etc., via `laravel new`).
- Reserve `client/` for the future Expo app — not created in this phase, just the
  intended eventual location, noted here so nothing else claims that path.

## 3. Data model

```
users
  id, name, email, google_id, avatar_url,
  consent_accepted_at (nullable), analytics_marketing_consent_at (nullable),
  is_admin (bool, default false),
  created_at, updated_at

colors
  id, name, hex, active (bool, default true), created_at, updated_at
  -- mood label only; no quadrant; not linked to question/activity selection

questions
  id, text, quadrant (enum: mental|physical|emotional|spiritual),
  active (bool, default true), created_at, updated_at

activities
  id, text, quadrant (enum: mental|physical|emotional|spiritual),
  active (bool, default true), created_at, updated_at

user_responses                              -- one row = one day = one flower
  id,
  user_id (FK -> users.id, ON DELETE CASCADE),
  color_id (FK -> colors.id),
  question_id (FK -> questions.id),
  answer_text (text, nullable until answered),
  activity_id (FK -> activities.id, nullable until assigned),
  activity_completed (bool, default false),
  entry_date (date, UTC calendar day),
  flower_x (decimal, nullable — 0-100, set on completion),
  flower_y (decimal, nullable — 0-100, set on completion),
  completed_at (timestamp, nullable),
  created_at, updated_at
  UNIQUE (user_id, entry_date)              -- one entry per user per UTC day
```

**`ON DELETE CASCADE` on `user_responses.user_id`** (and on Sanctum's
`personal_access_tokens` polymorphic relation, which cascades by default) means the
GDPR account-deletion flow collapses to essentially `$user->delete()` — the database
itself guarantees no orphaned entries or tokens survive a deleted user, which is a
simpler and more robust guarantee than the Cloudflare build's manual multi-table
`DB.batch()` delete.

### Quadrant definitions

Unchanged from the Cloudflare build: **mental, physical, emotional, spiritual** — a
fixed 4-value enum on `questions` and `activities` only (not `colors`, not `user_responses`
directly — a response's quadrant exposure is derived by joining to its question/activity).

### Seed content

Carried forward unchanged from the Cloudflare build's seed data: the same 11 colors,
11 questions, and 33 activities (with the same quadrant tags), loaded via Laravel
database seeders (`ColorSeeder`, `QuestionSeeder`, `ActivitySeeder`) run as part of
`php artisan migrate --seed`. If you want different seed content going in, say so before
the plan is written — otherwise the implementer transcribes the same content that was
already reviewed once.

### Selection logic (unchanged behavior, new implementation)

- **Question**: exclude any `question_id` this user answered in the last 7 days (via
  `user_responses.created_at >= now()->subDays(7)`); pick uniformly at random from the
  remainder; if the whole active bank was used in 7 days, fall back to the
  least-recently-used question for this user. Same rule as before, now an Eloquent query
  instead of a D1 query.
- **Activity**: pick uniformly at random from active activities, optionally excluding the
  currently-assigned one (for reroll); fall back to including the excluded one if it's the
  only option. Same as before.
- **One entry per day**: enforced by the `UNIQUE (user_id, entry_date)` database
  constraint; `entry_date` computed server-side from UTC.
- **Flower placement**: on marking `activity_completed = true`, the server assigns
  `flower_x`/`flower_y` as random percentages (0–100), retried (a small fixed number of
  attempts) against that user's existing flower positions to avoid exact overlaps. No
  physics/packing algorithm — good enough for a garden that grows one flower a day.

## 4. Auth: Socialite (SSO) + Sanctum (API)

Two login paths, both producing a Sanctum-authenticated session:

- **Web**: `GET /auth/google/redirect` → Google → `GET /auth/google/callback`.
  Socialite resolves the Google user, upserts the `users` row by `google_id`, logs the
  user in via Laravel's session auth, which Sanctum recognizes as a stateful SPA session
  for any domain listed in `SANCTUM_STATEFUL_DOMAINS`.
- **Mobile** (API-ready now, no Expo app yet): `POST /api/auth/google {idToken}` — a
  native client gets a Google ID token directly from Google's own SDK (no redirect
  needed), Laravel verifies it server-side, upserts the same `users` row by `google_id`,
  and issues a Sanctum personal access token (`$user->createToken(...)`) returned as
  `{ token, isNewUser }`.
- All `/api/*` routes (except the two auth endpoints) run through Sanctum's
  `auth:sanctum` guard, which transparently accepts either the session cookie or an
  `Authorization: Bearer` token — one middleware, works for both web and the future
  mobile client without special-casing.
- `POST /api/logout` revokes the current token (or session) — works for either auth
  style, matching the Cloudflare build's logout design.

## 5. API surface

- `GET /auth/google/redirect`, `GET /auth/google/callback` — web SSO (redirect flow).
- `POST /api/auth/google {idToken}` → `{ token, isNewUser }` — mobile SSO.
- `POST /api/logout` → revoke current session/token.
- `GET /api/me` → current user + consent status.
- `POST /api/me/consent {analyticsMarketing}` → required consent stamped once
  (first call), analytics/marketing consent freely toggled on every call.
- `DELETE /api/me` → `$user->delete()` (cascades to `user_responses` + tokens) +
  PostHog person purge (best-effort, logged on failure, never blocks the deletion —
  same lesson learned and already fixed once in the Cloudflare build).
- `GET /api/today` → today's `user_responses` row if one exists, else null.
- `POST /api/entries {color_id}` → creates today's row, picks a question; 409 if
  today's entry already exists.
- `PATCH /api/entries/{id} {answer}` → saves the answer, assigns an activity.
- `PATCH /api/entries/{id} {activityCompleted: true}` → marks complete, assigns
  `flower_x`/`flower_y`.
- `POST /api/entries/{id}/reroll-activity` → picks a different activity (pre-completion
  only).
- `GET /api/entries?cursor=...` → paginated garden feed (all flowers + their entries),
  newest first.
- `DELETE /api/entries/{id}` → delete one entry (must belong to the caller).

All routes requiring auth are gated by `auth:sanctum`; entry routes additionally require
`consent_accepted_at` to be set (a `RequireConsent` middleware returning `403
consent_required` otherwise) — the Cloudflare build initially missed this server-side
enforcement and had to add it in review; building it in from the start here.

## 6. Filament admin

Panel at `/admin`, restricted via a Filament `canAccessPanel()` check on `is_admin`.

- **UserResource** — list/view only (email, signup date, consent status, entry count).
  No editing user data beyond toggling `is_admin`. Not a way to impersonate or alter a
  user's private journal.
- **ColorResource** — full CRUD (name, hex swatch, active).
- **QuestionResource** — full CRUD (text, quadrant select, active). This is the ongoing
  content-authoring tool, matching the original "questions will be continuously added"
  requirement.
- **ActivityResource** — full CRUD, same shape as Questions.
- **UserResponseResource** — **view-only** (filterable by date/quadrant/user), for
  the "track what users are doing" admin goal. No delete/edit from the admin panel —
  a user's own GDPR deletion request is the only path that removes their entries, not
  an admin click.

## 7. GDPR, consent, and wellness guardrails

Unchanged in substance from the Cloudflare build, re-verified against this stack:

- **Wellness, not medical**: whatever client is eventually built must keep the
  Support & Safety notice visible in the daily flow — noted here as a requirement that
  travels with the API design (e.g. the app's static "about" content, not something
  the API itself serves).
- **Two-tier consent**: required wellness/terms ack (`consent_accepted_at`, write-once)
  vs. opt-in analytics/marketing (`analytics_marketing_consent_at`, freely toggled).
  Enforced server-side via the `RequireConsent` middleware (see §5) — not just
  client-side, closing the gap the Cloudflare build had to patch after its final review.
- **Account deletion**: `DELETE /api/me` removes the user row (cascading to entries and
  tokens) and purges the PostHog person record on a best-effort basis (logged failure,
  never blocks the deletion — matches the fix already validated once).
- **No tracking without consent**: PostHog only initialized client-side when
  `analytics_marketing_consent_at` is set — a client-side requirement noted here for
  whoever builds the Expo app.

## 8. Analytics: PostHog EU

Unchanged: PostHog Cloud, EU region, consent-gated, never sold. Client-side integration
is out of scope for this phase (no client yet) — the requirement is recorded here so
`DELETE /api/me`'s PostHog-purge call has a project to purge from, and so the eventual
client build doesn't reinvent the consent gating.

## 9. Testing

Pest, Laravel's modern default test framework (built on PHPUnit). Feature tests hit real
HTTP routes against a real test database (`RefreshDatabase` trait, SQLite or MySQL for
the test run — SQLite in-memory is the faster default for CI-style runs, matching the
"hit a real DB, don't mock it" principle that worked well in the Cloudflare build's
D1-backed test harness). Cover: question/activity selection (7-day no-repeat, exhaustion
fallback, reroll), one-entry-per-day enforcement, both SSO paths, consent gating, and
account deletion (including a PostHog-failure-doesn't-block-deletion case, mirroring the
fix already made once).

## 10. Deployment (owner/Hiba responsibilities, not run by the agent)

1. Create a Google Cloud OAuth client (External consent screen), authorized redirect
   URI = production `/auth/google/callback` URL.
2. Create/confirm the PostHog Cloud project (EU region) and its API keys.
3. Connect this GitHub repo to Laravel Cloud; provision a MySQL resource.
4. Set environment secrets on Laravel Cloud: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `POSTHOG_*` keys, `SANCTUM_STATEFUL_DOMAINS` (once a client domain exists).
5. Point DNS at Laravel Cloud once ready (same "Hiba's step" as before).
6. Deploy runs migrations + seeders automatically via Laravel Cloud's deploy hooks.

## 11. Out of scope (future phases)

- The Expo client (`client/`) — web, iOS, Android from one React Native codebase,
  consuming the API designed here. Its own spec/plan when this phase is done.
- Admin analytics dashboards, bulk actions, or anything beyond the 5 Filament resources
  listed in §6.
- Editable `UserResponseResource` in the admin — deliberately view-only for now.
