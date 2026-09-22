const LOTUS_ICONS: Record<string, number> = {
  'lotus-indigo.png': require('../assets/images/lotus-indigo.png'),
  'lotus-teal.png': require('../assets/images/lotus-teal.png'),
  'lotus-sage.png': require('../assets/images/lotus-sage.png'),
  'lotus-gold.png': require('../assets/images/lotus-gold.png'),
  'lotus-peach.png': require('../assets/images/lotus-peach.png'),
  'lotus-pink.png': require('../assets/images/lotus-pink.png'),
  'lotus-lilac.png': require('../assets/images/lotus-lilac.png'),
  'lotus-ember.png': require('../assets/images/lotus-ember.png'),
  'lotus-tangerine.png': require('../assets/images/lotus-tangerine.png'),
  'lotus-voltage.png': require('../assets/images/lotus-voltage.png'),
  'lotus-smoke.png': require('../assets/images/lotus-smoke.png'),
};

export function iconSource(icon: string): number {
  return LOTUS_ICONS[icon] ?? LOTUS_ICONS['lotus-sage.png'];
}
