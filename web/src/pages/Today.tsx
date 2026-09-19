import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, COLORS, type TodayEntry } from '@eve-colors/shared';
import { apiClient } from '../lib/api';
import { useCurrentUser } from '../lib/useCurrentUser';
import { loadPostHogIfConsented } from '../lib/posthog';

type Stage =
  | { name: 'loading' }
  | { name: 'pickColor' }
  | { name: 'question'; entryId: string; questionText: string }
  | { name: 'task'; entryId: string; taskText: string }
  | { name: 'done' };

const GENERIC_ERROR = 'Something went wrong. Please try again.';

const SUPPORT_SAFETY_NOTICE =
  'Eve Colors is a wellness self-reflection tool. It does not provide medical advice, diagnosis, or treatment. ' +
  'If you are in the U.S. and need immediate support, call or text 988. If you are in immediate danger, contact local emergency services.';

function stageFromTodayEntry(entry: TodayEntry | null): Stage {
  if (!entry) return { name: 'pickColor' };
  if (entry.answer_text === null) return { name: 'question', entryId: entry.id, questionText: entry.question_text };
  if (!entry.task_completed) return { name: 'task', entryId: entry.id, taskText: entry.task_text ?? '' };
  return { name: 'done' };
}

export function Today() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ name: 'loading' });
  const [answer, setAnswer] = useState('');
  const [formStatus, setFormStatus] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    if (!user.consentAcceptedAt) {
      navigate('/consent', { replace: true });
      return;
    }
    loadPostHogIfConsented(user);
    void apiClient
      .getToday()
      .then(({ entry }) => setStage(stageFromTodayEntry(entry)))
      .catch(() => {
        setStage({ name: 'pickColor' });
        setFormStatus(GENERIC_ERROR);
      });
  }, [loading, user, navigate]);

  // Re-read today's entry from the server and render whatever state it's
  // actually in. Used to recover from a 409 on createEntry, which means
  // today's entry already exists (e.g. a second tab picked a color first).
  async function resyncFromServer() {
    try {
      const { entry } = await apiClient.getToday();
      setStage(stageFromTodayEntry(entry));
      setFormStatus('');
    } catch {
      setFormStatus(GENERIC_ERROR);
    }
  }

  async function pickColor(color: string) {
    setFormStatus('');
    try {
      const { entry } = await apiClient.createEntry(color);
      setStage({ name: 'question', entryId: entry.id, questionText: entry.question.text });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Today's entry already exists — not really an error, just a race.
        // Land the user on their actual current state rather than a dead end.
        await resyncFromServer();
        return;
      }
      setFormStatus(GENERIC_ERROR);
    }
  }

  async function submitAnswer(entryId: string) {
    const trimmed = answer.trim();
    if (!trimmed) {
      setFormStatus('Write anything that feels true for you.');
      return;
    }
    setFormStatus('');
    try {
      const { entry } = await apiClient.answerEntry(entryId, trimmed);
      setStage({ name: 'task', entryId, taskText: entry.task.text });
    } catch {
      setFormStatus(GENERIC_ERROR);
    }
  }

  async function reroll(entryId: string) {
    setFormStatus('');
    try {
      const { task } = await apiClient.rerollTask(entryId);
      setStage({ name: 'task', entryId, taskText: task.text });
    } catch {
      setFormStatus(GENERIC_ERROR);
    }
  }

  async function completeTask(entryId: string) {
    setFormStatus('');
    try {
      await apiClient.completeTask(entryId);
      setStage({ name: 'done' });
    } catch {
      setFormStatus(GENERIC_ERROR);
    }
  }

  return (
    <div>
      <h1>Today</h1>
      <nav>
        <a href="/garden">My Garden</a> · <a href="/account">Account</a>
      </nav>

      {stage.name === 'loading' && <p>Loading…</p>}

      {stage.name === 'pickColor' && (
        <>
          <p>Pick the color that matches how you feel today.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {COLORS.map(({ name, hex }) => (
              <button key={name} className="color-swatch" onClick={() => void pickColor(name)}>
                <span className="dot" style={{ background: hex }} />
                {name}
              </button>
            ))}
          </div>
        </>
      )}

      {stage.name === 'question' && (
        <>
          <p>
            <strong>{stage.questionText}</strong>
          </p>
          <textarea rows={6} maxLength={5000} value={answer} onChange={(event) => setAnswer(event.target.value)} />
          <p>
            <button className="primary" onClick={() => void submitAnswer(stage.entryId)}>
              Save my reflection
            </button>
          </p>
        </>
      )}

      {stage.name === 'task' && (
        <>
          <p>One small thing for today:</p>
          <p>
            <strong>{stage.taskText}</strong>
          </p>
          <p>
            <button className="primary" onClick={() => void completeTask(stage.entryId)}>
              I did it
            </button>{' '}
            <button onClick={() => void reroll(stage.entryId)}>Give me another idea</button>
          </p>
        </>
      )}

      {stage.name === 'done' && (
        <>
          <p>You showed up for yourself today. 🌸</p>
          <p>
            <a href="/garden">View My Garden</a>
          </p>
        </>
      )}

      {/* One status line for the whole flow, so an error from any stage
          (picking a color, answering, rerolling, completing) is visible. */}
      <p role="status">{formStatus}</p>

      <p className="notice">{SUPPORT_SAFETY_NOTICE}</p>
    </div>
  );
}
