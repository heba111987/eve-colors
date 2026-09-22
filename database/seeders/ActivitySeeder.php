<?php

namespace Database\Seeders;

use App\Models\Activity;
use Illuminate\Database\Seeder;

class ActivitySeeder extends Seeder
{
    public function run(): void
    {
        $activities = [
            ['text' => 'Take three unhurried breaths and let your shoulders soften.', 'quadrant' => 'physical'],
            ['text' => 'Write one sentence beginning, "What I know right now is…"', 'quadrant' => 'spiritual'],
            ['text' => 'Take one small action that honors that truth without requiring complete certainty.', 'quadrant' => 'mental'],
            ['text' => 'Notice both feet and name three things you can see around you.', 'quadrant' => 'physical'],
            ['text' => 'Identify the one need that matters most in this moment.', 'quadrant' => 'mental'],
            ['text' => 'Choose one practical step—water, food, rest, fresh air, or a clear boundary.', 'quadrant' => 'physical'],
            ['text' => 'Lower your pace for one minute and lengthen each exhale.', 'quadrant' => 'physical'],
            ['text' => 'Name one expectation you can soften or postpone today.', 'quadrant' => 'emotional'],
            ['text' => 'Give yourself ten quiet minutes for rest, stretching, or time outside.', 'quadrant' => 'physical'],
            ['text' => 'Name the idea or possibility that gives you the most energy.', 'quadrant' => 'mental'],
            ['text' => 'Turn it into a step you can finish in ten minutes or less.', 'quadrant' => 'mental'],
            ['text' => 'Start before you feel fully ready, then acknowledge that you moved forward.', 'quadrant' => 'mental'],
            ['text' => 'Ask what kind of care would feel nourishing rather than demanding.', 'quadrant' => 'emotional'],
            ['text' => 'Reach toward one safe person or comforting practice.', 'quadrant' => 'emotional'],
            ['text' => 'Share one small act of warmth while keeping your own limits intact.', 'quadrant' => 'emotional'],
            ['text' => 'Place a hand over your heart and take one slow, comfortable breath.', 'quadrant' => 'physical'],
            ['text' => 'Replace one harsh thought with words that are honest and compassionate.', 'quadrant' => 'mental'],
            ['text' => 'Do one small thing that makes today easier for your future self.', 'quadrant' => 'emotional'],
            ['text' => 'Put away one source of stimulation for five minutes.', 'quadrant' => 'spiritual'],
            ['text' => 'Notice the thought, feeling, or body sensation that keeps returning.', 'quadrant' => 'spiritual'],
            ['text' => 'Record what you noticed and choose whether it needs action, patience, or support.', 'quadrant' => 'mental'],
            ['text' => 'Unclench your jaw, lower your shoulders, and press both feet firmly into the floor.', 'quadrant' => 'physical'],
            ['text' => 'Complete the sentence, "What I need or wish were different is…"', 'quadrant' => 'emotional'],
            ['text' => 'Choose one respectful next step, or give yourself time before responding.', 'quadrant' => 'mental'],
            ['text' => 'Write down your open loops and circle only the one that matters now.', 'quadrant' => 'mental'],
            ['text' => 'Look away from the screen, sip water, and take three comfortable breaths.', 'quadrant' => 'physical'],
            ['text' => 'Give the circled task five uninterrupted minutes, then reassess.', 'quadrant' => 'mental'],
            ['text' => 'Walk, stretch, or shake out your hands for one or two minutes.', 'quadrant' => 'physical'],
            ['text' => 'Notice five things you can see and three physical sensations you can feel.', 'quadrant' => 'physical'],
            ['text' => 'Choose one absorbing, low-stakes activity and stay with it for ten minutes.', 'quadrant' => 'mental'],
            ['text' => 'Postpone, delegate, or remove one nonessential demand.', 'quadrant' => 'mental'],
            ['text' => 'Drink water and let your exhale be a little longer than your inhale.', 'quadrant' => 'physical'],
            ['text' => 'Identify the smallest next step, or decide that rest is the next step.', 'quadrant' => 'mental'],
        ];

        foreach ($activities as $activity) {
            Activity::create($activity);
        }
    }
}
