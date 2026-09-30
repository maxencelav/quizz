import { useEffect } from "react";
import { useParams } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import {
  Badge,
  Button,
  Card,
  makeStyles,
  MessageBar,
  Spinner,
  Subtitle1,
  Tag,
  TagGroup,
  Text,
  Title1,
  Title3,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  ArrowRightRegular,
  FullScreenMaximizeRegular,
  PeopleRegular,
  PlayRegular,
  StopRegular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCountdown, useRoom } from "../lib/useRoom";
import { useErrorMessage } from "../lib/errors";
import { downloadAnswersCsv } from "../lib/exportAnswers";
import { AnswerTile, ANSWER_STYLES } from "../components/AnswerTile";
import { Leaderboard } from "../components/Leaderboard";
import type { HostView } from "../../shared/types";
import { ThemeToggle } from "../components/ThemeToggle";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: tokens.colorNeutralBackground3,
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    background: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  spacer: { flex: 1 },
  stage: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalXXL,
    padding: tokens.spacingHorizontalXXL,
    width: "100%",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  lobbyHead: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXXL,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pin: { fontSize: "96px", lineHeight: "1", fontWeight: tokens.fontWeightBold, letterSpacing: "0.1em" },
  qr: { padding: tokens.spacingHorizontalM, background: "white", borderRadius: tokens.borderRadiusLarge },
  question: {
    width: "100%",
    textAlign: "center",
    padding: tokens.spacingHorizontalXXL,
    fontSize: tokens.fontSizeHero800,
    lineHeight: tokens.lineHeightHero800,
    fontWeight: tokens.fontWeightSemibold,
  },
  middle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: tokens.spacingHorizontalXXL,
  },
  timer: {
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightBold,
    flexShrink: 0,
  },
  image: { maxHeight: "35vh", maxWidth: "100%", borderRadius: tokens.borderRadiusXLarge },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalL, width: "100%" },
  chart: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalL, height: "30vh" },
  bar: {
    width: "100px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: tokens.spacingVerticalXS,
    height: "100%",
  },
  barFill: { width: "100%", borderRadius: tokens.borderRadiusMedium, minHeight: "8px", transition: "height 600ms" },
  board: { width: "100%", maxWidth: "800px" },
});

export function Host() {
  const s = useStyles();
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { code = "" } = useParams();
  // Authenticated by the Cloudflare Access cookie (CF_Authorization), verified by the Worker
  const { view, error, deadline, send } = useRoom(code, "host");
  const seconds = useCountdown(deadline);

  // Space / Enter / right arrow: next step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, button")) return;
      if (!view) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        if (view.phase === "lobby") send({ type: "start" });
        else if (view.phase !== "ended") send({ type: "next" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, send]);

  if (!view) {
    return (
      <main className={s.page}>
        <div className={s.stage}>
          {error ? (
            <MessageBar intent="error">{errorMessage(error)}</MessageBar>
          ) : (
            <Spinner label={t("common.connecting")} />
          )}
        </div>
      </main>
    );
  }

  const competitive = view.mode === "competitive";
  const isLast = !!view.question && view.question.index + 1 >= view.question.total;
  const nextLabel = (() => {
    switch (view.phase) {
      case "question":
        return t("host.reveal");
      case "reveal":
        // Informative mode has no leaderboard: go straight to the next question
        if (competitive) return t("host.leaderboard");
        return isLast ? t("host.finish") : t("host.nextQuestion");
      case "leaderboard":
        return isLast ? t("host.podium") : t("host.nextQuestion");
    }
  })();

  return (
    <main className={s.page}>
      <header className={s.topbar}>
        <Subtitle1>{view.title}</Subtitle1>
        <Badge appearance="tint" size="large">
          {t("host.pin", { code: view.code })}
        </Badge>
        {view.question && view.phase !== "lobby" && (
          <Text>
            {t("common.questionProgress", { current: view.question.index + 1, total: view.question.total })}
          </Text>
        )}
        <div className={s.spacer} />
        <Badge appearance="outline" size="large" icon={<PeopleRegular />}>
          {view.players.filter((p) => p.connected).length}
        </Badge>
        <ThemeToggle />
        <Button
          appearance="subtle"
          icon={<FullScreenMaximizeRegular />}
          aria-label={t("host.fullscreen")}
          onClick={() => document.documentElement.requestFullscreen?.()}
        />
        {view.phase === "ended" && (
          <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={() => downloadAnswersCsv(view.code)}>
            {t("host.exportAnswers")}
          </Button>
        )}
        {view.phase !== "ended" && view.phase !== "lobby" && (
          <Button icon={<StopRegular />} onClick={() => confirm(t("host.endConfirm")) && send({ type: "end" })}>
            {t("host.end")}
          </Button>
        )}
        {view.phase === "lobby" && (
          <Button
            appearance="primary"
            icon={<PlayRegular />}
            disabled={view.players.length === 0}
            onClick={() => send({ type: "start" })}
          >
            {t("host.start")}
          </Button>
        )}
        {nextLabel && (
          <Button appearance="primary" icon={<ArrowRightRegular />} iconPosition="after" onClick={() => send({ type: "next" })}>
            {nextLabel}
          </Button>
        )}
      </header>

      {error && <MessageBar intent="error">{errorMessage(error)}</MessageBar>}

      <div className={s.stage}>
        {view.phase === "lobby" && <Lobby view={view} onKick={(id) => send({ type: "kick", playerId: id })} />}
        {(view.phase === "question" || view.phase === "reveal") && <QuestionStage view={view} seconds={seconds} />}
        {view.phase === "leaderboard" && (
          <div className={s.board}>
            <Title1 block align="center" style={{ marginBottom: tokens.spacingVerticalXL }}>
              {t("host.leaderboard")}
            </Title1>
            <Leaderboard entries={view.leaderboard} />
          </div>
        )}
        {view.phase === "ended" &&
          (competitive ? (
            <div className={s.board}>
              <Title1 block align="center" style={{ marginBottom: tokens.spacingVerticalXL }}>
                {t("host.podium")}
              </Title1>
              <Leaderboard entries={view.leaderboard} limit={10} />
            </div>
          ) : (
            <>
              <Title1 align="center">{t("host.thanks")}</Title1>
              <Subtitle1 align="center">{t("host.participants", { count: view.players.length })}</Subtitle1>
            </>
          ))}
      </div>
    </main>
  );
}

