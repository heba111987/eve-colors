<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResponseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'color' => [
                'id' => $this->color->id,
                'name' => $this->color->name,
                'hex' => $this->color->hex,
                'icon' => $this->color->icon,
            ],
            'answerText' => $this->answer_text,
            'activityCompleted' => $this->activity_completed,
            'entryDate' => $this->entry_date->toDateString(),
            'flowerX' => $this->flower_x,
            'flowerY' => $this->flower_y,
            'question' => [
                'id' => $this->question->id,
                'text' => $this->question->text,
                'quadrant' => $this->question->quadrant->value,
            ],
            'activity' => $this->activity_id !== null ? [
                'id' => $this->activity->id,
                'text' => $this->activity->text,
                'note' => $this->activity->note,
                'quadrant' => $this->activity->quadrant->value,
            ] : null,
        ];
    }
}
