import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import type {
  AnswerRecord,
  ClientMessage,
  GameExport,
  GameMode,
  HostView,
  LeaderboardEntry,
  Phase,
  PlayerView,
  PublicQuestion,
  Question,
  ServerMessage,
} from "../shared/types";
import { VERIFIED_ADMIN_HEADER } from "./auth";

interface Player {
  id: string;
  name: string;
  score: number;
  streak: number;
  lastResult: { correct: boolean; points: number } | null;
  /** Answer history, keyed by question index */
  history?: Record<number, AnswerRecord>;
}

interface RoomState {
  initialized: boolean;
  title: string;
  setId: string;
  /** Missing on games created before modes were introduced */
  mode?: GameMode;
  questions: Question[];
  phase: Phase;
  current: number;
  startedAt: number | null;
  deadline: number | null;
  players: Record<string, Player>;
  /** Answers to the current question, keyed by player id */
  answers: Record<string, { index: number; at: number }>;
  kicked: string[];
  /** Number of revealed questions (the ones included in the export) */
  revealed?: number;
}

type ConnState = { role: "host" | "player" };

const MAX_POINTS = 1000;

const emptyState = (): RoomState => ({
  initialized: false,
  title: "",
  setId: "",
  questions: [],
  phase: "lobby",
  current: -1,
  startedAt: null,
  deadline: null,
  players: {},
  answers: {},
  kicked: [],
});

/**
 * One instance per game (named after the PIN code).
 * Hibernation is enabled: the object is evicted from memory between
 * messages, so the state is persisted to storage on every mutation.
 */
export class QuizRoom extends Server<Env> {
  static options = { hibernate: true };

  state: RoomState = emptyState();

  async onStart() {
    this.state = (await this.ctx.storage.get<RoomState>("state")) ?? emptyState();
  }

  /** Called over RPC by the API when the game is created. */
  async setup(input: { title: string; setId: string; mode: GameMode; questions: Question[] }) {
    if (this.state.initialized) throw new Error("Game already initialized");
    this.state = { ...emptyState(), initialized: true, ...input };
    await this.save();
  }

  onConnect(conn: Connection<ConnState>, ctx: ConnectionContext) {
    if (!this.state.initialized) {
      this.sendTo(conn, { type: "error", code: "game_not_found" });
      conn.close(4404, "not found");
      return;
    }
    const url = new URL(ctx.request.url);
    if (url.searchParams.get("role") === "host") {
      // Header set by the Worker (onBeforeConnect) after verifying the Access JWT
      if (!ctx.request.headers.get(VERIFIED_ADMIN_HEADER)) {
        this.sendTo(conn, { type: "error", code: "unauthorized" });
        conn.close(4401, "unauthorized");
        return;
      }
      conn.setState({ role: "host" });
    } else {
      if (this.state.kicked.includes(conn.id)) {
        this.sendTo(conn, { type: "kicked" });
        conn.close(4403, "kicked");
        return;
      }
      conn.setState({ role: "player" });
    }
    this.broadcastState();
  }

  onClose() {
    // Refresh the "connected" status on the presentation view
    this.broadcastState();
  }

