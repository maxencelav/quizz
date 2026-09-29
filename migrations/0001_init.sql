CREATE TABLE question_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  questions TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE games (
  code TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  results TEXT
);

CREATE INDEX games_created_at ON games (created_at DESC);
