import { useTranslation } from "react-i18next";
import type { ErrorCode, ErrorParams } from "../../shared/errors";
import { ApiError } from "./api";

/** An error ready to be translated: a code plus optional interpolation params. */
export interface UiError {
  code: ErrorCode;
  params?: ErrorParams;
}

export function toUiError(e: unknown): UiError {
  if (e instanceof ApiError) return { code: e.code, params: e.params };
  console.error(e);
  return { code: "internal" };
}

/** Returns a function that turns a UiError into a message in the current language. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (err: UiError) => t(`errors.${err.code}`, err.params);
}
