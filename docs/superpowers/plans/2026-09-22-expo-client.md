# Eve Colors: Expo Web Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first client for the already-shipped Laravel API — a React app written with Expo, web target only for this phase, matching the approved "Eve Colors frontend redesign" design exactly.

**Architecture:** Expo Router (file-based, universal routing) + TypeScript + TanStack Query for all server state + a themed set of React Native primitives ported from the design system's CSS tokens. Four small, low-risk additions to the already-shipped Laravel API close real data gaps the design surfaced.

**Tech Stack:** Expo (SDK version resolved at scaffold time — this postdates training data, verify actual behavior against `npx create-expo-app --version`), Expo Router, TypeScript, `@tanstack/react-query`, `react-native-reanimated`, `@expo-google-fonts/caprasimo` + `@expo-google-fonts/figtree`, `lucide-react-native`.

**Spec:** `docs/superpowers/specs/2026-09-22-expo-client-design.md`

## Global Constraints

- **This phase builds the web target only.** No iOS/Android builds, no offline support, no "Download my garden" export — all explicitly out of scope per the spec.
- **`client/` is a fully independent Node project** (own `package.json`, own lockfile) at the repo root — not an npm workspace member of the root `package.json` (which is Laravel's own Vite/Tailwind asset pipeline, unrelated).
- **Client dev server is pinned to port 8081** everywhere (`npx expo start --web --port 8081`) — this must match `.env`'s existing `FRONTEND_URL=http://localhost:8081` (already set in Task 18 of the server plan) and the `SANCTUM_STATEFUL_DOMAINS`/CORS config this plan adds. Do not let it float to whatever Expo's default happens to be.
- **The prototype's raw HTML/CSS is a design and copy reference, not a code source.** Every screen is rebuilt as real React Native components against `theme.ts`. Decorative-only background elements (drifting tinted blobs, soft circles) should read as the same warm, rounded aesthetic — exact pixel positions from the mockup's inline styles are not a hard requirement; functional layout, content, and interaction fidelity are.
- **Testing framework for the backend additions is Pest** (not PHPUnit) — matches the rest of the already-shipped API. Run `php artisan test`.
- **The client has no automated test suite for this phase** (matches the precedent already set for the Laravel admin UI). Every client task's verification step is a concrete manual check: run the dev server, do the described action, confirm the described result.
- **Authenticated manual verification without real Google OAuth credentials**: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are empty in this environment, so the real Google SSO flow cannot complete end-to-end locally. Any task whose verification requires an authenticated session must establish one via a **temporary, `app()->environment('local')`-gated route** in `routes/web.php` on the Laravel side that logs in a seeded test user directly (mirroring the pattern already used once this session for Filament admin testing) — visit it in a browser to get a real session cookie, then exercise the client screen. This route must never be committed to a task's final diff; add it, use it, remove it again before considering the task's Laravel-side changes done. The client-side code itself never depends on this route existing.
- **Assets are pre-fetched by the controller, not a dispatched implementer.** The 11 `lotus-{name}.png` files and any background decoration images come from the Claude Design project (`b1a50a53-b061-4a8f-92f0-47e4458a4d4a`) via the `DesignSync` MCP tool, which requires the account-level `/design-login` authorization already completed once this session. A fresh implementer subagent cannot be assumed to have that authorization. Before dispatching Task 5 (scaffold + assets), the controller fetches every needed asset file directly and places it at the path Task 5's brief expects; Task 5's implementer only wires up already-present files and stops to flag it if any are missing, rather than attempting to fetch them itself.

## File Structure

```
client/
  app/
    _layout.tsx                — root layout: fonts, QueryClientProvider, auth guard
    sign-in.tsx                 — public
    consent.tsx                 — authenticated, pre-consent only
    (app)/
      _layout.tsx                — tab navigator (Today/Garden/You), auth+consent guard
      today.tsx                  — color → question → task → bloom, one screen, internal step state
      garden/
        index.tsx                 — garden scene + entry list
        [id].tsx                  — entry detail, modal route
      settings.tsx                — account / privacy / sign out / delete account
  components/
    Button.tsx                  — primary/secondary/ghost variants
    Card.tsx
    TextField.tsx                — includes the multiline/textarea variant
    Toggle.tsx                   — pill switch
    Tag.tsx
    ConfirmDialog.tsx            — shared bottom-sheet confirm (delete entry / delete account)
  lib/
    theme.ts                    — ported design tokens
    icons.ts                    — icon-filename → bundled asset lookup
    config.ts                   — EXPO_PUBLIC_API_URL
    apiClient.ts                 — fetch wrapper, CSRF-cookie flow, credentials
    queryClient.ts
    hooks/
      useMe.ts
      useColors.ts
      useToday.ts
      useEntries.ts
      useConsentMutation.ts
      useEntryMutations.ts       — submit color, submit answer, reroll, complete, delete entry
      useAccountMutations.ts     — delete account, logout
  assets/
    images/
      lotus-indigo.png ... lotus-smoke.png   (11 files, pre-fetched by controller)
  app.json
  package.json
  tsconfig.json
  babel.config.js
  README.md

app/Http/Controllers/Api/ColorController.php      — new (Task 2)
app/Http/Resources/ColorResource.php               — new (Task 2)
database/migrations/*_add_icon_to_colors_table.php         — new (Task 1)
database/migrations/*_add_note_to_activities_table.php     — new (Task 1)
config/cors.php                                     — new (Task 4)
```

---

## Task 1: Backend — `colors.icon` and `activities.note` columns

**Files:**
- Create: `database/migrations/*_add_icon_to_colors_table.php`
- Create: `database/migrations/*_add_note_to_activities_table.php`
- Modify: `app/Models/Color.php`
- Modify: `app/Models/Activity.php`
- Modify: `database/seeders/ColorSeeder.php`
- Modify: `database/seeders/ActivitySeeder.php`
- Modify: `app/Filament/Resources/Colors/Schemas/ColorForm.php`
- Modify: `app/Filament/Resources/Colors/Tables/ColorsTable.php`
- Modify: `app/Filament/Resources/Activities/Schemas/ActivityForm.php`
- Modify: `app/Filament/Resources/Activities/Tables/ActivitiesTable.php`
- Test: `tests/Feature/ContentSchemaTest.php`

**Interfaces:**
- Produces: `Color.icon` (string, nullable), `Activity.note` (string, nullable) — consumed by Task 3 (`UserResponseResource`) and Task 2 (`ColorResource`).

- [ ] **Step 1: Write the failing test `tests/Feature/ContentSchemaTest.php`**

```php
<?php

use App\Models\Activity;
use App\Models\Color;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds every color with a non-empty icon filename', function () {
    (new \Database\Seeders\ColorSeeder())->run();

    expect(Color::count())->toBe(11);
    Color::all()->each(function (Color $color) {
        expect($color->icon)->not->toBeNull()->not->toBe('');
        expect($color->icon)->toMatch('/^lotus-[a-z]+\.png$/');
    });
});

it('seeds every activity with a non-empty note', function () {
    (new \Database\Seeders\ActivitySeeder())->run();

    expect(Activity::count())->toBe(33);
    Activity::all()->each(function (Activity $activity) {
        expect($activity->note)->not->toBeNull()->not->toBe('');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ContentSchemaTest`
Expected: FAIL — `icon`/`note` columns don't exist yet.

- [ ] **Step 3: Create the migrations**

`database/migrations/2026_09_22_150000_add_icon_to_colors_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colors', function (Blueprint $table) {
            $table->string('icon')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('colors', function (Blueprint $table) {
            $table->dropColumn('icon');
        });
    }
};
```

`database/migrations/2026_09_22_150001_add_note_to_activities_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->text('note')->nullable()->after('text');
        });
    }

    public function down(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->dropColumn('note');
        });
    }
};
```

(Both nullable — colors/activities change rarely, but a nullable column avoids any risk of a NOT NULL migration failing against a populated table, consistent with how `colors.description` was added earlier.)

- [ ] **Step 4: Update the models**

In `app/Models/Color.php`, add `'icon'` to the `$fillable` array (find the existing line with `'name', 'hex', 'description', 'active'` and add `'icon'` to it).

In `app/Models/Activity.php`, add `'note'` to the `$fillable` array alongside `'text'`.

- [ ] **Step 5: Update the seeders with real content**

In `database/seeders/ColorSeeder.php`, add `'icon' => 'lotus-{name}.png'` to each of the 11 entries (lowercase the color name for the filename), e.g.:

```php
['name' => 'Indigo', 'hex' => '#34435f', 'description' => '...', 'icon' => 'lotus-indigo.png'],
```

Apply the same pattern (`'icon' => 'lotus-' . strtolower($name) . '.png'`) to all 11 rows, matching each row's own `name` field exactly (indigo, teal, sage, gold, peach, pink, lilac, ember, tangerine, voltage, smoke).

In `database/seeders/ActivitySeeder.php`, add a `'note'` value to every one of the 33 existing rows. Read the current file first — the note text should be a short, concrete elaboration of the activity's instruction (in the same voice as the existing `text` values), one sentence, matching the tone already established by the app's other content (e.g. for an activity like "Take a walk around the block", a fitting note is "Ten minutes. No phone if you can manage it."). Write real, specific notes for all 33 — do not leave any generic or repeated across rows.

- [ ] **Step 6: Update the Filament forms and tables**

In `app/Filament/Resources/Colors/Schemas/ColorForm.php`, add a `TextInput::make('icon')->required()` field (add `use Filament\Forms\Components\TextInput;` if not already imported under that exact name — it already is, per the existing `name`/`hex` fields).

In `app/Filament/Resources/Colors/Tables/ColorsTable.php`, add `TextColumn::make('icon')` to the columns array (a plain column, no truncation needed — filenames are short).

In `app/Filament/Resources/Activities/Schemas/ActivityForm.php`, add a `Textarea::make('note')->required()->rows(2)->columnSpanFull()` field, placed after the existing `text` field.

In `app/Filament/Resources/Activities/Tables/ActivitiesTable.php`, add a `note` column using the same truncate+tooltip pattern already used for `text` in this same file (60-char limit, tooltip callback) — copy that exact pattern for `note`.

- [ ] **Step 7: Run test to verify it passes**

Run: `php artisan test --filter=ContentSchemaTest`
Expected: PASS — both tests green.

- [ ] **Step 8: Run the full suite**

Run: `php artisan test`
Expected: PASS — every existing test still green (this task only adds nullable columns and seed data, no existing behavior changes).

- [ ] **Step 9: Commit**

```bash
git add database/migrations app/Models/Color.php app/Models/Activity.php database/seeders/ColorSeeder.php database/seeders/ActivitySeeder.php app/Filament/Resources/Colors app/Filament/Resources/Activities tests/Feature/ContentSchemaTest.php
git commit -m "feat: add colors.icon and activities.note content fields"
```

---

## Task 2: Backend — `GET /api/colors`

**Files:**
- Create: `app/Http/Controllers/Api/ColorController.php`
- Create: `app/Http/Resources/ColorResource.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Api/ColorControllerTest.php`

**Interfaces:**
- Consumes: `Color.icon` (Task 1).
- Produces: `GET /api/colors` → `{ colors: [{id, name, hex, description, icon}] }` — consumed by the client's `useColors` hook (Task 7).

- [ ] **Step 1: Write the failing test `tests/Feature/Api/ColorControllerTest.php`**

```php
<?php

use App\Models\Color;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function actingConsentedUser(): User
{
    $user = User::factory()->create(['consent_accepted_at' => now()]);
    test()->actingAs($user);
    return $user;
}

it('returns only active colors, in id order, shaped for the client', function () {
    actingConsentedUser();
    $first = Color::create(['name' => 'Indigo', 'hex' => '#34435f', 'description' => 'Deep and inward.', 'icon' => 'lotus-indigo.png']);
    $second = Color::create(['name' => 'Teal', 'hex' => '#4f8f86', 'description' => 'Clear and steady.', 'icon' => 'lotus-teal.png']);
    Color::create(['name' => 'Retired', 'hex' => '#000000', 'description' => 'n/a', 'icon' => 'lotus-retired.png', 'active' => false]);

    $response = test()->getJson('/api/colors');

    $response->assertOk();
    $response->assertJson([
        'colors' => [
            ['id' => $first->id, 'name' => 'Indigo', 'hex' => '#34435f', 'description' => 'Deep and inward.', 'icon' => 'lotus-indigo.png'],
            ['id' => $second->id, 'name' => 'Teal', 'hex' => '#4f8f86', 'description' => 'Clear and steady.', 'icon' => 'lotus-teal.png'],
        ],
    ]);
    expect($response->json('colors'))->toHaveCount(2);
});

it('rejects an unauthenticated request with 401', function () {
    $response = test()->getJson('/api/colors');

    $response->assertStatus(401);
});

it('rejects a non-consented user with 403', function () {
    $user = User::factory()->create(['consent_accepted_at' => null]);
    test()->actingAs($user);

    $response = test()->getJson('/api/colors');

    $response->assertStatus(403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ColorControllerTest`
Expected: FAIL — `/api/colors` doesn't exist (404).

- [ ] **Step 3: Write `app/Http/Resources/ColorResource.php`**

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ColorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'hex' => $this->hex,
            'description' => $this->description,
            'icon' => $this->icon,
        ];
    }
}
```

- [ ] **Step 4: Write `app/Http/Controllers/Api/ColorController.php`**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ColorResource;
use App\Models\Color;
use Illuminate\Http\JsonResponse;

class ColorController extends Controller
{
    public function index(): JsonResponse
    {
        $colors = Color::where('active', true)->orderBy('id')->get();

        return response()->json(['colors' => ColorResource::collection($colors)]);
    }
}
```

