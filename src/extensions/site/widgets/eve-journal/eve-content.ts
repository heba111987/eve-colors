export type EveColorName =
  | 'Indigo'
  | 'Teal'
  | 'Sage'
  | 'Gold'
  | 'Peach'
  | 'Pink'
  | 'Lilac'
  | 'Ember'
  | 'Tangerine'
  | 'Voltage'
  | 'Smoke';

export interface EvePrompt {
  color: EveColorName;
  hex: string;
  title: string;
  message: string;
  prompt: string;
  routine: {
    understanding: string;
    steps: readonly [string, string, string];
  };
}

export const EVE_PROMPTS: readonly EvePrompt[] = [
  {
    color: 'Indigo',
    hex: '#34435f',
    title: 'Trust what you know.',
    message: 'You don’t need complete certainty to honor what feels true.',
    prompt: 'What truth do you already know but need to trust?',
    routine: {
      understanding: 'Indigo can reflect a quiet, inward moment when you are trying to hear your own wisdom beneath the noise.',
      steps: [
        'Settle: Take three unhurried breaths and let your shoulders soften.',
        'Listen: Write one sentence beginning, “What I know right now is…”',
        'Choose: Take one small action that honors that truth without requiring complete certainty.',
      ],
    },
  },
  {
    color: 'Teal',
    hex: '#4f8f86',
    title: 'Return to your center.',
    message: 'Steadiness can begin with one small choice that supports you.',
    prompt: 'What would help you feel steady in this moment?',
    routine: {
      understanding: 'Teal can reflect a wish for steadiness, clarity, and a calmer place from which to decide what comes next.',
      steps: [
        'Ground: Notice both feet and name three things you can see around you.',
        'Simplify: Identify the one need that matters most in this moment.',
        'Support: Choose one practical step—water, food, rest, fresh air, or a clear boundary.',
      ],
    },
  },
  {
    color: 'Sage',
    hex: '#859873',
    title: 'Let gentleness lead.',
    message: 'Slowing down can be a form of strength, not a step backward.',
    prompt: 'Where can you give yourself permission to slow down?',
    routine: {
      understanding: 'Sage can reflect a need for gentleness, restoration, and permission to move at a more sustainable pace.',
      steps: [
        'Pause: Lower your pace for one minute and lengthen each exhale.',
        'Release: Name one expectation you can soften or postpone today.',
        'Restore: Give yourself ten quiet minutes for rest, stretching, or time outside.',
      ],
    },
  },
  {
    color: 'Gold',
    hex: '#b79239',
    title: 'Follow the spark.',
    message: 'You are allowed to move toward what feels hopeful and alive.',
    prompt: 'What possibility feels worth taking one small step toward?',
    routine: {
      understanding: 'Gold can reflect hope, creative energy, or a possibility that wants a little room to grow.',
      steps: [
        'Notice: Name the idea or possibility that gives you the most energy.',
        'Shape: Turn it into a step you can finish in ten minutes or less.',
        'Begin: Start before you feel fully ready, then acknowledge that you moved forward.',
      ],
    },
  },
  {
    color: 'Peach',
    hex: '#c48665',
    title: 'Stay open to care.',
    message: 'Warmth can begin with letting yourself receive what you need.',
    prompt: 'What do you need to receive—or offer—with openness?',
    routine: {
      understanding: 'Peach can reflect openness, warmth, and a desire to feel cared for or connected without overextending yourself.',
      steps: [
        'Receive: Ask what kind of care would feel nourishing rather than demanding.',
        'Connect: Reach toward one safe person or comforting practice.',
        'Offer: Share one small act of warmth while keeping your own limits intact.',
      ],
    },
  },
  {
    color: 'Pink',
    hex: '#b85e78',
    title: 'Choose kindness.',
    message: 'The way you speak to yourself shapes the space you move through.',
    prompt: 'How can you speak to yourself with more kindness today?',
    routine: {
      understanding: 'Pink can reflect tenderness and a need to meet yourself with the same kindness you would offer someone you love.',
      steps: [
        'Soften: Place a hand over your heart and take one slow, comfortable breath.',
        'Reframe: Replace one harsh thought with words that are honest and compassionate.',
        'Care: Do one small thing that makes today easier for your future self.',
      ],
    },
  },
  {
    color: 'Lilac',
    hex: '#75658d',
    title: 'Listen inward.',
    message: 'Your intuition does not always shout; sometimes it simply waits.',
    prompt: 'What is your intuition quietly asking you to notice?',
    routine: {
      understanding: 'Lilac can reflect introspection, imagination, and a need for quiet enough to notice what is happening within you.',
      steps: [
        'Quiet: Put away one source of stimulation for five minutes.',
        'Observe: Notice the thought, feeling, or body sensation that keeps returning.',
        'Honor: Record what you noticed and choose whether it needs action, patience, or support.',
      ],
    },
  },
  {
    color: 'Ember',
    hex: '#9f493d',
    title: 'Let the heat become information.',
    message: 'Frustration may be pointing toward a need, limit, or boundary that deserves attention.',
    prompt: 'What is your frustration trying to protect or change?',
    routine: {
      understanding: 'Ember may reflect frustration or tension. It does not define you; it may simply be a signal that something needs care or a clearer boundary.',
      steps: [
        'Discharge: Unclench your jaw, lower your shoulders, and press both feet firmly into the floor.',
        'Name: Complete the sentence, “What I need or wish were different is…”',
        'Pause: Choose one respectful next step, or give yourself time before responding.',
      ],
    },
  },
  {
    color: 'Tangerine',
    hex: '#c96f35',
    title: 'Gather what feels scattered.',
    message: 'You do not have to solve every open loop at the same time.',
    prompt: 'What can you set down so one thing can receive your attention?',
    routine: {
      understanding: 'Tangerine may reflect a frazzled or scattered moment when too many demands are competing for your attention.',
      steps: [
        'Triage: Write down your open loops and circle only the one that matters now.',
        'Reset: Look away from the screen, sip water, and take three comfortable breaths.',
        'Focus: Give the circled task five uninterrupted minutes, then reassess.',
      ],
    },
  },
  {
    color: 'Voltage',
    hex: '#5868a6',
    title: 'Give the energy somewhere to go.',
    message: 'Restless energy can be met with movement, grounding, and a clear place to land.',
    prompt: 'What kind of movement or focus would help this energy feel useful?',
    routine: {
      understanding: 'Voltage may reflect restlessness or heightened energy. You can work with that energy without judging or diagnosing it.',
      steps: [
        'Move: Walk, stretch, or shake out your hands for one or two minutes.',
        'Ground: Notice five things you can see and three physical sensations you can feel.',
        'Channel: Choose one absorbing, low-stakes activity and stay with it for ten minutes.',
      ],
    },
  },
  {
    color: 'Smoke',
    hex: '#68716d',
    title: 'Make the moment smaller.',
    message: 'When everything feels like too much, reducing the demand is a meaningful first step.',
    prompt: 'What is the smallest burden you can reduce right now?',
    routine: {
      understanding: 'Smoke may reflect overload or depletion—a moment when your capacity feels smaller than what is being asked of you.',
      steps: [
        'Reduce: Postpone, delegate, or remove one nonessential demand.',
        'Restore: Drink water and let your exhale be a little longer than your inhale.',
        'Choose: Identify the smallest next step, or decide that rest is the next step.',
      ],
    },
  },
] as const;

export const findPrompt = (color: string): EvePrompt | undefined =>
  EVE_PROMPTS.find((entry) => entry.color === color);

export const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const flowerMarkup = (
  color: EveColorName,
  hex: string,
  className = '',
): string => {
  const petals = Array.from({ length: 8 }, (_, index) =>
    `<span class="eve-petal" style="--petal-index:${index};--flower-color:${hex}"></span>`,
  ).join('');

  return `
    <div class="eve-flower ${className}" role="img" aria-label="${color} Eve flower">
      ${petals}
      <span class="eve-flower-center"></span>
    </div>
  `;
};
