<?php

namespace Database\Seeders;

use App\Models\Color;
use Illuminate\Database\Seeder;

class ColorSeeder extends Seeder
{
    public function run(): void
    {
        $colors = [
            ['name' => 'Indigo', 'hex' => '#34435f'],
            ['name' => 'Teal', 'hex' => '#4f8f86'],
            ['name' => 'Sage', 'hex' => '#859873'],
            ['name' => 'Gold', 'hex' => '#b79239'],
            ['name' => 'Peach', 'hex' => '#c48665'],
            ['name' => 'Pink', 'hex' => '#b85e78'],
            ['name' => 'Lilac', 'hex' => '#75658d'],
            ['name' => 'Ember', 'hex' => '#9f493d'],
            ['name' => 'Tangerine', 'hex' => '#c96f35'],
            ['name' => 'Voltage', 'hex' => '#5868a6'],
            ['name' => 'Smoke', 'hex' => '#68716d'],
        ];

        foreach ($colors as $color) {
            Color::create($color);
        }
    }
}