- [ ] **Step 5: Add the route to `routes/api.php`**

Add `use App\Http\Controllers\Api\ColorController;` to the imports, and inside the existing `Route::middleware(['auth:sanctum', 'consent'])->group(...)` block (the same group `/today` and `/entries*` already sit in), add:

```php
Route::get('/colors', [ColorController::class, 'index']);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=ColorControllerTest`
Expected: PASS — all 3 tests green.

- [ ] **Step 7: Run the full suite**

Run: `php artisan test`
Expected: PASS — every test green.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/Api/ColorController.php app/Http/Resources/ColorResource.php routes/api.php tests/Feature/Api/ColorControllerTest.php
git commit -m "feat: add GET /api/colors"
```

---

## Task 3: Backend — entries `total` count + activity `note` in response

**Files:**
- Modify: `app/Http/Controllers/Api/EntryController.php`
- Modify: `app/Http/Resources/UserResponseResource.php`
- Modify: `tests/Feature/Api/EntryControllerTest.php`

**Interfaces:**
- Consumes: `Activity.note` (Task 1).
- Produces: `GET /api/entries` response gains a `total` field; `UserResponseResource`'s nested `activity` object gains a `note` field — both consumed by the client (Tasks 10-11).

- [ ] **Step 1: Write the failing tests — append to `tests/Feature/Api/EntryControllerTest.php`**

```php
it('includes a total count alongside the paginated page', function () {
    $user = actingUserWithConsent();
    seedManualEntry($user, now()->subDays(2)->toDateString());
    seedManualEntry($user, now()->subDay()->toDateString());

    $response = $this->getJson('/api/entries');

    $response->assertOk();
    expect($response->json('total'))->toBe(2);
});

