<?php

namespace App\Services;

use App\Models\Activity;
use RuntimeException;

class ActivitySelector
{
    public function pick(?int $excludeActivityId = null): Activity
    {
        if ($excludeActivityId !== null) {
            $withExclusion = Activity::where('active', true)
                ->where('id', '!=', $excludeActivityId)
                ->get();

            if ($withExclusion->isNotEmpty()) {
                return $withExclusion->random();
            }
        }

        $all = Activity::where('active', true)->get();
        if ($all->isEmpty()) {
            throw new RuntimeException('No active activities available.');
        }

        return $all->random();
    }
}
