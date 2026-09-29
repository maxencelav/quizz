import { AppError } from "./errors";
import type { GameMode, Question } from "./types";

export const parseMode = (v: unknown): GameMode => (v === "informative" ? "informative" : "competitive");

/** Available durations in seconds; 0 = unlimited */
export const TIME_LIMITS = [5, 10, 20, 30, 60, 90, 120, 0];

/** Sanitizes and validates a list of questions sent by the client. Throws an AppError on invalid input. */
export function sanitizeQuestions(input: unknown, mode: GameMode = "competitive"): Question[] {
  if (!Array.isArray(input)) throw new AppError("questions_invalid");
  if (input.length > 200) throw new AppError("too_many_questions", { max: 200 });

  return input.map((raw, i) => {
    const q = raw as Partial<Question>;
    const params = { question: i + 1 };
    const text = String(q.text ?? "").trim();
    if (!text) throw new AppError("question_text_missing", params);

    const answers = Array.isArray(q.answers) ? q.answers.map((a) => String(a ?? "").trim()) : [];
    if (answers.length < 2 || answers.length > 4) throw new AppError("answers_count", params);
    if (answers.some((a) => !a)) throw new AppError("answer_empty", params);

    const correct = Array.isArray(q.correct)
      ? [...new Set(q.correct.filter((c) => Number.isInteger(c) && c >= 0 && c < answers.length))]
      : [];
    // In informative mode, a question without a correct answer is a poll
    if (correct.length === 0 && mode === "competitive") {
      throw new AppError("correct_required", params);
    }

    const rawLimit = Number(q.timeLimit ?? 20);
    const timeLimit = rawLimit === 0 ? 0 : Math.min(240, Math.max(5, Math.round(rawLimit) || 20));

    return {
      id: String(q.id || crypto.randomUUID()),
      text: text.slice(0, 300),
      answers: answers.map((a) => a.slice(0, 120)),
      correct,
      timeLimit,
      imageUrl: q.imageUrl ? String(q.imageUrl).slice(0, 500) : undefined,
    };
  });
}
