import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Button } from '../components/Button';
import { useConsentMutation } from '../lib/hooks/useConsentMutation';
import { theme } from '../lib/theme';

export default function Consent() {
  const [analytics, setAnalytics] = useState(false);
  const mutation = useConsentMutation();

  const accept = () => {
    mutation.mutate(analytics);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Before we begin</Text>
      <Text style={styles.body}>A few things to know, once. You can change your choices any time in settings.</Text>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>This is not medical care</Text>
        <Text style={styles.noticeBody}>
          Eve Colors is for everyday self-reflection. It does not diagnose, treat, or score anything, and it is not
          a substitute for care from a professional. If you are having a hard time, please reach out to someone you
          trust.
        </Text>
      </View>

      <Pressable style={styles.optionRow} onPress={() => setAnalytics((v) => !v)}>
        <View style={[styles.checkbox, analytics && styles.checkboxOn]}>
          {analytics && <Check size={14} color="#ffffff" strokeWidth={3.2} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>Help improve Eve Colors</Text>
          <Text style={styles.optionSubtitle}>Anonymous usage counts. Never your answers.</Text>
        </View>
      </Pressable>

      <Button title="I understand — let's start" onPress={accept} loading={mutation.isPending} style={{ marginTop: theme.space[6] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[6], gap: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center' },
  title: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text },
  body: { fontFamily: theme.font.body, fontSize: 15, color: theme.colors.neutral700 },
  noticeCard: { backgroundColor: theme.colors.accent100, borderRadius: theme.radius.lg, padding: theme.space[4] },
  noticeTitle: { fontFamily: theme.font.heading, fontSize: 15, marginBottom: 6, color: theme.colors.text },
  noticeBody: { fontFamily: theme.font.body, fontSize: 13.5, lineHeight: 21, color: theme.colors.neutral700 },
  optionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.md, padding: theme.space[3] },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: theme.colors.neutral400, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: theme.colors.accent2_500, borderColor: theme.colors.accent2_500 },
  optionTitle: { fontFamily: theme.font.bodySemibold, fontSize: 14.5, color: theme.colors.text },
  optionSubtitle: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.neutral600, marginTop: 2 },
});
