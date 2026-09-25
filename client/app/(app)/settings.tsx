import { useState } from 'react';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Toggle } from '../../components/Toggle';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useMe } from '../../lib/hooks/useMe';
import { useConsentMutation } from '../../lib/hooks/useConsentMutation';
import { useLogout, useDeleteAccount } from '../../lib/hooks/useAccountMutations';
import { theme } from '../../lib/theme';

export default function Settings() {
  const { data: me } = useMe();
  const consentMutation = useConsentMutation();
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!me) return null;

  const analyticsOn = !!me.analyticsConsentAt;
  const marketingOn = !!me.marketingConsentAt;

  // No explicit navigation on success here either, for the same reason
  // documented in Task 9's consent screen: both mutations clear the query
  // cache, which makes useMe() (in the root AuthGate) refetch and find no
  // session — AuthGate then reactively redirects to /sign-in on its own.
  // An explicit router.replace('/sign-in') here would race that redirect
  // for the same target and can crash with "Maximum update depth exceeded"
  // (reproduced during Task 9's verification with the equivalent /today
  // race). AuthGate is the single source of truth for auth-driven
  // navigation; this screen only triggers the auth change, never navigates
  // in response to it.
  const signOut = () => {
    logout.mutate();
  };

  const confirmDelete = () => {
    deleteAccount.mutate();
  };

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h2}>Account</Text>
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{me.displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.name}>{me.displayName}</Text>
          <Text style={styles.email}>{me.email} · Google</Text>
        </View>
      </View>

      <Text style={styles.h4}>Privacy</Text>
      <View style={styles.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>Anonymous analytics</Text>
          <Text style={styles.settingSubtitle}>Usage counts only, never answers.</Text>
        </View>
        <Toggle
          value={analyticsOn}
          accessibilityLabel="Toggle analytics"
          onValueChange={(v) => consentMutation.mutate({ analytics: v, marketing: marketingOn })}
        />
      </View>
      <View style={styles.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>Email notes</Text>
          <Text style={styles.settingSubtitle}>New questions and seasonal prompts.</Text>
        </View>
        <Toggle
          value={marketingOn}
          accessibilityLabel="Toggle email notes"
          onValueChange={(v) => consentMutation.mutate({ analytics: analyticsOn, marketing: v })}
        />
      </View>

      <Text style={styles.h4}>Your data</Text>
      <Button title="Delete my account" variant="secondary" onPress={() => setConfirmOpen(true)} style={{ borderColor: theme.colors.accent300, backgroundColor: theme.colors.accent100 }} />
      <Button title="Sign out" variant="ghost" onPress={signOut} loading={logout.isPending} style={{ marginTop: theme.space[2] }} />

      <Text style={styles.footnote}>
        Eve Colors is a reflection tool, not medical advice. In the US you can call or text 988 any time to reach
        the Suicide &amp; Crisis Lifeline.
      </Text>
      <View style={styles.legalLinks}>
        <Link href="/privacy" style={styles.legalLink}>Privacy Policy</Link>
        <Text style={styles.footnoteDot}>·</Text>
        <Link href="/terms" style={styles.legalLink}>Terms of Service</Link>
      </View>

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete your account?"
        body="Every flower in your garden and all of your answers are erased within 24 hours. You'll be signed out right away."
        confirmLabel="Delete everything"
        confirming={deleteAccount.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center', gap: theme.space[2] },
  h2: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text, marginBottom: theme.space[2] },
  h4: { fontFamily: theme.font.heading, fontSize: 17, color: theme.colors.text, marginTop: theme.space[6], marginBottom: theme.space[2] },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.lg, padding: theme.space[3] },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent200, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: theme.font.heading, fontSize: 17, color: theme.colors.accent800 },
  name: { fontFamily: theme.font.bodySemibold, fontSize: 14.5, color: theme.colors.text },
  email: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.neutral600 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.md, padding: theme.space[3] },
  settingTitle: { fontFamily: theme.font.bodySemibold, fontSize: 14.5, color: theme.colors.text },
  settingSubtitle: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.neutral600 },
  legalLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: theme.space[3] },
  legalLink: { fontFamily: theme.font.bodySemibold, fontSize: 12, color: theme.colors.accent700, textDecorationLine: 'underline' },
  footnoteDot: { color: theme.colors.neutral500 },
  footnote: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 19, color: theme.colors.neutral600, marginTop: theme.space[6] },
});