it('includes the activity note in the entry response once an activity is assigned', function () {
    [, $entryId] = createTodayEntry();
    \App\Models\Activity::create(['text' => 'Walk.', 'note' => 'Ten minutes, no phone.', 'quadrant' => 'physical']);

    $response = $this->patchJson("/api/entries/{$entryId}", ['answer' => 'answer']);

    $response->assertOk();
    $response->assertJson(['entry' => ['activity' => ['note' => 'Ten minutes, no phone.']]]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=EntryControllerTest`
Expected: FAIL — `total` is absent from the index response; `activity.note` is absent from the entry resource.

- [ ] **Step 3: Update `app/Http/Resources/UserResponseResource.php`**

In the `'activity' => $this->when(...)` block, add `'note' => $this->activity->note,` alongside the existing `id`/`text`/`quadrant` keys:

```php
'activity' => $this->when($this->activity_id !== null, fn () => [
    'id' => $this->activity->id,
    'text' => $this->activity->text,
    'note' => $this->activity->note,
    'quadrant' => $this->activity->quadrant->value,
]),
```

- [ ] **Step 4: Update `index()` in `app/Http/Controllers/Api/EntryController.php`**

Add a total count alongside the existing paginated query. The count must be scoped identically to the paginated query (same `user_id` filter, no cursor applied) so it reflects the true all-time total, not the current page:

```php
public function index(Request $request): JsonResponse
{
    $limit = 20;
    $baseQuery = UserResponse::where('user_id', $request->user()->id);
    $total = (clone $baseQuery)->count();

    $query = (clone $baseQuery)->with(['color', 'question', 'activity'])->orderByDesc('id');

    if ($cursor = $request->query('cursor')) {
        $query->where('id', '<', $cursor);
    }

    $rows = $query->limit($limit + 1)->get();
    $hasMore = $rows->count() > $limit;
    $page = $hasMore ? $rows->slice(0, $limit) : $rows;

    return response()->json([
        'entries' => UserResponseResource::collection($page->values()),
        'nextCursor' => $hasMore ? (string) $page->last()->id : null,
        'total' => $total,
    ]);
}
```

(`clone` is required here — Eloquent query builders are mutable, so reusing `$baseQuery` without cloning would let the `count()` call's own query modifications bleed into the paginated query, or vice versa.)

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=EntryControllerTest`
Expected: PASS — all tests in this file green (13 existing + 2 new = 15... verify the exact count by reading the file's current test count before running, since prior tasks may have added more; the important thing is zero failures, not a specific number).

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS — every test green.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Resources/UserResponseResource.php app/Http/Controllers/Api/EntryController.php tests/Feature/Api/EntryControllerTest.php
git commit -m "feat: add total count to GET /api/entries and note to activity response"
```

---

## Task 4: Backend — CORS + Sanctum stateful domains for the local Expo client

**Files:**
- Create: `config/cors.php`
- Modify: `.env`
- Modify: `.env.example`

**Interfaces:**
- Produces: a working credentialed-cookie CORS setup for `http://localhost:8081` — required by every client task from Task 7 onward that makes a real API call against the local Laravel dev server.

- [ ] **Step 1: Create `config/cors.php`**

No `config/cors.php` currently exists in this app (confirmed — Laravel falls back to its packaged default, which has `supports_credentials: false` and a wildcard origin, incompatible with Sanctum's cookie auth). Create it:

```php
<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:8081')),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
```

- [ ] **Step 2: Add `CORS_ALLOWED_ORIGINS` and `SANCTUM_STATEFUL_DOMAINS` to `.env` and `.env.example`**

In both files, add these two lines near the existing `FRONTEND_URL=http://localhost:8081` line:

```
SANCTUM_STATEFUL_DOMAINS=localhost:8081
CORS_ALLOWED_ORIGINS=http://localhost:8081
```

(`SANCTUM_STATEFUL_DOMAINS`'s packaged default already includes bare `localhost` and `127.0.0.1:8000`, but Sanctum's frontend-detection matches the Origin/Referer host+port against this list with exact/glob string matching — a bare `localhost` entry does **not** match `localhost:8081`, since the port is part of the compared string. Without this explicit entry, every request from the Expo web dev server would be treated as non-stateful and fall through to token auth, which the web client never sends — every authenticated request would silently 401.)

- [ ] **Step 3: Verify manually**

Run: `php artisan config:clear && php artisan tinker --execute="echo implode(',', config('cors')); echo PHP_EOL; echo env('SANCTUM_STATEFUL_DOMAINS');"`
Expected: no error, and the stateful-domains output includes `localhost:8081`. (A full end-to-end CORS verification happens naturally once Task 7 makes the first real cross-origin request from the running Expo dev server — this step only confirms the config loads without error.)

- [ ] **Step 4: Run the full suite**

Run: `php artisan test`
Expected: PASS — this task touches no application code paths any existing test exercises.

- [ ] **Step 5: Commit**

```bash
git add config/cors.php .env.example
git commit -m "feat: configure CORS and Sanctum stateful domains for the local Expo client"
```

(`.env` itself is gitignored and never committed — only `.env.example` carries the change into git.)

---

## Task 5: Client — scaffold the Expo project

**Files:**
- Create: `client/` (entire Expo project scaffold)
- Create: `client/assets/images/*.png` (pre-fetched by the controller — see Global Constraints)

**Interfaces:**
- Produces: a booting Expo Router web app at `http://localhost:8081` — the foundation every later client task builds on.

- [ ] **Step 1: Confirm assets are already present**

Before writing any code, confirm `client/assets/images/` exists and contains all 11 `lotus-{name}.png` files (indigo, teal, sage, gold, peach, pink, lilac, ember, tangerine, voltage, smoke). These are pre-fetched by the controller, not something this task fetches itself (see Global Constraints). If any are missing, stop and report it rather than attempting to source them another way.

- [ ] **Step 2: Scaffold the project**

From the repo root:

```bash
npx create-expo-app@latest client --template tabs
```

(The `tabs` template is Expo's own starter with Expo Router and a tab layout already wired — the fastest correct starting point, even though this plan replaces its example screens. Immediately after scaffolding, verify what was actually generated: `cat client/package.json` and note the exact Expo/Expo Router versions installed, since this postdates training data — adapt later steps' exact API surface to what's actually installed if it differs from what's assumed below, the way earlier tasks in this project adapted to Filament v5's real generated layout when it differed from an older assumed version.)

- [ ] **Step 3: Remove the template's example content**

Delete the template's example screens/components that this plan replaces: remove everything under `client/app/(tabs)/` and `client/components/` that the template generated, and any `client/app-example/` directory the template may have moved aside. Keep `client/app/_layout.tsx` for now — Task 8 rewrites it.

- [ ] **Step 4: Install the additional dependencies this plan needs**

```bash
cd client
npx expo install @tanstack/react-query react-native-reanimated lucide-react-native @expo-google-fonts/caprasimo @expo-google-fonts/figtree expo-font
```

(`npx expo install`, not plain `npm install` — Expo's install command resolves versions compatible with the installed Expo SDK, which matters since the exact SDK version isn't known until Step 2 runs.)

- [ ] **Step 5: Configure the Reanimated Babel plugin**

Open `client/babel.config.js` and confirm `react-native-reanimated/plugin` is listed as the **last** entry in the `plugins` array (Reanimated's own install docs require this exact position — if `expo install` didn't add it automatically, add it yourself).

- [ ] **Step 6: Create `client/lib/config.ts`**

```ts
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
```

- [ ] **Step 7: Pin the dev server port**

Open `client/package.json` and change the `"web"` script (or add one if the template didn't generate it) to:

```json
"web": "expo start --web --port 8081"
```

- [ ] **Step 8: Verify it boots**

Run: `cd client && npm run web`
Expected: the dev server starts on port 8081, opens a browser tab, and shows the template's default tab screen with no console errors. Stop the server once confirmed.

- [ ] **Step 9: Commit**

```bash
cd client && git add -A
git commit -m "chore: scaffold the Expo web client"
```

---

## Task 6: Client — theme tokens and component primitives

**Files:**
- Create: `client/lib/theme.ts`
- Create: `client/lib/icons.ts`
- Create: `client/components/Button.tsx`
- Create: `client/components/Card.tsx`
- Create: `client/components/TextField.tsx`
- Create: `client/components/Toggle.tsx`
- Create: `client/components/Tag.tsx`
- Modify: `client/app/_layout.tsx` (temporary verification render — Task 8 replaces this file's contents)

**Interfaces:**
- Produces: `theme` (default export of `theme.ts`), `iconSource(filename: string)` (from `icons.ts`), and five themed components — consumed by every screen task from Task 8 onward.

- [ ] **Step 1: Write `client/lib/theme.ts`**

Ported directly from the design system's `styles.css` tokens (values copied exactly, not approximated):

```ts
export const theme = {
  colors: {
    bg: '#fffbf7',
    text: '#201e1d',
    neutral100: '#f9f4ed',
    neutral200: '#eee7db',
    neutral300: '#dcd3c4',
    neutral400: '#c0b6a5',
    neutral500: '#a19786',
    neutral600: '#82796a',
    neutral700: '#645c50',
    neutral800: '#474238',
    neutral900: '#2e2b25',
    accent100: '#fff2eb',
    accent200: '#ffe1d0',
    accent300: '#ffc6a5',
    accent400: '#f6a06b',
    accent500: '#d67f48',
    accent600: '#b2622d',
    accent700: '#8c491a',
    accent800: '#643312',
    accent900: '#402310',
    accent2_100: '#f0fae1',
    accent2_200: '#e1eecc',
    accent2_300: '#ccdbb2',
    accent2_400: '#aebf92',
    accent2_500: '#8fa073',
    accent2_600: '#728157',
    accent2_700: '#56633f',
    accent2_800: '#3d472b',
    accent2_900: '#272e1b',
  },
  font: {
    heading: 'Caprasimo_400Regular',
    body: 'Figtree_400Regular',
    bodySemibold: 'Figtree_600SemiBold',
    bodyBold: 'Figtree_700Bold',
  },
  fontSize: {
    h1: 42,
    h2: 32,
    h3: 25,
    h4: 20,
    h5: 16,
    h6: 13,
    body: 15,
    small: 13,
    tiny: 12,
  },
  space: {
    1: 4.4,
    2: 8.8,
    3: 13.2,
    4: 17.6,
    6: 26.4,
    8: 35.2,
  },
  radius: {
    sm: 8,
    md: 16,
    lg: 28,
    pill: 999,
  },
  shadow: {
    sm: { shadowColor: '#2e2b25', shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    md: { shadowColor: '#2e2b25', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
    lg: { shadowColor: '#2e2b25', shadowOpacity: 0.22, shadowRadius: 32, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  },
} as const;

export type Theme = typeof theme;
```

- [ ] **Step 2: Write `client/lib/icons.ts`**

```ts
const LOTUS_ICONS: Record<string, number> = {
  'lotus-indigo.png': require('../assets/images/lotus-indigo.png'),
  'lotus-teal.png': require('../assets/images/lotus-teal.png'),
  'lotus-sage.png': require('../assets/images/lotus-sage.png'),
  'lotus-gold.png': require('../assets/images/lotus-gold.png'),
  'lotus-peach.png': require('../assets/images/lotus-peach.png'),
  'lotus-pink.png': require('../assets/images/lotus-pink.png'),
  'lotus-lilac.png': require('../assets/images/lotus-lilac.png'),
  'lotus-ember.png': require('../assets/images/lotus-ember.png'),
  'lotus-tangerine.png': require('../assets/images/lotus-tangerine.png'),
  'lotus-voltage.png': require('../assets/images/lotus-voltage.png'),
  'lotus-smoke.png': require('../assets/images/lotus-smoke.png'),
};

export function iconSource(icon: string): number {
  return LOTUS_ICONS[icon] ?? LOTUS_ICONS['lotus-sage.png'];
}
```

(Metro's bundler requires `require()` paths to be statically analyzable — a fully dynamic `require(icon)` does not work, hence the lookup table rather than string interpolation into `require`.)

- [ ] **Step 3: Write `client/components/Button.tsx`**

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from '../lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && !disabled && variant === 'primary' && { backgroundColor: theme.colors.accent700 },
        pressed && !disabled && variant === 'secondary' && { backgroundColor: theme.colors.neutral200 },
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.bg : theme.colors.accent700} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'ghost' && styles.labelGhost,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: theme.colors.accent500,
  },
  secondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.neutral300,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.text,
  },
  labelPrimary: {
    color: theme.colors.bg,
  },
  labelGhost: {
    color: theme.colors.accent700,
    fontSize: 13.5,
  },
});
```

- [ ] **Step 4: Write `client/components/Card.tsx`**

```tsx
import { StyleSheet, View, ViewProps } from 'react-native';
import { theme } from '../lib/theme';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.neutral200,
    borderRadius: theme.radius.lg,
    padding: theme.space[4],
  },
});
```

- [ ] **Step 5: Write `client/components/TextField.tsx`**

```tsx
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { theme } from '../lib/theme';

interface TextFieldProps extends TextInputProps {
  multiline?: boolean;
}

export function TextField({ style, multiline, ...props }: TextFieldProps) {
  return (
    <TextInput
      style={[styles.base, multiline && styles.multiline, style]}
      placeholderTextColor={theme.colors.neutral500}
      multiline={multiline}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.neutral300,
    borderRadius: theme.radius.lg,
  },
  multiline: {
    minHeight: 168,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
});
```

- [ ] **Step 6: Write `client/components/Toggle.tsx`**

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { theme } from '../lib/theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
}

export function Toggle({ value, onValueChange, accessibilityLabel }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: value ? theme.colors.accent2_500 : theme.colors.neutral300 }]}
    >
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: theme.radius.pill,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
});
```

- [ ] **Step 7: Write `client/components/Tag.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

interface TagProps {
  label: string;
  tint: string;
  ink: string;
}

export function Tag({ label, tint, ink }: TagProps) {
  return (
    <View style={[styles.tag, { backgroundColor: tint }]}>
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
```

- [ ] **Step 8: Verify by temporarily rendering a gallery**

Temporarily replace the contents of `client/app/_layout.tsx` (whatever the scaffold left there) with a screen that renders one of each component/variant — a `Button` in each of the 3 variants, a `Card` wrapping some text, a `TextField` (both single-line and `multiline`), a `Toggle` in both states, a `Tag`. This is scratch verification only.

Run: `cd client && npm run web`
Expected: every primitive renders with the right colors/fonts/shapes (fonts will fall back to system fonts until Task 8 wires up `expo-font` loading — that's expected at this stage, not a bug to fix here). Stop the server once confirmed.

- [ ] **Step 9: Commit**

```bash
cd client && git add lib/theme.ts lib/icons.ts components/
git commit -m "feat: add design system theme tokens and component primitives"
```

(Do not commit the temporary gallery render left in `_layout.tsx` — leave that file as Task 8 will fully rewrite it; if `git status` shows it modified, that's expected and Task 8 supersedes it, not something to clean up here.)

---

## Task 7: Client — API client, data layer, and hooks

**Files:**
- Create: `client/lib/apiClient.ts`
- Create: `client/lib/queryClient.ts`
- Create: `client/lib/hooks/useMe.ts`
- Create: `client/lib/hooks/useColors.ts`
- Create: `client/lib/hooks/useToday.ts`
- Create: `client/lib/hooks/useEntries.ts`
- Create: `client/lib/hooks/useConsentMutation.ts`
- Create: `client/lib/hooks/useEntryMutations.ts`
- Create: `client/lib/hooks/useAccountMutations.ts`

**Interfaces:**
- Consumes: `GET /api/colors` (Task 2), `GET /api/entries` `total` field (Task 3), CORS/stateful-domains config (Task 4).
- Produces: every hook below — consumed by every screen task from Task 8 onward. Response shapes here are copied exactly from the real, already-shipped Laravel resources (`SessionUserResource`, `UserResponseResource`, `ColorResource`) — not guessed.

- [ ] **Step 1: Write `client/lib/apiClient.ts`**

```ts
import { API_URL } from './config';

let csrfReady: Promise<void> | null = null;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfCookie(): Promise<void> {
  if (!csrfReady) {
    csrfReady = fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: 'include' }).then(() => undefined);
  }
  await csrfReady;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type JsonBody = Record<string, unknown>;

async function request<T>(method: string, path: string, body?: JsonBody): Promise<T> {
  const isMutating = method !== 'GET';
  if (isMutating) {
    await ensureCsrfCookie();
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (isMutating) {
    const token = getCookie('XSRF-TOKEN');
    if (token) headers['X-XSRF-TOKEN'] = token;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? response.statusText;
    throw new ApiError(response.status, data, message);
  }

  return data as T;
}

// NOTE: this wrapper is the single seam where a future native build adds
// `Authorization: Bearer <token>` auth — every screen calls apiClient.*,
// never fetch() directly, so that change happens in exactly one place.
export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: JsonBody) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: JsonBody) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
```

- [ ] **Step 2: Write `client/lib/queryClient.ts`**

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});
```

- [ ] **Step 3: Write `client/lib/hooks/useMe.ts`**

Shape copied exactly from `App\Http\Resources\SessionUserResource` (`id`, `email`, `displayName`, `consentAcceptedAt`, `analyticsMarketingConsentAt` — no `name`, no `avatarUrl`, those fields are not in the real resource):

```ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export interface Me {
  id: number;
  email: string;
  displayName: string;
  consentAcceptedAt: string | null;
  analyticsMarketingConsentAt: string | null;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<{ user: Me }>('/api/me').then((r) => r.user),
    retry: false,
  });
}
```

- [ ] **Step 4: Write `client/lib/hooks/useColors.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export interface Color {
  id: number;
  name: string;
  hex: string;
  description: string;
  icon: string;
}

