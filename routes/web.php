<?php

use App\Http\Controllers\Auth\DevLoginController;
use App\Http\Controllers\Auth\GoogleWebController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/auth/google/redirect', [GoogleWebController::class, 'redirect']);
Route::get('/auth/google/callback', [GoogleWebController::class, 'callback']);

if (app()->environment('local')) {
    // Bypasses Google OAuth for local client testing — see DevLoginController.
    // Never registered outside local (and the controller re-checks besides),
    // so this route doesn't exist in staging/production route caches.
    Route::get('/dev-login', DevLoginController::class);
}
