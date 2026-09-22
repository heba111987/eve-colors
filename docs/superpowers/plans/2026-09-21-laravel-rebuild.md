# Eve Colors: Laravel Server-Side Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cloudflare Workers/D1/React implementation with a Laravel 13 + Filament + Sanctum/Socialite + MySQL backend, hosted on Laravel Cloud, exposing the same product (color → question → answer → activity → garden flower) via a REST API and a Filament admin panel. No client app is built in this phase.

**Architecture:** A single Laravel 13 application at the repo root. Filament (admin panel at `/admin`) shares the same Eloquent models as the public API. Sanctum provides dual auth (cookie for a future same-site SPA, bearer token for a future mobile app) behind one `auth:sanctum` middleware. Socialite handles the Google OAuth redirect flow for web; a custom ID-token verifier (Google's `tokeninfo` endpoint, same approach validated in the prior Cloudflare build) handles the mobile-style token exchange. MySQL in production (Laravel Cloud), SQLite in-memory for tests.

**Tech Stack:** Laravel 13, Filament (v5 line), Laravel Sanctum, Laravel Socialite, MySQL (prod) / SQLite (test), Pest, Laravel Cloud.

**Spec:** `docs/superpowers/specs/2026-09-21-laravel-rebuild-design.md`

## Global Constraints

- Not a medical tool — this is a requirement the eventual client must honor; nothing to enforce server-side beyond not contradicting it in API copy/error messages.
- No payment/paywall of any kind.
- No data migration — clean slate, no existing users.
- Colors are a mood label only — no quadrant field, not linked to question/activity selection.
- Quadrant is a fixed 4-value set: `mental | physical | emotional | spiritual`, modeled as a backed PHP enum (`App\Enums\Quadrant`), stored as a plain `string` column (not a native DB enum) for portability.
- One entry per user per UTC calendar day — enforced by a `UNIQUE (user_id, entry_date)` database constraint; `entry_date` computed server-side from UTC, never from client input.
- Question selection excludes anything this user used in the last 7 days; if the whole active bank was used in 7 days, fall back to the least-recently-used question for that user — never fail with "no question available."
- Activity selection has no repeat window, but a "reroll" (pre-completion only) must exclude the currently-assigned activity when another is available.
- Flower `(x, y)` is assigned by the server, as a percentage (0–100, `decimal(5,2)`), only when an entry's activity is marked complete — not at entry creation.
- `users.google_id` is the identity key for Socialite/mobile upsert; `users.password` is nullable and unused (Google-only sign-in).
- Sessions/tokens: `auth:sanctum` accepts either a stateful cookie session (web) or a personal access token (`Authorization: Bearer`, mobile) — written once, used everywhere, per Sanctum's own design (no manual dual-path branching needed, unlike the Cloudflare build's hand-rolled version).
- Account deletion (`DELETE /api/me`) must remove the user row (cascading via FK to `user_responses` and `personal_access_tokens`) AND best-effort purge the PostHog EU person record — a PostHog failure must never block the account deletion (this exact bug was found and fixed once already in the Cloudflare build; build it in correctly from the start here).
- Required wellness/terms consent (`consent_accepted_at`) must be enforced **server-side** via middleware on `/api/entries/*` and `/api/today` — not left to a future client to enforce alone (another gap the Cloudflare build had to patch after the fact).
- `UserResponseResource` in Filament is **view-only** — no edit/delete from the admin panel.
- Seed content (11 colors, 11 questions, 33 activities) is transcribed verbatim from the prior Cloudflare build's seed data, including quadrant tags.

---

## Task 1: Scaffold — remove Cloudflare code, install fresh Laravel 13 + Pest

