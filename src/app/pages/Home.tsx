import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Button,
  Card,
  Field,
  Input,
  Link as FluentLink,
  makeStyles,
  MessageBar,
  Title1,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { toUiError, useErrorMessage, type UiError } from "../lib/errors";
import type { GameSummary } from "../../shared/types";
import { ThemeToggle } from "../components/ThemeToggle";

export const NAME_KEY = "quizz:name";

const useStyles = makeStyles({
  page: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalL,
    background: tokens.colorNeutralBackground2,
  },
  corner: { position: "absolute", top: tokens.spacingVerticalS, right: tokens.spacingHorizontalS },
  card: { width: "100%", maxWidth: "400px" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

export function Home() {
  const s = useStyles();
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pin, setPin] = useState(params.get("pin") ?? "");
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [error, setError] = useState<UiError | null>(null);
  const [loading, setLoading] = useState(false);

  async function join(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const game = await api<GameSummary>(`/games/${pin}`);
      if (game.status === "ended") throw new ApiError("game_ended", undefined, 400);
      localStorage.setItem(NAME_KEY, name.trim());
      navigate(`/play/${pin}`);
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={s.page}>
      <div className={s.corner}>
        <ThemeToggle />
      </div>
      <Title1 align="center">{t("common.appName")}</Title1>
      <Card className={s.card}>
        <form className={s.form} onSubmit={join}>
          <Field label={t("home.pin")}>
            <Input
              size="large"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(_, d) => setPin(d.value.replace(/\D/g, ""))}
              autoFocus={!pin}
            />
          </Field>
          <Field label={t("common.name")}>
            <Input
              size="large"
              maxLength={24}
              value={name}
              onChange={(_, d) => setName(d.value)}
              autoFocus={!!pin}
            />
          </Field>
          {error && <MessageBar intent="error">{errorMessage(error)}</MessageBar>}
          <Button
            appearance="primary"
            size="large"
            type="submit"
            disabled={pin.length !== 6 || !name.trim() || loading}
          >
            {t("common.join")}
          </Button>
        </form>
      </Card>
      {/* Full page navigation (no client-side routing) so the Cloudflare Access login kicks in */}
      <FluentLink href="/admin">{t("home.admin")}</FluentLink>
    </main>
  );
}
