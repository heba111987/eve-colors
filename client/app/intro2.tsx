import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { LegalLinks } from '../components/LegalLinks';
import { theme } from '../lib/theme';

const SCENE = [
  { image: require('../assets/images/lotus-lilac.png'), size: 46 },
  { image: require('../assets/images/lotus-teal.png'), size: 54 },
  { image: require('../assets/images/lotus-gold.png'), size: 46 },
  { image: require('../assets/images/lotus-peach.png'), size: 62 },
  { image: require('../assets/images/lotus-pink.png'), size: 46 },
  { image: require('../assets/images/lotus-sage.png'), size: 54 },
];

export default function Intro2() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('../assets/images/icon.png')} style={styles.brandMark} resizeMode="contain" />
            <Text style={styles.brandName}>Eve Colors</Text>
          </View>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>No streaks. No falling behind.</Text>
          <Text style={styles.title}>Your moments become a garden.</Text>
          <Text style={styles.body}>
            Each reflection plants a flower dated to that moment. There are no streaks to protect and no falling
            behind—your garden simply grows whenever you return.
          </Text>
          <View style={styles.scene}>
            <View style={styles.sceneGround} />
            <View style={styles.sceneRow}>
              {SCENE.map((f, i) => (
                <View key={i} style={{ alignItems: 'center' }}>
                  <Image source={f.image} style={{ width: f.size, height: f.size }} resizeMode="contain" />
                  <View style={[styles.stem, { height: 20 + (i % 3) * 8 }]} />
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ flex: 1, minHeight: theme.space[6] }} />
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>
        <Button title="Set" onPress={() => router.push('/sign-in')} />
        <LegalLinks />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center' },
  content: { flex: 1, width: '100%', maxWidth: 440, padding: theme.space[6] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space[8] },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 30, height: 30 },
  brandName: { fontFamily: theme.font.heading, fontSize: 17, color: theme.colors.text },
  back: { fontFamily: theme.font.heading, fontSize: 13, color: theme.colors.accent700 },
  card: { borderRadius: 28, backgroundColor: '#e9f4ee', padding: theme.space[4], paddingBottom: 0, overflow: 'hidden' },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#5f8f88', marginBottom: theme.space[2] },
  title: { fontFamily: theme.font.heading, fontSize: 30, lineHeight: 33, color: theme.colors.text, marginBottom: theme.space[3], maxWidth: 220 },
  body: { fontFamily: theme.font.body, fontSize: 14.5, lineHeight: 23, color: theme.colors.neutral800, maxWidth: 320 },
  scene: { height: 150, marginTop: theme.space[4], marginHorizontal: -theme.space[4] },
  sceneGround: { position: 'absolute', left: 0, right: 0, bottom: -54, height: 118, borderRadius: 999, backgroundColor: '#d8ecdd' },
  sceneRow: { position: 'absolute', left: 0, right: 0, bottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  stem: { width: 3, borderRadius: 2, backgroundColor: '#a8c4a6', marginTop: -4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: theme.space[4] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent200 },
  dotActive: { width: 20, backgroundColor: theme.colors.accent600 },
});