export function useColors() {
  return useQuery({
    queryKey: ['colors'],
    queryFn: () => apiClient.get<{ colors: Color[] }>('/api/colors').then((r) => r.colors),
    staleTime: Infinity, // colors change rarely (see spec §8) — no need to refetch within a session
  });
}
```

- [ ] **Step 5: Write `client/lib/hooks/useToday.ts`**

Shape copied exactly from `App\Http\Resources\UserResponseResource`:

```ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export interface Entry {
  id: number;
  color: string;
  answerText: string | null;
  activityCompleted: boolean;
  entryDate: string;
  flowerX: number | null;
  flowerY: number | null;
  question: { id: number; text: string; quadrant: string };
  activity: { id: number; text: string; note: string | null; quadrant: string } | null;
}

export function useToday() {
  return useQuery({
    queryKey: ['today'],
    queryFn: () => apiClient.get<{ entry: Entry | null }>('/api/today').then((r) => r.entry),
  });
}
```

- [ ] **Step 6: Write `client/lib/hooks/useEntries.ts`**

```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { Entry } from './useToday';

interface EntriesPage {
  entries: Entry[];
  nextCursor: string | null;
  total: number;
}

export function useEntries() {
  return useInfiniteQuery({
    queryKey: ['entries'],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const path = pageParam ? `/api/entries?cursor=${encodeURIComponent(pageParam)}` : '/api/entries';
      return apiClient.get<EntriesPage>(path);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
```

- [ ] **Step 7: Write `client/lib/hooks/useConsentMutation.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export function useConsentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (analyticsMarketing: boolean) => apiClient.post<{ ok: true }>('/api/me/consent', { analyticsMarketing }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
```

- [ ] **Step 8: Write `client/lib/hooks/useEntryMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../apiClient';
import { Entry } from './useToday';

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (colorId: number) => apiClient.post<{ entry: Entry }>('/api/entries', { color_id: colorId }).then((r) => r.entry),
    onSuccess: (entry) => {
      queryClient.setQueryData(['today'], entry);
    },
  });
}

export function useSubmitAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer }: { id: number; answer: string }) =>
      apiClient.patch<{ entry: Entry }>(`/api/entries/${id}`, { answer }).then((r) => r.entry),
    onSuccess: (entry) => {
      queryClient.setQueryData(['today'], entry);
    },
  });
}

export function useRerollActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.post<{ activity: { id: number; text: string; note: string | null; quadrant: string } }>(
        `/api/entries/${id}/reroll-activity`,
      ),
    onSuccess: (result, id) => {
      queryClient.setQueryData(['today'], (current: Entry | null | undefined) =>
        current && current.id === id ? { ...current, activity: result.activity } : current,
      );
    },
  });
}

