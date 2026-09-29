import { Hono } from "hono";
import { getServerByName } from "partyserver";
import type { GameMode, GameSummary, QuestionSet, QuestionSetSummary } from "../shared/types";
import { isValidPin, parseMode, sanitizeQuestions } from "../shared/validation";
import { AppError, type ErrorBody } from "../shared/errors";
import { verifyAdmin, type AdminIdentity } from "./auth";

type AppEnv = { Bindings: Env; Variables: { admin: AdminIdentity } };

interface SetRow {
  id: string;
  title: string;
  description: string;
  mode: GameMode;
  questions: string;
  created_at: number;
  updated_at: number;
}

interface GameRow {
  code: string;
  set_id: string;
  title: string;
  mode: GameMode;
  status: GameSummary["status"];
  created_at: number;
  ended_at: number | null;
}

const toSet = (r: SetRow): QuestionSet => ({
  id: r.id,
  title: r.title,
  description: r.description,
  mode: parseMode(r.mode),
  questions: JSON.parse(r.questions),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toGame = (r: GameRow): GameSummary => ({
  code: r.code,
  setId: r.set_id,
  title: r.title,
  mode: parseMode(r.mode),
  status: r.status,
  createdAt: r.created_at,
  endedAt: r.ended_at,
});

export const api = new Hono<AppEnv>().basePath("/api");

api.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json<ErrorBody>({ error: err.code, params: err.params }, err.status);
  }
  // Malformed JSON body
  if (err instanceof SyntaxError) return c.json<ErrorBody>({ error: "invalid_request" }, 400);
  console.error(err);
  return c.json<ErrorBody>({ error: "internal" }, 500);
});

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

api.get("/games/:code", async (c) => {
  const code = c.req.param("code");
  // Malformed codes are rejected without touching D1
  const row = isValidPin(code)
    ? await c.env.DB.prepare("SELECT * FROM games WHERE code = ?").bind(code).first<GameRow>()
    : null;
  if (!row) throw new AppError("game_not_found", undefined, 404);
  return c.json(toGame(row));
});

// ---------------------------------------------------------------------------
// Admin (Cloudflare Access)
// ---------------------------------------------------------------------------

const admin = new Hono<AppEnv>();

admin.use(async (c, next) => {
  const identity = await verifyAdmin(c.req.raw, c.env);
  if (!identity) throw new AppError("unauthorized", undefined, 401);
  c.set("admin", identity);
  await next();
});

admin.get("/me", (c) => c.json(c.get("admin")));

admin.get("/sets", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, description, mode, created_at, updated_at, json_array_length(questions) AS question_count
     FROM question_sets ORDER BY updated_at DESC`,
  ).all<Omit<SetRow, "questions"> & { question_count: number }>();
  return c.json(
    results.map(
      (r): QuestionSetSummary => ({
        id: r.id,
        title: r.title,
        description: r.description,
        mode: parseMode(r.mode),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        questionCount: r.question_count,
      }),
    ),
  );
});

admin.get("/sets/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM question_sets WHERE id = ?")
    .bind(c.req.param("id"))
    .first<SetRow>();
  if (!row) throw new AppError("set_not_found", undefined, 404);
  return c.json(toSet(row));
});

admin.post("/sets", async (c) => {
  const body = await c.req.json<Partial<QuestionSet>>();
  const title = String(body.title ?? "").trim() || "New quiz";
  const mode = parseMode(body.mode);
  const questions = sanitizeQuestions(body.questions ?? [], mode);
  const now = Date.now();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO question_sets (id, title, description, mode, questions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, title, String(body.description ?? ""), mode, JSON.stringify(questions), now, now)
    .run();
  return c.json({ id }, 201);
});

admin.put("/sets/:id", async (c) => {
  const body = await c.req.json<Partial<QuestionSet>>();
  const title = String(body.title ?? "").trim();
  if (!title) throw new AppError("title_required");
  const mode = parseMode(body.mode);
  const questions = sanitizeQuestions(body.questions ?? [], mode);
  const { meta } = await c.env.DB.prepare(
    "UPDATE question_sets SET title = ?, description = ?, mode = ?, questions = ?, updated_at = ? WHERE id = ?",
  )
    .bind(title, String(body.description ?? ""), mode, JSON.stringify(questions), Date.now(), c.req.param("id"))
    .run();
  if (meta.changes === 0) throw new AppError("set_not_found", undefined, 404);
  return c.json({ ok: true });
});

admin.delete("/sets/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM question_sets WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

admin.get("/games", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT code, set_id, title, mode, status, created_at, ended_at FROM games ORDER BY created_at DESC LIMIT 100",
  ).all<GameRow>();
  return c.json(results.map(toGame));
});

admin.get("/games/:code/results", async (c) => {
  const row = await c.env.DB.prepare("SELECT results FROM games WHERE code = ?")
    .bind(c.req.param("code"))
    .first<{ results: string | null }>();
  return c.json(row?.results ? JSON.parse(row.results) : []);
});

admin.get("/games/:code/export", async (c) => {
  const code = c.req.param("code");
  // Check the game exists in D1 so we don't instantiate an empty Durable Object
  const game = await c.env.DB.prepare("SELECT code FROM games WHERE code = ?").bind(code).first();
  if (!game) throw new AppError("game_not_found", undefined, 404);
  const room = await getServerByName(c.env.QuizRoom, code);
  return c.json(await room.exportAnswers());
});

admin.post("/games", async (c) => {
  const { setId } = await c.req.json<{ setId: string }>();
  const set = await c.env.DB.prepare("SELECT * FROM question_sets WHERE id = ?")
    .bind(setId)
    .first<SetRow>();
  if (!set) throw new AppError("set_not_found", undefined, 404);
  const questions = JSON.parse(set.questions);
  if (questions.length === 0) throw new AppError("set_empty");

  // 6-digit PIN, retry on collision
  let code = "";
  for (let i = 0; i < 10; i++) {
    const candidate = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const { meta } = await c.env.DB.prepare(
      "INSERT OR IGNORE INTO games (code, set_id, title, mode, status, created_at) VALUES (?, ?, ?, ?, 'lobby', ?)",
    )
      .bind(candidate, set.id, set.title, parseMode(set.mode), Date.now())
      .run();
    if (meta.changes > 0) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new AppError("pin_generation_failed", undefined, 500);

  // Snapshot the questions into the Durable Object: editing the set later doesn't affect the game
  const room = await getServerByName(c.env.QuizRoom, code);
  await room.setup({ title: set.title, setId: set.id, mode: parseMode(set.mode), questions });

  return c.json({ code }, 201);
});

admin.delete("/games/:code", async (c) => {
  await c.env.DB.prepare("DELETE FROM games WHERE code = ?").bind(c.req.param("code")).run();
  return c.json({ ok: true });
});

api.route("/admin", admin);
