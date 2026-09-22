<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\GoogleIdTokenVerifier;
use App\Services\UpsertsGoogleUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class GoogleMobileController extends Controller
{
    public function __invoke(
        Request $request,
        GoogleIdTokenVerifier $verifier,
        UpsertsGoogleUser $upserter,
    ): JsonResponse {
        $data = $request->validate(['idToken' => ['required', 'string']]);

        try {
            $payload = $verifier->verify($data['idToken']);
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        [$user, $isNewUser] = $upserter->upsert(
            googleId: $payload['sub'],
            email: $payload['email'],
            name: $payload['name'] ?? null,
            avatarUrl: $payload['picture'] ?? null,
        );

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json(
            ['token' => $token, 'isNewUser' => $isNewUser],
            $isNewUser ? 201 : 200,
        );
    }
}