export function useCompleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.patch<{ entry: Entry }>(`/api/entries/${id}`, { activityCompleted: true }).then((r) => r.entry),
    onSuccess: (entry) => {
      queryClient.setQueryData(['today'], entry);
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete<{ ok: true }>(`/api/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export { ApiError };
```

- [ ] **Step 9: Write `client/lib/hooks/useAccountMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: true }>('/api/logout'),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<{ ok: true; analyticsPurged: boolean }>('/api/me'),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
```

- [ ] **Step 10: Verify against a live local session**

Start the Laravel dev server (`php artisan dev` or `php artisan serve`, from the repo root, with `DB_CONNECTION=sqlite` locally as already established for this environment) and run its seeders if the local database is empty (`php artisan db:seed`). Establish a local session per the Global Constraints' temporary dev-login route pattern, for a user with `consent_accepted_at` already set.

Temporarily render `useMe()`'s and `useColors()`'s data as raw JSON text in `client/app/_layout.tsx` (same scratch-verification approach as Task 6). Run `cd client && npm run web`, open `http://localhost:8081` in the **same browser** that holds the Laravel session cookie (the dev-login route and the Expo app must be visited in the same browser for the cookie to be shared — the CORS config from Task 4 is what allows the cross-port fetch to succeed).

Expected: the screen shows real `displayName`/`email` from `useMe()` and the 11 real colors from `useColors()`, with no CORS error and no 401 in the browser's network tab. If there's a CORS error, re-check Task 4's config before debugging the client — a misconfigured `SANCTUM_STATEFUL_DOMAINS` or `CORS_ALLOWED_ORIGINS` is the most likely cause. Remove the temporary Laravel dev-login route once this verification passes (per Global Constraints).

- [ ] **Step 11: Commit**

```bash
cd client && git add lib/apiClient.ts lib/queryClient.ts lib/hooks/
git commit -m "feat: add API client, TanStack Query setup, and data hooks"
```

---

## Task 8: Client — sign-in, auth guard, and app shell

**Files:**
- Modify: `client/app/_layout.tsx`
- Create: `client/app/sign-in.tsx`
- Create: `client/app/(app)/_layout.tsx`

**Interfaces:**
- Consumes: `useMe` (Task 7).
- Produces: the root navigation shell every other screen task renders inside.

- [ ] **Step 1: Write `client/app/_layout.tsx`**

Replaces Task 6/7's scratch verification content entirely. Loads fonts, sets up the `QueryClientProvider`, and redirects based on session/consent state:

```tsx
import { useFonts, Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Slot, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { queryClient } from '../lib/queryClient';
import { useMe } from '../lib/hooks/useMe';
import { theme } from '../lib/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, isError } = useMe();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.accent500} />
      </View>
    );
  }

  const signedIn = !isError && !!me;
  const consented = signedIn && !!me.consentAcceptedAt;

  if (!signedIn && pathname !== '/sign-in') {
    return <Redirect href="/sign-in" />;
  }
  if (signedIn && !consented && pathname !== '/consent') {
    return <Redirect href="/consent" />;
  }
  if (signedIn && consented && (pathname === '/sign-in' || pathname === '/consent')) {
    return <Redirect href="/today" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.accent500} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Slot />
      </AuthGate>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Write `client/app/sign-in.tsx`**

Content and copy matches the prototype's sign-in screen exactly:

```tsx
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { API_URL } from '../lib/config';
import { theme } from '../lib/theme';

export default function SignIn() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={require('../assets/images/lotus-peach.png')} style={styles.hero} resizeMode="contain" />
        <Text style={styles.title}>Eve Colors</Text>
        <Text style={styles.subtitle}>One color, one question, one small thing — every day.</Text>
        <Button
          title="Continue with Google"
          onPress={() => {
            // Full-page navigation, not a fetch call — the server sets the session
            // cookie via a redirect chain that a fetch/XHR request cannot follow.
            if (typeof window !== 'undefined') {
              window.location.href = `${API_URL}/auth/google/redirect`;
            }
          }}
        />
        <Text style={styles.disclaimer}>
          Private by default. Your colors and answers are only ever yours. Eve Colors is a reflection tool, not a
          medical service.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center' },
  content: { flex: 1, width: '100%', maxWidth: 440, justifyContent: 'center', padding: theme.space[6], gap: theme.space[6] },
  hero: { width: 176, height: 176, alignSelf: 'flex-start' },
  title: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h1, color: theme.colors.text },
  subtitle: { fontFamily: theme.font.body, fontSize: 17, color: theme.colors.neutral700, maxWidth: 260 },
  disclaimer: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.neutral600, maxWidth: 320 },
});
```

- [ ] **Step 3: Write `client/app/(app)/_layout.tsx`**

The bottom tab bar (Today / Garden / You), matching the prototype's bottom nav:

```tsx
import { Tabs } from 'expo-router';
import { Compass, Flower2, User } from 'lucide-react-native';
import { theme } from '../../lib/theme';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent700,
        tabBarInactiveTintColor: theme.colors.neutral600,
        tabBarStyle: { borderTopColor: theme.colors.neutral200, backgroundColor: '#fffdfa' },
        tabBarLabelStyle: { fontFamily: theme.font.bodySemibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Compass color={color} size={size} strokeWidth={2.75} /> }}
      />
      <Tabs.Screen
        name="garden/index"
        options={{ title: 'Garden', tabBarIcon: ({ color, size }) => <Flower2 color={color} size={size} strokeWidth={2.75} /> }}
      />
      <Tabs.Screen
        name="garden/[id]"
        options={{ href: null }} // reachable only via navigation, not a tab
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'You', tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={2.75} /> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Verify manually**

Without a session (no dev-login visit, or a fresh incognito window): run `cd client && npm run web`, confirm loading `http://localhost:8081` redirects to `/sign-in` and shows the sign-in screen with the "Continue with Google" button. Click it — confirm the browser navigates to the Laravel server's `/auth/google/redirect` (it's fine if this then errors past that point, since no real Google credentials are configured; confirming the redirect *target* is correct is what this step checks).

With a session established via the Global Constraints' dev-login route (for a consented user): confirm loading `http://localhost:8081` redirects straight to `/today` and shows the (currently empty, since `today.tsx` doesn't exist until Task 10) tab shell without erroring.

- [ ] **Step 5: Commit**

```bash
cd client && git add app/_layout.tsx app/sign-in.tsx "app/(app)/_layout.tsx"
git commit -m "feat: add sign-in screen, auth guard, and tab shell"
```

---

## Task 9: Client — consent screen

**Files:**
- Create: `client/app/consent.tsx`

**Interfaces:**
- Consumes: `useConsentMutation` (Task 7).
- Produces: the consent screen the auth guard (Task 8) redirects newly-signed-in, not-yet-consented users to.

- [ ] **Step 1: Write `client/app/consent.tsx`**

Copy and structure matches the prototype's consent screen exactly (the medical-disclaimer card, the two opt-in toggles, the accept button):

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Button } from '../components/Button';
import { useConsentMutation } from '../lib/hooks/useConsentMutation';
import { theme } from '../lib/theme';

