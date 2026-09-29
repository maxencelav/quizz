import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  Dropdown,
  Field,
  Radio,
  RadioGroup,
  Input,
  makeStyles,
  MessageBar,
  Option,
  Spinner,
  Text,
  Textarea,
  Title2,
  Toolbar,
  ToolbarButton,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowDownRegular,
  ArrowLeftRegular,
  ArrowUpRegular,
  DeleteRegular,
  DismissRegular,
  PlayRegular,
  SaveRegular,
} from "@fluentui/react-icons";
import { api } from "../../lib/api";
import { createGame } from "../../lib/createGame";
import { ANSWER_STYLES } from "../../components/AnswerTile";
import { TIME_LIMITS } from "../../../shared/validation";
import type { GameMode, Question, QuestionSet } from "../../../shared/types";
import { useTranslation } from "react-i18next";
import { GAME_MODES } from "../../lib/modes";
import { toUiError, useErrorMessage, type UiError } from "../../lib/errors";

const useStyles = makeStyles({
  head: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
    position: "sticky",
    top: 0,
    zIndex: 1,
    padding: `${tokens.spacingVerticalS} 0`,
    background: tokens.colorNeutralBackground2,
  },
  spacer: { flex: 1 },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  row: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "flex-end", flexWrap: "wrap" },
  grow: { flex: 1, minWidth: "240px" },
  answers: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingHorizontalM,
    "@media (max-width: 700px)": { gridTemplateColumns: "1fr" },
  },
  answer: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingLeft: tokens.spacingHorizontalS,
    borderLeft: "6px solid",
    borderRadius: tokens.borderRadiusMedium,
  },
});

const newQuestion = (): Question => ({
  id: crypto.randomUUID(),
  text: "",
  answers: ["", ""],
  correct: [0],
  timeLimit: 20,
});

