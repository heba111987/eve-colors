<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserResponse;

class FlowerPlacer
{
    /**
     * @return array{0: float, 1: float}
     */
    public function place(User $user): array
    {
        $existing = UserResponse::where('user_id', $user->id)
            ->whereNotNull('flower_x')
            ->get(['flower_x', 'flower_y']);

        $x = 0.0;
        $y = 0.0;

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $x = round(mt_rand(0, 10000) / 100, 2);
            $y = round(mt_rand(0, 10000) / 100, 2);

            $collision = $existing->contains(
                fn ($entry) => abs($entry->flower_x - $x) < 5 && abs($entry->flower_y - $y) < 5
            );

            if (! $collision) {
                break;
            }
        }

        return [$x, $y];
    }
}
