<?php

use App\Models\Color;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('fills blank color icons by name without overwriting set ones', function () {
    $blank = Color::create(['name' => 'Teal', 'hex' => '#4f8f86', 'icon' => null]);
    $custom = Color::create(['name' => 'Gold', 'hex' => '#b79239', 'icon' => 'lotus-peach.png']);

    (require database_path('migrations/2026_09_24_170000_backfill_color_icons.php'))->up();

    expect($blank->fresh()->icon)->toBe('lotus-teal.png');
    expect($custom->fresh()->icon)->toBe('lotus-peach.png');
});
