# Eve Colors: Expo Web Client — Design Spec

Date: 2026-09-22
Status: Draft — awaiting owner review

## 1. Purpose

Build the first client for the already-shipped Laravel API: a React app
written with Expo, so the same codebase can later target iOS and Android
with no rewrite. **This phase builds the web target only** — hosted on
Cloudflare (Pages), connected to the Laravel Cloud API. Native builds are
explicitly out of scope for this phase.

The product surface is fixed by an approved visual design (Claude Design
project "Eve Colors frontend redesign", `b1a50a53-b061-4a8f-92f0-47e4458a4d4a`):
a warm, rounded, pastel "Organic" design system; a daily flow of
color → question → task → "bloom" celebration; a private garden of past
entries; and an account/settings screen. This spec translates that
approved prototype into a real, API-backed architecture — it does not
redesign anything the prototype already decided.

**Non-goals for this phase:**
- No iOS/Android builds (Expo makes this possible later; not done now).
- No offline support.
- No "Download my garden" data export (unspecified in the design; see
  §9 Out of Scope).
- No redesign of the approved visual design — deviations from it below
  are implementation necessities (real data, real auth), not taste calls.

## 2. Repo layout

```
/                — Laravel app (existing, unchanged)
/client          — Expo app (this spec), lives at repo root per the
                    Laravel README's already-documented planned layout
```

`client/` does not exist yet and is created by the first implementation
task.

## 3. Architecture

- **Framework**: Expo + Expo Router (file-based, universal routing).
  Chosen over bare React Navigation because the whole reason for
  choosing Expo was "one codebase, web now, mobile later" — Expo Router
  gets that for free; a bare-React-Navigation-on-web setup would need
  rework when native ships.
- **Language**: TypeScript throughout.
- **Server state**: TanStack Query (`@tanstack/react-query`) for every
  API read/write — caching, mutations, and cross-screen cache
  invalidation (e.g. completing today's entry must update the garden
  list without a manual refetch wire-up). The prototype's raw
  `useState` approach does not hold up once real network calls,
  loading states, and error states are involved.
- **Local UI state**: plain `useState`/`useReducer` for in-progress,
  not-yet-submitted state only (the answer textarea's draft text before
  save, which color is highlighted before confirming, dialog
  open/closed).
- **Styling**: React Native has no CSS custom properties or classes, so
  the "Organic" design system's `styles.css` tokens are ported to a
  typed `theme.ts` module (see §7), consumed via `StyleSheet.create` in
  a small set of themed primitives.
- **HTTP/auth client**: a single `apiClient` wrapper (see §6) shared by
  every screen — never a raw `fetch` call in component code.

## 4. Screens & routes

Expo Router file structure (paths relative to `client/app/`):

```
_layout.tsx              — root layout: fonts, QueryClientProvider, auth guard
sign-in.tsx               — public
consent.tsx               — authenticated, pre-consent only
(app)/_layout.tsx         — authenticated + consented; bottom tab bar (Today/Garden/You)
(app)/today.tsx           — color → question → task → bloom, ONE route, internal step state
(app)/garden/index.tsx    — garden scene + entry list
(app)/garden/[id].tsx     — entry detail, rendered as a route-based modal
(app)/settings.tsx        — account / privacy / sign out / delete account
```

