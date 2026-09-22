<?php

use App\Models\Activity;
use App\Services\ActivitySelector;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns an active activity', function () {
    $activity = Activity::create(['text' => 'A', 'quadrant' => 'physical']);

    $selector = new ActivitySelector();
    expect($selector->pick()->id)->toBe($activity->id);
});

it('excludes the given activity when another is available', function () {
    $ta = Activity::create(['text' => 'A', 'quadrant' => 'physical']);
    $tb = Activity::create(['text' => 'B', 'quadrant' => 'physical']);

    $selector = new ActivitySelector();
    for ($i = 0; $i < 10; $i++) {
        expect($selector->pick($ta->id)->id)->toBe($tb->id);
    }
});

it('falls back to the excluded activity if it is the only one available', function () {
    $ta = Activity::create(['text' => 'A', 'quadrant' => 'physical']);

    $selector = new ActivitySelector();
    expect($selector->pick($ta->id)->id)->toBe($ta->id);
});

it('throws when there are no active activities at all', function () {
    $selector = new ActivitySelector();
    expect(fn () => $selector->pick())->toThrow(RuntimeException::class);
});
