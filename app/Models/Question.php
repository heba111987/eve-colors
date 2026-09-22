<?php

namespace App\Models;

use App\Enums\Quadrant;
use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    protected $fillable = ['text', 'quadrant', 'active'];

    protected $casts = [
        'quadrant' => Quadrant::class,
        'active' => 'boolean',
    ];
}