**Today as one route, not four.** The prototype's color/question/task/
bloom screens are stages of one continuous action (today's entry), not
independent destinations — there is nothing to deep-link to mid-flow,
and the prototype itself never changes URL between them. Internal state
(`'color' | 'question' | 'task' | 'bloom'`) drives which stage renders,
matching the prototype's own `step` state exactly. Refresh mid-flow
re-derives the correct stage from the server (`GET /api/today` — if an
entry exists with no answer yet → question stage; answered but no
activity completed → task stage; etc.), so a reload never strands the
user on a stage the server disagrees with.

**Entry detail as a real route.** The prototype renders entry detail as
a client-only absolute-positioned overlay with no URL change. The real
app uses `garden/[id]` as an actual route (a modal presentation in Expo
Router) instead: deep-linkable, has a real back button, and survives a
page refresh — meaningfully better for a web app than the prototype's
approach, with no visual difference to the user.

**Auth guard.** The root layout checks session state (via `GET
/api/me`, cached by TanStack Query) and redirects: no session →
`/sign-in`; session but no `consent_accepted_at` → `/consent`; both
present → `(app)`. This mirrors the Laravel API's own route gating
(`auth:sanctum` only vs. `auth:sanctum + consent`) so the client can
never reach a screen the server would 403 anyway.

## 5. Data flow — screen to endpoint

| Screen / action | Endpoint | Notes |
|---|---|---|
| Sign in | `GET /auth/google/redirect` (full-page redirect, not fetch) | Web SSO; server sets the session cookie and redirects back to `FRONTEND_URL` |
| Consent screen load | `GET /api/me` | Reads current consent status |
| Consent accept | `POST /api/me/consent` | Write-once required consent + free-toggle analytics/marketing |
| Color picker load | `GET /api/colors` | **New endpoint — see §8** |
| Today load (any stage) | `GET /api/today` | Determines which stage to render, per §4 |
| Submit color | `POST /api/entries {color_id}` | Creates today's entry, server picks the question |
| Submit answer | `PATCH /api/entries/{id} {answer}` | Server auto-assigns an activity |
| Reroll task | `POST /api/entries/{id}/reroll-activity` | |
| Complete task ("plant my flower") | `PATCH /api/entries/{id} {activityCompleted:true}` | Server assigns `flowerX`/`flowerY`; response feeds the bloom screen |
| Garden load | `GET /api/entries` (cursor-paginated) | See §8 for the `total` field addition |
| Entry detail | Already in the cached `GET /api/entries` page, or `GET /api/entries` filtered client-side — no new endpoint needed | |
| Delete entry | `DELETE /api/entries/{id}` | |
| Settings: toggle analytics/marketing | `POST /api/me/consent` | Same endpoint as initial consent, free-toggle fields |
| Delete account | `DELETE /api/me` | Full account deletion, matches the confirm-dialog copy already in the prototype |
| Sign out | `POST /api/logout` | |

## 6. Auth integration (the trickiest real constraint)

The Laravel API uses Sanctum's dual-mode design: cookie/session auth
for the web SPA, bearer tokens reserved for the future native app. For
this web-only phase:

- Every mutating request must first ensure a CSRF cookie exists — call
  `GET /sanctum/csrf-cookie` once per session (on app boot, before any
  `POST`/`PATCH`/`DELETE`) — the standard Sanctum SPA pattern. The
  `apiClient` wrapper does this automatically and transparently; no
  screen calls it directly.
- Every request sends `credentials: 'include'` so the session cookie
  travels.
- **Cross-origin requirement**: once Cloudflare Pages hosts the client
  on its own domain, that domain must be added to the Laravel API's
  `SANCTUM_STATEFUL_DOMAINS` and to its CORS `allowed_origins` with
  credentials enabled — this is a Laravel Cloud environment-config
  change, owner-responsibility (same pattern as the existing README's
  "Deployment (owner responsibility)" section), not something this
  client-side plan can do itself. Local dev needs `localhost` in both.
- The `apiClient` wrapper is written so a bearer-token mode (`Authorization:
  Bearer <token>`) can be added later for native builds without
  changing any call site — every screen calls `apiClient.get/post/patch/delete`,
  never `fetch` directly, so the auth mode is swappable in one place.

## 7. Design system → theme

`styles.css`'s tokens port directly to `client/theme.ts`:

- **Color ramps**: `neutral-100..900`, `accent-100..900` (terracotta),
  `accent2-100..900` (sage) — same hex values, same step semantics
  (100–300 tints, 500 base, 700–900 for text-on-tint / pressed states).
- **Type**: Caprasimo (headings) + Figtree (body), loaded via
  `expo-font` (Google Fonts). Same size scale (`h1` 42 / `h2` 32 / `h3`
  25 / `h4` 20, etc.) and the same `letterSpacing: -0.015em` on
  headings.
- **Spacing**: the same `space-1..8` scale (4.4 / 8.8 / 13.2 / 17.6 /
  26.4 / 35.2), as numbers rather than CSS values.
- **Radius**: `radius-sm/md/lg` (8/16/28), plus the design system's
  documented "everything interactive goes pill" rule
  (`borderRadius: 999`) for buttons, inputs, and tags.
- **Shadows**: React Native's `shadow*` props (iOS) / `elevation`
  (Android) / `boxShadow` (web, via React Native Web) approximating the
  three documented elevation steps.

**Component primitives** (`client/components/`), each a thin themed
wrapper, mirroring the CSS classes the prototype actually uses:
`Button` (primary/secondary/ghost variants, matching `.btn-primary` /
`.btn-secondary` / `.btn-ghost`), `Card`, `TextField` (the prototype's
`.input`, including the textarea variant used for the daily answer),
`Toggle` (the pill switch used in consent and settings), `Tag`. Every
other prototype element (the color-picker rows, the task card, the
bloom animation, the bottom tab bar, the confirm dialog) is a
screen-specific component built from these primitives plus the raw
theme tokens — the prototype doesn't reuse a single generic "list item"
or "screen" wrapper across those, so neither does this.

**Animations**: the prototype's CSS `@keyframes` (`bloomIn`, `riseIn`,
`sway`, `ringPulse`, `drift`) port to React Native's `Animated` API
(or `react-native-reanimated`, since it's the more idiomatic choice for
Expo and works identically on web). Same easing curves, same timings.

**Assets**: the 11 `lotus-{color}.png` images and the pastel background
blobs are exported from the design project into `client/assets/`
during implementation (not part of this spec). Each color's `icon`
field (§8) names exactly which bundled file to render — the client
never derives a filename from the color name itself.

