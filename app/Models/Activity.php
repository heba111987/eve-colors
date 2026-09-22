<?php

namespace App\Models;

use App\Enums\Quadrant;
use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    protected $fillable = ['text', 'note', 'quadrant', 'active'];

    protected $casts = [
        'quadrant' => Quadrant::class,
        'active' => 'boolean',
    ];
}
