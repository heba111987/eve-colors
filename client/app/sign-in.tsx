import Svg, { Path } from 'react-native-svg';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { API_URL } from '../lib/config';
import { theme } from '../lib/theme';

function GoogleIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.6 2.3 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v8.4h12.5c-.3 2.1-1.6 5.2-4.6 7.3l7.7 6c4.5-4.2 6.5-10.2 6.5-17.6z" />
      <Path fill="#FBBC05" d="M10.5 28.6a14.6 14.6 0 010-9.2l-7.9-6.2a24 24 0 000 21.6l7.9-6.2z" />
      <Path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.6-5.8l-7.7-6c-2.1 1.4-4.9 2.4-7.9 2.4-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </Svg>
  );
}

export default function SignIn() {
  const signIn = () => {
    // Full-page navigation, not a fetch call — the server sets the session
    // cookie via a redirect chain that a fetch/XHR request cannot follow.
    if (typeof window !== 'undefined') {
      window.location.href = `${API_URL}/auth/google/redirect`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={require('../assets/images/lotus-peach.png')} style={styles.hero} resizeMode="contain" />
        <View>
          <Text style={styles.kicker}>One moment. One color. You.</Text>
          <Text style={styles.title}>Eve Colors</Text>
          <Text style={styles.subtitle}>A private space to notice yourself.</Text>
        </View>
        <View>
          <Button title="Grow!" variant="secondary" onPress={signIn} icon={<GoogleIcon />} />
          <Text style={styles.disclaimer}>Private by design • No streaks • Your reflections stay yours</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center' },
  content: { flex: 1, width: '100%', maxWidth: 440, justifyContent: 'center', padding: theme.space[6], gap: theme.space[6] },
  hero: { width: 176, height: 176, alignSelf: 'flex-start' },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: theme.colors.accent700, marginBottom: theme.space[3] },
  title: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h1, color: theme.colors.text, marginBottom: theme.space[3] },
  subtitle: { fontFamily: theme.font.body, fontSize: 17, color: theme.colors.neutral700, maxWidth: 260 },
  disclaimer: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.neutral600, maxWidth: 320, marginTop: theme.space[4] },
});