export function SetEditor() {
  const s = useStyles();
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { id = "" } = useParams();
  const [set, setSet] = useState<QuestionSet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ intent: "success" } | { intent: "error"; error: UiError } | null>(null);
  const showError = (e: unknown) => setMessage({ intent: "error", error: toUiError(e) });
  const formatLimit = (limit: number) =>
    limit === 0 ? t("admin.editor.unlimited") : t("admin.editor.seconds", { count: limit });

  useEffect(() => {
    api<QuestionSet>(`/admin/sets/${id}`).then(
      (data) => setSet(data.questions.length ? data : { ...data, questions: [newQuestion()] }),
      showError,
    );
  }, [id]);

  if (!set) {
    return message?.intent === "error" ? (
      <MessageBar intent="error">{errorMessage(message.error)}</MessageBar>
    ) : (
      <Spinner />
    );
  }

  const update = (patch: Partial<QuestionSet>) => {
    setSet({ ...set, ...patch });
    setDirty(true);
  };
  const updateQuestion = (index: number, patch: Partial<Question>) =>
    update({ questions: set.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) });
  const moveQuestion = (index: number, delta: number) => {
    const questions = [...set.questions];
    const [q] = questions.splice(index, 1);
    questions.splice(index + delta, 0, q);
    update({ questions });
  };

  async function save() {
    setSaving(true);
    try {
      await api(`/admin/sets/${id}`, { method: "PUT", json: set });
      setDirty(false);
      setMessage({ intent: "success" });
      return true;
    } catch (e) {
      showError(e);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function launch() {
    if (dirty && !(await save())) return;
    try {
      await createGame(id);
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <div className={s.head}>
        <Link to="/admin">
          <Button appearance="subtle" icon={<ArrowLeftRegular />} aria-label={t("admin.editor.back")} />
        </Link>
        <Title2>{set.title || t("common.untitled")}</Title2>
        <div className={s.spacer} />
        <Button icon={<PlayRegular />} onClick={launch}>
          {t("admin.editor.launch")}
        </Button>
        <Button appearance="primary" icon={<SaveRegular />} disabled={!dirty || saving} onClick={save}>
          {saving ? t("admin.editor.saving") : t("admin.editor.save")}
        </Button>
      </div>

      <div className={s.stack}>
        {message && (
          <MessageBar intent={message.intent} onClick={() => setMessage(null)}>
            {message.intent === "success" ? t("admin.editor.saved") : errorMessage(message.error)}
          </MessageBar>
        )}

        <Card>
          <div className={s.row}>
            <Field label={t("admin.editor.title")} className={s.grow}>
              <Input value={set.title} onChange={(_, d) => update({ title: d.value })} />
            </Field>
          </div>
          <Field label={t("admin.editor.description")}>
            <Textarea value={set.description} onChange={(_, d) => update({ description: d.value })} resize="vertical" />
          </Field>
          <Field label={t("admin.editor.mode")} hint={t(`modes.${set.mode}.description`)}>
            <RadioGroup
              layout="horizontal"
              value={set.mode}
              onChange={(_, d) => update({ mode: d.value as GameMode })}
            >
              {GAME_MODES.map((m) => (
                <Radio key={m} value={m} label={t(`modes.${m}.label`)} />
              ))}
            </RadioGroup>
          </Field>
        </Card>

        {set.questions.map((q, qi) => (
          <Card key={q.id}>
            <CardHeader
              header={<Text weight="semibold">{t("admin.editor.questionN", { n: qi + 1 })}</Text>}
              action={
                <Toolbar size="small">
                  <Tooltip content={t("admin.editor.moveUp")} relationship="label">
                    <ToolbarButton icon={<ArrowUpRegular />} disabled={qi === 0} onClick={() => moveQuestion(qi, -1)} />
                  </Tooltip>
                  <Tooltip content={t("admin.editor.moveDown")} relationship="label">
                    <ToolbarButton
                      icon={<ArrowDownRegular />}
                      disabled={qi === set.questions.length - 1}
                      onClick={() => moveQuestion(qi, 1)}
                    />
                  </Tooltip>
                  <Tooltip content={t("admin.editor.deleteQuestion")} relationship="label">
                    <ToolbarButton
                      icon={<DeleteRegular />}
                      onClick={() => update({ questions: set.questions.filter((_, i) => i !== qi) })}
                    />
                  </Tooltip>
                </Toolbar>
              }
            />
            <Field label={t("admin.editor.question")} required>
              <Textarea value={q.text} onChange={(_, d) => updateQuestion(qi, { text: d.value })} resize="vertical" />
            </Field>
            <div className={s.row}>
              <Field label={t("admin.editor.image")} className={s.grow}>
                <Input
                  type="url"
                  value={q.imageUrl ?? ""}
                  onChange={(_, d) => updateQuestion(qi, { imageUrl: d.value || undefined })}
                />
              </Field>
              <Field label={t("admin.editor.time")}>
                <Dropdown
                  value={formatLimit(q.timeLimit)}
                  selectedOptions={[String(q.timeLimit)]}
                  onOptionSelect={(_, d) => updateQuestion(qi, { timeLimit: Number(d.optionValue) })}
                  style={{ minWidth: 100 }}
                >
                  {TIME_LIMITS.map((limit) => (
                    <Option key={limit} value={String(limit)}>
                      {formatLimit(limit)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            </div>
            <Field
              label={
                set.mode === "competitive" ? t("admin.editor.answersCompetitive") : t("admin.editor.answersInformative")
              }
            >
              <div className={s.answers}>
                {q.answers.map((a, ai) => (
                  <div key={ai} className={s.answer} style={{ borderColor: ANSWER_STYLES[ai].color }}>
                    <Checkbox
                      checked={q.correct.includes(ai)}
                      aria-label={t("admin.editor.correctAnswer")}
                      onChange={(_, d) =>
                        updateQuestion(qi, {
                          correct: d.checked ? [...q.correct, ai] : q.correct.filter((c) => c !== ai),
                        })
                      }
                    />
                    <Input
                      className={s.grow}
                      placeholder={t("admin.editor.answerN", { n: ai + 1 })}
                      value={a}
                      onChange={(_, d) =>
                        updateQuestion(qi, { answers: q.answers.map((x, i) => (i === ai ? d.value : x)) })
                      }
                    />
                    {q.answers.length > 2 && (
                      <Button
                        appearance="subtle"
                        icon={<DismissRegular />}
                        aria-label={t("admin.editor.removeAnswer")}
                        onClick={() =>
                          updateQuestion(qi, {
                            answers: q.answers.filter((_, i) => i !== ai),
                            correct: q.correct.filter((c) => c !== ai).map((c) => (c > ai ? c - 1 : c)),
                          })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </Field>
            {q.answers.length < 4 && (
              <div>
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<AddRegular />}
                  onClick={() => updateQuestion(qi, { answers: [...q.answers, ""] })}
                >
                  {t("admin.editor.addAnswer")}
                </Button>
              </div>
            )}
          </Card>
        ))}

        <Button icon={<AddRegular />} onClick={() => update({ questions: [...set.questions, newQuestion()] })}>
          {t("admin.editor.addQuestion")}
        </Button>
      </div>
    </>
  );
}
