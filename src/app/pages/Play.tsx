import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Badge,
  Body1,
  Button,
  Card,
  Field,
  Input,
  makeStyles,
  MessageBar,
  Spinner,
  Subtitle1,
  Text,
  Title2,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircleFilled, DismissCircleFilled, FireFilled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCountdown, useRoom } from "../lib/useRoom";
import { useErrorMessage } from "../lib/errors";
import { AnswerTile } from "../components/AnswerTile";
import { NAME_KEY } from "./Home";
import { ThemeToggle } from "../components/ThemeToggle";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: tokens.colorNeutralBackground2,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    background: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalL,
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingHorizontalM,
    width: "100%",
    maxWidth: "720px",
    "@media (max-width: 480px)": { gridTemplateColumns: "1fr" },
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    width: "100%",
    maxWidth: "360px",
  },
  bigIcon: { fontSize: "72px" },
});

export function Play() {
  const s = useStyles();
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { view, error, kicked, deadline, send } = useRoom(code, "player");
  const seconds = useCountdown(deadline);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const autoJoined = useRef(false);

  // Automatically join with the name entered on the home page
  useEffect(() => {
    if (view && !view.me && name.trim() && !autoJoined.current) {
      autoJoined.current = true;
      send({ type: "join", name: name.trim() });
    }
  }, [view, name, send]);

  function join(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem(NAME_KEY, name.trim());
    send({ type: "join", name: name.trim() });
  }

  if (kicked) {
    return (
      <main className={s.page}>
        <div className={s.body}>
          <Title3 align="center">{t("play.kicked")}</Title3>
          <Button onClick={() => navigate("/")}>{t("common.backHome")}</Button>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className={s.page}>
        <div className={s.body}>
          {error ? (
            <MessageBar intent="error">{errorMessage(error)}</MessageBar>
          ) : (
            <Spinner label={t("common.connecting")} />
          )}
        </div>
      </main>
    );
  }

  const { me, phase, question, lastResult } = view;
  const competitive = view.mode === "competitive";

  let content;
  if (!me) {
    content = (
      <Card>
        <form className={s.form} onSubmit={join}>
          <Subtitle1>{view.title}</Subtitle1>
          <Field label={t("common.name")}>
            <Input size="large" maxLength={24} value={name} onChange={(_, d) => setName(d.value)} autoFocus />
          </Field>
          {error && <MessageBar intent="error">{errorMessage(error)}</MessageBar>}
          <Button appearance="primary" size="large" type="submit" disabled={!name.trim()}>
            {t("common.join")}
          </Button>
        </form>
      </Card>
    );
  } else if (phase === "lobby") {
    content = (
      <>
        <Title2 align="center">{t("play.welcome", { name: me.name })}</Title2>
        <Body1 align="center">{t("play.waitingStart")}</Body1>
        <Spinner />
      </>
    );
  } else if (phase === "question" && question) {
    content =
      view.answered === null ? (
        <>
          <Subtitle1 align="center">{question.text}</Subtitle1>
          <div className={s.grid}>
            {question.answers.map((a, i) => (
              <AnswerTile key={i} index={i} onClick={() => send({ type: "answer", index: i })}>
                {a}
              </AnswerTile>
            ))}
          </div>
        </>
      ) : (
        <>
          <Title3 align="center">{t("play.answerSent")}</Title3>
          <div style={{ width: "100%", maxWidth: 360 }}>
            <AnswerTile index={view.answered}>{question.answers[view.answered]}</AnswerTile>
          </div>
          <Spinner label={t("play.waitingOthers")} />
        </>
      );
  } else if (phase === "reveal" && question?.correct?.length === 0) {
    // Poll: no correct answer
    content = (
      <>
        <Title2 align="center">{view.answered === null ? t("play.noAnswer") : t("play.answerRecorded")}</Title2>
        <Body1 align="center">{t("play.lookAtScreen")}</Body1>
      </>
    );
  } else if (phase === "reveal") {
    const ok = lastResult?.correct;
    content = (
      <>
        {ok ? (
          <CheckmarkCircleFilled className={s.bigIcon} color={tokens.colorPaletteGreenForeground1} />
        ) : (
          <DismissCircleFilled className={s.bigIcon} color={tokens.colorPaletteRedForeground1} />
        )}
        <Title2 align="center">{ok ? t("play.correct") : view.answered === null ? t("play.tooLate") : t("play.wrong")}</Title2>
        {ok && competitive && <Title3 align="center">+{lastResult?.points}</Title3>}
        {competitive && me.streak >= 2 && (
          <Badge size="extra-large" color="warning" icon={<FireFilled />}>
            {t("play.streak", { count: me.streak })}
          </Badge>
        )}
      </>
    );
  } else if (phase === "ended" && !competitive) {
    content = (
      <>
        <Title2 align="center">{t("play.thanks")}</Title2>
        <Button onClick={() => navigate("/")}>{t("common.backHome")}</Button>
      </>
    );
  } else if (phase === "leaderboard" || phase === "ended") {
    content = (
      <>
        <Subtitle1 align="center">{phase === "ended" ? t("play.finalRanking") : t("play.ranking")}</Subtitle1>
        <Title2 align="center">{t("play.rank", { count: me.rank, ordinal: true, total: view.playerCount })}</Title2>
        <Title3 align="center">{t("play.points", { count: me.score })}</Title3>
        {phase === "ended" && <Button onClick={() => navigate("/")}>{t("play.newGame")}</Button>}
      </>
    );
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <Text truncate wrap={false} style={{ flex: 1, minWidth: 0 }}>
          {me?.name ?? view.title}
        </Text>
        {phase === "question" && seconds !== null && (
          <Badge size="extra-large" appearance="filled">
            {seconds}
          </Badge>
        )}
        {question && phase !== "lobby" && (
          <Body1>
            {question.index + 1}/{question.total}
          </Body1>
        )}
        {me && competitive && <Badge appearance="tint">{t("common.pts", { count: me.score })}</Badge>}
        <ThemeToggle />
      </header>
      <div className={s.body}>
        {me && error && <MessageBar intent="warning">{errorMessage(error)}</MessageBar>}
        {content}
      </div>
    </main>
  );
}
