import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { ShieldAlert } from 'lucide-react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useToday } from '../../lib/hooks/useToday';
import { useColors, Color } from '../../lib/hooks/useColors';
import { useCreateEntry, useSubmitAnswer, useRerollActivity, useCompleteActivity } from '../../lib/hooks/useEntryMutations';
import { iconSource } from '../../lib/icons';
import { theme } from '../../lib/theme';

type Stage = 'home' | 'color' | 'question' | 'task' | 'done' | 'bloom';

function stageFor(entry: ReturnType<typeof useToday>['data']): Stage {
  if (!entry) return 'home';
  if (entry.answerText === null) return 'question';
  if (!entry.activityCompleted) return 'task';
  return 'done'; // already completed on a prior visit/reload — not the same-session bloom celebration
}

export default function Today() {
  const { data: entry, isLoading } = useToday();
  const [stage, setStage] = useState<Stage>('home');
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [justBloomed, setJustBloomed] = useState(false);

  useEffect(() => {
    if (!isLoading) setStage(entry ? stageFor(entry) : 'home');
  }, [isLoading, entry?.id, entry?.answerText, entry?.activityCompleted]);

  if (isLoading) return null;

  if (justBloomed && entry?.activityCompleted) {
    return <BloomStage entry={entry} onDone={() => setJustBloomed(false)} />;
  }

  if (stage === 'home') {
    return <HomeStage onStart={() => setStage('color')} />;
  }
  if (stage === 'color') {
    return <ColorStage selectedColorId={selectedColorId} onSelect={setSelectedColorId} onCreated={() => setStage('question')} />;
  }
  if (stage === 'question' && entry) {
    return (
      <QuestionStage
        entry={entry}
        draft={answerDraft}
        onDraftChange={setAnswerDraft}
        onSubmitted={() => setStage('task')}
      />
    );
  }
  if (stage === 'task' && entry) {
    return <TaskStage entry={entry} onCompleted={() => setJustBloomed(true)} />;
  }
  if (stage === 'done' && entry) {
    return <DoneStage entry={entry} />;
  }
  return null;
}

function HomeStage({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>A private space to notice yourself</Text>
        <Text style={styles.homeTitle}>See how you feel. Watch your garden grow.</Text>
        <Text style={styles.subtitle}>
          Choose a color, reflect for a moment, and return over time to notice the patterns that are uniquely
          yours.
        </Text>
        <Button title="Choose today’s color" onPress={onStart} style={{ alignSelf: 'flex-start' }} />
        <Text style={styles.footnote}>Private by design • No streaks • Your reflections stay yours</Text>
      </ScrollView>
    </View>
  );
}

function DoneStage({ entry }: { entry: NonNullable<ReturnType<typeof useToday>['data']> }) {
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: theme.space[6] }]}>
      <Image source={require('../../assets/images/lotus-peach.png')} style={{ width: 150, height: 150 }} resizeMode="contain" />
      <Text style={[styles.h2, { marginTop: theme.space[4], textAlign: 'center' }]}>Already planted today.</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>
        {entry.color.name} — {entry.activity?.text ?? 'Today’s task'}. Come back tomorrow for the next one.
      </Text>
      <Button title="See my garden" onPress={() => router.replace('/garden')} style={{ marginTop: theme.space[6], width: '100%' }} />
    </View>
  );
}

