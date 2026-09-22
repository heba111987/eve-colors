<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

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

it('deletes the account, cascades entries and tokens, and reports the PostHog purge outcome', function () {
    Http::fake([
        'eu.posthog.com/*' => Http::response(['results' => []]),
    ]);

    $user = User::factory()->create();
    $newToken = $user->createToken('test');
    $tokenId = $newToken->accessToken->id;

    $response = $this->withHeader('Authorization', "Bearer {$newToken->plainTextToken}")->deleteJson('/api/me');

    $response->assertOk();
    $response->assertJson(['ok' => true, 'analyticsPurged' => true]);
    expect(User::find($user->id))->toBeNull();
    expect(\Laravel\Sanctum\PersonalAccessToken::find($tokenId))->toBeNull();
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
