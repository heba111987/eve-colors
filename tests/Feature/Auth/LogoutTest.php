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