## 8. Backend additions required

Four small, low-risk additions to the already-shipped Laravel API — same
quality bar as the original 18-task build (test-first, reviewed):

**`GET /api/colors`** — new. Sits in the existing `['auth:sanctum',
'consent']` route group (colors are only needed once a user reaches the
daily flow, which already requires consent). Returns active colors only,
in seed/id order (matches the prototype's curated color sequence, not
alphabetical):

```json
{
  "colors": [
    { "id": 1, "name": "Indigo", "hex": "#34435f", "description": "Indigo can reflect a quiet, inward moment...", "icon": "lotus-indigo.png" },
    ...
  ]
}
```

New `App\Http\Controllers\Api\ColorController::index()` +
`App\Http\Resources\ColorResource` (shapes `id`/`name`/`hex`/
`description`/`icon` only — `active`/timestamps stay internal,
consistent with how `UserResponseResource` already shapes its output).

**`colors.icon` — new column.** Colors change rarely, so there's no
need for an upload mechanism: `icon` is a plain string column (e.g.
`"lotus-indigo.png"`) naming a static asset file that ships bundled in
the client (`client/assets/`), not a Filament-managed upload. Migration
adds the nullable column, seeder backfills all 11 rows with their
`lotus-{name}.png` filename, `ColorForm`/`ColorsTable` in Filament get a
plain `TextInput`/`TextColumn` for it (no file-upload widget) so admins
can retarget which bundled asset a color uses without needing a new
client build.

**`activities.note` — new column.** The prototype's task cards carry a
headline (`Activity.text`) *and* a supporting detail line the shipped
schema doesn't have. Migration adds a nullable `note` text column,
seeder backfills all 33 existing activities with a second line matching
the prototype's own copy (e.g. "Take a walk around the block" / "Ten
minutes. No phone if you can manage it."), `ActivityForm`/
`ActivitiesTable` in Filament gain a `Textarea`/truncated `TextColumn`
for it (mirroring the pattern already used for `text` itself), and
`UserResponseResource`'s nested `activity` object gains a `note` field
alongside `id`/`text`/`quadrant`.

**`GET /api/entries` gains a `total` field.** The prototype's bloom
screen ("That's N flowers in your garden") and garden screen ("N days,
all yours") both need a total entry count, which the existing
cursor-paginated response doesn't carry (only the current page +
`nextCursor`). Add a cheap `UserResponse::where('user_id', ...)->count()`
alongside the existing paginated query, returned as a sibling field:
`{ "entries": [...], "nextCursor": "...", "total": 6 }`. Low-risk,
additive, doesn't change existing pagination behavior or break the
already-shipped tests for this endpoint.

All four additions get their own Pest tests and go through the same
implementer → reviewer cycle as the rest of the API before the client
plan consumes them.

## 9. Out of scope for this phase

- **"Download my garden"** — the prototype's only button with no
  defined behavior. Not built now; can become its own small feature
  later once its format/content is specified.
- **Native (iOS/Android) builds** — Expo Router makes this a later,
  low-friction addition, not part of this plan.
- **Offline support / optimistic UI beyond TanStack Query's defaults.**
- **The prototype's raw HTML/CSS is not reused directly** — it's a
  design reference and copy/content source, not a code source; every
  screen is rebuilt as real React Native components against the theme
  in §7.

## 10. Decisions made during review

**A. Task supporting-detail line.** Resolved: add `activities.note` (a
real schema change — see §8) rather than drop the detail line. The task
card matches the prototype exactly, headline + supporting sentence.

**B. Color icon asset.** Resolved: add `colors.icon` (a real schema
change — see §8) storing the bundled asset's filename directly, rather
than deriving it from the color name client-side. Colors change rarely
enough that a plain admin-editable string field is the right amount of
flexibility — no upload mechanism, no derived-from-name fragility.

## 11. Testing

- **Backend additions** (§8): Pest feature tests, same bar as the rest
  of the API — auth/consent gating, response shape, ordering.
- **Client**: no dedicated automated test suite for this phase (matches
  the precedent already set for the Laravel admin UI — "frontend has no
  automated tests," verified manually in a browser instead). Revisit
  once the app has enough screens that manual verification stops
  scaling.

## 12. Deployment (owner responsibility, not run from this codebase)

- Expo static web export (`expo export --platform web`) deployed to
  Cloudflare Pages, connected to this repo's `client/` directory.
- Environment variable `EXPO_PUBLIC_API_URL` pointing at the Laravel
  Cloud API's public URL.
- Once a Cloudflare Pages domain exists: add it to
  `SANCTUM_STATEFUL_DOMAINS` and CORS `allowed_origins` (with
  credentials) in the Laravel API's environment config, and set
  `FRONTEND_URL` accordingly so the Google OAuth redirect lands back on
  the client correctly.
