<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SessionUserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => new SessionUserResource($request->user())]);
    }

    public function updateConsent(Request $request): JsonResponse
    {
        $data = $request->validate(['analyticsMarketing' => ['required', 'boolean']]);
        $user = $request->user();

        $user->consent_accepted_at ??= now();
        $user->analytics_marketing_consent_at = $data['analyticsMarketing'] ? now() : null;
        $user->save();

        return response()->json(['ok' => true]);
    }
}
