import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMe } from '../lib/hooks/useMe';
import { theme } from '../lib/theme';

export function AppHeader() {
  const { data: me } = useMe();

  return (
    <View style={styles.row}>
      <Pressable style={styles.brand} onPress={() => router.push('/today')}>
        <Image source={require('../assets/images/icon.png')} style={styles.brandMark} resizeMode="contain" />
        <Text style={styles.brandName}>Eve Colors</Text>
      </Pressable>
      <Pressable style={styles.moments} onPress={() => router.push('/garden')}>
        <Text style={styles.momentsLabel}>My Eve Moments</Text>
        <View style={styles.momentsBadge}>
          <Text style={styles.momentsCount}>{me?.momentCount ?? 0}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space[4], paddingTop: theme.space[4], paddingBottom: theme.space[2], maxWidth: 440, width: '100%', alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 30, height: 30 },
  brandName: { fontFamily: theme.font.heading, fontSize: 17, color: theme.colors.text },
  moments: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.pill, paddingVertical: 6, paddingHorizontal: 6, paddingLeft: 14 },
  momentsLabel: { fontFamily: theme.font.bodySemibold, fontSize: 12.5, color: theme.colors.text },
  momentsBadge: { minWidth: 24, height: 24, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent200, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  momentsCount: { fontFamily: theme.font.bodySemibold, fontSize: 12, color: theme.colors.accent800 },
});