**Files:**
- Delete: `worker/`, `shared/`, `web/`, `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`
- Create: a fresh Laravel 13 application at the repo root (`app/`, `bootstrap/`, `config/`, `database/`, `public/`, `resources/`, `routes/`, `tests/`, `artisan`, `composer.json`, etc.)
- Modify: `.gitignore` (Laravel's own gitignore replaces the old one; re-add the `.superpowers/` entry)

**Interfaces:**
- Produces: a booting Laravel 13 app with `php artisan test` passing (0 tests) and `composer install` succeeding — the foundation every later task builds on.

- [ ] **Step 1: Remove the Cloudflare implementation and irrelevant Node config**

```bash
git rm -r worker shared web package.json package-lock.json .npmrc .nvmrc
```

- [ ] **Step 2: Install Laravel 13 into a temp directory, then move it into the repo root**

```bash
composer create-project laravel/laravel _laravel_tmp "^13.0" --prefer-dist --no-interaction
rm -rf _laravel_tmp/.git
cp -R _laravel_tmp/. .
rm -rf _laravel_tmp
```

(`cp -R _laravel_tmp/. .` copies all files including dotfiles into the repo root without touching the real `.git`, since `_laravel_tmp/.git` was removed first.)

- [ ] **Step 3: Re-add the `.superpowers/` gitignore entry Laravel's own `.gitignore` doesn't have**

Append to the end of `.gitignore`:

```
# subagent-driven-development scratch workspace
.superpowers/
```

- [ ] **Step 4: Configure `.env.example` with the variables this app will need**

Add these lines to `.env.example` (alongside Laravel's defaults — don't remove Laravel's own entries, just add these):

```
DB_CONNECTION=mysql
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI="${APP_URL}/auth/google/callback"
FRONTEND_URL=http://localhost:8081
POSTHOG_PROJECT_ID=
POSTHOG_DELETION_API_KEY=
```

Copy it to a real `.env`: `cp .env.example .env`, then `php artisan key:generate`.

- [ ] **Step 5: Register the new config values**

In `config/services.php`, add to the returned array (alongside the existing `postmark`/`resend`/`slack` entries Laravel ships by default — don't remove those):

```php
'google' => [
    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect' => env('GOOGLE_REDIRECT_URI'),
],

'posthog' => [
    'project_id' => env('POSTHOG_PROJECT_ID'),
    'deletion_api_key' => env('POSTHOG_DELETION_API_KEY'),
],
```

Add to `config/app.php`'s returned array:

```php
'frontend_url' => env('FRONTEND_URL', 'http://localhost:8081'),
```

- [ ] **Step 6: Install Pest**

```bash
composer require pestphp/pest pestphp/pest-plugin-laravel --dev --with-all-dependencies
php artisan pest:install
```

- [ ] **Step 7: Configure SQLite in-memory for the test environment**

In `phpunit.xml`, confirm (or add, inside the existing `<php>` block) these two lines — Laravel's default `phpunit.xml` usually ships them commented out or already present:

```xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```

- [ ] **Step 8: Verify the app boots and the test runner works**

Run: `composer install && php artisan test`
Expected: no errors, "Tests: 0 passed" (or similar — an empty/default test suite runs cleanly). Also run `php artisan about` and confirm it prints without error (confirms the app genuinely boots, config included).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: remove Cloudflare implementation, scaffold Laravel 13 app with Pest"
```

---

## Task 2: Migrations + Eloquent models

**Files:**
- Create: `database/migrations/<timestamp>_add_google_and_consent_fields_to_users_table.php`
- Create: `database/migrations/<timestamp>_create_colors_table.php`
- Create: `database/migrations/<timestamp>_create_questions_table.php`
- Create: `database/migrations/<timestamp>_create_activities_table.php`
- Create: `database/migrations/<timestamp>_create_user_responses_table.php`
- Create: `app/Enums/Quadrant.php`
- Create: `app/Models/Color.php`, `app/Models/Question.php`, `app/Models/Activity.php`, `app/Models/UserResponse.php`
- Modify: `app/Models/User.php`
- Test: `tests/Feature/SchemaTest.php`

**Interfaces:**
- Produces: `App\Enums\Quadrant` (backed string enum: `Mental`, `Physical`, `Emotional`, `Spiritual`), `App\Models\Color`, `App\Models\Question`, `App\Models\Activity`, `App\Models\UserResponse` (with `user()`, `color()`, `question()`, `activity()` relations), and `User` with `google_id`, `avatar_url`, `consent_accepted_at`, `analytics_marketing_consent_at`, `is_admin` — consumed by every later task.

- [ ] **Step 1: Write `app/Enums/Quadrant.php`**

```php
<?php

namespace App\Enums;

enum Quadrant: string
{
    case Mental = 'mental';
    case Physical = 'physical';
    case Emotional = 'emotional';
    case Spiritual = 'spiritual';
}
```

- [ ] **Step 2: Write the users-table migration**

Run: `php artisan make:migration add_google_and_consent_fields_to_users_table`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id')->nullable()->unique()->after('email');
            $table->string('avatar_url')->nullable()->after('google_id');
            $table->timestamp('consent_accepted_at')->nullable()->after('avatar_url');
            $table->timestamp('analytics_marketing_consent_at')->nullable()->after('consent_accepted_at');
            $table->boolean('is_admin')->default(false)->after('analytics_marketing_consent_at');
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['google_id', 'avatar_url', 'consent_accepted_at', 'analytics_marketing_consent_at', 'is_admin']);
            $table->string('password')->nullable(false)->change();
        });
    }
};
```

(`->change()` requires `doctrine/dbal` — Laravel 13's default `laravel/laravel` skeleton no longer bundles it; if the migration fails with a "change" error, run `composer require doctrine/dbal --dev` first and retry.)

- [ ] **Step 3: Write the colors/questions/activities migrations**

Run: `php artisan make:migration create_colors_table`, `make:migration create_questions_table`, `make:migration create_activities_table`

```php
// database/migrations/<ts>_create_colors_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('colors', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('hex', 7);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('colors');
    }
};
```

```php
// database/migrations/<ts>_create_questions_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->text('text');
            $table->string('quadrant', 20);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
```

```php
// database/migrations/<ts>_create_activities_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->text('text');
            $table->string('quadrant', 20);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};
```

- [ ] **Step 4: Write the `user_responses` migration**

Run: `php artisan make:migration create_user_responses_table`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('color_id')->constrained();
            $table->foreignId('question_id')->constrained();
            $table->text('answer_text')->nullable();
            $table->foreignId('activity_id')->nullable()->constrained();
            $table->boolean('activity_completed')->default(false);
            $table->date('entry_date');
            $table->decimal('flower_x', 5, 2)->nullable();
            $table->decimal('flower_y', 5, 2)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_responses');
    }
};
```

- [ ] **Step 5: Write the models**

`app/Models/Color.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Color extends Model
{
    protected $fillable = ['name', 'hex', 'active'];

    protected $casts = ['active' => 'boolean'];
}
```

`app/Models/Question.php`:

```php
<?php

namespace App\Models;

use App\Enums\Quadrant;
use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    protected $fillable = ['text', 'quadrant', 'active'];

    protected $casts = [
        'quadrant' => Quadrant::class,
        'active' => 'boolean',
    ];
}
```

`app/Models/Activity.php`:

```php
<?php

namespace App\Models;

use App\Enums\Quadrant;
use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    protected $fillable = ['text', 'quadrant', 'active'];

    protected $casts = [
        'quadrant' => Quadrant::class,
        'active' => 'boolean',
    ];
}
```

`app/Models/UserResponse.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserResponse extends Model
{
    protected $fillable = [
        'user_id', 'color_id', 'question_id', 'answer_text',
        'activity_id', 'activity_completed', 'entry_date',
        'flower_x', 'flower_y', 'completed_at',
    ];

    protected $casts = [
        'activity_completed' => 'boolean',
        'entry_date' => 'date',
        'flower_x' => 'float',
        'flower_y' => 'float',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function color(): BelongsTo
    {
        return $this->belongsTo(Color::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class);
    }
}
```

- [ ] **Step 6: Update `app/Models/User.php`**

Add to `$fillable`: `'google_id', 'avatar_url'` only. **Do NOT add `is_admin`, `consent_accepted_at`, or `analytics_marketing_consent_at` to `$fillable`** — these are privilege/consent-relevant fields, and putting them in `$fillable` is a mass-assignment vector (a future endpoint that naively does `$user->update($request->validate([...]))` with a too-broad validated array could let a user grant themselves admin). Every place these three fields are actually set in this plan uses direct property assignment (`$user->is_admin = ...`, `$user->consent_accepted_at = ...`) or `forceFill()`, never `fill()`/`create()`/`update()` with raw request input — direct property assignment always works regardless of `$fillable`, so this restriction costs nothing functionally. (Task 9's `MeController::updateConsent` already uses direct property assignment, so it's unaffected by this. Task 16's Filament admin toggle needs one explicit adjustment for the same reason — see that task's notes.)

Add to `$casts` (inside the `casts()` method Laravel 13 generates, or the `$casts` property — match whatever style the freshly-scaffolded file already uses): `'consent_accepted_at' => 'datetime', 'analytics_marketing_consent_at' => 'datetime', 'is_admin' => 'boolean'`. (Casts are unrelated to mass-assignment safety — keep all three here regardless of the `$fillable` change above.)

Add a relation:

```php
public function userResponses(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(UserResponse::class);
}
```

(Sanctum's `HasApiTokens` trait and Filament's `FilamentUser` contract are added in Tasks 4 and 17 respectively — don't add them yet, those tasks own that wiring.)

- [ ] **Step 7: Write the failing test `tests/Feature/SchemaTest.php`**

```php
<?php

use App\Models\Activity;
use App\Models\Color;
use App\Models\Question;
use App\Models\User;
use App\Models\UserResponse;

it('creates a color, question, activity, and a linked user response', function () {
    $user = User::factory()->create();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $question = Question::create(['text' => 'Q?', 'quadrant' => 'mental']);
    $activity = Activity::create(['text' => 'Walk.', 'quadrant' => 'physical']);

    $response = UserResponse::create([
        'user_id' => $user->id,
        'color_id' => $color->id,
        'question_id' => $question->id,
        'activity_id' => $activity->id,
        'entry_date' => now()->toDateString(),
    ]);

    expect($response->user->id)->toBe($user->id);
    expect($response->color->name)->toBe('Teal');
    expect($response->question->quadrant)->toBe(\App\Enums\Quadrant::Mental);
    expect($response->activity->quadrant)->toBe(\App\Enums\Quadrant::Physical);
});

it('enforces one entry per user per day', function () {
    $user = User::factory()->create();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $question = Question::create(['text' => 'Q?', 'quadrant' => 'mental']);

    UserResponse::create([
        'user_id' => $user->id, 'color_id' => $color->id, 'question_id' => $question->id,
        'entry_date' => '2026-09-21',
    ]);

    expect(fn () => UserResponse::create([
        'user_id' => $user->id, 'color_id' => $color->id, 'question_id' => $question->id,
        'entry_date' => '2026-09-21',
    ]))->toThrow(\Illuminate\Database\QueryException::class);
});

it('cascades user deletion to their user_responses', function () {
    $user = User::factory()->create();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $question = Question::create(['text' => 'Q?', 'quadrant' => 'mental']);
    $response = UserResponse::create([
        'user_id' => $user->id, 'color_id' => $color->id, 'question_id' => $question->id,
        'entry_date' => now()->toDateString(),
    ]);

    $user->delete();

    expect(UserResponse::find($response->id))->toBeNull();
});
```

- [ ] **Step 8: Run migrations and the test to verify RED**

Run: `php artisan migrate:fresh && php artisan test --filter=SchemaTest`
Expected: FAIL before Step 5's models exist (class not found) — if migrations/models are written together as this task specifies, instead verify RED by temporarily reverting `app/Models/UserResponse.php` to confirm the test fails without it, or simply proceed straight to Step 9 if you wrote migrations and models together and want a single RED→GREEN cycle across both — either is acceptable for this schema-only task.

- [ ] **Step 9: Run migrations and the test to verify GREEN**

Run: `php artisan migrate:fresh && php artisan test --filter=SchemaTest`
Expected: PASS — all 3 tests green.

- [ ] **Step 10: Commit**

```bash
git add app/Enums app/Models database/migrations tests/Feature/SchemaTest.php
git commit -m "feat: add colors/questions/activities/user_responses schema and models"
```

---

## Task 3: Seeders (11 colors, 11 questions, 33 activities)

**Files:**
- Create: `database/seeders/ColorSeeder.php`, `database/seeders/QuestionSeeder.php`, `database/seeders/ActivitySeeder.php`
- Modify: `database/seeders/DatabaseSeeder.php`
- Test: `tests/Feature/SeedContentTest.php`

**Interfaces:**
- Produces: seeded rows in `colors` (11), `questions` (11), `activities` (33) — consumed by every later task that needs real content to select from, and eventually by the Filament admin and the future client.

- [ ] **Step 1: Write `database/seeders/ColorSeeder.php`**

```php
<?php

namespace Database\Seeders;

use App\Models\Color;
use Illuminate\Database\Seeder;

class ColorSeeder extends Seeder
{
    public function run(): void
    {
        $colors = [
            ['name' => 'Indigo', 'hex' => '#34435f'],
            ['name' => 'Teal', 'hex' => '#4f8f86'],
            ['name' => 'Sage', 'hex' => '#859873'],
            ['name' => 'Gold', 'hex' => '#b79239'],
            ['name' => 'Peach', 'hex' => '#c48665'],
            ['name' => 'Pink', 'hex' => '#b85e78'],
            ['name' => 'Lilac', 'hex' => '#75658d'],
            ['name' => 'Ember', 'hex' => '#9f493d'],
            ['name' => 'Tangerine', 'hex' => '#c96f35'],
            ['name' => 'Voltage', 'hex' => '#5868a6'],
            ['name' => 'Smoke', 'hex' => '#68716d'],
        ];

        foreach ($colors as $color) {
            Color::create($color);
        }
    }
}
```

- [ ] **Step 2: Write `database/seeders/QuestionSeeder.php`**

```php
<?php

namespace Database\Seeders;

use App\Models\Question;
use Illuminate\Database\Seeder;

class QuestionSeeder extends Seeder
{
    public function run(): void
    {
        $questions = [
            ['text' => 'What truth do you already know but need to trust?', 'quadrant' => 'spiritual'],
            ['text' => 'What would help you feel steady in this moment?', 'quadrant' => 'physical'],
            ['text' => 'Where can you give yourself permission to slow down?', 'quadrant' => 'emotional'],
            ['text' => 'What possibility feels worth taking one small step toward?', 'quadrant' => 'mental'],
            ['text' => 'What do you need to receive—or offer—with openness?', 'quadrant' => 'emotional'],
            ['text' => 'How can you speak to yourself with more kindness today?', 'quadrant' => 'emotional'],
            ['text' => 'What is your intuition quietly asking you to notice?', 'quadrant' => 'spiritual'],
            ['text' => 'What is your frustration trying to protect or change?', 'quadrant' => 'emotional'],
            ['text' => 'What can you set down so one thing can receive your attention?', 'quadrant' => 'mental'],
            ['text' => 'What kind of movement or focus would help this energy feel useful?', 'quadrant' => 'physical'],
            ['text' => 'What is the smallest burden you can reduce right now?', 'quadrant' => 'physical'],
        ];

        foreach ($questions as $question) {
            Question::create($question);
        }
    }
}
```

- [ ] **Step 3: Write `database/seeders/ActivitySeeder.php`**

```php
<?php

namespace Database\Seeders;

use App\Models\Activity;
use Illuminate\Database\Seeder;

class ActivitySeeder extends Seeder
{
    public function run(): void
    {
        $activities = [
            ['text' => 'Take three unhurried breaths and let your shoulders soften.', 'quadrant' => 'physical'],
            ['text' => 'Write one sentence beginning, "What I know right now is…"', 'quadrant' => 'spiritual'],
            ['text' => 'Take one small action that honors that truth without requiring complete certainty.', 'quadrant' => 'mental'],
            ['text' => 'Notice both feet and name three things you can see around you.', 'quadrant' => 'physical'],
            ['text' => 'Identify the one need that matters most in this moment.', 'quadrant' => 'mental'],
            ['text' => 'Choose one practical step—water, food, rest, fresh air, or a clear boundary.', 'quadrant' => 'physical'],
            ['text' => 'Lower your pace for one minute and lengthen each exhale.', 'quadrant' => 'physical'],
            ['text' => 'Name one expectation you can soften or postpone today.', 'quadrant' => 'emotional'],
            ['text' => 'Give yourself ten quiet minutes for rest, stretching, or time outside.', 'quadrant' => 'physical'],
            ['text' => 'Name the idea or possibility that gives you the most energy.', 'quadrant' => 'mental'],
            ['text' => 'Turn it into a step you can finish in ten minutes or less.', 'quadrant' => 'mental'],
            ['text' => 'Start before you feel fully ready, then acknowledge that you moved forward.', 'quadrant' => 'mental'],
            ['text' => 'Ask what kind of care would feel nourishing rather than demanding.', 'quadrant' => 'emotional'],
            ['text' => 'Reach toward one safe person or comforting practice.', 'quadrant' => 'emotional'],
            ['text' => 'Share one small act of warmth while keeping your own limits intact.', 'quadrant' => 'emotional'],
            ['text' => 'Place a hand over your heart and take one slow, comfortable breath.', 'quadrant' => 'physical'],
            ['text' => 'Replace one harsh thought with words that are honest and compassionate.', 'quadrant' => 'mental'],
            ['text' => 'Do one small thing that makes today easier for your future self.', 'quadrant' => 'emotional'],
            ['text' => 'Put away one source of stimulation for five minutes.', 'quadrant' => 'spiritual'],
            ['text' => 'Notice the thought, feeling, or body sensation that keeps returning.', 'quadrant' => 'spiritual'],
            ['text' => 'Record what you noticed and choose whether it needs action, patience, or support.', 'quadrant' => 'mental'],
            ['text' => 'Unclench your jaw, lower your shoulders, and press both feet firmly into the floor.', 'quadrant' => 'physical'],
            ['text' => 'Complete the sentence, "What I need or wish were different is…"', 'quadrant' => 'emotional'],
            ['text' => 'Choose one respectful next step, or give yourself time before responding.', 'quadrant' => 'mental'],
            ['text' => 'Write down your open loops and circle only the one that matters now.', 'quadrant' => 'mental'],
            ['text' => 'Look away from the screen, sip water, and take three comfortable breaths.', 'quadrant' => 'physical'],
            ['text' => 'Give the circled task five uninterrupted minutes, then reassess.', 'quadrant' => 'mental'],
            ['text' => 'Walk, stretch, or shake out your hands for one or two minutes.', 'quadrant' => 'physical'],
            ['text' => 'Notice five things you can see and three physical sensations you can feel.', 'quadrant' => 'physical'],
            ['text' => 'Choose one absorbing, low-stakes activity and stay with it for ten minutes.', 'quadrant' => 'mental'],
            ['text' => 'Postpone, delegate, or remove one nonessential demand.', 'quadrant' => 'mental'],
            ['text' => 'Drink water and let your exhale be a little longer than your inhale.', 'quadrant' => 'physical'],
            ['text' => 'Identify the smallest next step, or decide that rest is the next step.', 'quadrant' => 'mental'],
        ];

        foreach ($activities as $activity) {
            Activity::create($activity);
        }
    }
}
```

- [ ] **Step 4: Wire seeders into `database/seeders/DatabaseSeeder.php`**

Replace the body of the `run()` method (leave the class/namespace declaration as scaffolded) with:

```php
public function run(): void
{
    $this->call([
        ColorSeeder::class,
        QuestionSeeder::class,
        ActivitySeeder::class,
    ]);
}
```

- [ ] **Step 5: Write the failing test `tests/Feature/SeedContentTest.php`**

```php
<?php

use App\Models\Activity;
use App\Models\Color;
use App\Models\Question;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds 11 colors, 11 questions, and 33 activities with valid quadrants', function () {
    $this->seed();

    expect(Color::count())->toBe(11);
    expect(Question::count())->toBe(11);
    expect(Activity::count())->toBe(33);

    Question::all()->each(fn ($q) => expect($q->quadrant)->toBeInstanceOf(\App\Enums\Quadrant::class));
    Activity::all()->each(fn ($a) => expect($a->quadrant)->toBeInstanceOf(\App\Enums\Quadrant::class));
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `php artisan test --filter=SeedContentTest`
Expected: FAIL — 0 rows, since seeders haven't been written/wired yet (run this before Steps 1-4 if following strict TDD, or confirm failure by temporarily commenting out the `$this->call([...])` body once).

- [ ] **Step 7: Run test to verify it passes**

Run: `php artisan test --filter=SeedContentTest`
Expected: PASS — all counts and quadrant types correct.

- [ ] **Step 8: Commit**

```bash
git add database/seeders tests/Feature/SeedContentTest.php
git commit -m "feat: seed initial colors, questions, and activities"
```

---

## Task 4: Install Sanctum + Socialite

**Files:**
- Modify: `bootstrap/app.php`, `composer.json` (via composer require), `config/services.php` (already has the `google` key from Task 1)
- Create: `routes/api.php` (via `install:api`)

**Interfaces:**
- Produces: `auth:sanctum` middleware available app-wide; `Laravel\Socialite\Facades\Socialite` available app-wide; `User` model gets `HasApiTokens`. Consumed by every auth/API task from here on.

- [ ] **Step 1: Install Sanctum via the API installer**

```bash
php artisan install:api
```

This creates `routes/api.php`, publishes Sanctum's migration, and registers the `api` route group. Run the new migration:

```bash
php artisan migrate
```

- [ ] **Step 2: Enable stateful SPA support in `bootstrap/app.php`**

In the `->withMiddleware(function (Middleware $middleware) { ... })` closure Laravel 13's `bootstrap/app.php` already has, add:

```php
$middleware->statefulApi();
```

- [ ] **Step 3: Add `HasApiTokens` to `app/Models/User.php`**

Add the import `use Laravel\Sanctum\HasApiTokens;` and add `HasApiTokens` to the `use` trait list at the top of the class body (alongside whatever traits Laravel 13 scaffolds by default, e.g. `HasFactory`, `Notifiable`).

- [ ] **Step 4: Install Socialite**

```bash
composer require laravel/socialite
```

No further config needed beyond the `services.google` array already added in Task 1 — Socialite reads `client_id`/`client_secret`/`redirect` from that same `config('services.google')` structure by convention.

- [ ] **Step 5: Verify the app still boots and tests still pass**

Run: `php artisan test`
Expected: PASS — all prior tests (Tasks 2–3) still green, no errors from the new packages.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: install Sanctum (install:api + statefulApi) and Socialite"
```

---

## Task 5: Web Google SSO (Socialite redirect/callback) + shared upsert service

**Files:**
- Create: `app/Services/UpsertsGoogleUser.php`
- Create: `app/Http/Controllers/Auth/GoogleWebController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/Auth/GoogleWebLoginTest.php`

**Interfaces:**
- Produces: `App\Services\UpsertsGoogleUser::upsert(string $googleId, string $email, ?string $name, ?string $avatarUrl): array` (returns `[User $user, bool $isNewUser]`) — shared by this task and Task 6's mobile flow, so the upsert logic is written once.
- Consumes: `config('services.google')`, `config('app.frontend_url')`.

- [ ] **Step 1: Write `app/Services/UpsertsGoogleUser.php`**

```php
<?php

namespace App\Services;

use App\Models\User;

class UpsertsGoogleUser
{
    /**
     * @return array{0: User, 1: bool}
     */
    public function upsert(string $googleId, string $email, ?string $name, ?string $avatarUrl): array
    {
        $user = User::where('google_id', $googleId)->first();
        $isNewUser = $user === null;

        if ($user) {
            $user->update([
                'email' => $email,
                'name' => $name ?? $user->name,
                'avatar_url' => $avatarUrl,
            ]);
        } else {
            $user = User::create([
                'google_id' => $googleId,
                'email' => $email,
                'name' => $name ?? $email,
                'avatar_url' => $avatarUrl,
                'password' => null,
            ]);
        }

        return [$user, $isNewUser];
    }
}
```

- [ ] **Step 2: Write the failing test `tests/Feature/Auth/GoogleWebLoginTest.php`**

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\User as SocialiteUserContract;
use Laravel\Socialite\Facades\Socialite;

uses(RefreshDatabase::class);

it('redirects to google', function () {
    $response = $this->get('/auth/google/redirect');

    $response->assertRedirect();
    expect($response->headers->get('Location'))->toContain('accounts.google.com');
});

it('creates a new user, logs them in, and redirects to /consent on first login', function () {
    $socialiteUser = Mockery::mock(SocialiteUserContract::class);
    $socialiteUser->shouldReceive('getId')->andReturn('google-sub-1');
    $socialiteUser->shouldReceive('getEmail')->andReturn('new-user@example.com');
    $socialiteUser->shouldReceive('getName')->andReturn('New User');
    $socialiteUser->shouldReceive('getAvatar')->andReturn('https://example.com/avatar.png');

    Socialite::shouldReceive('driver->user')->andReturn($socialiteUser);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(config('app.frontend_url') . '/consent');
    $this->assertAuthenticated();

    $user = User::where('google_id', 'google-sub-1')->first();
    expect($user)->not->toBeNull();
    expect($user->email)->toBe('new-user@example.com');
});

it('redirects an existing user straight to /today', function () {
    User::factory()->create(['google_id' => 'google-sub-2', 'email' => 'repeat@example.com']);

    $socialiteUser = Mockery::mock(SocialiteUserContract::class);
    $socialiteUser->shouldReceive('getId')->andReturn('google-sub-2');
    $socialiteUser->shouldReceive('getEmail')->andReturn('repeat@example.com');
    $socialiteUser->shouldReceive('getName')->andReturn('Repeat User');
    $socialiteUser->shouldReceive('getAvatar')->andReturn(null);

    Socialite::shouldReceive('driver->user')->andReturn($socialiteUser);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(config('app.frontend_url') . '/today');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=GoogleWebLoginTest`
Expected: FAIL — route `/auth/google/redirect` doesn't exist (404).

- [ ] **Step 4: Write `app/Http/Controllers/Auth/GoogleWebController.php`**

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\UpsertsGoogleUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class GoogleWebController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(UpsertsGoogleUser $upserter): RedirectResponse
    {
        $googleUser = Socialite::driver('google')->user();

        [$user, $isNewUser] = $upserter->upsert(
            googleId: $googleUser->getId(),
            email: $googleUser->getEmail(),
            name: $googleUser->getName(),
            avatarUrl: $googleUser->getAvatar(),
        );

        Auth::login($user);
        request()->session()->regenerate();

        $destination = $isNewUser ? '/consent' : '/today';

        return redirect(config('app.frontend_url') . $destination);
    }
}
```

- [ ] **Step 5: Add routes to `routes/web.php`**

Append:

```php
use App\Http\Controllers\Auth\GoogleWebController;

