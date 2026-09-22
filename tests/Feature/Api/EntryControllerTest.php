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
