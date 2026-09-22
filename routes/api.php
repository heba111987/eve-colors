<?php

use App\Http\Controllers\Api\EntryController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Auth\GoogleMobileController;
use App\Http\Controllers\Auth\LogoutController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/auth/google', GoogleMobileController::class);

Route::middleware('auth:sanctum')->post('/logout', LogoutController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::post('/me/consent', [MeController::class, 'updateConsent']);
    Route::delete('/me', [MeController::class, 'destroy']);
});

Route::middleware(['auth:sanctum', 'consent'])->group(function () {
    Route::get('/today', [EntryController::class, 'today']);
    Route::post('/entries', [EntryController::class, 'store']);
    Route::patch('/entries/{id}', [EntryController::class, 'update']);
    Route::post('/entries/{id}/reroll-activity', [EntryController::class, 'rerollActivity']);
    Route::get('/entries', [EntryController::class, 'index']);
    Route::delete('/entries/{id}', [EntryController::class, 'destroy']);
});
