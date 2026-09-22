<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserResponse extends Model
{
    protected $fillable = [
        'user_id', 'color_id', 'question_id', 'answer_text',
        'activity_id', 'activity_completed', 'entry_date',
        'flower_x', 'flower_y', 'completed_at',
    ];

    protected $casts = [
        'activity_completed' => 'boolean',
        'entry_date' => 'date',
        'flower_x' => 'float',
        'flower_y' => 'float',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function color(): BelongsTo
    {
        return $this->belongsTo(Color::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class);
    }
}
