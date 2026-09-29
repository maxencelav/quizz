import { Badge, Body1Strong, makeStyles, tokens } from "@fluentui/react-components";
import { TrophyFilled } from "@fluentui/react-icons";
import type { LeaderboardEntry } from "../../shared/types";

const MEDALS = [
  tokens.colorPaletteGoldForeground2,
  tokens.colorNeutralForeground3,
  tokens.colorPaletteBrownForeground2,
];

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, width: "100%" },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    fontSize: tokens.fontSizeBase500,
  },
  rank: { width: "32px", textAlign: "center", fontWeight: tokens.fontWeightBold },
  name: { flex: 1 },
});

export function Leaderboard({ entries, limit = 5 }: { entries: LeaderboardEntry[]; limit?: number }) {
  const s = useStyles();
  return (
    <div className={s.list}>
      {entries.slice(0, limit).map((e, i) => (
        <div key={e.id} className={s.row}>
          <span className={s.rank}>
            {i < 3 ? <TrophyFilled style={{ color: MEDALS[i] }} /> : i + 1}
          </span>
          <Body1Strong className={s.name} style={{ fontSize: "inherit" }}>
            {e.name}
          </Body1Strong>
          <Badge size="extra-large" appearance="tint">
            {e.score}
          </Badge>
        </div>
      ))}
    </div>
  );
}