Route::get('/auth/google/redirect', [GoogleWebController::class, 'redirect']);
Route::get('/auth/google/callback', [GoogleWebController::class, 'callback']);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=GoogleWebLoginTest`
Expected: PASS — all 3 tests green.

- [ ] **Step 7: Commit**

```bash
git add app/Services/UpsertsGoogleUser.php app/Http/Controllers/Auth/GoogleWebController.php routes/web.php tests/Feature/Auth/GoogleWebLoginTest.php
git commit -m "feat: add web Google SSO via Socialite"
```

---

## Task 6: Mobile Google SSO (ID-token verification + Sanctum token issuance)

**Files:**
- Create: `app/Services/GoogleIdTokenVerifier.php`
- Create: `app/Http/Controllers/Auth/GoogleMobileController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Auth/GoogleMobileLoginTest.php`

**Interfaces:**
- Consumes: `App\Services\UpsertsGoogleUser` (Task 5).
- Produces: `App\Services\GoogleIdTokenVerifier::verify(string $idToken): array` (returns Google's decoded payload), `POST /api/auth/google`.

- [ ] **Step 1: Write `app/Services/GoogleIdTokenVerifier.php`**

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class GoogleIdTokenVerifier
{
    /**
     * @return array<string, mixed>
     */
    public function verify(string $idToken): array
    {
        $response = Http::timeout(5)->get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $idToken,
        ]);

        if (! $response->successful()) {
            throw new RuntimeException('Google tokeninfo request failed.');
        }

        $payload = $response->json();

        if (($payload['aud'] ?? null) !== config('services.google.client_id')) {
            throw new RuntimeException('ID token audience mismatch.');
        }

        $emailVerified = $payload['email_verified'] ?? false;
        if ($emailVerified !== true && $emailVerified !== 'true') {
            throw new RuntimeException('Google email not verified.');
        }

        return $payload;
    }
}
```

- [ ] **Step 2: Write the failing test `tests/Feature/Auth/GoogleMobileLoginTest.php`**

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

it('returns 422 when idToken is missing', function () {
    $response = $this->postJson('/api/auth/google', []);

    $response->assertStatus(422);
});

