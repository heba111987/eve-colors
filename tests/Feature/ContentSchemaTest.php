<?php

use App\Models\Activity;
use App\Models\Color;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds every color with a non-empty icon filename', function () {
    (new \Database\Seeders\ColorSeeder())->run();

    expect(Color::count())->toBe(11);
    Color::all()->each(function (Color $color) {
        expect($color->icon)->not->toBeNull()->not->toBe('');
        expect($color->icon)->toMatch('/^lotus-[a-z]+\.png$/');
    });
});

it('seeds every activity with a non-empty note', function () {
    (new \Database\Seeders\ActivitySeeder())->run();

    expect(Activity::count())->toBe(33);
    Activity::all()->each(function (Activity $activity) {
        expect($activity->note)->not->toBeNull()->not->toBe('');
    });
});
