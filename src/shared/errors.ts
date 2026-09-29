// Error codes shared by the Worker and the front end. The server only sends codes
// (plus optional params); the client translates them into the user's language.

export type ErrorCode =
  // Generic
  | "unauthorized"
  | "invalid_request"
  | "internal"
  | "network"
  // Games and sets
  | "game_not_found"
  | "game_ended"
  | "set_not_found"
  | "set_empty"
  | "title_required"
  | "pin_generation_failed"
  // Real-time
  | "host_only"
  | "name_required"
  | "name_taken"
  // Question validation ({ question } = 1-based question number)
  | "questions_invalid"
  | "too_many_questions"
  | "question_text_missing"
  | "answers_count"
  | "answer_empty"
  | "correct_required";

export type ErrorParams = Record<string, string | number>;

/** JSON body of an API error response */
export interface ErrorBody {
  error: ErrorCode;
  params?: ErrorParams;
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public params?: ErrorParams,
    public status: 400 | 401 | 404 | 500 = 400,
  ) {
    super(code);
  }
}