it('verifies the Google ID token and returns a bearer token for a new user', function () {
    Http::fake([
        'oauth2.googleapis.com/tokeninfo*' => Http::response([
            'sub' => 'google-sub-mobile',
            'email' => 'mobile-user@example.com',
            'email_verified' => 'true',
            'aud' => config('services.google.client_id'),
            'name' => 'Mobile User',
        ]),
    ]);

    $response = $this->postJson('/api/auth/google', ['idToken' => 'id-mobile-1']);

    $response->assertStatus(201);
    $response->assertJsonStructure(['token', 'isNewUser']);
    expect($response->json('isNewUser'))->toBeTrue();

    $user = User::where('google_id', 'google-sub-mobile')->first();
    expect($user)->not->toBeNull();
    expect($user->email)->toBe('mobile-user@example.com');
});

it('returns 200 with isNewUser false for a repeat login', function () {
    User::factory()->create(['google_id' => 'google-sub-repeat']);

    Http::fake([
        'oauth2.googleapis.com/tokeninfo*' => Http::response([
            'sub' => 'google-sub-repeat',
            'email' => 'repeat@example.com',
            'email_verified' => 'true',
            'aud' => config('services.google.client_id'),
            'name' => 'Repeat',
        ]),
    ]);

    $response = $this->postJson('/api/auth/google', ['idToken' => 'id-repeat']);

    $response->assertStatus(200);
    expect($response->json('isNewUser'))->toBeFalse();
});

it('rejects a token with the wrong audience', function () {
    Http::fake([
        'oauth2.googleapis.com/tokeninfo*' => Http::response([
            'sub' => 'google-sub-x',
            'email' => 'x@example.com',
            'email_verified' => 'true',
            'aud' => 'someone-elses-client-id',
        ]),
    ]);

    $response = $this->postJson('/api/auth/google', ['idToken' => 'bad-audience']);

    $response->assertStatus(422);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=GoogleMobileLoginTest`
Expected: FAIL — `POST /api/auth/google` doesn't exist (404).

- [ ] **Step 4: Write `app/Http/Controllers/Auth/GoogleMobileController.php`**

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\GoogleIdTokenVerifier;
use App\Services\UpsertsGoogleUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class GoogleMobileController extends Controller
{
    public function __invoke(
        Request $request,
        GoogleIdTokenVerifier $verifier,
        UpsertsGoogleUser $upserter,
    ): JsonResponse {
        $data = $request->validate(['idToken' => ['required', 'string']]);

        try {
            $payload = $verifier->verify($data['idToken']);
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        [$user, $isNewUser] = $upserter->upsert(
            googleId: $payload['sub'],
            email: $payload['email'],
            name: $payload['name'] ?? null,
            avatarUrl: $payload['picture'] ?? null,
        );

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json(
            ['token' => $token, 'isNewUser' => $isNewUser],
            $isNewUser ? 201 : 200,
        );
    }
}
```

- [ ] **Step 5: Add the route to `routes/api.php`**

Append:

```php
use App\Http\Controllers\Auth\GoogleMobileController;

Route::post('/auth/google', GoogleMobileController::class);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=GoogleMobileLoginTest`
Expected: PASS — all 4 tests green.

- [ ] **Step 7: Commit**

```bash
git add app/Services/GoogleIdTokenVerifier.php app/Http/Controllers/Auth/GoogleMobileController.php routes/api.php tests/Feature/Auth/GoogleMobileLoginTest.php
git commit -m "feat: add mobile Google SSO via ID-token verification + Sanctum token"
```

---

## Task 7: Logout

**Files:**
- Create: `app/Http/Controllers/Auth/LogoutController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Auth/LogoutTest.php`

**Interfaces:**
- Produces: `POST /api/logout` (behind `auth:sanctum`).

- [ ] **Step 1: Write the failing test `tests/Feature/Auth/LogoutTest.php`**

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 401 when not authenticated', function () {
    $response = $this->postJson('/api/logout');

    $response->assertStatus(401);
});

it('deletes the current token and returns ok for a bearer-authenticated request', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/logout');

    $response->assertOk();
    $response->assertJson(['ok' => true]);
    expect($user->fresh()->tokens()->count())->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=LogoutTest`
Expected: FAIL — `/api/logout` doesn't exist (404).

- [ ] **Step 3: Write `app/Http/Controllers/Auth/LogoutController.php`**

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogoutController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }
}
```

- [ ] **Step 4: Add the route to `routes/api.php`**

Append:

```php
use App\Http\Controllers\Auth\LogoutController;

Route::middleware('auth:sanctum')->post('/logout', LogoutController::class);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=LogoutTest`
Expected: PASS — both tests green.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Auth/LogoutController.php routes/api.php tests/Feature/Auth/LogoutTest.php
git commit -m "feat: add logout endpoint"
```

---

## Task 8: RequireConsent middleware

**Files:**
- Create: `app/Http/Middleware/RequireConsent.php`
- Modify: `bootstrap/app.php`
- Test: `tests/Feature/Middleware/RequireConsentTest.php`

**Interfaces:**
- Produces: a `'consent'` middleware alias, applied to routes in Tasks 12–14 (not yet — this task only builds and registers it against a temporary throwaway test route; Task 14 wires it onto the real entry routes).

- [ ] **Step 1: Write `app/Http/Middleware/RequireConsent.php`**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireConsent
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->consent_accepted_at) {
            return response()->json(['error' => 'consent_required'], 403);
        }

        return $next($request);
    }
}
```

- [ ] **Step 2: Register the middleware alias in `bootstrap/app.php`**

In the same `->withMiddleware(function (Middleware $middleware) { ... })` closure from Task 4, add:

```php
$middleware->alias(['consent' => \App\Http\Middleware\RequireConsent::class]);
```

- [ ] **Step 3: Write the failing test `tests/Feature/Middleware/RequireConsentTest.php`**

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

beforeEach(function () {
    Route::middleware(['auth:sanctum', 'consent'])->get('/__test/consent-gated', fn () => response()->json(['ok' => true]));
});

it('returns 403 for a signed-in user with no consent', function () {
    $user = User::factory()->create(['consent_accepted_at' => null]);
    $this->actingAs($user);

    $response = $this->getJson('/__test/consent-gated');

    $response->assertStatus(403);
    $response->assertJson(['error' => 'consent_required']);
});

it('passes through for a signed-in, consented user', function () {
    $user = User::factory()->create(['consent_accepted_at' => now()]);
    $this->actingAs($user);

    $response = $this->getJson('/__test/consent-gated');

    $response->assertOk();
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `php artisan test --filter=RequireConsentTest`
Expected: FAIL — middleware alias `consent` not registered yet (if Step 2 hasn't run) or route doesn't exist.

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=RequireConsentTest`
Expected: PASS — both tests green.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Middleware/RequireConsent.php bootstrap/app.php tests/Feature/Middleware/RequireConsentTest.php
git commit -m "feat: add RequireConsent middleware"
```

---

## Task 9: GET /api/me + POST /api/me/consent

**Files:**
- Create: `app/Http/Resources/SessionUserResource.php`
- Create: `app/Http/Controllers/Api/MeController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Api/MeControllerTest.php`

**Interfaces:**
- Produces: `SessionUserResource` (camelCase shape: `id`, `email`, `displayName`, `consentAcceptedAt`, `analyticsMarketingConsentAt`) — consumed by every future client; `GET /api/me`, `POST /api/me/consent`.

- [ ] **Step 1: Write `app/Http/Resources/SessionUserResource.php`**

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SessionUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'displayName' => $this->name,
            'consentAcceptedAt' => $this->consent_accepted_at?->toISOString(),
            'analyticsMarketingConsentAt' => $this->analytics_marketing_consent_at?->toISOString(),
        ];
    }
}
```

- [ ] **Step 2: Write the failing test `tests/Feature/Api/MeControllerTest.php`**

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 401 for GET /api/me with no session', function () {
    $response = $this->getJson('/api/me');

    $response->assertStatus(401);
});

it('returns the user with null consent fields for a fresh signup', function () {
    $user = User::factory()->create(['consent_accepted_at' => null, 'analytics_marketing_consent_at' => null]);
    $this->actingAs($user);

    $response = $this->getJson('/api/me');

    $response->assertOk();
    $response->assertJson([
        'user' => ['email' => $user->email, 'consentAcceptedAt' => null],
    ]);
});

it('stamps consentAcceptedAt once and lets analytics consent be toggled afterward', function () {
    $user = User::factory()->create(['consent_accepted_at' => null]);
    $this->actingAs($user);

    $first = $this->postJson('/api/me/consent', ['analyticsMarketing' => true]);
    $first->assertOk();

    $user->refresh();
    $firstAcceptedAt = $user->consent_accepted_at;
    expect($firstAcceptedAt)->not->toBeNull();
    expect($user->analytics_marketing_consent_at)->not->toBeNull();

    $this->postJson('/api/me/consent', ['analyticsMarketing' => false])->assertOk();

    $user->refresh();
    expect($user->consent_accepted_at->equalTo($firstAcceptedAt))->toBeTrue();
    expect($user->analytics_marketing_consent_at)->toBeNull();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=MeControllerTest`
Expected: FAIL — `/api/me` doesn't exist (404).

- [ ] **Step 4: Write `app/Http/Controllers/Api/MeController.php`**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SessionUserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => new SessionUserResource($request->user())]);
    }

    public function updateConsent(Request $request): JsonResponse
    {
        $data = $request->validate(['analyticsMarketing' => ['required', 'boolean']]);
        $user = $request->user();

        $user->consent_accepted_at ??= now();
        $user->analytics_marketing_consent_at = $data['analyticsMarketing'] ? now() : null;
        $user->save();

        return response()->json(['ok' => true]);
    }
}
```

- [ ] **Step 5: Add routes to `routes/api.php`**

Append:

```php
use App\Http\Controllers\Api\MeController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::post('/me/consent', [MeController::class, 'updateConsent']);
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=MeControllerTest`
Expected: PASS — all 3 tests green.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Resources/SessionUserResource.php app/Http/Controllers/Api/MeController.php routes/api.php tests/Feature/Api/MeControllerTest.php
git commit -m "feat: add GET /api/me and POST /api/me/consent"
```

---

## Task 10: DELETE /api/me (account deletion + PostHog purge)

**Files:**
- Create: `app/Services/PostHogClient.php`
- Modify: `app/Http/Controllers/Api/MeController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Api/MeControllerTest.php` (extend)

**Interfaces:**
- Produces: `App\Services\PostHogClient::deletePerson(string $distinctId): bool` (best-effort — returns whether the purge succeeded, never throws); `DELETE /api/me`.

