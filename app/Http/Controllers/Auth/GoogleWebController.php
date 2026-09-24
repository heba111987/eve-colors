<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\UpsertsGoogleUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class GoogleWebController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(UpsertsGoogleUser $upserter): RedirectResponse
    {
        $googleUser = Socialite::driver('google')->user();

        // Same check the mobile flow does in GoogleIdTokenVerifier — the
        // upserter links accounts by email, so the email must be Google-verified.
        abort_unless(($googleUser->getRaw()['email_verified'] ?? false) === true, 403, 'Google email not verified.');

        [$user, $isNewUser] = $upserter->upsert(
            googleId: $googleUser->getId(),
            email: $googleUser->getEmail(),
            name: $googleUser->getName(),
            avatarUrl: $googleUser->getAvatar(),
        );

        Auth::login($user);
        request()->session()->regenerate();

        $destination = $isNewUser ? '/consent' : '/today';

        return redirect(config('app.frontend_url') . $destination);
    }
}
