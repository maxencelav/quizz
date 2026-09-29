import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import {
  CheckmarkCircleFilled,
  CircleFilled,
  DiamondFilled,
  DismissCircleFilled,
  SquareFilled,
  TriangleFilled,
} from "@fluentui/react-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

// The 4 iconic colors/shapes. The *BorderActive tokens give the saturated shade
// of each Fluent palette, identical in light and dark themes (white text stays readable).
export const ANSWER_STYLES = [
  { color: tokens.colorPaletteRedBorderActive, Icon: TriangleFilled, shape: "triangle" },
  { color: tokens.colorPaletteBlueBorderActive, Icon: DiamondFilled, shape: "diamond" },
  { color: tokens.colorPaletteMarigoldBorderActive, Icon: CircleFilled, shape: "circle" },
  { color: tokens.colorPaletteGreenBorderActive, Icon: SquareFilled, shape: "square" },
] as const;

const useStyles = makeStyles({
  tile: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
    padding: tokens.spacingHorizontalL,
    borderRadius: tokens.borderRadiusXLarge,
    border: "none",
    color: "white",
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    fontFamily: "inherit",
    textAlign: "left",
    minHeight: "80px",
    width: "100%",
    boxShadow: tokens.shadow8,
    transition: "opacity 200ms, transform 100ms",
  },
  clickable: {
    cursor: "pointer",
    ":active": { transform: "scale(0.97)" },
    ":disabled": { cursor: "default" },
  },
  dimmed: { opacity: 0.3 },
  large: { fontSize: tokens.fontSizeHero700, minHeight: "120px" },
  icon: { fontSize: "36px", flexShrink: 0 },
  text: { flex: 1, overflowWrap: "anywhere" },
});

export function AnswerTile({
  index,
  children,
  onClick,
  dimmed,
  status,
  large,
  disabled,
}: {
  index: number;
  children?: ReactNode;
  onClick?: () => void;
  dimmed?: boolean;
  status?: "correct" | "wrong";
  large?: boolean;
  disabled?: boolean;
}) {
  const s = useStyles();
  const { t } = useTranslation();
  const { color, Icon, shape } = ANSWER_STYLES[index % 4];
  const StatusIcon = status === "correct" ? CheckmarkCircleFilled : DismissCircleFilled;
  return (
    <button
      type="button"
      aria-label={typeof children === "string" ? children : t(`shapes.${shape}`)}
      className={mergeClasses(s.tile, onClick && s.clickable, dimmed && s.dimmed, large && s.large)}
      style={{ background: color }}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      <Icon className={s.icon} />
      <span className={s.text}>{children}</span>
      {status && <StatusIcon className={s.icon} />}
    </button>
  );
}