- [ ] **Step 1: Write `app/Services/PostHogClient.php`**

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class PostHogClient
{
    public function deletePerson(string $distinctId): bool
    {
        $projectId = config('services.posthog.project_id');
        $apiKey = config('services.posthog.deletion_api_key');

        try {
            $lookup = Http::withToken($apiKey)
                ->timeout(5)
                ->get("https://eu.posthog.com/api/projects/{$projectId}/persons/", [
                    'distinct_id' => $distinctId,
                ]);

            if (! $lookup->successful()) {
                return false;
            }

            foreach ($lookup->json('results', []) as $person) {
                $delete = Http::withToken($apiKey)
                    ->timeout(5)
                    ->delete("https://eu.posthog.com/api/projects/{$projectId}/persons/{$person['id']}/");

                if (! $delete->successful() && $delete->status() !== 404) {
                    return false;
                }
            }

            return true;
        } catch (Throwable $e) {
            Log::error('PostHog purge failed during account deletion', ['error' => $e->getMessage()]);

            return false;
        }
    }
}
```

- [ ] **Step 2: Write the failing test — append to `tests/Feature/Api/MeControllerTest.php`**

```php
it('deletes the account, cascades entries and tokens, and reports the PostHog purge outcome', function () {
    Http::fake([
        'eu.posthog.com/*' => Http::response(['results' => []]),
    ]);

    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")->deleteJson('/api/me');

    $response->assertOk();
    $response->assertJson(['ok' => true, 'analyticsPurged' => true]);
    expect(User::find($user->id))->toBeNull();
});

it('still deletes the account when the PostHog purge fails', function () {
    Http::fake([
        'eu.posthog.com/*' => Http::response(null, 500),
    ]);

    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")->deleteJson('/api/me');

    $response->assertOk();
    $response->assertJson(['ok' => true, 'analyticsPurged' => false]);
    expect(User::find($user->id))->toBeNull();
});
```

Add `use Illuminate\Support\Facades\Http;` to the top of the test file if not already present.

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=MeControllerTest`
Expected: FAIL — `DELETE /api/me` returns 404 (route not registered).

- [ ] **Step 4: Extend `app/Http/Controllers/Api/MeController.php`**

Add the import `use App\Services\PostHogClient;` at the top, and append this method to the class:

```php
public function destroy(Request $request, PostHogClient $postHog): JsonResponse
{
    $user = $request->user();
    $analyticsPurged = $postHog->deletePerson($user->email);

    $user->delete();

    return response()->json(['ok' => true, 'analyticsPurged' => $analyticsPurged]);
}
```

(PostHog is purged before the delete, and the deletion always proceeds regardless of the purge's outcome — an analytics vendor being unreachable must never block a user's explicit "delete my account" request. `$user->delete()` cascades to `user_responses` and `personal_access_tokens` via the FK constraints from Tasks 2 and 4.)

- [ ] **Step 5: Add the route to `routes/api.php`**

Inside the same `Route::middleware('auth:sanctum')->group(...)` block from Task 9, add:

```php
Route::delete('/me', [MeController::class, 'destroy']);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=MeControllerTest`
Expected: PASS — all 5 tests in this file green.

- [ ] **Step 7: Commit**

```bash
git add app/Services/PostHogClient.php app/Http/Controllers/Api/MeController.php routes/api.php tests/Feature/Api/MeControllerTest.php
git commit -m "feat: add account deletion with PostHog person purge"
```

---

## Task 11: Question and activity selection services

**Files:**
- Create: `app/Services/QuestionSelector.php`
- Create: `app/Services/ActivitySelector.php`
- Test: `tests/Unit/QuestionSelectorTest.php`
- Test: `tests/Unit/ActivitySelectorTest.php`

**Interfaces:**
- Produces: `App\Services\QuestionSelector::pick(User $user): Question`, `App\Services\ActivitySelector::pick(?int $excludeActivityId = null): Activity` — consumed by Task 12/13's entry endpoints.

- [ ] **Step 1: Write the failing test `tests/Unit/QuestionSelectorTest.php`**

```php
<?php

use App\Models\Question;
use App\Models\User;
use App\Models\UserResponse;
use App\Models\Color;
use App\Services\QuestionSelector;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeUserResponseFor(User $user, Question $question, \Carbon\Carbon $createdAt): void
{
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $response = new UserResponse([
        'user_id' => $user->id,
        'color_id' => $color->id,
        'question_id' => $question->id,
        'entry_date' => $createdAt->toDateString(),
    ]);
    $response->timestamps = false;
    $response->created_at = $createdAt;
    $response->updated_at = $createdAt;
    $response->save();
}

it('excludes a question used within the last 7 days', function () {
    $user = User::factory()->create();
    $qa = Question::create(['text' => 'A', 'quadrant' => 'mental']);
    $qb = Question::create(['text' => 'B', 'quadrant' => 'mental']);
    makeUserResponseFor($user, $qa, now()->subDays(2));

    $selector = new QuestionSelector();
    for ($i = 0; $i < 10; $i++) {
        expect($selector->pick($user)->id)->toBe($qb->id);
    }
});

it('makes a question eligible again after 7 days', function () {
    $user = User::factory()->create();
    $qa = Question::create(['text' => 'A', 'quadrant' => 'mental']);
    makeUserResponseFor($user, $qa, now()->subDays(8));

    $selector = new QuestionSelector();
    expect($selector->pick($user)->id)->toBe($qa->id);
});

it('falls back to the least-recently-used question when the bank is exhausted', function () {
    $user = User::factory()->create();
    $qa = Question::create(['text' => 'A', 'quadrant' => 'mental']);
    $qb = Question::create(['text' => 'B', 'quadrant' => 'mental']);
    makeUserResponseFor($user, $qa, now()->subDays(3));
    makeUserResponseFor($user, $qb, now()->subDay());

    $selector = new QuestionSelector();
    expect($selector->pick($user)->id)->toBe($qa->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=QuestionSelectorTest`
Expected: FAIL — `App\Services\QuestionSelector` doesn't exist.

- [ ] **Step 3: Write `app/Services/QuestionSelector.php`**

```php
<?php

namespace App\Services;

use App\Models\Question;
use App\Models\User;
use App\Models\UserResponse;
use RuntimeException;

class QuestionSelector
{
    public function pick(User $user): Question
    {
        $sevenDaysAgo = now()->subDays(7);
        $excludedIds = UserResponse::where('user_id', $user->id)
            ->where('created_at', '>=', $sevenDaysAgo)
            ->pluck('question_id');

        $eligible = Question::where('active', true)->whereNotIn('id', $excludedIds)->get();
        if ($eligible->isNotEmpty()) {
            return $eligible->random();
        }

        $lastUsedAtByQuestion = UserResponse::where('user_id', $user->id)
            ->selectRaw('question_id, MAX(created_at) as last_used')
            ->groupBy('question_id')
            ->pluck('last_used', 'question_id');

        $fallback = Question::where('active', true)
            ->get()
            ->sortBy(fn (Question $question) => $lastUsedAtByQuestion[$question->id] ?? '')
            ->first();

        if (! $fallback) {
            throw new RuntimeException('No active questions available.');
        }

        return $fallback;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=QuestionSelectorTest`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Write the failing test `tests/Unit/ActivitySelectorTest.php`**

```php
<?php

use App\Models\Activity;
use App\Services\ActivitySelector;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns an active activity', function () {
    $activity = Activity::create(['text' => 'A', 'quadrant' => 'physical']);

    $selector = new ActivitySelector();
    expect($selector->pick()->id)->toBe($activity->id);
});

it('excludes the given activity when another is available', function () {
    $ta = Activity::create(['text' => 'A', 'quadrant' => 'physical']);
    $tb = Activity::create(['text' => 'B', 'quadrant' => 'physical']);

    $selector = new ActivitySelector();
    for ($i = 0; $i < 10; $i++) {
        expect($selector->pick($ta->id)->id)->toBe($tb->id);
    }
});

it('falls back to the excluded activity if it is the only one available', function () {
    $ta = Activity::create(['text' => 'A', 'quadrant' => 'physical']);

    $selector = new ActivitySelector();
    expect($selector->pick($ta->id)->id)->toBe($ta->id);
});

it('throws when there are no active activities at all', function () {
    $selector = new ActivitySelector();
    expect(fn () => $selector->pick())->toThrow(RuntimeException::class);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `php artisan test --filter=ActivitySelectorTest`
Expected: FAIL — `App\Services\ActivitySelector` doesn't exist.

- [ ] **Step 7: Write `app/Services/ActivitySelector.php`**

```php
<?php

namespace App\Services;

use App\Models\Activity;
use RuntimeException;

