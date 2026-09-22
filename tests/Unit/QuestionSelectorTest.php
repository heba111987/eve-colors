<?php

use App\Models\Question;
use App\Models\User;
use App\Models\UserResponse;
use App\Models\Color;
use App\Services\QuestionSelector;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeUserResponseFor(User $user, Question $question, \Carbon\Carbon $createdAt): void
{
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $response = new UserResponse([
        'user_id' => $user->id,
        'color_id' => $color->id,
        'question_id' => $question->id,
        'entry_date' => $createdAt->toDateString(),
    ]);
    $response->timestamps = false;
    $response->created_at = $createdAt;
    $response->updated_at = $createdAt;
    $response->save();
}

it('excludes a question used within the last 7 days', function () {
    $user = User::factory()->create();
    $qa = Question::create(['text' => 'A', 'quadrant' => 'mental']);
    $qb = Question::create(['text' => 'B', 'quadrant' => 'mental']);
    makeUserResponseFor($user, $qa, now()->subDays(2));

    $selector = new QuestionSelector();
    for ($i = 0; $i < 10; $i++) {
        expect($selector->pick($user)->id)->toBe($qb->id);
    }
});

it('makes a question eligible again after 7 days', function () {
    $user = User::factory()->create();
    $qa = Question::create(['text' => 'A', 'quadrant' => 'mental']);
    makeUserResponseFor($user, $qa, now()->subDays(8));

    $selector = new QuestionSelector();
    expect($selector->pick($user)->id)->toBe($qa->id);
});

it('falls back to the least-recently-used question when the bank is exhausted', function () {
    $user = User::factory()->create();
    $qa = Question::create(['text' => 'A', 'quadrant' => 'mental']);
    $qb = Question::create(['text' => 'B', 'quadrant' => 'mental']);
    makeUserResponseFor($user, $qa, now()->subDays(3));
    makeUserResponseFor($user, $qb, now()->subDay());

    $selector = new QuestionSelector();
    expect($selector->pick($user)->id)->toBe($qa->id);
});
