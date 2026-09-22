<?php

use App\Models\Activity;
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

it('finds today\'s entry via GET /api/today once one has been created', function () {
    actingUserWithConsent();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    Question::create(['text' => 'Q1', 'quadrant' => 'mental']);

    $created = $this->postJson('/api/entries', ['color_id' => $color->id])->assertCreated();

    $response = $this->getJson('/api/today');

    $response->assertOk();
    expect($response->json('entry.id'))->toBe($created->json('entry.id'));
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

it('rejects re-completing an already-completed activity and does not re-roll the flower', function () {
    [, $entryId] = createTodayEntry();
    Activity::create(['text' => 'Walk.', 'quadrant' => 'physical']);
    $this->patchJson("/api/entries/{$entryId}", ['answer' => 'answer'])->assertOk();

    $first = $this->patchJson("/api/entries/{$entryId}", ['activityCompleted' => true]);
    $first->assertOk();
    $firstFlowerX = $first->json('entry.flowerX');
    $firstFlowerY = $first->json('entry.flowerY');

    $second = $this->patchJson("/api/entries/{$entryId}", ['activityCompleted' => true]);
    $second->assertStatus(409);

    $row = \App\Models\UserResponse::find($entryId);
    expect($row->flower_x)->toBe($firstFlowerX);
    expect($row->flower_y)->toBe($firstFlowerY);
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
