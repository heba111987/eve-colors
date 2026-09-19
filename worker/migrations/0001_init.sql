CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  consent_accepted_at TEXT,
  analytics_marketing_consent_at TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  quadrant TEXT NOT NULL CHECK (quadrant IN ('mental','physical','emotional','spiritual')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  quadrant TEXT NOT NULL CHECK (quadrant IN ('mental','physical','emotional','spiritual')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  color TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  answer_text TEXT,
  task_id TEXT REFERENCES tasks(id),
  task_completed INTEGER NOT NULL DEFAULT 0,
  entry_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (user_id, entry_date)
);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_user_created ON entries(user_id, created_at);
