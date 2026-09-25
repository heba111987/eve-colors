import { router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { LegalLinks } from '../components/LegalLinks';
import { theme } from '../lib/theme';

const STEPS = [
  { image: require('../assets/images/lotus-peach.png'), tint: '#fde9dc', title: '1 — Choose', body: 'Pick the color that feels most like you today.' },
  { image: require('../assets/images/lotus-lilac.png'), tint: '#efe6f7', title: '2 — Reflect', body: 'Receive a thoughtful prompt and write only what you want to keep.' },
  { image: require('../assets/images/lotus-teal.png'), tint: '#ddf0ec', title: '3 — Notice', body: 'Return to your garden and see your moments gather over time.' },
];

export default function Intro() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.brand}>
          <Image source={require('../assets/images/icon.png')} style={styles.brandMark} resizeMode="contain" />
          <Text style={styles.brandName}>Eve Colors</Text>
        </View>
        <Text style={styles.kicker}>A small ritual that grows with you</Text>
        <Text style={styles.title}>Three gentle steps. One private ritual.</Text>

        <View style={{ gap: 10 }}>
          {STEPS.map((step) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={[styles.stepIconWrap, { backgroundColor: step.tint }]}>
                <Image source={step.image} style={styles.stepIcon} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flex: 1, minHeight: theme.space[6] }} />
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Button title="Ready" onPress={() => router.push('/intro2')} />
        <LegalLinks />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center' },
  content: { flex: 1, width: '100%', maxWidth: 440, padding: theme.space[6] },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.space[8] },
  brandMark: { width: 30, height: 30 },
  brandName: { fontFamily: theme.font.heading, fontSize: 17, color: theme.colors.text },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#5f8f88', marginBottom: theme.space[2] },
  title: { fontFamily: theme.font.heading, fontSize: 32, lineHeight: 35, color: theme.colors.text, marginBottom: theme.space[6], maxWidth: 260 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: 22, padding: 12, paddingLeft: 12 },
  stepIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  stepIcon: { width: 44, height: 44 },
  stepTitle: { fontFamily: theme.font.heading, fontSize: 16, color: theme.colors.text },
  stepBody: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 19, color: theme.colors.neutral700, marginTop: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: theme.space[4] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent200 },
  dotActive: { width: 20, backgroundColor: theme.colors.accent600 },
});
