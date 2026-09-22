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