class ActivitySelector
{
    public function pick(?int $excludeActivityId = null): Activity
    {
        if ($excludeActivityId !== null) {
            $withExclusion = Activity::where('active', true)
                ->where('id', '!=', $excludeActivityId)
                ->get();

            if ($withExclusion->isNotEmpty()) {
                return $withExclusion->random();
            }
        }

        $all = Activity::where('active', true)->get();
        if ($all->isEmpty()) {
            throw new RuntimeException('No active activities available.');
        }

        return $all->random();
    }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `php artisan test --filter=ActivitySelectorTest`
Expected: PASS — all 4 tests green.

- [ ] **Step 9: Commit**

```bash
git add app/Services/QuestionSelector.php app/Services/ActivitySelector.php tests/Unit/QuestionSelectorTest.php tests/Unit/ActivitySelectorTest.php
git commit -m "feat: add question (7-day no-repeat) and activity selection services"
```

---

## Task 12: Flower placement service

**Files:**
- Create: `app/Services/FlowerPlacer.php`
- Test: `tests/Unit/FlowerPlacerTest.php`

**Interfaces:**
- Produces: `App\Services\FlowerPlacer::place(User $user): array{0: float, 1: float}` — consumed by Task 14's "mark activity complete" endpoint.

- [ ] **Step 1: Write the failing test `tests/Unit/FlowerPlacerTest.php`**

```php
<?php

use App\Models\Activity;
use App\Models\Color;
use App\Models\Question;
use App\Models\User;
use App\Models\UserResponse;
use App\Services\FlowerPlacer;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns coordinates within the 0-100 bounds', function () {
    $user = User::factory()->create();

    $placer = new FlowerPlacer();
    [$x, $y] = $placer->place($user);

    expect($x)->toBeGreaterThanOrEqual(0)->toBeLessThanOrEqual(100);
    expect($y)->toBeGreaterThanOrEqual(0)->toBeLessThanOrEqual(100);
});

it('avoids placing a new flower on top of an existing one when possible', function () {
    $user = User::factory()->create();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $question = Question::create(['text' => 'Q', 'quadrant' => 'mental']);
    $activity = Activity::create(['text' => 'A', 'quadrant' => 'physical']);

    UserResponse::create([
        'user_id' => $user->id, 'color_id' => $color->id, 'question_id' => $question->id,
        'activity_id' => $activity->id, 'entry_date' => now()->subDay()->toDateString(),
        'flower_x' => 50.0, 'flower_y' => 50.0,
    ]);

    $placer = new FlowerPlacer();
    [$x, $y] = $placer->place($user);

    $tooClose = abs($x - 50.0) < 5 && abs($y - 50.0) < 5;
    expect($tooClose)->toBeFalse();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=FlowerPlacerTest`
Expected: FAIL — `App\Services\FlowerPlacer` doesn't exist.

- [ ] **Step 3: Write `app/Services/FlowerPlacer.php`**

```php
<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserResponse;

class FlowerPlacer
{
    /**
     * @return array{0: float, 1: float}
     */
    public function place(User $user): array
    {
        $existing = UserResponse::where('user_id', $user->id)
            ->whereNotNull('flower_x')
            ->get(['flower_x', 'flower_y']);

        $x = 0.0;
        $y = 0.0;

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $x = round(mt_rand(0, 10000) / 100, 2);
            $y = round(mt_rand(0, 10000) / 100, 2);

            $collision = $existing->contains(
                fn ($entry) => abs($entry->flower_x - $x) < 5 && abs($entry->flower_y - $y) < 5
            );

            if (! $collision) {
                break;
            }
        }

        return [$x, $y];
    }
}
```

(After 10 attempts without finding a collision-free spot, the loop's last-generated `$x`/`$y` is accepted as-is — a garden with enough flowers to make that likely is a garden worth having regardless of a little overlap.)

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=FlowerPlacerTest`
Expected: PASS — both tests green. (The collision-avoidance test is probabilistic-but-effectively-certain: with a 10x10 exclusion zone out of a 100x100 space and 10 attempts, the chance of never finding a free spot is astronomically small — if this test ever flakes, that's a real signal to investigate, not a reason to loosen the assertion.)

- [ ] **Step 5: Commit**

```bash
git add app/Services/FlowerPlacer.php tests/Unit/FlowerPlacerTest.php
git commit -m "feat: add flower placement service"
```

---

## Task 13: GET /api/today + POST /api/entries (create today's entry)

**Files:**
- Create: `app/Http/Resources/UserResponseResource.php`
- Create: `app/Http/Controllers/Api/EntryController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Api/EntryControllerTest.php`

**Interfaces:**
- Consumes: `QuestionSelector` (Task 11).
- Produces: `UserResponseResource` (camelCase-ish shape mirroring the field names a client needs: `id`, `color`, `answerText`, `activityCompleted`, `entryDate`, `question` (nested `id`/`text`/`quadrant`), `activity` (nested, nullable)); `GET /api/today`, `POST /api/entries`. `EntryController` is extended by Tasks 14–15 with more actions in the same file.

- [ ] **Step 1: Write `app/Http/Resources/UserResponseResource.php`**

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResponseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'color' => $this->color->name,
            'answerText' => $this->answer_text,
            'activityCompleted' => $this->activity_completed,
            'entryDate' => $this->entry_date->toDateString(),
            'flowerX' => $this->flower_x,
            'flowerY' => $this->flower_y,
            'question' => [
                'id' => $this->question->id,
                'text' => $this->question->text,
                'quadrant' => $this->question->quadrant->value,
            ],
            'activity' => $this->when($this->activity_id !== null, fn () => [
                'id' => $this->activity->id,
                'text' => $this->activity->text,
                'quadrant' => $this->activity->quadrant->value,
            ]),
        ];
    }
}
```

- [ ] **Step 2: Write the failing test `tests/Feature/Api/EntryControllerTest.php`**

```php
<?php

use App\Models\Color;
use App\Models\Question;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function actingUserWithConsent(): User
{
    $user = User::factory()->create(['consent_accepted_at' => now()]);
    test()->actingAs($user);
    return $user;
}

it('returns null for GET /api/today when no entry exists yet', function () {
    actingUserWithConsent();

    $response = $this->getJson('/api/today');

    $response->assertOk();
    $response->assertJson(['entry' => null]);
});

it('creates today\'s entry with a picked question', function () {
    actingUserWithConsent();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    Question::create(['text' => 'Q1', 'quadrant' => 'mental']);

    $response = $this->postJson('/api/entries', ['color_id' => $color->id]);

    $response->assertCreated();
    $response->assertJsonStructure(['entry' => ['id', 'color', 'question' => ['id', 'text', 'quadrant']]]);
});

it('rejects a second entry the same day with 409', function () {
    actingUserWithConsent();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    Question::create(['text' => 'Q1', 'quadrant' => 'mental']);

    $this->postJson('/api/entries', ['color_id' => $color->id])->assertCreated();
    $second = $this->postJson('/api/entries', ['color_id' => $color->id]);

    $second->assertStatus(409);
});

it('rejects a request with no color_id with 422', function () {
    actingUserWithConsent();

    $response = $this->postJson('/api/entries', []);

    $response->assertStatus(422);
});

it('rejects entry creation for a non-consented user with 403', function () {
    $user = User::factory()->create(['consent_accepted_at' => null]);
    $this->actingAs($user);

    $response = $this->postJson('/api/entries', ['color_id' => 1]);

    $response->assertStatus(403);
    $response->assertJson(['error' => 'consent_required']);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=EntryControllerTest`
Expected: FAIL — `/api/today` and `/api/entries` don't exist (404).

- [ ] **Step 4: Write `app/Http/Controllers/Api/EntryController.php`**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResponseResource;
use App\Models\UserResponse;
use App\Services\QuestionSelector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EntryController extends Controller
{
    public function today(Request $request): JsonResponse
    {
        $entry = UserResponse::where('user_id', $request->user()->id)
            ->where('entry_date', now()->toDateString())
            ->first();

        return response()->json(['entry' => $entry ? new UserResponseResource($entry) : null]);
    }

    public function store(Request $request, QuestionSelector $questionSelector): JsonResponse
    {
        $data = $request->validate(['color_id' => ['required', 'integer', 'exists:colors,id']]);
        $user = $request->user();
        $today = now()->toDateString();

        $existing = UserResponse::where('user_id', $user->id)->where('entry_date', $today)->exists();
        if ($existing) {
            return response()->json(['error' => 'entry_already_exists_today'], 409);
        }

        $question = $questionSelector->pick($user);

        $entry = UserResponse::create([
            'user_id' => $user->id,
            'color_id' => $data['color_id'],
            'question_id' => $question->id,
            'entry_date' => $today,
        ]);

        return response()->json(['entry' => new UserResponseResource($entry)], 201);
    }
}
```

- [ ] **Step 5: Add routes to `routes/api.php`**

Append (as its own group, since it needs both `auth:sanctum` and `consent`):

```php
use App\Http\Controllers\Api\EntryController;

Route::middleware(['auth:sanctum', 'consent'])->group(function () {
    Route::get('/today', [EntryController::class, 'today']);
    Route::post('/entries', [EntryController::class, 'store']);
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=EntryControllerTest`
Expected: PASS — all 5 tests green.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Resources/UserResponseResource.php app/Http/Controllers/Api/EntryController.php routes/api.php tests/Feature/Api/EntryControllerTest.php
git commit -m "feat: add GET /api/today and POST /api/entries"
```

---

## Task 14: Answer + complete-activity + reroll

**Files:**
- Modify: `app/Http/Controllers/Api/EntryController.php`
- Modify: `routes/api.php`
- Modify: `tests/Feature/Api/EntryControllerTest.php`

**Interfaces:**
- Consumes: `ActivitySelector` (Task 11), `FlowerPlacer` (Task 12).
- Produces: nothing new consumed elsewhere — completes the daily-flow contract from the spec's §5 API surface.

- [ ] **Step 1: Write the failing tests — append to `tests/Feature/Api/EntryControllerTest.php`**

```php
function createTodayEntry(): array
{
    $user = actingUserWithConsent();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    Question::create(['text' => 'Q1', 'quadrant' => 'mental']);

    $response = test()->postJson('/api/entries', ['color_id' => $color->id]);
    $entryId = $response->json('entry.id');

    return [$user, $entryId];
}

it('saves the answer and assigns an activity', function () {
    [, $entryId] = createTodayEntry();
    Activity::create(['text' => 'Walk.', 'quadrant' => 'physical']);

    $response = $this->patchJson("/api/entries/{$entryId}", ['answer' => 'I feel steady today.']);

    $response->assertOk();
    $response->assertJsonStructure(['entry' => ['activity' => ['id', 'text', 'quadrant']]]);
});

it('rejects answering the same entry twice with 409', function () {
    [, $entryId] = createTodayEntry();
    Activity::create(['text' => 'Walk.', 'quadrant' => 'physical']);

    $this->patchJson("/api/entries/{$entryId}", ['answer' => 'first'])->assertOk();
    $second = $this->patchJson("/api/entries/{$entryId}", ['answer' => 'second']);

    $second->assertStatus(409);
});

it('marks the activity complete and assigns flower coordinates', function () {
    [, $entryId] = createTodayEntry();
    Activity::create(['text' => 'Walk.', 'quadrant' => 'physical']);
    $this->patchJson("/api/entries/{$entryId}", ['answer' => 'answer'])->assertOk();

    $response = $this->patchJson("/api/entries/{$entryId}", ['activityCompleted' => true]);

    $response->assertOk();
    $row = \App\Models\UserResponse::find($entryId);
    expect($row->activity_completed)->toBeTrue();
    expect($row->flower_x)->not->toBeNull();
    expect($row->flower_y)->not->toBeNull();
});

it('rejects marking an activity complete before one is assigned', function () {
    [, $entryId] = createTodayEntry();

    $response = $this->patchJson("/api/entries/{$entryId}", ['activityCompleted' => true]);

    $response->assertStatus(409);
});

it('assigns a different activity on reroll before completion', function () {
    [, $entryId] = createTodayEntry();
    Activity::create(['text' => 'Walk.', 'quadrant' => 'physical']);
    Activity::create(['text' => 'Meditate.', 'quadrant' => 'spiritual']);
    $answerResponse = $this->patchJson("/api/entries/{$entryId}", ['answer' => 'answer']);
    $firstActivityId = $answerResponse->json('entry.activity.id');

    $response = $this->postJson("/api/entries/{$entryId}/reroll-activity");

    $response->assertOk();
    expect($response->json('activity.id'))->not->toBe($firstActivityId);
});

it('rejects rerolling after the activity is completed', function () {
    [, $entryId] = createTodayEntry();
    Activity::create(['text' => 'Walk.', 'quadrant' => 'physical']);
    $this->patchJson("/api/entries/{$entryId}", ['answer' => 'answer'])->assertOk();
    $this->patchJson("/api/entries/{$entryId}", ['activityCompleted' => true])->assertOk();

    $response = $this->postJson("/api/entries/{$entryId}/reroll-activity");

    $response->assertStatus(409);
});

it('returns 404 when patching an entry owned by another user', function () {
    [, $entryId] = createTodayEntry();
    $otherUser = User::factory()->create(['consent_accepted_at' => now()]);
    $this->actingAs($otherUser);

    $response = $this->patchJson("/api/entries/{$entryId}", ['answer' => 'nope']);

    $response->assertStatus(404);
});
```

Add `use App\Models\Activity;` to the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=EntryControllerTest`
Expected: FAIL — `PATCH /api/entries/{id}` and `POST /api/entries/{id}/reroll-activity` don't exist (404).

- [ ] **Step 3: Extend `app/Http/Controllers/Api/EntryController.php`**

Add these imports at the top: `use App\Services\ActivitySelector;`, `use App\Services\FlowerPlacer;`, `use Illuminate\Http\Response;`.

Append these methods to the class:

```php
public function update(
    Request $request,
    int $id,
    ActivitySelector $activitySelector,
    FlowerPlacer $flowerPlacer,
): JsonResponse {
    $entry = UserResponse::where('id', $id)->where('user_id', $request->user()->id)->first();
    if (! $entry) {
        return response()->json(['error' => 'not_found'], 404);
    }

    if ($request->has('answer')) {
        if ($entry->answer_text !== null) {
            return response()->json(['error' => 'already_answered'], 409);
        }

        $data = $request->validate(['answer' => ['required', 'string']]);
        $activity = $activitySelector->pick();

        $entry->update(['answer_text' => $data['answer'], 'activity_id' => $activity->id]);

        return response()->json(['entry' => new UserResponseResource($entry->fresh())]);
    }

    if ($request->boolean('activityCompleted')) {
        if (! $entry->activity_id) {
            return response()->json(['error' => 'no_activity_assigned'], 409);
        }

        [$x, $y] = $flowerPlacer->place($request->user());
        $entry->update([
            'activity_completed' => true,
            'completed_at' => now(),
            'flower_x' => $x,
            'flower_y' => $y,
        ]);

        return response()->json(['entry' => new UserResponseResource($entry->fresh())]);
    }

    return response()->json(['error' => 'no_recognized_update'], 400);
}

public function rerollActivity(Request $request, int $id, ActivitySelector $activitySelector): JsonResponse
{
    $entry = UserResponse::where('id', $id)->where('user_id', $request->user()->id)->first();
    if (! $entry) {
        return response()->json(['error' => 'not_found'], 404);
    }
    if ($entry->activity_completed) {
        return response()->json(['error' => 'activity_already_completed'], 409);
    }
    if (! $entry->activity_id) {
        return response()->json(['error' => 'no_activity_assigned_yet'], 409);
    }

    $activity = $activitySelector->pick($entry->activity_id);
    $entry->update(['activity_id' => $activity->id]);

    return response()->json([
        'activity' => ['id' => $activity->id, 'text' => $activity->text, 'quadrant' => $activity->quadrant->value],
    ]);
}
```

- [ ] **Step 4: Add routes to `routes/api.php`**

Inside the same `Route::middleware(['auth:sanctum', 'consent'])->group(...)` block from Task 13, add:

```php
Route::patch('/entries/{id}', [EntryController::class, 'update']);
Route::post('/entries/{id}/reroll-activity', [EntryController::class, 'rerollActivity']);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=EntryControllerTest`
Expected: PASS — all 12 tests in this file green.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/EntryController.php routes/api.php tests/Feature/Api/EntryControllerTest.php
git commit -m "feat: add answer/complete-activity PATCH and reroll-activity routes"
```

---

## Task 15: GET /api/entries (paginated garden feed) + DELETE /api/entries/{id}

**Files:**
- Modify: `app/Http/Controllers/Api/EntryController.php`
- Modify: `routes/api.php`
- Modify: `tests/Feature/Api/EntryControllerTest.php`

**Interfaces:**
- Produces: nothing new consumed elsewhere — completes the entries controller.

- [ ] **Step 1: Write the failing tests — append to `tests/Feature/Api/EntryControllerTest.php`**

```php
function seedManualEntry(User $user, string $entryDate, ?array $flower = null): \App\Models\UserResponse
{
    $color = Color::firstOrCreate(['name' => 'Teal'], ['hex' => '#4f8f86']);
    $question = Question::firstOrCreate(['text' => 'Manual Q'], ['quadrant' => 'mental']);

    return \App\Models\UserResponse::create([
        'user_id' => $user->id,
        'color_id' => $color->id,
        'question_id' => $question->id,
        'entry_date' => $entryDate,
        'flower_x' => $flower[0] ?? null,
        'flower_y' => $flower[1] ?? null,
    ]);
}

it('returns entries newest first, scoped to the requesting user', function () {
    $user = actingUserWithConsent();
    $otherUser = User::factory()->create();

    seedManualEntry($user, now()->subDays(2)->toDateString());
    $newest = seedManualEntry($user, now()->subDay()->toDateString());
    seedManualEntry($otherUser, now()->subDay()->toDateString());

    $response = $this->getJson('/api/entries');

    $response->assertOk();
    $ids = collect($response->json('entries'))->pluck('id');
    expect($ids->first())->toBe($newest->id);
    expect($ids->count())->toBe(2);
});

it('paginates with a cursor', function () {
    $user = actingUserWithConsent();
    for ($i = 0; $i < 25; $i++) {
        seedManualEntry($user, now()->subDays($i + 1)->toDateString());
    }

    $firstPage = $this->getJson('/api/entries');
    $firstPage->assertOk();
    expect($firstPage->json('entries'))->toHaveCount(20);
    expect($firstPage->json('nextCursor'))->not->toBeNull();

    $secondPage = $this->getJson('/api/entries?cursor=' . urlencode($firstPage->json('nextCursor')));
    $secondPage->assertOk();
    expect($secondPage->json('entries'))->toHaveCount(5);
    expect($secondPage->json('nextCursor'))->toBeNull();
});

it('deletes an entry the user owns', function () {
    $user = actingUserWithConsent();
    $entry = seedManualEntry($user, now()->toDateString());

    $response = $this->deleteJson("/api/entries/{$entry->id}");

    $response->assertOk();
    expect(\App\Models\UserResponse::find($entry->id))->toBeNull();
});

it('returns 404 deleting an entry owned by another user', function () {
    $user = actingUserWithConsent();
    $otherUser = User::factory()->create();
    $entry = seedManualEntry($otherUser, now()->toDateString());

    $response = $this->deleteJson("/api/entries/{$entry->id}");

    $response->assertStatus(404);
    expect(\App\Models\UserResponse::find($entry->id))->not->toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=EntryControllerTest`
Expected: FAIL — `GET /api/entries` and `DELETE /api/entries/{id}` return 404 (not registered).

- [ ] **Step 3: Extend `app/Http/Controllers/Api/EntryController.php`**

Append these methods:

```php
public function index(Request $request): JsonResponse
{
    $limit = 20;
    $query = UserResponse::where('user_id', $request->user()->id)->orderByDesc('created_at');

    if ($cursor = $request->query('cursor')) {
        $query->where('created_at', '<', $cursor);
    }

    $rows = $query->limit($limit + 1)->get();
    $hasMore = $rows->count() > $limit;
    $page = $hasMore ? $rows->slice(0, $limit) : $rows;

    return response()->json([
        'entries' => UserResponseResource::collection($page->values()),
        'nextCursor' => $hasMore ? $page->last()->created_at->toISOString() : null,
    ]);
}

public function destroy(Request $request, int $id): JsonResponse
{
    $deleted = UserResponse::where('id', $id)->where('user_id', $request->user()->id)->delete();

    if ($deleted === 0) {
        return response()->json(['error' => 'not_found'], 404);
    }

    return response()->json(['ok' => true]);
}
```

- [ ] **Step 4: Add routes to `routes/api.php`**

Inside the same consent-gated group, add:

```php
Route::get('/entries', [EntryController::class, 'index']);
Route::delete('/entries/{id}', [EntryController::class, 'destroy']);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=EntryControllerTest`
Expected: PASS — all 16 tests in this file green.

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS — every test from Tasks 2–15 green.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/Api/EntryController.php routes/api.php tests/Feature/Api/EntryControllerTest.php
git commit -m "feat: add paginated GET /api/entries and DELETE /api/entries/{id}"
```

---

## Task 16: Install Filament, panel access, UserResource, ColorResource

**Files:**
- Create: `app/Filament/Resources/UserResource.php` and its `Pages/` (auto-generated)
- Create: `app/Filament/Resources/ColorResource.php` and its `Pages/`
- Modify: `app/Models/User.php` (implement `FilamentUser`)
- Modify: `database/factories/UserFactory.php` (add an `admin()` state, used by the test)
- Test: `tests/Feature/Filament/PanelAccessTest.php`

**Interfaces:**
- Produces: the `/admin` panel, gated on `is_admin`; the User and Color resources within it.

- [ ] **Step 1: Install Filament**

```bash
composer require filament/filament:"^5.0"
php artisan filament:install --panels
```

Accept the default panel ID (`admin`) and path (`/admin`) when prompted, or pass `--panels=admin` non-interactively if your environment requires it.

- [ ] **Step 2: Implement `FilamentUser` on `app/Models/User.php`**

Add the import `use Filament\Models\Contracts\FilamentUser;` and `use Filament\Panel;`, add `FilamentUser` to the class's `implements` list, and add this method:

```php
public function canAccessPanel(Panel $panel): bool
{
    return $this->is_admin;
}
```

- [ ] **Step 3: Add an `admin()` state to `database/factories/UserFactory.php`**

Add this method to the factory class (alongside whatever states Laravel 13 scaffolds by default, e.g. `unverified()`). Note this uses `afterCreating()` with direct property assignment rather than `state()`: `state()` merges into the attributes array that gets passed through the model's constructor, which respects `$fillable` — and since `is_admin` was deliberately removed from `User`'s fillable list in Task 2, a `state()`-based override would be silently dropped:

```php
public function admin(): static
{
    return $this->afterCreating(function (User $user) {
        $user->is_admin = true;
        $user->save();
    });
}
```

- [ ] **Step 4: Write the failing test `tests/Feature/Filament/PanelAccessTest.php`**

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('denies panel access to a non-admin user', function () {
    // No need to pass is_admin explicitly — the users.is_admin column
    // defaults to false (Task 2's migration), and passing it here would hit
    // the same fillable restriction the admin() factory state works around.
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get('/admin');

    $response->assertForbidden();
});

it('grants panel access to an admin user', function () {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin);

    $response = $this->get('/admin');

    $response->assertOk();
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `php artisan test --filter=PanelAccessTest`
Expected: FAIL — before `canAccessPanel` is implemented, Filament's default (deny-all in production-like test config, or an error) won't match this test's expectations; confirm failure, then proceed.

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test --filter=PanelAccessTest`
Expected: PASS — both tests green.

- [ ] **Step 7: Generate the UserResource (list + edit-only-`is_admin` — no create, no editing name/email/other user data)**

```bash
php artisan make:filament-resource User
```

(No `--view`/`--generate` flag here — this resource genuinely needs one editable field, `is_admin`, so it needs a real Edit page, just a deliberately narrow one. `--view` would generate no Edit page at all, which was an inconsistency in an earlier draft of this task — worth knowing if you're comparing against an older version of this plan.)

Delete the generated `app/Filament/Resources/UserResource/Pages/CreateUser.php` and remove its reference from `UserResource::getPages()` — admins are never created through this panel, only via Google sign-in (a `google_id` is required, so a blank "create user" form wouldn't produce a usable account anyway).

Open the generated `app/Filament/Resources/UserResource.php` and replace its `table()` method with:

```php
public static function table(Table $table): Table
{
    return $table
        ->columns([
            Tables\Columns\TextColumn::make('email')->searchable(),
            Tables\Columns\TextColumn::make('name'),
            Tables\Columns\TextColumn::make('created_at')->label('Signed up')->dateTime(),
            Tables\Columns\IconColumn::make('consent_accepted_at')->label('Consented')->boolean(),
            Tables\Columns\TextColumn::make('user_responses_count')->label('Entries')->counts('userResponses'),
            Tables\Columns\IconColumn::make('is_admin')->boolean(),
        ]);
}
```

Add `use Filament\Tables\Table;` and `use Filament\Tables;` imports if not already present from the generated file. Replace the generated `form()` method entirely (remove whatever fields the generator scaffolded for `name`/`email`/`password` — this resource is deliberately not for editing user profile data, only admin status):

```php
public static function form(Form $form): Form
{
    return $form->schema([
        Forms\Components\Toggle::make('is_admin'),
    ]);
}
```

`is_admin` was deliberately removed from `User`'s `$fillable`/`#[Fillable(...)]` in Task 2 (mass-assignment safety — see that task's note). Filament's default `EditRecord` page saves via mass assignment, so it would silently fail to persist this toggle otherwise. Open the generated `app/Filament/Resources/UserResource/Pages/EditUser.php` and add this method to bypass mass assignment for just this one, already-admin-gated field:

```php
protected function handleRecordUpdate(\Illuminate\Database\Eloquent\Model $record, array $data): \Illuminate\Database\Eloquent\Model
{
    $record->is_admin = (bool) ($data['is_admin'] ?? $record->is_admin);
    $record->save();

    return $record;
}
```

(This is safe precisely because reaching this page at all already requires `canAccessPanel()` to have returned `true` for the current user — i.e. they're already an admin. It's a controlled, gated write path, unlike a public API endpoint.)

- [ ] **Step 8: Generate the ColorResource with full CRUD**

```bash
php artisan make:filament-resource Color --generate
```

`--generate` auto-derives the form/table from the `colors` table's columns (`name`, `hex`, `active`), which matches what's needed here — no manual edits required beyond a visual nicety: in the generated `table()` method, wrap the `hex` column with a color preview by changing that column to:

```php
Tables\Columns\ColorColumn::make('hex'),
```

(instead of whatever plain `TextColumn::make('hex')` the generator produced).

- [ ] **Step 9: Verify the resources load without error**

Run: `php artisan test --filter=PanelAccessTest` again (still green), then manually sanity-check by running `php artisan route:list --path=admin` and confirming routes for both `users` and `colors` resources are listed.

- [ ] **Step 10: Commit**

```bash
git add app/Filament app/Models/User.php database/factories/UserFactory.php tests/Feature/Filament/PanelAccessTest.php composer.json composer.lock config/filament.php
git commit -m "feat: install Filament, add panel access control, User and Color resources"
```

---

## Task 17: QuestionResource, ActivityResource, UserResponseResource (view-only)

**Files:**
- Create: `app/Filament/Resources/QuestionResource.php` and its `Pages/`
- Create: `app/Filament/Resources/ActivityResource.php` and its `Pages/`
- Create: `app/Filament/Resources/UserResponseResource.php` and its `Pages/`

**Interfaces:**
- Produces: the remaining 3 Filament resources named in the spec's §6.

- [ ] **Step 1: Generate QuestionResource and ActivityResource with full CRUD**

```bash
php artisan make:filament-resource Question --generate
php artisan make:filament-resource Activity --generate
```

In both generated `form()` methods, replace whatever plain text input the generator produced for `quadrant` with a `Select` bound to the enum (so admins pick from the 4 valid values, not free text):

```php
Forms\Components\Select::make('quadrant')
    ->options([
        'mental' => 'Mental',
        'physical' => 'Physical',
        'emotional' => 'Emotional',
        'spiritual' => 'Spiritual',
    ])
    ->required(),
```

Also change the `text` field's generated `TextInput` to a `Textarea` in both (question/activity text can run long):

```php
Forms\Components\Textarea::make('text')->required()->rows(3),
```

- [ ] **Step 2: Generate UserResponseResource as view-only**

```bash
php artisan make:filament-resource UserResponse --view
```

Same fallback as Task 16 Step 7 if `--view` isn't recognized: generate plainly (`php artisan make:filament-resource UserResponse`) and delete the Create/Edit pages, keeping only List (and View, if generated) — the `canCreate()`/`canEdit()`/`canDelete()` overrides below are the real enforcement either way, the missing pages are just tidiness.

Replace the generated `table()` method with:

```php
public static function table(Table $table): Table
{
    return $table
        ->columns([
            Tables\Columns\TextColumn::make('user.email')->label('User')->searchable(),
            Tables\Columns\TextColumn::make('color.name')->label('Color'),
            Tables\Columns\TextColumn::make('question.quadrant')->label('Q Quadrant'),
            Tables\Columns\TextColumn::make('activity.quadrant')->label('Activity Quadrant'),
            Tables\Columns\TextColumn::make('entry_date')->date(),
            Tables\Columns\IconColumn::make('activity_completed')->boolean(),
        ])
        ->filters([
            Tables\Filters\SelectFilter::make('question.quadrant')
                ->relationship('question', 'quadrant')
                ->options([
                    'mental' => 'Mental', 'physical' => 'Physical',
                    'emotional' => 'Emotional', 'spiritual' => 'Spiritual',
                ]),
        ]);
}
```

Delete (or leave empty) the generated `form()` method's contents and replace with an empty schema, and remove any generated Edit/Create pages so the resource is genuinely view-only:

```php
public static function form(Form $form): Form
{
    return $form->schema([]);
}
```

In the resource class, override `canCreate()`, `canEdit()`, and `canDelete()` to all return `false`:

```php
public static function canCreate(): bool
{
    return false;
}

public static function canEdit($record): bool
{
    return false;
}

public static function canDelete($record): bool
{
    return false;
}
```

- [ ] **Step 3: Verify everything still boots**

Run: `php artisan test` (full suite) and `php artisan route:list --path=admin`.
Expected: full suite still green (this task adds no new automated tests — it's admin-UI-only, matching the "frontend has no automated tests" pattern from the prior Cloudflare build, since Filament's generated CRUD is itself a well-tested first-party package); the route list shows all 5 resources.

- [ ] **Step 4: Commit**

```bash
git add app/Filament
git commit -m "feat: add Question, Activity, and view-only UserResponse Filament resources"
```

---

## Task 18: Deployment config finalization

**Files:**
- Modify: `README.md`
- Modify: `.env.example` (confirm completeness)

**Interfaces:**
- None — documentation and config only.

- [ ] **Step 1: Rewrite `README.md`**

Replace the entire file with:

```markdown
# Eve Colors

Eve Colors is a wellness journaling app for a quick daily check-in: pick a
color that matches how you feel, answer a short reflection question, then
get a small suggested activity to do. Completing a day's activity plants a
flower in your private garden, at its own spot.

**Eve Colors is a wellness tool, not a medical device.** It does not
provide medical advice, diagnosis, or treatment.

## How it works

1. **Pick a color** — a mood label for the day (11 presets, admin-editable).
2. **Answer a question** — drawn at random from a growing bank, never
   repeating within 7 days.
3. **Do a small activity** — suggested at random after answering; you can
   ask for a different one before committing.
4. **Watch your garden grow** — completing an activity plants a flower at
   a server-assigned spot in your garden.

Every question and activity is tagged to one of four wellness quadrants —
**mental, physical, emotional, spiritual** — purely descriptive, not a
score or diagnosis.

## Privacy & GDPR

- We collect your Google account email and name to run your account.
- Analytics (PostHog, EU region) and marketing email are **opt-in**, off
  by default, separate from the required terms you accept to use the app.
  We never sell your email address.
- Deleting your account permanently removes your entries and account
  record, and purges your analytics data too.

## Framework overview

- **Backend** — [Laravel 13](https://laravel.com), REST API + [Filament](https://filamentphp.com)
  admin panel (`/admin`), one codebase.
- **Auth** — [Socialite](https://laravel.com/docs/socialite) (Google SSO,
  web) + [Sanctum](https://laravel.com/docs/sanctum) (API auth — cookie
  for web, bearer token for the future mobile app; both behind one
  `auth:sanctum` guard).
- **Database** — MySQL in production (Laravel Cloud managed), SQLite
  in-memory for tests.
- **Hosting** — [Laravel Cloud](https://cloud.laravel.com), connected
  directly to this repo.
- **Analytics** — PostHog Cloud, EU region, loaded only for users who
  opt in (client-side integration is part of the future client app).

Planned repo layout once the client app lands:

```
/                — Laravel app (this repo's root)
/client          — Expo app (web + iOS + Android from one codebase) — not built yet
```

## Local development

1. `composer install`
2. `cp .env.example .env && php artisan key:generate`
3. Fill in `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `POSTHOG_PROJECT_ID`,
   `POSTHOG_DELETION_API_KEY` — a real Google Cloud OAuth client and PostHog EU project
   are the repo owner's setup steps, not something run from this codebase.
4. `php artisan migrate --seed`
5. `php artisan serve`

Run the test suite with `php artisan test` (uses an in-memory SQLite database,
no setup needed).

## Status

Server-side phase complete: Laravel API (Google SSO for web + mobile, the
full daily color→question→activity→garden flow, GDPR account deletion,
consent enforcement) and the Filament admin panel (Users, Colors,
Questions, Activities, and a view-only Daily Entries resource). No client
app exists yet — that's the next phase, built with Expo so the same
codebase targets web, iOS, and Android.

## Deployment (owner responsibility, not run from this codebase)

1. Create a Google Cloud OAuth client (External consent screen), authorized
   redirect URI = production `/auth/google/callback` URL.
2. Create/confirm the PostHog Cloud project (EU region) and its API keys.
3. Connect this repo to [Laravel Cloud](https://cloud.laravel.com);
   provision a MySQL resource.
4. Set environment secrets on Laravel Cloud: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `POSTHOG_PROJECT_ID`, `POSTHOG_DELETION_API_KEY`,
   `FRONTEND_URL` (once a client domain exists), `SANCTUM_STATEFUL_DOMAINS`
   (once a client domain exists).
5. Point DNS at Laravel Cloud once ready.
6. Deploys run migrations + seeders automatically via Laravel Cloud's deploy
   hooks (confirm this is configured in the Laravel Cloud dashboard — it's
   not a file in this repo).
```

- [ ] **Step 2: Confirm `.env.example` has every variable this app needs**

Read through `.env.example` and confirm it includes (from Task 1's Step 4, plus
whatever Sanctum/Filament added automatically during install): `DB_CONNECTION`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`,
`POSTHOG_PROJECT_ID`, `POSTHOG_DELETION_API_KEY`. Add any that are missing.

- [ ] **Step 3: Final verification**

Run: `php artisan test` (full suite) and `composer install` on a clean checkout if
practical.
Expected: full suite green, install succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "docs: document local dev setup and deployment steps"
```
