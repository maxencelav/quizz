import i18n from "../i18n";
import { api } from "./api";
import type { GameExport } from "../../shared/types";

const LETTERS = ["A", "B", "C", "D"];

/**
 * Downloads a CSV with one row per player and, for each question,
 * the chosen answer, whether it was correct, the points and the response time.
 * Headers follow the UI language; the separator and decimal mark follow what
 * Excel expects for that locale (";" and "," in French, "," and "." in English).
 */
export async function downloadAnswersCsv(code: string) {
  const data = await api<GameExport>(`/admin/games/${code}/export`);
  const t = i18n.t;
  const lang = i18n.resolvedLanguage ?? "en";
  const sep = lang === "fr" ? ";" : ",";
  const seconds = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });

  const cell = (v: string | number) => {
    const s = String(v);
    return s.includes(sep) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const scored = data.mode === "competitive";
  // Poll (no correct answer): no "correct" column
  const judged = data.questions.map((q) => q.correct.length > 0);

  const header = scored
    ? [t("csv.rank"), t("csv.name"), t("csv.score"), t("csv.correctCount")]
    : [t("csv.name"), t("csv.correctCount")];
  data.questions.forEach((q, i) => {
    const label = `Q${i + 1} ${q.text}`;
    header.push(`${label} - ${t("csv.answer")}`);
    if (judged[i]) header.push(`${label} - ${t("csv.correct")}`);
    if (scored) header.push(`${label} - ${t("csv.points")}`);
    header.push(`${label} - ${t("csv.time")}`);
  });

  const rows = data.players.map((p) => {
    const good = p.answers.filter((a) => a?.correct).length;
    const row: (string | number)[] = scored ? [p.rank, p.name, p.score, good] : [p.name, good];
    p.answers.forEach((a, qi) => {
      const text = !a
        ? ""
        : a.answer !== null
          ? `${LETTERS[a.answer]}. ${data.questions[qi].answers[a.answer]}`
          : t("csv.noAnswer");
      row.push(text);
      if (judged[qi]) row.push(!a ? "" : a.correct ? t("csv.yes") : t("csv.no"));
      if (scored) row.push(a?.points ?? "");
      row.push(a?.timeMs != null ? seconds.format(a.timeMs / 1000) : "");
    });
    return row;
  });

  // UTF-8 BOM so Excel displays accented characters correctly
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(sep)).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  const slug = data.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();
  a.download = `quizz-${code}${slug ? `-${slug}` : ""}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
