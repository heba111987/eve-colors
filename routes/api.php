<?php

use App\Http\Controllers\Auth\GoogleMobileController;
use App\Http\Controllers\Auth\LogoutController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/auth/google', GoogleMobileController::class);

Route::middleware('auth:sanctum')->post('/logout', LogoutController::class);
