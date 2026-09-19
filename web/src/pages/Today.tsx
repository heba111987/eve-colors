import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS, type TodayEntry } from '@eve-colors/shared';
import { apiClient } from '../lib/api';
import { useCurrentUser } from '../lib/useCurrentUser';
import { loadPostHogIfConsented } from '../lib/posthog';

type Stage =
  | { name: 'loading' }
  | { name: 'pickColor' }
  | { name: 'question'; entryId: string; questionText: string }
  | { name: 'task'; entryId: string; taskText: string }
  | { name: 'done' };

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
    void apiClient.getToday().then(({ entry }) => setStage(stageFromTodayEntry(entry)));
  }, [loading, user, navigate]);

  async function pickColor(color: string) {
    const { entry } = await apiClient.createEntry(color);
    setStage({ name: 'question', entryId: entry.id, questionText: entry.question.text });
  }

  async function submitAnswer(entryId: string) {
    const trimmed = answer.trim();
    if (!trimmed) {
      setFormStatus('Write anything that feels true for you.');
      return;
    }
    const { entry } = await apiClient.answerEntry(entryId, trimmed);
    setStage({ name: 'task', entryId, taskText: entry.task.text });
  }

  async function reroll(entryId: string) {
    const { task } = await apiClient.rerollTask(entryId);
    setStage({ name: 'task', entryId, taskText: task.text });
  }

  async function completeTask(entryId: string) {
    await apiClient.completeTask(entryId);
    setStage({ name: 'done' });
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
          <p role="status">{formStatus}</p>
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

      <p className="notice">{SUPPORT_SAFETY_NOTICE}</p>
    </div>
  );
}
