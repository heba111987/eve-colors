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
