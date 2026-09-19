export type Quadrant = 'mental' | 'physical' | 'emotional' | 'spiritual';

export interface QuestionRef {
  id: string;
  text: string;
  quadrant: Quadrant;
}

export interface TaskRef {
  id: string;
  text: string;
  quadrant: Quadrant;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  consentAcceptedAt: string | null;
  analyticsMarketingConsentAt: string | null;
}

export interface TodayEntry {
  id: string;
  color: string;
  answer_text: string | null;
  task_completed: number;
  entry_date: string;
  question_id: string;
  question_text: string;
  question_quadrant: Quadrant;
  task_id: string | null;
  task_text: string | null;
  task_quadrant: Quadrant | null;
}

export interface TimelineEntry {
  id: string;
  user_id: string;
  color: string;
  question_id: string;
  answer_text: string | null;
  task_id: string | null;
  task_completed: number;
  entry_date: string;
  created_at: string;
  completed_at: string | null;
}

export const COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Indigo', hex: '#34435f' },
  { name: 'Teal', hex: '#4f8f86' },
  { name: 'Sage', hex: '#859873' },
  { name: 'Gold', hex: '#b79239' },
  { name: 'Peach', hex: '#c48665' },
  { name: 'Pink', hex: '#b85e78' },
  { name: 'Lilac', hex: '#75658d' },
  { name: 'Ember', hex: '#9f493d' },
  { name: 'Tangerine', hex: '#c96f35' },
  { name: 'Voltage', hex: '#5868a6' },
  { name: 'Smoke', hex: '#68716d' },
];
