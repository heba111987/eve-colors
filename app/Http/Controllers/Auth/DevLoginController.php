<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

// Local-only stand-in for the Google OAuth round-trip (app/Http/Controllers/
// Auth/GoogleWebController.php), for testing the client's authenticated
// screens without real Google OAuth credentials configured. Never routable
// outside app.environment('local') — see the route registration in
// routes/web.php, checked again here in case this controller is ever
// reused somewhere that guard doesn't cover.
class DevLoginController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        if (! app()->environment('local')) {
            throw new NotFoundHttpException;
        }

        if ($request->boolean('new')) {
            // A fresh user every time, to exercise the isNewUser === true
            // path (lands on /consent, same as a first-time Google sign-in).
            $user = User::create([
                'google_id' => 'dev-'.Str::random(10),
                'email' => Str::random(8).'@dev.local',
                'name' => 'Dev Tester',
                'password' => null,
            ]);
        } else {
            // One stable user reused across visits, pre-consented, so it
            // behaves like a returning user landing straight on /today.
            $user = User::firstOrCreate(
                ['google_id' => 'dev-fixed-user'],
                ['email' => 'dev@evecolors.local', 'name' => 'Dev Tester', 'password' => null],
            );

            if (! $user->consent_accepted_at) {
                $user->consent_accepted_at = now();
                $user->analytics_consent_at = now();
                $user->save();
            }
        }

        Auth::login($user);
        $request->session()->regenerate();

        $destination = $user->consent_accepted_at ? '/today' : '/consent';

        return redirect(config('app.frontend_url').$destination);
    }
}
