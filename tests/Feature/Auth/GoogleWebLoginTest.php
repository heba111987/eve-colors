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
    $socialiteUser->shouldReceive('getRaw')->andReturn(['email_verified' => true]);

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
    $socialiteUser->shouldReceive('getRaw')->andReturn(['email_verified' => true]);

    Socialite::shouldReceive('driver->user')->andReturn($socialiteUser);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(config('app.frontend_url') . '/today');
});

function mockGoogleWebUser(string $id, string $email, bool $emailVerified): void
{
    $socialiteUser = Mockery::mock(SocialiteUserContract::class);
    $socialiteUser->shouldReceive('getId')->andReturn($id);
    $socialiteUser->shouldReceive('getEmail')->andReturn($email);
    $socialiteUser->shouldReceive('getName')->andReturn('Some User');
    $socialiteUser->shouldReceive('getAvatar')->andReturn(null);
    $socialiteUser->shouldReceive('getRaw')->andReturn(['email_verified' => $emailVerified]);

    Socialite::shouldReceive('driver->user')->andReturn($socialiteUser);
}

it('links a google sign-in to an existing account with the same email', function () {
    $existing = User::factory()->create(['google_id' => null, 'email' => 'admin@example.com']);

    mockGoogleWebUser('google-sub-admin', 'admin@example.com', emailVerified: true);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(config('app.frontend_url') . '/consent');
    $this->assertAuthenticatedAs($existing);
    expect(User::count())->toBe(1);
    expect($existing->fresh()->google_id)->toBe('google-sub-admin');
});

it('rejects a google sign-in whose email is not verified', function () {
    User::factory()->create(['google_id' => null, 'email' => 'admin@example.com']);

    mockGoogleWebUser('google-sub-attacker', 'admin@example.com', emailVerified: false);

    $response = $this->get('/auth/google/callback');

    $response->assertForbidden();
    $this->assertGuest();
    expect(User::where('email', 'admin@example.com')->value('google_id'))->toBeNull();
});
