<?php

namespace App\Services;

use App\Models\User;

class UpsertsGoogleUser
{
    /**
     * @return array{0: User, 1: bool}
     */
    public function upsert(string $googleId, string $email, ?string $name, ?string $avatarUrl): array
    {
        $user = User::where('google_id', $googleId)->first();
        $isNewUser = $user === null;

        // An account created outside Google sign-in (e.g. an admin made with
        // make:filament-user) gets linked on its first Google sign-in instead
        // of colliding on the unique email. Callers must only pass
        // Google-verified emails, or this would allow account takeover.
        if (! $user) {
            $user = User::where('email', $email)->whereNull('google_id')->first();
            $user?->update(['google_id' => $googleId]);
            $isNewUser = $user === null || $user->consent_accepted_at === null;
        }

        if ($user) {
            $user->update([
                'email' => $email,
                'name' => $name ?? $user->name,
                'avatar_url' => $avatarUrl,
            ]);
        } else {
            $user = User::create([
                'google_id' => $googleId,
                'email' => $email,
                'name' => $name ?? $email,
                'avatar_url' => $avatarUrl,
                'password' => null,
            ]);
        }

        return [$user, $isNewUser];
    }
}
