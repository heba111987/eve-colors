<?php

use App\Models\Activity;
use App\Models\Color;
use App\Models\Question;
use App\Models\User;
use App\Models\UserResponse;
use App\Services\FlowerPlacer;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns coordinates within the 0-100 bounds', function () {
    $user = User::factory()->create();

    $placer = new FlowerPlacer();
    [$x, $y] = $placer->place($user);

    expect($x)->toBeGreaterThanOrEqual(0)->toBeLessThanOrEqual(100);
    expect($y)->toBeGreaterThanOrEqual(0)->toBeLessThanOrEqual(100);
});

it('avoids placing a new flower on top of an existing one when possible', function () {
    $user = User::factory()->create();
    $color = Color::create(['name' => 'Teal', 'hex' => '#4f8f86']);
    $question = Question::create(['text' => 'Q', 'quadrant' => 'mental']);
    $activity = Activity::create(['text' => 'A', 'quadrant' => 'physical']);

    UserResponse::create([
        'user_id' => $user->id, 'color_id' => $color->id, 'question_id' => $question->id,
        'activity_id' => $activity->id, 'entry_date' => now()->subDay()->toDateString(),
        'flower_x' => 50.0, 'flower_y' => 50.0,
    ]);

    $placer = new FlowerPlacer();
    [$x, $y] = $placer->place($user);

    $tooClose = abs($x - 50.0) < 5 && abs($y - 50.0) < 5;
    expect($tooClose)->toBeFalse();
});
