import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { API_URL } from '../lib/config';
import { theme } from '../lib/theme';

export default function SignIn() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={require('../assets/images/lotus-peach.png')} style={styles.hero} resizeMode="contain" />
        <Text style={styles.title}>Eve Colors</Text>
        <Text style={styles.subtitle}>One color, one question, one small thing — every day.</Text>
        <Button
          title="Continue with Google"
          onPress={() => {
            // Full-page navigation, not a fetch call — the server sets the session
            // cookie via a redirect chain that a fetch/XHR request cannot follow.
            if (typeof window !== 'undefined') {
              window.location.href = `${API_URL}/auth/google/redirect`;
            }
          }}
        />
        <Text style={styles.disclaimer}>
          Private by default. Your colors and answers are only ever yours. Eve Colors is a reflection tool, not a
          medical service.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center' },
  content: { flex: 1, width: '100%', maxWidth: 440, justifyContent: 'center', padding: theme.space[6], gap: theme.space[6] },
  hero: { width: 176, height: 176, alignSelf: 'flex-start' },
  title: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h1, color: theme.colors.text },
  subtitle: { fontFamily: theme.font.body, fontSize: 17, color: theme.colors.neutral700, maxWidth: 260 },
  disclaimer: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.neutral600, maxWidth: 320 },
});
