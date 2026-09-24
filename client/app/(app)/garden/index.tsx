import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEntries } from '../../../lib/hooks/useEntries';
import { iconSource } from '../../../lib/icons';
import { theme } from '../../../lib/theme';
import { AppHeader } from '../../../components/AppHeader';
import { Button } from '../../../components/Button';

const SCENE_HEIGHT = 220;

export default function Garden() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useEntries();

  const entries = (data?.pages ?? []).flatMap((p) => p.entries);
  const total = data?.pages[0]?.total ?? 0;
  const planted = entries.filter(
    (e): e is typeof e & { flowerX: number; flowerY: number } => e.flowerX !== null && e.flowerY !== null,
  );

  if (isLoading) return null;

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h2}>My Garden</Text>
      <Text style={styles.subtitle}>{total} {total === 1 ? 'day' : 'days'}, all yours. Tap any flower to read it back.</Text>

      <View style={styles.scene}>
        {planted.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => router.push(`/garden/${e.id}`)}
            style={[
              styles.flower,
              { left: `${e.flowerX}%`, top: `${e.flowerY}%` },
            ]}
          >
            <Image source={iconSource(e.color.icon)} style={styles.flowerIcon} resizeMode="contain" />
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 10, marginTop: theme.space[6] }}>
        {entries.map((e) => (
          <Pressable key={e.id} onPress={() => router.push(`/garden/${e.id}`)} style={styles.entryRow}>
            <Image source={iconSource(e.color.icon)} style={styles.entryIcon} resizeMode="contain" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', gap: 7, alignItems: 'baseline' }}>
                <Text style={styles.entryColorName}>{e.color.name}</Text>
                <Text style={styles.entryDate}>{e.entryDate}</Text>
              </View>
              <Text style={styles.entrySnippet} numberOfLines={1}>{e.answerText}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {hasNextPage && (
        <Button title="Load more" variant="secondary" onPress={() => fetchNextPage()} loading={isFetchingNextPage} style={{ marginTop: theme.space[4] }} />
      )}

      <Text style={styles.footnote}>Your garden is private. Nothing here is shared.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center' },
  h2: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text, marginBottom: theme.space[1] },
  subtitle: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.neutral700, marginBottom: theme.space[4] },
  scene: { height: SCENE_HEIGHT, borderRadius: theme.radius.lg, backgroundColor: theme.colors.accent2_100, position: 'relative', overflow: 'hidden' },
  flower: { position: 'absolute', width: 40, height: 40, marginLeft: -20, marginTop: -20 },
  flowerIcon: { width: '100%', height: '100%' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: 22, padding: 10 },
  entryIcon: { width: 48, height: 48 },
  entryColorName: { fontFamily: theme.font.heading, fontSize: 15, color: theme.colors.text },
  entryDate: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.neutral600 },
  entrySnippet: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.neutral700, marginTop: 2 },
  footnote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.neutral600, textAlign: 'center', marginTop: theme.space[6] },
});
