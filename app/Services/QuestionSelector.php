<?php

namespace App\Services;

use App\Models\Question;
use App\Models\User;
use App\Models\UserResponse;
use RuntimeException;

class QuestionSelector
{
    public function pick(User $user): Question
    {
        $sevenDaysAgo = now()->subDays(7);
        $excludedIds = UserResponse::where('user_id', $user->id)
            ->where('created_at', '>=', $sevenDaysAgo)
            ->pluck('question_id');

        $eligible = Question::where('active', true)->whereNotIn('id', $excludedIds)->get();
        if ($eligible->isNotEmpty()) {
            return $eligible->random();
        }

        $lastUsedAtByQuestion = UserResponse::where('user_id', $user->id)
            ->selectRaw('question_id, MAX(created_at) as last_used')
            ->groupBy('question_id')
            ->pluck('last_used', 'question_id');

        $fallback = Question::where('active', true)
            ->get()
            ->sortBy(fn (Question $question) => $lastUsedAtByQuestion[$question->id] ?? '')
            ->first();

        if (! $fallback) {
            throw new RuntimeException('No active questions available.');
        }

        return $fallback;
    }
}