export default function Consent() {
  const [analytics, setAnalytics] = useState(false);
  const mutation = useConsentMutation();

  const accept = () => {
    mutation.mutate(analytics, {
      onSuccess: () => router.replace('/today'),
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Before we begin</Text>
      <Text style={styles.body}>A few things to know, once. You can change your choices any time in settings.</Text>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>This is not medical care</Text>
        <Text style={styles.noticeBody}>
          Eve Colors is for everyday self-reflection. It does not diagnose, treat, or score anything, and it is not
          a substitute for care from a professional. If you are having a hard time, please reach out to someone you
          trust.
        </Text>
      </View>

      <Pressable style={styles.optionRow} onPress={() => setAnalytics((v) => !v)}>
        <View style={[styles.checkbox, analytics && styles.checkboxOn]}>
          {analytics && <Check size={14} color="#ffffff" strokeWidth={3.2} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>Help improve Eve Colors</Text>
          <Text style={styles.optionSubtitle}>Anonymous usage counts. Never your answers.</Text>
        </View>
      </Pressable>

      <Button title="I understand — let's start" onPress={accept} loading={mutation.isPending} style={{ marginTop: theme.space[6] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[6], gap: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center' },
  title: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text },
  body: { fontFamily: theme.font.body, fontSize: 15, color: theme.colors.neutral700 },
  noticeCard: { backgroundColor: theme.colors.accent100, borderRadius: theme.radius.lg, padding: theme.space[4] },
  noticeTitle: { fontFamily: theme.font.heading, fontSize: 15, marginBottom: 6, color: theme.colors.text },
  noticeBody: { fontFamily: theme.font.body, fontSize: 13.5, lineHeight: 21, color: theme.colors.neutral700 },
  optionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.md, padding: theme.space[3] },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: theme.colors.neutral400, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: theme.colors.accent2_500, borderColor: theme.colors.accent2_500 },
  optionTitle: { fontFamily: theme.font.bodySemibold, fontSize: 14.5, color: theme.colors.text },
  optionSubtitle: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.neutral600, marginTop: 2 },
});
```

(The prototype also shows a second "Occasional notes by email" marketing toggle — the real `POST /api/me/consent` endpoint only accepts one `analyticsMarketing` boolean covering both, per the already-shipped API's `MeController::updateConsent()`, so this screen has one toggle, not two, matching what the endpoint actually models.)

- [ ] **Step 2: Verify manually**

Using the dev-login route for a signed-in, **not yet consented** user (`consent_accepted_at` null): run `cd client && npm run web`, confirm landing on `/consent` automatically (per Task 8's auth guard). Toggle the checkbox, tap "I understand — let's start", confirm it redirects to `/today` and that a fresh `GET /api/me` call (check via the browser's network tab, or Laravel tinker) now shows `consent_accepted_at` set.

- [ ] **Step 3: Commit**

```bash
cd client && git add app/consent.tsx
git commit -m "feat: add consent screen"
```

---

## Task 10: Client — Today screen (color → question → task → bloom)

**Files:**
- Create: `client/app/(app)/today.tsx`

**Interfaces:**
- Consumes: `useToday`, `useColors`, `useCreateEntry`, `useSubmitAnswer`, `useRerollActivity`, `useCompleteActivity` (Task 7), `Button`, `Card`, `TextField` (Task 6).
- Produces: the daily-flow screen — the app's primary destination.

This is the largest single screen: one route, four internal stages (`color` / `question` / `task` / `bloom`), matching the prototype's own `step` state machine. The current stage is derived from the already-fetched `today` entry wherever possible (so a page refresh mid-flow lands on the right stage), with `bloom` as the one stage that's purely local (there's nothing server-side that distinguishes "just completed" from "completed a while ago" — that transition is a client-only celebration, matching the prototype).

- [ ] **Step 1: Write `client/app/(app)/today.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useToday } from '../../lib/hooks/useToday';
import { useColors, Color } from '../../lib/hooks/useColors';
import { useCreateEntry, useSubmitAnswer, useRerollActivity, useCompleteActivity } from '../../lib/hooks/useEntryMutations';
import { iconSource } from '../../lib/icons';
import { theme } from '../../lib/theme';

type Stage = 'color' | 'question' | 'task' | 'done' | 'bloom';

function stageFor(entry: ReturnType<typeof useToday>['data']): Stage {
  if (!entry) return 'color';
  if (entry.answerText === null) return 'question';
  if (!entry.activityCompleted) return 'task';
  return 'done'; // already completed on a prior visit/reload — not the same-session bloom celebration
}

export default function Today() {
  const { data: entry, isLoading } = useToday();
  const [stage, setStage] = useState<Stage>('color');
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [justBloomed, setJustBloomed] = useState(false);

  useEffect(() => {
    if (!isLoading) setStage(entry ? stageFor(entry) : 'color');
  }, [isLoading, entry?.id, entry?.answerText, entry?.activityCompleted]);

  if (isLoading) return null;

  if (justBloomed && entry?.activityCompleted) {
    return <BloomStage entry={entry} onDone={() => setJustBloomed(false)} />;
  }

  if (stage === 'color') {
    return <ColorStage selectedColorId={selectedColorId} onSelect={setSelectedColorId} onCreated={() => setStage('question')} />;
  }
  if (stage === 'question' && entry) {
    return (
      <QuestionStage
        entry={entry}
        draft={answerDraft}
        onDraftChange={setAnswerDraft}
        onSubmitted={() => setStage('task')}
      />
    );
  }
  if (stage === 'task' && entry) {
    return <TaskStage entry={entry} onCompleted={() => setJustBloomed(true)} />;
  }
  if (stage === 'done' && entry) {
    return <DoneStage entry={entry} />;
  }
  return null;
}

function DoneStage({ entry }: { entry: NonNullable<ReturnType<typeof useToday>['data']> }) {
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: theme.space[6] }]}>
      <Image source={require('../../assets/images/lotus-peach.png')} style={{ width: 150, height: 150 }} resizeMode="contain" />
      <Text style={[styles.h2, { marginTop: theme.space[4], textAlign: 'center' }]}>Already planted today.</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>
        {entry.color} — {entry.activity?.text ?? 'Today’s task'}. Come back tomorrow for the next one.
      </Text>
      <Button title="See my garden" onPress={() => router.replace('/garden')} style={{ marginTop: theme.space[6], width: '100%' }} />
    </View>
  );
}

function ColorStage({
  selectedColorId,
  onSelect,
  onCreated,
}: {
  selectedColorId: number | null;
  onSelect: (id: number) => void;
  onCreated: () => void;
}) {
  const { data: colors, isLoading } = useColors();
  const createEntry = useCreateEntry();

  const submit = () => {
    if (!selectedColorId) return;
    createEntry.mutate(selectedColorId, { onSuccess: onCreated });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h2}>How does today feel?</Text>
      <Text style={styles.subtitle}>Pick the color that fits. There's no wrong one.</Text>
      <View style={{ gap: 10 }}>
        {isLoading && <Text style={styles.subtitle}>Loading colors…</Text>}
        {colors?.map((c: Color) => {
          const selected = c.id === selectedColorId;
          return (
            <Pressable
              key={c.id}
              onPress={() => onSelect(c.id)}
              style={[styles.colorRow, selected && { borderColor: c.hex, borderWidth: 2, backgroundColor: `${c.hex}1a` }]}
            >
              <Image source={iconSource(c.icon)} style={styles.colorIcon} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.colorName}>{c.name}</Text>
                <Text style={styles.colorBlurb}>{c.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Button
        title={selectedColorId ? 'Continue' : 'Choose a color'}
        onPress={submit}
        disabled={!selectedColorId}
        loading={createEntry.isPending}
        style={{ marginTop: theme.space[6] }}
      />
    </ScrollView>
  );
}

function QuestionStage({
  entry,
  draft,
  onDraftChange,
  onSubmitted,
}: {
  entry: NonNullable<ReturnType<typeof useToday>['data']>;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmitted: () => void;
}) {
  const submitAnswer = useSubmitAnswer();

  const submit = () => {
    if (!draft.trim()) return;
    submitAnswer.mutate({ id: entry.id, answer: draft.trim() }, { onSuccess: onSubmitted });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { flexGrow: 1 }]}>
      <Text style={styles.h2}>{entry.question.text}</Text>
      <TextField
        multiline
        value={draft}
        onChangeText={onDraftChange}
        placeholder="A sentence is plenty."
        style={{ marginTop: theme.space[4] }}
      />
      <Text style={styles.helper}>Only you can read this.</Text>
      <View style={{ flex: 1 }} />
      <Button title="Next" onPress={submit} disabled={!draft.trim()} loading={submitAnswer.isPending} />
    </ScrollView>
  );
}

function TaskStage({
  entry,
  onCompleted,
}: {
  entry: NonNullable<ReturnType<typeof useToday>['data']>;
  onCompleted: () => void;
}) {
  const reroll = useRerollActivity();
  const complete = useCompleteActivity();

  if (!entry.activity) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { flexGrow: 1 }]}>
      <Text style={styles.h2}>One small thing</Text>
      <View style={styles.taskCard}>
        <Text style={styles.taskKicker}>TODAY'S TASK</Text>
        <Text style={styles.taskTitle}>{entry.activity.text}</Text>
        {!!entry.activity.note && <Text style={styles.taskNote}>{entry.activity.note}</Text>}
      </View>
      <Button
        title="Give me another"
        variant="secondary"
        onPress={() => reroll.mutate(entry.id)}
        loading={reroll.isPending}
        disabled={entry.activityCompleted}
        style={{ alignSelf: 'flex-start', marginTop: theme.space[3] }}
      />
      <View style={{ flex: 1 }} />
      <Button
        title="I did it — plant my flower"
        onPress={() => complete.mutate(entry.id, { onSuccess: onCompleted })}
        loading={complete.isPending}
      />
    </ScrollView>
  );
}

function BloomStage({ entry, onDone }: { entry: NonNullable<ReturnType<typeof useToday>['data']>; onDone: () => void }) {
  const scale = useSharedValue(0.28);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.08, { duration: 560, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 200 }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: theme.space[6] }]}>
      <Animated.Image source={require('../../assets/images/lotus-peach.png')} style={[{ width: 200, height: 200 }, animatedStyle]} resizeMode="contain" />
      <Text style={[styles.h2, { marginTop: theme.space[4] }]}>Planted.</Text>
      <Text style={styles.subtitle}>Come back tomorrow for the next one.</Text>
      <Button title="See my garden" onPress={() => { onDone(); router.replace('/garden'); }} style={{ marginTop: theme.space[6], width: '100%' }} />
    </View>
  );
}

