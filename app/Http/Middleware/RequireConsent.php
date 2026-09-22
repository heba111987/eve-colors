<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireConsent
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->consent_accepted_at) {
            return response()->json(['error' => 'consent_required'], 403);
        }

        return $next($request);
    }
}
