<?php

use App\Models\Activity;
use App\Models\Color;
use App\Models\Question;
use App\Models\User;
use App\Models\UserResponse;

it('creates a color, question, activity, and a linked user response', function () {
    $user = User::factory()->create();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $question = Question::create(['text' => 'Q?', 'quadrant' => 'mental']);
    $activity = Activity::create(['text' => 'Walk.', 'quadrant' => 'physical']);

    $response = UserResponse::create([
        'user_id' => $user->id,
        'color_id' => $color->id,
        'question_id' => $question->id,
        'activity_id' => $activity->id,
        'entry_date' => now()->toDateString(),
    ]);

    expect($response->user->id)->toBe($user->id);
    expect($response->color->name)->toBe('Teal');
    expect($response->question->quadrant)->toBe(\App\Enums\Quadrant::Mental);
    expect($response->activity->quadrant)->toBe(\App\Enums\Quadrant::Physical);
});

it('enforces one entry per user per day', function () {
    $user = User::factory()->create();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $question = Question::create(['text' => 'Q?', 'quadrant' => 'mental']);

    UserResponse::create([
        'user_id' => $user->id, 'color_id' => $color->id, 'question_id' => $question->id,
        'entry_date' => '2026-09-21',
    ]);

    expect(fn () => UserResponse::create([
        'user_id' => $user->id, 'color_id' => $color->id, 'question_id' => $question->id,
        'entry_date' => '2026-09-21',
    ]))->toThrow(\Illuminate\Database\QueryException::class);
});

it('cascades user deletion to their user_responses', function () {
    $user = User::factory()->create();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $question = Question::create(['text' => 'Q?', 'quadrant' => 'mental']);
    $response = UserResponse::create([
        'user_id' => $user->id, 'color_id' => $color->id, 'question_id' => $question->id,
        'entry_date' => now()->toDateString(),
    ]);

    $user->delete();

    expect(UserResponse::find($response->id))->toBeNull();
});