import { router } from 'expo-router';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center' },
  h2: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text, marginBottom: theme.space[1] },
  subtitle: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.neutral700, marginBottom: theme.space[4] },
  helper: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.neutral600, marginTop: theme.space[2] },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200 },
  colorIcon: { width: 54, height: 54 },
  colorName: { fontFamily: theme.font.heading, fontSize: 16, color: theme.colors.text },
  colorBlurb: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.neutral700, marginTop: 1 },
  taskCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.lg, padding: theme.space[6] },
  taskKicker: { fontFamily: theme.font.body, fontSize: 11.5, letterSpacing: 1.2, color: theme.colors.neutral600, marginBottom: theme.space[2] },
  taskTitle: { fontFamily: theme.font.heading, fontSize: 25, color: theme.colors.text, lineHeight: 30 },
  taskNote: { fontFamily: theme.font.body, fontSize: 13.5, color: theme.colors.neutral700, marginTop: theme.space[3] },
});
```

(Move the `import { router } from 'expo-router';` line to the top of the file with the other imports — it's written separately above only because `BloomStage` was introduced after the initial import block in this listing; when actually writing the file, all imports belong at the top in one block, standard TypeScript convention.)

- [ ] **Step 2: Verify manually — full flow**

Using the dev-login route for a signed-in, consented user with no entry for today yet: run `cd client && npm run web`, land on `/today`, confirm the color stage renders all 11 real colors with icons/names/descriptions from `GET /api/colors`. Pick one, confirm it advances to the question stage showing a real server-picked question. Type an answer, submit, confirm it advances to the task stage showing a real activity's text + note. Tap "Give me another" — confirm the activity text changes. Tap "I did it — plant my flower" — confirm the bloom animation plays and "Planted." shows. Tap "See my garden" — confirm it navigates to `/garden` (which won't render real content until Task 11, but the navigation itself should succeed with no error).

Reload the page mid-flow at each stage (after picking a color, after answering) and confirm it correctly resumes at the right stage rather than resetting to color-picker — this is the derived-stage behavior from Step 1, and it's the main thing worth deliberately re-testing here.

- [ ] **Step 3: Commit**

```bash
cd client && git add "app/(app)/today.tsx"
git commit -m "feat: add Today screen (color, question, task, bloom)"
```

---

## Task 11: Client — Garden screen (real 2D scattered scene + entry list)

**Files:**
- Create: `client/app/(app)/garden/index.tsx`

**Interfaces:**
- Consumes: `useEntries` (Task 7), `useColors` (Task 7, for resolving each entry's icon/hex from its `color` name — `UserResponseResource.color` is a plain name string, not an object, so the client cross-references the already-fetched colors list by name).
- Produces: the garden tab's main screen.

- [ ] **Step 1: Write `client/app/(app)/garden/index.tsx`**

The garden scene renders each entry's flower at its actual server-assigned `flowerX`/`flowerY` percentage within a fixed-height scene container — a genuine scattered map, not the prototype's simplified row (per the approved spec decision in §10 of the design doc). Entries without a placed flower yet (`flowerX`/`flowerY` null — possible if an entry exists but its activity isn't completed) are excluded from the scene, only shown in the list below.

```tsx
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEntries } from '../../../lib/hooks/useEntries';
import { useColors } from '../../../lib/hooks/useColors';
import { iconSource } from '../../../lib/icons';
import { theme } from '../../../lib/theme';
import { Button } from '../../../components/Button';

const SCENE_HEIGHT = 220;

