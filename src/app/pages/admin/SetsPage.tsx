import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Button,
  makeStyles,
  MessageBar,
  Spinner,
  Badge,
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
import { AddRegular, DeleteRegular, EditRegular, PlayRegular } from "@fluentui/react-icons";
import { api } from "../../lib/api";
import { createGame } from "../../lib/createGame";
import { useTranslation } from "react-i18next";
import { toUiError, useErrorMessage, type UiError } from "../../lib/errors";
import type { QuestionSetSummary } from "../../../shared/types";

const useStyles = makeStyles({
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: tokens.spacingVerticalL },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
  table: { background: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusLarge },
});

export function SetsPage() {
  const s = useStyles();
  const navigate = useNavigate();
  const [sets, setSets] = useState<QuestionSetSummary[] | null>(null);
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<UiError | null>(null);

  const load = useCallback(() => {
    api<QuestionSetSummary[]>("/admin/sets").then(setSets, (e) => setError(toUiError(e)));
  }, []);
  useEffect(load, [load]);

  async function create() {
    const { id } = await api<{ id: string }>("/admin/sets", { method: "POST", json: { title: t("admin.sets.defaultTitle") } });
    navigate(`/admin/sets/${id}`);
  }

  async function remove(set: QuestionSetSummary) {
    if (!confirm(t("admin.sets.deleteConfirm", { title: set.title }))) return;
    await api(`/admin/sets/${set.id}`, { method: "DELETE" });
    load();
  }

  async function launch(id: string) {
    try {
      await createGame(id);
    } catch (e) {
      setError(toUiError(e));
    }
  }

  return (
    <>
      <div className={s.head}>
        <Title2>{t("admin.sets.title")}</Title2>
        <Button appearance="primary" icon={<AddRegular />} onClick={create}>
          {t("admin.sets.new")}
        </Button>
      </div>
      {error && <MessageBar intent="error">{errorMessage(error)}</MessageBar>}
      {!sets ? (
        <Spinner />
      ) : sets.length === 0 ? (
        <Text>{t("admin.sets.empty")}</Text>
      ) : (
        <Table className={s.table}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("admin.sets.colTitle")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 130 }}>{t("admin.sets.colMode")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 110 }}>{t("admin.sets.colQuestions")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 180 }}>{t("admin.sets.colUpdated")}</TableHeaderCell>
              <TableHeaderCell style={{ width: 280 }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sets.map((set) => (
              <TableRow key={set.id}>
                <TableCell>
                  <TableCellLayout description={set.description}>{set.title}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <Badge appearance="outline" color={set.mode === "competitive" ? "brand" : "informative"}>
                    {t(`modes.${set.mode}.label`)}
                  </Badge>
                </TableCell>
                <TableCell>{set.questionCount}</TableCell>
                <TableCell>{new Date(set.updatedAt).toLocaleString(i18n.language)}</TableCell>
                <TableCell>
                  <div className={s.actions}>
                    <Button
                      size="small"
                      appearance="primary"
                      icon={<PlayRegular />}
                      disabled={set.questionCount === 0}
                      onClick={() => launch(set.id)}
                    >
                      {t("admin.sets.launch")}
                    </Button>
                    <Button size="small" icon={<EditRegular />} onClick={() => navigate(`/admin/sets/${set.id}`)}>
                      {t("admin.sets.edit")}
                    </Button>
                    <Button size="small" appearance="subtle" icon={<DeleteRegular />} aria-label={t("admin.sets.delete")} onClick={() => remove(set)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
