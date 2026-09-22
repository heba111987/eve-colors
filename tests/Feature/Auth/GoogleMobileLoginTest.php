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
