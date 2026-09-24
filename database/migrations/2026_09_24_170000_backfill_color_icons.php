<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Colors seeded before the icon column existed have a null icon, so the
    // client falls back to the same lotus for every color. Only fills blanks,
    // leaving any icon already set (e.g. via Filament) alone.
    public function up(): void
    {
        $icons = [
            'Indigo' => 'lotus-indigo.png',
            'Teal' => 'lotus-teal.png',
            'Sage' => 'lotus-sage.png',
            'Gold' => 'lotus-gold.png',
            'Peach' => 'lotus-peach.png',
            'Pink' => 'lotus-pink.png',
            'Lilac' => 'lotus-lilac.png',
            'Ember' => 'lotus-ember.png',
            'Tangerine' => 'lotus-tangerine.png',
            'Voltage' => 'lotus-voltage.png',
            'Smoke' => 'lotus-smoke.png',
        ];

        foreach ($icons as $name => $icon) {
            DB::table('colors')
                ->where('name', $name)
                ->where(fn ($q) => $q->whereNull('icon')->orWhere('icon', ''))
                ->update(['icon' => $icon]);
        }
    }

    public function down(): void
    {
        //
    }
};
