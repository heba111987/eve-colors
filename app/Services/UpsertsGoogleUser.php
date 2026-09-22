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
