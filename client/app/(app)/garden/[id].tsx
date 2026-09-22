import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useEntries } from '../../../lib/hooks/useEntries';
import { useColors } from '../../../lib/hooks/useColors';
import { useDeleteEntry } from '../../../lib/hooks/useEntryMutations';
import { iconSource } from '../../../lib/icons';
import { theme } from '../../../lib/theme';

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useEntries();
  const { data: colors } = useColors();
  const deleteEntry = useDeleteEntry();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const entry = (data?.pages ?? []).flatMap((p) => p.entries).find((e) => String(e.id) === id);
  const color = colors?.find((c) => c.name === entry?.color);

  if (!entry) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>This entry is no longer available.</Text>
      </View>
    );
  }

  const confirmDelete = () => {
    deleteEntry.mutate(entry.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        router.back();
      },
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Button title="Garden" variant="secondary" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />

      <View style={{ alignItems: 'center', marginVertical: theme.space[6] }}>
        <Image source={iconSource(color?.icon ?? 'lotus-sage.png')} style={{ width: 150, height: 150 }} resizeMode="contain" />
        <Text style={styles.colorName}>{entry.color}</Text>
        <Text style={styles.date}>{entry.entryDate}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>THE QUESTION</Text>
        <Text style={styles.question}>{entry.question.text}</Text>
        <Text style={styles.answer}>{entry.answerText}</Text>
      </View>

      {entry.activityCompleted && entry.activity && (
        <View style={styles.taskDone}>
          <Check size={18} color={theme.colors.accent2_700} strokeWidth={2.75} />
          <Text style={styles.taskDoneText}>{entry.activity.text}</Text>
        </View>
      )}

      <Button title="Delete this day" variant="ghost" onPress={() => setConfirmOpen(true)} style={{ marginTop: theme.space[6] }} />

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete this day?"
        body="The color, question, answer and task for this day will be removed from your garden. This can't be undone."
        confirmLabel="Delete this day"
        confirming={deleteEntry.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center' },
  body: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.neutral700 },
  colorName: { fontFamily: theme.font.heading, fontSize: 22, color: theme.colors.text, marginTop: theme.space[2] },
  date: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.neutral600, marginTop: 2 },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.lg, padding: theme.space[4] },
  kicker: { fontFamily: theme.font.body, fontSize: 11.5, letterSpacing: 1.2, color: theme.colors.neutral600, marginBottom: 6 },
  question: { fontFamily: theme.font.heading, fontSize: 18, color: theme.colors.text, marginBottom: theme.space[3] },
  answer: { fontFamily: theme.font.body, fontSize: 14.5, lineHeight: 23, color: theme.colors.neutral800 },
  taskDone: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.accent2_100, borderRadius: theme.radius.lg, padding: theme.space[3], marginTop: 10 },
  taskDoneText: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.text },
});
