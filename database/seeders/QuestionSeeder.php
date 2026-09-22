<?php

namespace Database\Seeders;

use App\Models\Question;
use Illuminate\Database\Seeder;

class QuestionSeeder extends Seeder
{
    public function run(): void
    {
        $questions = [
            ['text' => 'What truth do you already know but need to trust?', 'quadrant' => 'spiritual'],
            ['text' => 'What would help you feel steady in this moment?', 'quadrant' => 'physical'],
            ['text' => 'Where can you give yourself permission to slow down?', 'quadrant' => 'emotional'],
            ['text' => 'What possibility feels worth taking one small step toward?', 'quadrant' => 'mental'],
            ['text' => 'What do you need to receive—or offer—with openness?', 'quadrant' => 'emotional'],
            ['text' => 'How can you speak to yourself with more kindness today?', 'quadrant' => 'emotional'],
            ['text' => 'What is your intuition quietly asking you to notice?', 'quadrant' => 'spiritual'],
            ['text' => 'What is your frustration trying to protect or change?', 'quadrant' => 'emotional'],
            ['text' => 'What can you set down so one thing can receive your attention?', 'quadrant' => 'mental'],
            ['text' => 'What kind of movement or focus would help this energy feel useful?', 'quadrant' => 'physical'],
            ['text' => 'What is the smallest burden you can reduce right now?', 'quadrant' => 'physical'],
        ];

        foreach ($questions as $question) {
            Question::create($question);
        }
    }
}