function Lobby({ view, onKick }: { view: HostView; onKick: (id: string) => void }) {
  const s = useStyles();
  const { t } = useTranslation();
  const joinUrl = `${location.origin}/?pin=${view.code}`;
  return (
    <>
      <div className={s.lobbyHead}>
        <div>
          <Title3 block>{t("host.joinAt", { host: location.host })}</Title3>
          <div className={s.pin}>{view.code}</div>
        </div>
        <div className={s.qr}>
          <QRCodeSVG value={joinUrl} size={200} />
        </div>
      </div>
      <Card style={{ width: "100%", minHeight: 200 }}>
        <Subtitle1>{t("host.players", { count: view.players.length })}</Subtitle1>
        {view.players.length === 0 ? (
          <Text>{t("host.waitingPlayers")}</Text>
        ) : (
          <TagGroup onDismiss={(_, d) => onKick(d.value)} style={{ flexWrap: "wrap", gap: tokens.spacingHorizontalS }}>
            {view.players.map((p) => (
              <Tag
                key={p.id}
                value={p.id}
                size="medium"
                dismissible
                appearance={p.connected ? "brand" : "outline"}
                title={t("host.removePlayer")}
              >
                {p.name}
              </Tag>
            ))}
          </TagGroup>
        )}
      </Card>
    </>
  );
}

function QuestionStage({ view, seconds }: { view: HostView; seconds: number | null }) {
  const s = useStyles();
  const { t } = useTranslation();
  const q = view.question!;
  const revealed = view.phase === "reveal";
  const isPoll = q.correct?.length === 0;
  const max = Math.max(1, ...(view.distribution ?? [0]));

  return (
    <>
      <Card className={s.question}>{q.text}</Card>
      <div className={s.middle}>
        {revealed ? <div style={{ width: 120 }} /> : <div className={s.timer}>{q.timeLimit === 0 ? "∞" : seconds ?? ""}</div>}
        {revealed && view.distribution ? (
          <div className={s.chart}>
            {view.distribution.map((count, i) => (
              <div key={i} className={s.bar}>
                <Text weight="bold" size={500}>
                  {count}
                </Text>
                <div
                  className={s.barFill}
                  style={{
                    height: `${(count / max) * 100}%`,
                    background: ANSWER_STYLES[i].color,
                    opacity: !isPoll && !q.correct?.includes(i) ? 0.35 : 1,
                  }}
                />
              </div>
            ))}
          </div>
        ) : q.imageUrl ? (
          <img className={s.image} src={q.imageUrl} alt="" />
        ) : (
          <div />
        )}
        <div style={{ textAlign: "center" }}>
          <Title1 block>{view.answerCount}</Title1>
          <Text>{t("host.answers", { count: view.answerCount })}</Text>
        </div>
      </div>
      <div className={s.grid}>
        {q.answers.map((a, i) => {
          const correct = q.correct?.includes(i);
          // Poll (no correct answer): don't mark anything as right or wrong
          const judged = revealed && !isPoll;
          return (
            <AnswerTile
              key={i}
              index={i}
              large
              dimmed={judged && !correct}
              status={judged ? (correct ? "correct" : "wrong") : undefined}
            >
              {a}
            </AnswerTile>
          );
        })}
      </div>
    </>
  );
}