function ColorStage({
  selectedColorId,
  onSelect,
  onCreated,
}: {
  selectedColorId: number | null;
  onSelect: (id: number) => void;
  onCreated: () => void;
}) {
  const { data: colors, isLoading } = useColors();
  const createEntry = useCreateEntry();

  const submit = () => {
    if (!selectedColorId) return;
    createEntry.mutate(selectedColorId, { onSuccess: onCreated });
  };

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h2}>How does today feel?</Text>
        <Text style={styles.subtitle}>Pick the color that fits. There's no wrong one.</Text>
        <View style={{ gap: 10 }}>
          {isLoading && <Text style={styles.subtitle}>Loading colors…</Text>}
          {colors?.map((c: Color) => {
            const selected = c.id === selectedColorId;
            return (
              <Pressable
                key={c.id}
                onPress={() => onSelect(c.id)}
                style={[styles.colorRow, selected && { borderColor: c.hex, borderWidth: 2, backgroundColor: `${c.hex}1a` }]}
              >
                <Image source={iconSource(c.icon)} style={styles.colorIcon} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.colorName}>{c.name}</Text>
                  <Text style={styles.colorBlurb}>{c.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Button
          title={selectedColorId ? 'Continue' : 'Choose a color'}
          onPress={submit}
          disabled={!selectedColorId}
          loading={createEntry.isPending}
          style={{ marginTop: theme.space[6] }}
        />
        <View style={styles.safetyCard}>
          <View style={styles.safetyHeading}>
            <ShieldAlert size={16} color="#5f7a52" strokeWidth={2.75} />
            <Text style={styles.safetyTitle}>Support &amp; Safety</Text>
          </View>
          <Text style={styles.safetyBody}>
            Eve Colors is a self-reflection tool. It does not provide medical advice, diagnosis, therapy, or
            emergency services.
          </Text>
          <Text style={styles.safetyBody}>
            If you are in the U.S. and need immediate emotional support, call or text <Text style={{ fontFamily: theme.font.bodyBold }}>988</Text>.
            If you are in immediate danger, contact local emergency services.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function QuestionStage({
  entry,
  draft,
  onDraftChange,
  onSubmitted,
}: {
  entry: NonNullable<ReturnType<typeof useToday>['data']>;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmitted: () => void;
}) {
  const submitAnswer = useSubmitAnswer();

  const submit = () => {
    if (!draft.trim()) return;
    submitAnswer.mutate({ id: entry.id, answer: draft.trim() }, { onSuccess: onSubmitted });
  };

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={[styles.content, { flexGrow: 1 }]}>
        <Text style={styles.h2}>{entry.question.text}</Text>
        <TextField
          multiline
          value={draft}
          onChangeText={onDraftChange}
          placeholder="A sentence is plenty."
          style={{ marginTop: theme.space[4] }}
        />
        <Text style={styles.helper}>Only you can read this.</Text>
        <View style={{ flex: 1 }} />
        <Button title="Next" onPress={submit} disabled={!draft.trim()} loading={submitAnswer.isPending} />
      </ScrollView>
    </View>
  );
}

function TaskStage({
  entry,
  onCompleted,
}: {
  entry: NonNullable<ReturnType<typeof useToday>['data']>;
  onCompleted: () => void;
}) {
  const reroll = useRerollActivity();
  const complete = useCompleteActivity();

  if (!entry.activity) return null;

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={[styles.content, { flexGrow: 1 }]}>
        <Text style={styles.h2}>One small thing</Text>
        <View style={styles.taskCard}>
          <Text style={styles.taskKicker}>TODAY'S TASK</Text>
          <Text style={styles.taskTitle}>{entry.activity.text}</Text>
          {!!entry.activity.note && <Text style={styles.taskNote}>{entry.activity.note}</Text>}
        </View>
        <Button
          title="Give me another"
          variant="secondary"
          onPress={() => reroll.mutate(entry.id)}
          loading={reroll.isPending}
          disabled={entry.activityCompleted}
          style={{ alignSelf: 'flex-start', marginTop: theme.space[3] }}
        />
        <View style={{ flex: 1 }} />
        <Button
          title="I did it — plant my flower"
          onPress={() => complete.mutate(entry.id, { onSuccess: onCompleted })}
          loading={complete.isPending}
        />
      </ScrollView>
    </View>
  );
}

function BloomStage({ entry, onDone }: { entry: NonNullable<ReturnType<typeof useToday>['data']>; onDone: () => void }) {
  const scale = useSharedValue(0.28);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.08, { duration: 560, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 200 }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: theme.space[6] }]}>
      <Animated.Image source={require('../../assets/images/lotus-peach.png')} style={[{ width: 200, height: 200 }, animatedStyle]} resizeMode="contain" />
      <Text style={[styles.h2, { marginTop: theme.space[4] }]}>Planted.</Text>
      <Text style={styles.subtitle}>Come back tomorrow for the next one.</Text>
      <Button title="See my garden" onPress={() => { onDone(); router.replace('/garden'); }} style={{ marginTop: theme.space[6], width: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[4], maxWidth: 440, width: '100%', alignSelf: 'center' },
  h2: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text, marginBottom: theme.space[1] },
  subtitle: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.neutral700, marginBottom: theme.space[4] },
  helper: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.neutral600, marginTop: theme.space[2] },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200 },
  colorIcon: { width: 54, height: 54 },
  colorName: { fontFamily: theme.font.heading, fontSize: 16, color: theme.colors.text },
  colorBlurb: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.neutral700, marginTop: 1 },
  taskCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.colors.neutral200, borderRadius: theme.radius.lg, padding: theme.space[6] },
  taskKicker: { fontFamily: theme.font.body, fontSize: 11.5, letterSpacing: 1.2, color: theme.colors.neutral600, marginBottom: theme.space[2] },
  taskTitle: { fontFamily: theme.font.heading, fontSize: 25, color: theme.colors.text, lineHeight: 30 },
  taskNote: { fontFamily: theme.font.body, fontSize: 13.5, color: theme.colors.neutral700, marginTop: theme.space[3] },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: theme.colors.accent700, marginBottom: theme.space[3] },
  homeTitle: { fontFamily: theme.font.heading, fontSize: 36, lineHeight: 39, color: theme.colors.text, marginBottom: theme.space[3], maxWidth: 260 },
  footnote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.neutral600, marginTop: theme.space[3] },
  safetyCard: { marginTop: theme.space[6], backgroundColor: theme.colors.accent2_100, borderRadius: 22, padding: theme.space[4] },
  safetyHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  safetyTitle: { fontFamily: theme.font.heading, fontSize: 15, color: theme.colors.text },
  safetyBody: { fontFamily: theme.font.body, fontSize: 12.5, lineHeight: 20, color: theme.colors.neutral800, marginBottom: 6 },
});
