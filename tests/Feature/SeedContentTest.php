<?php

use App\Models\Activity;
use App\Models\Color;
use App\Models\Question;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds 11 colors, 11 questions, and 33 activities with valid quadrants', function () {
    $this->seed();

    expect(Color::count())->toBe(11);
    expect(Question::count())->toBe(11);
    expect(Activity::count())->toBe(33);

    Question::all()->each(fn ($q) => expect($q->quadrant)->toBeInstanceOf(\App\Enums\Quadrant::class));
    Activity::all()->each(fn ($a) => expect($a->quadrant)->toBeInstanceOf(\App\Enums\Quadrant::class));
});
