<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class PostHogClient
{
    public function deletePerson(string $distinctId): bool
    {
        $projectId = config('services.posthog.project_id');
        $apiKey = config('services.posthog.deletion_api_key');

        try {
            $lookup = Http::withToken($apiKey)
                ->timeout(5)
                ->get("https://eu.posthog.com/api/projects/{$projectId}/persons/", [
                    'distinct_id' => $distinctId,
                ]);

            if (! $lookup->successful()) {
                return false;
            }

            foreach ($lookup->json('results', []) as $person) {
                $delete = Http::withToken($apiKey)
                    ->timeout(5)
                    ->delete("https://eu.posthog.com/api/projects/{$projectId}/persons/{$person['id']}/");

                if (! $delete->successful() && $delete->status() !== 404) {
                    return false;
                }
            }

            return true;
        } catch (Throwable $e) {
            Log::error('PostHog purge failed during account deletion', ['error' => $e->getMessage()]);

            return false;
        }
    }
}
