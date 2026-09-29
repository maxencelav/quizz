import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogActions,
  DialogTrigger,
  Tooltip,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  Option,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownloadRegular, DeleteRegular, OpenRegular, PlayRegular, TrophyRegular } from "@fluentui/react-icons";
import { api } from "../../lib/api";
import { createGame } from "../../lib/createGame";
import { downloadAnswersCsv } from "../../lib/exportAnswers";
import { useTranslation } from "react-i18next";
import { toUiError, useErrorMessage, type UiError } from "../../lib/errors";
import { Leaderboard } from "../../components/Leaderboard";
import type { GameSummary, LeaderboardEntry, QuestionSetSummary } from "../../../shared/types";

const STATUS_COLOR: Record<GameSummary["status"], "informative" | "success" | "subtle"> = {
  lobby: "informative",
  running: "success",
  ended: "subtle",
};

const useStyles = makeStyles({
  head: { marginBottom: tokens.spacingVerticalL },
  create: {
    display: "flex",
    alignItems: "flex-end",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXL,
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    flexWrap: "wrap",
  },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
  table: { background: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusLarge },
  pin: { fontFamily: tokens.fontFamilyMonospace, fontWeight: tokens.fontWeightSemibold },
});

export function GamesPage() {
  const s = useStyles();
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [sets, setSets] = useState<QuestionSetSummary[]>([]);
  const [setId, setSetId] = useState<string>("");
  const [error, setError] = useState<UiError | null>(null);
  const [results, setResults] = useState<{ game: GameSummary; entries: LeaderboardEntry[] } | null>(null);

  const load = useCallback(() => {
    api<GameSummary[]>("/admin/games").then(setGames, (e) => setError(toUiError(e)));
  }, []);

  useEffect(() => {
    load();
    api<QuestionSetSummary[]>("/admin/sets").then((data) => setSets(data.filter((x) => x.questionCount > 0)));
  }, [load]);

  async function create() {
    try {
      await createGame(setId);
      load();
    } catch (e) {
      setError(toUiError(e));
    }
  }

  async function remove(code: string) {
    if (!confirm(t("admin.games.deleteConfirm", { code }))) return;
    await api(`/admin/games/${code}`, { method: "DELETE" });
    load();
  }

  async function exportCsv(code: string) {
    try {
      await downloadAnswersCsv(code);
    } catch (e) {
      setError(toUiError(e));
    }
  }

  async function showResults(game: GameSummary) {
    const entries = await api<LeaderboardEntry[]>(`/admin/games/${game.code}/results`);
    setResults({ game, entries });
  }

  const selectedSet = sets.find((x) => x.id === setId);

  return (
    <>
      <Title2 block className={s.head}>
        {t("admin.games.title")}
      </Title2>

      <div className={s.create}>
        <Field label={t("admin.games.set")} style={{ flex: 1, minWidth: 240 }}>
          <Dropdown
            placeholder={t("admin.games.chooseSet")}
            value={selectedSet ? selectedSet.title : ""}
            selectedOptions={setId ? [setId] : []}
            onOptionSelect={(_, d) => setSetId(d.optionValue ?? "")}
          >
            {sets.map((x) => (
              <Option key={x.id} value={x.id} text={x.title}>
                {t("admin.games.setOption", { title: x.title, count: x.questionCount })}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Button appearance="primary" icon={<PlayRegular />} disabled={!setId} onClick={create}>
          {t("admin.games.create")}
        </Button>
      </div>

      {error && <MessageBar intent="error">{errorMessage(error)}</MessageBar>}

      {!games ? (
        <Spinner />
      ) : games.length === 0 ? (
        <Text>{t("admin.games.empty")}</Text>
      ) : (
        <Table className={s.table}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ width: 110 }}>{t("admin.games.colPin")}</TableHeaderCell>
              <TableHeaderCell>{t("admin.games.colQuiz")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 130 }}>{t("admin.games.colStatus")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 180 }}>{t("admin.games.colCreated")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 240 }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.map((g) => (
              <TableRow key={g.code}>
                <TableCell className={s.pin}>{g.code}</TableCell>
                <TableCell>
                  <TableCellLayout description={t(`modes.${g.mode}.label`)}>{g.title}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <Badge appearance="tint" color={STATUS_COLOR[g.status]}>
                    {t(`admin.games.status.${g.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(g.createdAt).toLocaleString(i18n.language)}</TableCell>
                <TableCell>
                  <div className={s.actions}>
                    {g.status === "ended" ? (
                      g.mode === "competitive" && (
                        <Button size="small" icon={<TrophyRegular />} onClick={() => showResults(g)}>
                          {t("admin.games.results")}
                        </Button>
                      )
                    ) : (
                      <Button size="small" icon={<OpenRegular />} onClick={() => window.open(`/host/${g.code}`, "_blank")}>
                        {t("admin.games.presentation")}
                      </Button>
                    )}
                    {g.status !== "lobby" && (
                      <Tooltip content={t("admin.games.exportCsv")} relationship="label">
                        <Button size="small" appearance="subtle" icon={<ArrowDownloadRegular />} onClick={() => exportCsv(g.code)} />
                      </Tooltip>
                    )}
                    <Button size="small" appearance="subtle" icon={<DeleteRegular />} aria-label={t("admin.games.delete")} onClick={() => remove(g.code)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!results} onOpenChange={(_, d) => !d.open && setResults(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("admin.games.resultsTitle", { title: results?.game.title })}</DialogTitle>
            <DialogContent>
              {results && (results.entries.length ? <Leaderboard entries={results.entries} limit={100} /> : <Text>{t("admin.games.noPlayers")}</Text>)}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={() => results && exportCsv(results.game.code)}>
                {t("host.exportAnswers")}
              </Button>
              <DialogTrigger disableButtonEnhancement>
                <Button>{t("common.close")}</Button>
              </DialogTrigger>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