  async onMessage(conn: Connection<ConnState>, raw: WSMessage) {
    if (typeof raw !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const isHost = conn.state?.role === "host";

    switch (msg.type) {
      case "join":
        return this.handleJoin(conn, msg.name);
      case "answer":
        return this.handleAnswer(conn, msg.index);
    }

    if (!isHost) return this.sendTo(conn, { type: "error", code: "host_only" });

    switch (msg.type) {
      case "start":
        if (this.state.phase === "lobby" && this.state.questions.length > 0) {
          await this.startQuestion(0);
          await this.updateGameStatus("running");
        }
        break;
      case "reveal":
        if (this.state.phase === "question") await this.reveal();
        break;
      case "next":
        if (this.state.phase === "preview") await this.openAnswers();
        else if (this.state.phase === "question") await this.reveal();
        // Informative mode: no leaderboard screen between questions
        else if (this.state.phase === "reveal" && this.mode() === "competitive") await this.setPhase("leaderboard");
        else if (this.state.phase === "reveal" || this.state.phase === "leaderboard") {
          const next = this.state.current + 1;
          if (next < this.state.questions.length) await this.startQuestion(next);
          else await this.end();
        }
        break;
      case "kick": {
        delete this.state.players[msg.playerId];
        delete this.state.answers[msg.playerId];
        this.state.kicked.push(msg.playerId);
        await this.save();
        const target = this.getConnection(msg.playerId);
        if (target) {
          this.sendTo(target, { type: "kicked" });
          target.close(4403, "kicked");
        }
        this.broadcastState();
        break;
      }
      case "end":
        if (this.state.phase !== "ended") await this.end();
        break;
    }
  }

  async onAlarm() {
    const { phase, deadline } = this.state;
    if (phase === "question" && deadline !== null && Date.now() >= deadline - 50) {
      await this.reveal();
    }
  }

  // -------------------------------------------------------------------------
  // Game logic
  // -------------------------------------------------------------------------

  private async handleJoin(conn: Connection<ConnState>, rawName: string) {
    const name = String(rawName ?? "").trim().slice(0, 24);
    if (!name) return this.sendTo(conn, { type: "error", code: "name_required" });
    if (this.state.phase === "ended") {
      return this.sendTo(conn, { type: "error", code: "game_ended" });
    }

    const existing = this.state.players[conn.id];
    const taken = Object.values(this.state.players).some(
      (p) => p.id !== conn.id && p.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) return this.sendTo(conn, { type: "error", code: "name_taken" });

    if (existing) existing.name = name;
    else this.state.players[conn.id] = { id: conn.id, name, score: 0, streak: 0, lastResult: null };

    await this.save();
    this.broadcastState();
  }

  private async handleAnswer(conn: Connection<ConnState>, index: number) {
    const { phase, deadline, players, answers } = this.state;
    const question = this.currentQuestion();
    if (phase !== "question" || !question || !players[conn.id]) return;
    if (answers[conn.id]) return;
    if (!Number.isInteger(index) || index < 0 || index >= question.answers.length) return;
    if (deadline !== null && Date.now() > deadline) return;

    answers[conn.id] = { index, at: Date.now() };
    await this.save();

    // Every connected player has answered: reveal right away
    const connectedIds = this.connectedPlayerIds();
    const allAnswered = [...connectedIds].every((id) => !players[id] || answers[id]);
    if (allAnswered) await this.reveal();
    else this.broadcastState();
  }

  /** Step 1: show the question alone, without answers or timer. */
  private async startQuestion(index: number) {
    Object.assign(this.state, {
      phase: "preview",
      current: index,
      answers: {},
      startedAt: null,
      deadline: null,
    } satisfies Partial<RoomState>);
    for (const p of Object.values(this.state.players)) p.lastResult = null;
    await this.save();
    this.broadcastState();
  }

  /** Step 2: show the answers and start the timer (response times count from here). */
  private async openAnswers() {
    const q = this.currentQuestion();
    if (!q) return;
    const now = Date.now();
    this.state.phase = "question";
    this.state.startedAt = now;
    // Unlimited timer: no deadline, the host reveals (or everyone has answered)
    this.state.deadline = q.timeLimit > 0 ? now + q.timeLimit * 1000 : null;
    if (this.state.deadline !== null) await this.ctx.storage.setAlarm(this.state.deadline);
    await this.save();
    this.broadcastState();
  }

  private async reveal() {
    const q = this.currentQuestion();
    if (!q) return;
    const { startedAt, answers } = this.state;
    const limitMs = q.timeLimit * 1000;
    const scored = this.mode() === "competitive";

    for (const player of Object.values(this.state.players)) {
      const answer = answers[player.id];
      const correct = !!answer && q.correct.includes(answer.index);
      const timeMs = answer ? answer.at - (startedAt ?? answer.at) : null;
      let points = 0;
      if (correct && scored) {
        // Kahoot-style scoring: from 1000 (instant) down to 500 (last second).
        // Without a time limit there is no speed bonus: 1000 points.
        const ratio = limitMs > 0 ? Math.min(1, Math.max(0, timeMs! / limitMs)) : 0;
        points = Math.round(MAX_POINTS * (1 - ratio / 2));
      }
      player.streak = correct && scored ? player.streak + 1 : 0;
      player.score += points;
      player.lastResult = { correct, points };
      player.history = {
        ...player.history,
        [this.state.current]: { answer: answer?.index ?? null, correct, points, timeMs },
      };
    }

    this.state.revealed = Math.max(this.state.revealed ?? 0, this.state.current + 1);
    this.state.phase = "reveal";
    this.state.deadline = null;
    await this.ctx.storage.deleteAlarm();
    await this.save();
    this.broadcastState();
  }

  private async end() {
    this.state.phase = "ended";
    this.state.deadline = null;
    await this.ctx.storage.deleteAlarm();
    await this.save();
    this.broadcastState();
    await this.env.DB.prepare(
      "UPDATE games SET status = 'ended', ended_at = ?, results = ? WHERE code = ?",
    )
      .bind(Date.now(), JSON.stringify(this.leaderboard()), this.name)
      .run();
  }

  private async setPhase(phase: Phase) {
    this.state.phase = phase;
    await this.save();
    this.broadcastState();
  }

  private async updateGameStatus(status: "running") {
    await this.env.DB.prepare("UPDATE games SET status = ? WHERE code = ?")
      .bind(status, this.name)
      .run();
  }

  /** Called over RPC by the admin API: each player's answers, question by question. */
  async exportAnswers(): Promise<GameExport> {
    const played = this.state.questions.slice(0, this.state.revealed ?? 0);
    const leaderboard = this.leaderboard();
    const informative = this.mode() === "informative";
    if (informative) leaderboard.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return {
      code: this.name,
      title: this.state.title,
      mode: this.mode(),
      questions: played.map(({ text, answers, correct }) => ({ text, answers, correct })),
      players: leaderboard.map((entry, i) => {
        const player = this.state.players[entry.id];
        return {
          name: entry.name,
          score: entry.score,
          rank: i + 1,
          answers: played.map((_, qi) => player.history?.[qi] ?? null),
        };
      }),
    };
  }

  // -------------------------------------------------------------------------
  // Views sent to clients
  // -------------------------------------------------------------------------

  private mode(): GameMode {
    return this.state.mode ?? "competitive";
  }

  private currentQuestion(): Question | undefined {
    return this.state.questions[this.state.current];
  }

  private connectedPlayerIds(): Set<string> {
    const ids = new Set<string>();
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.role === "player") ids.add(c.id);
    }
    return ids;
  }

  private leaderboard(): LeaderboardEntry[] {
    return Object.values(this.state.players)
      .map(({ id, name, score }) => ({ id, name, score }))
      .sort((a, b) => b.score - a.score);
  }

  private publicQuestion(): PublicQuestion | null {
    const q = this.currentQuestion();
    if (!q) return null;
    return {
      index: this.state.current,
      total: this.state.questions.length,
      text: q.text,
      // Answers stay hidden during the preview, even from the network payload
      answers: this.state.phase === "preview" ? [] : q.answers,
      timeLimit: q.timeLimit,
      imageUrl: q.imageUrl,
      correct: this.isRevealed() ? q.correct : undefined,
    };
  }

  private isRevealed(): boolean {
    return ["reveal", "leaderboard", "ended"].includes(this.state.phase);
  }

  private remainingMs(): number | null {
    if (this.state.phase !== "question" || this.state.deadline === null) return null;
    return Math.max(0, this.state.deadline - Date.now());
  }

  private hostView(): HostView {
    const connected = this.connectedPlayerIds();
    const q = this.currentQuestion();
    let distribution: number[] | null = null;
    if (q && this.isRevealed()) {
      distribution = q.answers.map(() => 0);
      for (const a of Object.values(this.state.answers)) distribution[a.index]++;
    }
    return {
      role: "host",
      code: this.name,
      title: this.state.title,
      mode: this.mode(),
      phase: this.state.phase,
      players: Object.values(this.state.players).map((p) => ({
        id: p.id,
        name: p.name,
        connected: connected.has(p.id),
      })),
      question: this.publicQuestion(),
      remainingMs: this.remainingMs(),
      answerCount: Object.keys(this.state.answers).length,
      distribution,
      leaderboard: this.leaderboard(),
    };
  }

  private playerView(id: string, leaderboard: LeaderboardEntry[]): PlayerView {
    const player = this.state.players[id];
    const rank = leaderboard.findIndex((e) => e.id === id) + 1;
    return {
      role: "player",
      code: this.name,
      title: this.state.title,
      mode: this.mode(),
      phase: this.state.phase,
      me: player
        ? { id, name: player.name, score: player.score, rank, streak: player.streak }
        : null,
      question: this.publicQuestion(),
      remainingMs: this.remainingMs(),
      answered: this.state.answers[id]?.index ?? null,
      lastResult: player?.lastResult ?? null,
      playerCount: Object.keys(this.state.players).length,
    };
  }

  private broadcastState() {
    const host = this.hostView();
    const leaderboard = host.leaderboard;
    for (const conn of this.getConnections<ConnState>()) {
      const view = conn.state?.role === "host" ? host : this.playerView(conn.id, leaderboard);
      this.sendTo(conn, { type: "state", view });
    }
  }

  private sendTo(conn: Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private async save() {
    await this.ctx.storage.put("state", this.state);
  }
}
