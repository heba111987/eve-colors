<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class GoogleIdTokenVerifier
{
    /**
     * @return array<string, mixed>
     */
    public function verify(string $idToken): array
    {
        $response = Http::timeout(5)->get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $idToken,
        ]);

        if (! $response->successful()) {
            throw new RuntimeException('Google tokeninfo request failed.');
        }

        $payload = $response->json();

        if (($payload['aud'] ?? null) !== config('services.google.client_id')) {
            throw new RuntimeException('ID token audience mismatch.');
        }

        $emailVerified = $payload['email_verified'] ?? false;
        if ($emailVerified !== true && $emailVerified !== 'true') {
            throw new RuntimeException('Google email not verified.');
        }

        return $payload;
    }
}
