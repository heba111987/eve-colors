import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

export function LegalLinks() {
  return (
    <View style={styles.row}>
      <Link href="/privacy" style={styles.link}>Privacy Policy</Link>
      <Text style={styles.dot}>·</Text>
      <Link href="/terms" style={styles.link}>Terms of Service</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: theme.space[4] },
  link: { fontFamily: theme.font.bodySemibold, fontSize: 12, color: theme.colors.neutral600, textDecorationLine: 'underline' },
  dot: { color: theme.colors.neutral500 },
});
