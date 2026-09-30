// Types shared between the Worker (API + Durable Object) and the React front end.

import type { ErrorCode, ErrorParams } from "./errors";

export interface Question {
  id: string;
  text: string;
  /** 2 to 4 answers */
  answers: string[];
  /** Indexes of the correct answers (at least one in competitive mode; may be empty in informative mode = poll) */
  correct: number[];
  /** Duration in seconds, 0 = unlimited (the host reveals manually) */
  timeLimit: number;
  imageUrl?: string;
}

/** competitive: points, streaks and leaderboard. informative: no score (learning quiz, poll). */
export type GameMode = "competitive" | "informative";

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  mode: GameMode;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

export type QuestionSetSummary = Omit<QuestionSet, "questions"> & {
  questionCount: number;
};

export type GameStatus = "lobby" | "running" | "ended";

/** A player's answer to a question, recorded at reveal time */
export interface AnswerRecord {
  /** Index of the chosen answer, null if the player didn't answer */
  answer: number | null;
  correct: boolean;
  points: number;
  /** Response time in ms since the question was shown */
  timeMs: number | null;
}

/** Export data for a game (each player's answers) */
export interface GameExport {
  code: string;
  title: string;
  mode: GameMode;
  questions: { text: string; answers: string[]; correct: number[] }[];
  players: {
    name: string;
    score: number;
    rank: number;
    /** Indexed like questions; null if the player wasn't there */
    answers: (AnswerRecord | null)[];
  }[];
}

export interface GameSummary {
  code: string;
  setId: string;
  title: string;
  mode: GameMode;
  status: GameStatus;
  createdAt: number;
  endedAt: number | null;
}

// ---------------------------------------------------------------------------
// Real-time protocol (WebSocket via partyserver / partysocket)
// ---------------------------------------------------------------------------

export const PARTY = "quiz-room";

/**
 * preview: the question is shown alone (no answers, no timer) until the host moves on.
 * question: answers are shown, the timer runs and players can answer.
 */
export type Phase = "lobby" | "preview" | "question" | "reveal" | "leaderboard" | "ended";

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "answer"; index: number }
  // Host only (presentation view)
  | { type: "start" }
  | { type: "next" }
  | { type: "reveal" }
  | { type: "kick"; playerId: string }
  | { type: "end" };

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

export interface PublicQuestion {
  index: number;
  total: number;
  text: string;
  /** Empty during the preview phase */
  answers: string[];
  timeLimit: number;
  imageUrl?: string;
  /** Only set once the answer has been revealed */
  correct?: number[];
}

export interface HostView {
  role: "host";
  code: string;
  title: string;
  mode: GameMode;
  phase: Phase;
  players: { id: string; name: string; connected: boolean }[];
  question: PublicQuestion | null;
  /** Time left when the message was sent (avoids clock skew issues) */
  remainingMs: number | null;
  answerCount: number;
  /** Number of answers per option, during the reveal phase */
  distribution: number[] | null;
  leaderboard: LeaderboardEntry[];
}

export interface PlayerView {
  role: "player";
  code: string;
  title: string;
  mode: GameMode;
  phase: Phase;
  me: {
    id: string;
    name: string;
    score: number;
    rank: number;
    streak: number;
  } | null;
  /** Text and answers are also sent to players (useful for remote play) */
  question: PublicQuestion | null;
  remainingMs: number | null;
  answered: number | null;
  lastResult: { correct: boolean; points: number } | null;
  playerCount: number;
}

export type ServerMessage =
  | { type: "state"; view: HostView | PlayerView }
  | { type: "error"; code: ErrorCode; params?: ErrorParams }
  | { type: "kicked" };
