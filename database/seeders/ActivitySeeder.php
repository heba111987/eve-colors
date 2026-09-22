<?php

namespace Database\Seeders;

use App\Models\Activity;
use Illuminate\Database\Seeder;

class ActivitySeeder extends Seeder
{
    public function run(): void
    {
        $activities = [
            ['text' => 'Take three unhurried breaths and let your shoulders soften.', 'quadrant' => 'physical', 'note' => 'Your nervous system responds to the pace you set; slowing your breath signals that you are safe.'],
            ['text' => 'Write one sentence beginning, "What I know right now is…"', 'quadrant' => 'spiritual', 'note' => 'Clarity often arrives not through thinking more, but through naming what is already true beneath the doubt.'],
            ['text' => 'Take one small action that honors that truth without requiring complete certainty.', 'quadrant' => 'mental', 'note' => 'Movement does not demand confidence; it only asks that you choose what matters more than the fear.'],
            ['text' => 'Notice both feet and name three things you can see around you.', 'quadrant' => 'physical', 'note' => 'Grounding yourself in sensory detail quiets the constant what-if chatter and brings you into the present.'],
            ['text' => 'Identify the one need that matters most in this moment.', 'quadrant' => 'mental', 'note' => 'When everything feels urgent, the clearest path forward often emerges from asking what would serve you first.'],
            ['text' => 'Choose one practical step—water, food, rest, fresh air, or a clear boundary.', 'quadrant' => 'physical', 'note' => 'Sometimes the wisest decision is the smallest one: meeting a basic need calms both body and mind.'],
            ['text' => 'Lower your pace for one minute and lengthen each exhale.', 'quadrant' => 'physical', 'note' => 'When you extend your exhale, your heart rate settles and your whole system follows.'],
            ['text' => 'Name one expectation you can soften or postpone today.', 'quadrant' => 'emotional', 'note' => 'You do not have to prove anything today; releasing one "should" frees energy for what actually matters.'],
            ['text' => 'Give yourself ten quiet minutes for rest, stretching, or time outside.', 'quadrant' => 'physical', 'note' => 'Even small pockets of restoration compound over time and refresh your capacity to show up.'],
            ['text' => 'Name the idea or possibility that gives you the most energy.', 'quadrant' => 'mental', 'note' => 'Energy itself is data; noticing what enlivens you shows you where your genuine pull and curiosity lie.'],
            ['text' => 'Turn it into a step you can finish in ten minutes or less.', 'quadrant' => 'mental', 'note' => 'A manageable task prevents overwhelm and builds momentum through quick wins.'],
            ['text' => 'Start before you feel fully ready, then acknowledge that you moved forward.', 'quadrant' => 'mental', 'note' => 'Readiness follows action more often than it precedes it; acknowledge the courage it took to begin.'],
            ['text' => 'Ask what kind of care would feel nourishing rather than demanding.', 'quadrant' => 'emotional', 'note' => 'Care that feels like another obligation depletes you; true nourishment feels like a gift, not a chore.'],
            ['text' => 'Reach toward one safe person or comforting practice.', 'quadrant' => 'emotional', 'note' => 'Connection—whether with a person or a practice—reminds you that you do not have to carry this alone.'],
            ['text' => 'Share one small act of warmth while keeping your own limits intact.', 'quadrant' => 'emotional', 'note' => 'Generosity that honors your own boundaries teaches both you and others what healthy love looks like.'],
            ['text' => 'Place a hand over your heart and take one slow, comfortable breath.', 'quadrant' => 'physical', 'note' => 'This simple gesture sends a signal of safety and compassion directly to your own nervous system.'],
            ['text' => 'Replace one harsh thought with words that are honest and compassionate.', 'quadrant' => 'mental', 'note' => 'The voice in your head shapes your resilience; speaking to yourself as you would a friend changes everything.'],
            ['text' => 'Do one small thing that makes today easier for your future self.', 'quadrant' => 'emotional', 'note' => 'Small acts of care compound and create a foundation of respect between who you are now and who you are becoming.'],
            ['text' => 'Put away one source of stimulation for five minutes.', 'quadrant' => 'spiritual', 'note' => 'Silence and stillness, even briefly, create space for what matters to become visible.'],
            ['text' => 'Notice the thought, feeling, or body sensation that keeps returning.', 'quadrant' => 'spiritual', 'note' => 'What repeats is often trying to tell you something; listening to it reveals wisdom beneath the noise.'],
            ['text' => 'Record what you noticed and choose whether it needs action, patience, or support.', 'quadrant' => 'mental', 'note' => 'Writing clarifies which signals require your immediate response and which ones ask you simply to witness and wait.'],
            ['text' => 'Unclench your jaw, lower your shoulders, and press both feet firmly into the floor.', 'quadrant' => 'physical', 'note' => 'Tension lives in specific places; releasing these anchor points naturally releases the holding patterns throughout your body.'],
            ['text' => 'Complete the sentence, "What I need or wish were different is…"', 'quadrant' => 'emotional', 'note' => 'Naming your longing, even when it cannot be immediately met, transforms longing into clarity about what matters.'],
            ['text' => 'Choose one respectful next step, or give yourself time before responding.', 'quadrant' => 'mental', 'note' => 'A delayed response chosen consciously is far more powerful than an immediate reaction driven by hurt.'],
            ['text' => 'Write down your open loops and circle only the one that matters now.', 'quadrant' => 'mental', 'note' => 'Externalizing everything you are holding lets you see clearly which single item deserves your focus first.'],
            ['text' => 'Look away from the screen, sip water, and take three comfortable breaths.', 'quadrant' => 'physical', 'note' => 'Breaking your visual focus and hydrating your body resets your attention and refreshes your clarity.'],
            ['text' => 'Give the circled task five uninterrupted minutes, then reassess.', 'quadrant' => 'mental', 'note' => 'Five focused minutes of forward momentum often shifts your sense of what is possible.'],
            ['text' => 'Walk, stretch, or shake out your hands for one or two minutes.', 'quadrant' => 'physical', 'note' => 'Moving your body discharges the stagnant energy that keeps your mind spinning in circles.'],
            ['text' => 'Notice five things you can see and three physical sensations you can feel.', 'quadrant' => 'physical', 'note' => 'Anchoring your awareness in concrete sensory detail pulls you out of thought loops and back into the present.'],
            ['text' => 'Choose one absorbing, low-stakes activity and stay with it for ten minutes.', 'quadrant' => 'mental', 'note' => 'Gentle absorption—something that holds your focus without demanding results—gives your nervous system a chance to settle.'],
            ['text' => 'Postpone, delegate, or remove one nonessential demand.', 'quadrant' => 'mental', 'note' => 'Each demand you release creates space for what actually aligns with your priorities and your energy.'],
            ['text' => 'Drink water and let your exhale be a little longer than your inhale.', 'quadrant' => 'physical', 'note' => 'Hydration and extended exhales are two simple, powerful tools your body provides for returning to ease.'],
            ['text' => 'Identify the smallest next step, or decide that rest is the next step.', 'quadrant' => 'mental', 'note' => 'Sometimes forward motion means moving, and sometimes it means stopping; both are choices that require wisdom.'],
        ];

        foreach ($activities as $activity) {
            Activity::create($activity);
        }
    }
}
