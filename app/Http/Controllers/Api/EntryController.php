<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResponseResource;
use App\Models\UserResponse;
use App\Services\QuestionSelector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EntryController extends Controller
{
    public function today(Request $request): JsonResponse
    {
        $entry = UserResponse::where('user_id', $request->user()->id)
            ->whereDate('entry_date', now()->toDateString())
            ->first();

        return response()->json(['entry' => $entry ? new UserResponseResource($entry) : null]);
    }

    public function store(Request $request, QuestionSelector $questionSelector): JsonResponse
    {
        $data = $request->validate(['color_id' => ['required', 'integer', 'exists:colors,id']]);
        $user = $request->user();
        $today = now()->toDateString();

        $existing = UserResponse::where('user_id', $user->id)->whereDate('entry_date', $today)->exists();
        if ($existing) {
            return response()->json(['error' => 'entry_already_exists_today'], 409);
        }

        $question = $questionSelector->pick($user);

        $entry = UserResponse::create([
            'user_id' => $user->id,
            'color_id' => $data['color_id'],
            'question_id' => $question->id,
            'entry_date' => $today,
        ]);

        return response()->json(['entry' => new UserResponseResource($entry)], 201);
    }
}
