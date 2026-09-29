-- Game mode: 'competitive' (points + leaderboard) or 'informative' (no score)
ALTER TABLE question_sets ADD COLUMN mode TEXT NOT NULL DEFAULT 'competitive';
ALTER TABLE games ADD COLUMN mode TEXT NOT NULL DEFAULT 'competitive';