export default function Garden() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useEntries();
  const { data: colors } = useColors();

  const colorsByName = new Map((colors ?? []).map((c) => [c.name, c]));
  const entries = (data?.pages ?? []).flatMap((p) => p.entries);
  const total = data?.pages[0]?.total ?? 0;
  const planted = entries.filter((e) => e.flowerX !== null && e.flowerY !== null);

  if (isLoading) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h2}>My Garden</Text>
      <Text style={styles.subtitle}>{total} {total === 1 ? 'day' : 'days'}, all yours. Tap any flower to read it back.</Text>

      <View style={styles.scene}>
        {planted.map((e) => {
          const color = colorsByName.get(e.color);
          return (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/garden/${e.id}`)}
              style={[
                styles.flower,
                { left: `${e.flowerX}%`, top: `${e.flowerY}%` },
              ]}
            >
              <Image source={iconSource(color?.icon ?? 'lotus-sage.png')} style={styles.flowerIcon} resizeMode="contain" />
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 10, marginTop: theme.space[6] }}>
        {entries.map((e) => {
          const color = colorsByName.get(e.color);
          return (
            <Pressable key={e.id} onPress={() => router.push(`/garden/${e.id}`)} style={styles.entryRow}>
              <Image source={iconSource(color?.icon ?? 'lotus-sage.png')} style={styles.entryIcon} resizeMode="contain" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', gap: 7, alignItems: 'baseline' }}>
                  <Text style={styles.entryColorName}>{e.color}</Text>
                  <Text style={styles.entryDate}>{e.entryDate}</Text>
                </View>
                <Text style={styles.entrySnippet} numberOfLines={1}>{e.answerText}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {hasNextPage && (
        <Button title="Load more" variant="secondary" onPress={() => fetchNextPage()} loading={isFetchingNextPage} style={{ marginTop: theme.space[4] }} />
      )}

      <Text style={styles.footnote}>Your garden is private. Nothing here is shared.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center' },
  h2: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text, marginBottom: theme.space[1] },
  subtitle: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.neutral700, marginBottom: theme.space[4] },
  scene: { height: SCENE_HEIGHT, borderRadius: theme.radius.lg, backgroundColor: theme.colors.accent2_100, position: 'relative', overflow: 'hidden' },
  flower: { position: 'absolute', width: 40, height: 40, marginLeft: -20, marginTop: -20 },
  flowerIcon: { width: '100%', height: '100%' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: 22, padding: 10 },
  entryIcon: { width: 48, height: 48 },
  entryColorName: { fontFamily: theme.font.heading, fontSize: 15, color: theme.colors.text },
  entryDate: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.neutral600 },
  entrySnippet: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.neutral700, marginTop: 2 },
  footnote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.neutral600, textAlign: 'center', marginTop: theme.space[6] },
});
```

(`left`/`top` as percentage strings are valid React Native Web style values for an absolutely-positioned child of a `position: relative` parent with a fixed height — this works today on the web target this phase targets; a future native build would need `onLayout` to convert percentages to pixel offsets instead, since React Native's `View` doesn't support percentage `top`/`left` on non-web platforms the same way. Not a concern for this phase.)

- [ ] **Step 2: Verify manually**

Using the dev-login route for a consented user with at least 2-3 completed entries (complete a couple of days through the Today flow first, or seed `UserResponse` rows directly via `php artisan tinker` with `flower_x`/`flower_y` set): confirm the garden scene shows a flower for each completed entry, positioned at roughly its stored `flowerX`/`flowerY` percentage within the scene box (not all clustered in one spot). Confirm the entry list below shows every entry (completed or not), tapping one navigates toward `/garden/[id]` (won't fully render until Task 12, but the navigation attempt should not error). If there are more than 20 entries, confirm "Load more" appears and fetches the next page.

- [ ] **Step 3: Commit**

```bash
cd client && git add "app/(app)/garden/index.tsx"
git commit -m "feat: add Garden screen with real flower-coordinate scene"
```

---

## Task 12: Client — entry detail (modal route) + delete entry

**Files:**
- Create: `client/app/(app)/garden/[id].tsx`
- Create: `client/components/ConfirmDialog.tsx`

**Interfaces:**
- Consumes: `useEntries` (Task 7, to look up the entry by id from the already-cached pages — no new fetch needed), `useDeleteEntry` (Task 7).
- Produces: the entry-detail modal, and a shared `ConfirmDialog` component reused by Task 13's delete-account flow.

- [ ] **Step 1: Write `client/components/ConfirmDialog.tsx`**

Matches the prototype's bottom-sheet confirm dialog, reused for both "delete this day" and "delete my account":

```tsx
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { theme } from '../lib/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

export function ConfirmDialog({ visible, title, body, confirmLabel, onConfirm, onCancel, confirming }: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Button title={confirmLabel} onPress={onConfirm} loading={confirming} style={{ backgroundColor: theme.colors.accent800 }} />
          <Button title="Keep it" variant="secondary" onPress={onCancel} style={{ marginTop: theme.space[2] }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(88, 70, 84, 0.34)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.bg, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, padding: theme.space[6] },
  title: { fontFamily: theme.font.heading, fontSize: 21, color: theme.colors.text, marginBottom: theme.space[2] },
  body: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.neutral700, marginBottom: theme.space[4] },
});
```

- [ ] **Step 2: Write `client/app/(app)/garden/[id].tsx`**

```tsx
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, Check } from 'lucide-react-native';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useEntries } from '../../../lib/hooks/useEntries';
import { useColors } from '../../../lib/hooks/useColors';
import { useDeleteEntry } from '../../../lib/hooks/useEntryMutations';
import { iconSource } from '../../../lib/icons';
import { theme } from '../../../lib/theme';

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useEntries();
  const { data: colors } = useColors();
  const deleteEntry = useDeleteEntry();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const entry = (data?.pages ?? []).flatMap((p) => p.entries).find((e) => String(e.id) === id);
  const color = colors?.find((c) => c.name === entry?.color);

  if (!entry) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>This entry is no longer available.</Text>
      </View>
    );
  }

  const confirmDelete = () => {
    deleteEntry.mutate(entry.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        router.back();
      },
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Button title="Garden" variant="secondary" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />

      <View style={{ alignItems: 'center', marginVertical: theme.space[6] }}>
        <Image source={iconSource(color?.icon ?? 'lotus-sage.png')} style={{ width: 150, height: 150 }} resizeMode="contain" />
        <Text style={styles.colorName}>{entry.color}</Text>
        <Text style={styles.date}>{entry.entryDate}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>THE QUESTION</Text>
        <Text style={styles.question}>{entry.question.text}</Text>
        <Text style={styles.answer}>{entry.answerText}</Text>
      </View>

      {entry.activityCompleted && entry.activity && (
        <View style={styles.taskDone}>
          <Check size={18} color={theme.colors.accent2_700} strokeWidth={2.75} />
          <Text style={styles.taskDoneText}>{entry.activity.text}</Text>
        </View>
      )}

      <Button title="Delete this day" variant="ghost" onPress={() => setConfirmOpen(true)} style={{ marginTop: theme.space[6] }} />

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete this day?"
        body="The color, question, answer and task for this day will be removed from your garden. This can't be undone."
        confirmLabel="Delete this day"
        confirming={deleteEntry.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center' },
  body: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.neutral700 },
  colorName: { fontFamily: theme.font.heading, fontSize: 22, color: theme.colors.text, marginTop: theme.space[2] },
  date: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.neutral600, marginTop: 2 },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.lg, padding: theme.space[4] },
  kicker: { fontFamily: theme.font.body, fontSize: 11.5, letterSpacing: 1.2, color: theme.colors.neutral600, marginBottom: 6 },
  question: { fontFamily: theme.font.heading, fontSize: 18, color: theme.colors.text, marginBottom: theme.space[3] },
  answer: { fontFamily: theme.font.body, fontSize: 14.5, lineHeight: 23, color: theme.colors.neutral800 },
  taskDone: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.accent2_100, borderRadius: theme.radius.lg, padding: theme.space[3], marginTop: 10 },
  taskDoneText: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.text },
});
```

- [ ] **Step 3: Verify manually**

From the garden screen (Task 11), tap an entry — confirm the detail view shows the right color, date, question, answer, and (if completed) the task line. Tap "Delete this day", confirm the dialog appears, tap "Keep it" and confirm it closes with no change. Reopen, tap "Delete this day" for real, confirm it navigates back to the garden list and the entry is actually gone (both from the list and, if it had a flower, from the scene).

- [ ] **Step 4: Commit**

```bash
cd client && git add "app/(app)/garden/[id].tsx" components/ConfirmDialog.tsx
git commit -m "feat: add entry detail screen and delete-entry flow"
```

---

## Task 13: Client — Settings screen

**Files:**
- Create: `client/app/(app)/settings.tsx`

**Interfaces:**
- Consumes: `useMe`, `useConsentMutation`, `useLogout`, `useDeleteAccount` (Task 7), `ConfirmDialog` (Task 12).
- Produces: the "You" tab's screen.

- [ ] **Step 1: Write `client/app/(app)/settings.tsx`**

```tsx
import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Toggle } from '../../components/Toggle';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useMe } from '../../lib/hooks/useMe';
import { useConsentMutation } from '../../lib/hooks/useConsentMutation';
import { useLogout, useDeleteAccount } from '../../lib/hooks/useAccountMutations';
import { theme } from '../../lib/theme';

export default function Settings() {
  const { data: me } = useMe();
  const consentMutation = useConsentMutation();
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!me) return null;

  const analyticsOn = !!me.analyticsMarketingConsentAt;

  const signOut = () => {
    logout.mutate(undefined, { onSuccess: () => router.replace('/sign-in') });
  };

  const confirmDelete = () => {
    deleteAccount.mutate(undefined, { onSuccess: () => router.replace('/sign-in') });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h2}>Account</Text>
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{me.displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.name}>{me.displayName}</Text>
          <Text style={styles.email}>{me.email} · Google</Text>
        </View>
      </View>

      <Text style={styles.h4}>Privacy</Text>
      <View style={styles.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>Anonymous analytics</Text>
          <Text style={styles.settingSubtitle}>Usage counts only, never answers.</Text>
        </View>
        <Toggle
          value={analyticsOn}
          accessibilityLabel="Toggle analytics"
          onValueChange={(v) => consentMutation.mutate(v)}
        />
      </View>

      <Text style={styles.h4}>Your data</Text>
      <Button title="Delete my account" variant="secondary" onPress={() => setConfirmOpen(true)} style={{ borderColor: theme.colors.accent300, backgroundColor: theme.colors.accent100 }} />
      <Button title="Sign out" variant="ghost" onPress={signOut} loading={logout.isPending} style={{ marginTop: theme.space[2] }} />

      <Text style={styles.footnote}>
        Eve Colors is a reflection tool, not medical advice. In the US you can call or text 988 any time to reach
        the Suicide &amp; Crisis Lifeline.
      </Text>

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete your account?"
        body="Every flower in your garden and all of your answers are erased within 24 hours. You'll be signed out right away."
        confirmLabel="Delete everything"
        confirming={deleteAccount.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center', gap: theme.space[2] },
  h2: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text, marginBottom: theme.space[2] },
  h4: { fontFamily: theme.font.heading, fontSize: 17, color: theme.colors.text, marginTop: theme.space[6], marginBottom: theme.space[2] },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.lg, padding: theme.space[3] },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent200, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: theme.font.heading, fontSize: 17, color: theme.colors.accent800 },
  name: { fontFamily: theme.font.bodySemibold, fontSize: 14.5, color: theme.colors.text },
  email: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.neutral600 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.md, padding: theme.space[3] },
  settingTitle: { fontFamily: theme.font.bodySemibold, fontSize: 14.5, color: theme.colors.text },
  settingSubtitle: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.neutral600 },
  footnote: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 19, color: theme.colors.neutral600, marginTop: theme.space[6] },
});
```

- [ ] **Step 2: Verify manually**

Using the dev-login route: confirm the settings screen shows the real signed-in user's name/email, toggling analytics calls the API and the toggle reflects the persisted state after a reload. Tap "Delete my account", confirm the dialog appears with the exact copy above; cancel it once to confirm nothing happens; then for a **throwaway test user only** (never the account you're using for ongoing manual testing of other tasks), confirm it, and confirm the app redirects to `/sign-in` and the account is genuinely gone (a repeat sign-in attempt would create a fresh account, not resurrect the old one).

- [ ] **Step 3: Commit**

```bash
cd client && git add "app/(app)/settings.tsx"
git commit -m "feat: add Settings screen"
```

---

## Task 14: Client — README and final verification

**Files:**
- Create: `client/README.md`

**Interfaces:**
- None — documentation and final regression pass only.

- [ ] **Step 1: Write `client/README.md`**

```markdown
# Eve Colors — Web Client

The Expo web client for Eve Colors, consuming the Laravel API in this
repo's root. Web target only for this phase — the same Expo Router
codebase is designed to add iOS/Android later with no rewrite.

## Local development

1. `npm install`
2. Copy `.env.example` to `.env` if present, or set `EXPO_PUBLIC_API_URL`
   to point at your local Laravel server (defaults to
   `http://localhost:8000` if unset).
3. Make sure the Laravel API's `.env` has `SANCTUM_STATEFUL_DOMAINS`
   and `CORS_ALLOWED_ORIGINS` including `localhost:8081` (already set
   by this repo's own server setup).
4. `npm run web` — starts the dev server on port 8081, matching the
   Laravel API's configured `FRONTEND_URL`.

Signing in locally requires a real Google OAuth client configured on
the Laravel side (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in its
`.env`) — without one, the sign-in button's redirect will reach Google
and fail there. See the root README's deployment section.

## Structure

- `app/` — Expo Router screens (file-based routing)
- `components/` — themed UI primitives
- `lib/` — API client, TanStack Query hooks, theme tokens
- `assets/` — bundled images (lotus icons per color)

## Status

Color → question → task → bloom daily flow, garden (real flower
coordinates), entry detail, settings, and account deletion are built.
Not built yet: iOS/Android builds, offline support, garden data
export.
```

- [ ] **Step 2: Full regression pass**

Run the backend's full test suite one more time to confirm nothing regressed across this whole plan's backend tasks: `php artisan test` from the repo root. Expected: every test green.

Using the dev-login route for a fresh test user, walk the entire flow start to finish in one sitting: sign-in screen renders → (simulate arriving post-auth via the dev-login route, since real Google auth isn't available) → consent → pick a color → answer the question → complete (or reroll then complete) the task → bloom → garden shows the new flower at a real position → tap into the entry detail → delete it → confirm it's gone → visit settings → toggle analytics → sign out → confirm redirect to sign-in.

- [ ] **Step 3: Commit**

```bash
cd client && git add README.md
git commit -m "docs: add client README with local dev instructions"
```
