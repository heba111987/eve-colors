<?php

namespace Database\Seeders;

use App\Models\Color;
use Illuminate\Database\Seeder;

class ColorSeeder extends Seeder
{
    public function run(): void
    {
        $colors = [
            ['name' => 'Indigo', 'hex' => '#34435f', 'description' => 'Indigo can reflect a quiet, inward moment when you are trying to hear your own wisdom beneath the noise.', 'icon' => 'lotus-indigo.png'],
            ['name' => 'Teal', 'hex' => '#4f8f86', 'description' => 'Teal can reflect a wish for steadiness, clarity, and a calmer place from which to decide what comes next.', 'icon' => 'lotus-teal.png'],
            ['name' => 'Sage', 'hex' => '#859873', 'description' => 'Sage can reflect a need for gentleness, restoration, and permission to move at a more sustainable pace.', 'icon' => 'lotus-sage.png'],
            ['name' => 'Gold', 'hex' => '#b79239', 'description' => 'Gold can reflect hope, creative energy, or a possibility that wants a little room to grow.', 'icon' => 'lotus-gold.png'],
            ['name' => 'Peach', 'hex' => '#c48665', 'description' => 'Peach can reflect openness, warmth, and a desire to feel cared for or connected without overextending yourself.', 'icon' => 'lotus-peach.png'],
            ['name' => 'Pink', 'hex' => '#b85e78', 'description' => 'Pink can reflect tenderness and a need to meet yourself with the same kindness you would offer someone you love.', 'icon' => 'lotus-pink.png'],
            ['name' => 'Lilac', 'hex' => '#75658d', 'description' => 'Lilac can reflect introspection, imagination, and a need for quiet enough to notice what is happening within you.', 'icon' => 'lotus-lilac.png'],
            ['name' => 'Ember', 'hex' => '#9f493d', 'description' => 'Ember may reflect frustration or tension. It does not define you; it may simply be a signal that something needs care or a clearer boundary.', 'icon' => 'lotus-ember.png'],
            ['name' => 'Tangerine', 'hex' => '#c96f35', 'description' => 'Tangerine may reflect a frazzled or scattered moment when too many demands are competing for your attention.', 'icon' => 'lotus-tangerine.png'],
            ['name' => 'Voltage', 'hex' => '#5868a6', 'description' => 'Voltage may reflect restlessness or heightened energy. You can work with that energy without judging or diagnosing it.', 'icon' => 'lotus-voltage.png'],
            ['name' => 'Smoke', 'hex' => '#68716d', 'description' => 'Smoke may reflect overload or depletion—a moment when your capacity feels smaller than what is being asked of you.', 'icon' => 'lotus-smoke.png'],
        ];

        foreach ($colors as $color) {
            Color::create($color);
        }
    }
}
