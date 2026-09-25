<?php

use App\Http\Controllers\Api\ColorController;
use App\Http\Controllers\Api\EntryController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Auth\GoogleMobileController;
use App\Http\Controllers\Auth\LogoutController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/google', GoogleMobileController::class);

Route::middleware('auth:sanctum')->post('/logout', LogoutController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::post('/me/consent', [MeController::class, 'updateConsent']);
    Route::delete('/me', [MeController::class, 'destroy']);
});

Route::middleware(['auth:sanctum', 'consent'])->group(function () {
    Route::get('/colors', [ColorController::class, 'index']);
    Route::get('/today', [EntryController::class, 'today']);
    Route::post('/entries', [EntryController::class, 'store']);
    Route::patch('/entries/{id}', [EntryController::class, 'update']);
    Route::post('/entries/{id}/reroll-activity', [EntryController::class, 'rerollActivity']);
    Route::get('/entries', [EntryController::class, 'index']);
    Route::get('/garden', [EntryController::class, 'garden']);
    Route::delete('/entries/{id}', [EntryController::class, 'destroy']);
});
