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
