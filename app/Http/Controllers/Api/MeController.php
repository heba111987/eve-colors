<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SessionUserResource;
use App\Services\PostHogClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => new SessionUserResource($request->user())]);
    }

    public function updateConsent(Request $request): JsonResponse
    {
        $data = $request->validate([
            'analytics' => ['required', 'boolean'],
            'marketing' => ['required', 'boolean'],
        ]);
        $user = $request->user();

        $user->consent_accepted_at ??= now();
        $user->analytics_consent_at = $data['analytics'] ? now() : null;
        $user->marketing_consent_at = $data['marketing'] ? now() : null;
        $user->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, PostHogClient $postHog): JsonResponse
    {
        $user = $request->user();
        $analyticsPurged = $postHog->deletePerson($user->email);

        $user->tokens()->delete();
        DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->delete();

        return response()->json(['ok' => true, 'analyticsPurged' => $analyticsPurged]);
    }
}
