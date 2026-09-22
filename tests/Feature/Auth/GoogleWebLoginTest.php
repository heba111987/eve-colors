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
