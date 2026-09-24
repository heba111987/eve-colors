<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('returns 401 for GET /api/me with no session', function () {
    $response = $this->getJson('/api/me');

    $response->assertStatus(401);
});

it('returns the user with null consent fields for a fresh signup', function () {
    $user = User::factory()->create(['consent_accepted_at' => null, 'analytics_consent_at' => null, 'marketing_consent_at' => null]);
    $this->actingAs($user);

    $response = $this->getJson('/api/me');

    $response->assertOk();
    $response->assertJson([
        'user' => ['email' => $user->email, 'consentAcceptedAt' => null, 'analyticsConsentAt' => null, 'marketingConsentAt' => null],
    ]);
});

it('stamps consentAcceptedAt once and lets analytics and marketing consent be toggled independently afterward', function () {
    $user = User::factory()->create(['consent_accepted_at' => null]);
    $this->actingAs($user);

    $first = $this->postJson('/api/me/consent', ['analytics' => true, 'marketing' => false]);
    $first->assertOk();

    $user->refresh();
    $firstAcceptedAt = $user->consent_accepted_at;
    expect($firstAcceptedAt)->not->toBeNull();
    expect($user->analytics_consent_at)->not->toBeNull();
    expect($user->marketing_consent_at)->toBeNull();

    $this->postJson('/api/me/consent', ['analytics' => false, 'marketing' => true])->assertOk();

    $user->refresh();
    expect($user->consent_accepted_at->equalTo($firstAcceptedAt))->toBeTrue();
    expect($user->analytics_consent_at)->toBeNull();
    expect($user->marketing_consent_at)->not->toBeNull();
});

it('deletes the account, cascades entries and tokens, and reports the PostHog purge outcome', function () {
    Http::fake([
        'eu.posthog.com/*' => Http::response(['results' => []]),
    ]);

    $user = User::factory()->create();
    $newToken = $user->createToken('test');
    $tokenId = $newToken->accessToken->id;

    DB::table('sessions')->insert([
        'id' => Str::random(40),
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'PestTestAgent',
        'payload' => base64_encode(serialize([])),
        'last_activity' => now()->timestamp,
    ]);

    $response = $this->withHeader('Authorization', "Bearer {$newToken->plainTextToken}")->deleteJson('/api/me');

    $response->assertOk();
    $response->assertJson(['ok' => true, 'analyticsPurged' => true]);
    expect(User::find($user->id))->toBeNull();
    expect(\Laravel\Sanctum\PersonalAccessToken::find($tokenId))->toBeNull();
    expect(DB::table('sessions')->where('user_id', $user->id)->doesntExist())->toBeTrue();
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
