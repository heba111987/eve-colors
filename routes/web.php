<?php

use App\Http\Controllers\Auth\GoogleWebController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/auth/google/redirect', [GoogleWebController::class, 'redirect']);
Route::get('/auth/google/callback', [GoogleWebController::class, 'callback']);
