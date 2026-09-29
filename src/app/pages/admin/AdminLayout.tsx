import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import {
  Button,
  Caption1,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Tab,
  TabList,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { SignOutRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { ThemeToggle } from "../../components/ThemeToggle";

const useStyles = makeStyles({
  page: { minHeight: "100vh", background: tokens.colorNeutralBackground2 },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXL,
    padding: `0 ${tokens.spacingHorizontalXL}`,
    height: "56px",
    background: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  spacer: { flex: 1 },
  content: { maxWidth: "1100px", margin: "0 auto", padding: tokens.spacingHorizontalXL },
  center: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: tokens.spacingHorizontalL },
});

export function AdminLayout() {
  const s = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [me, setMe] = useState<{ email: string; devBypass?: boolean } | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api<{ email: string; devBypass?: boolean }>("/admin/me").then(
      setMe,
      () => setDenied(true),
    );
  }, []);

  if (denied) {
    return (
      <div className={s.center}>
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{t("admin.accessDenied")}</MessageBarTitle>
            {t("admin.accessDeniedBody")}
          </MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  if (!me) {
    return (
      <div className={s.center}>
        <Spinner />
      </div>
    );
  }

  const tab = pathname.startsWith("/admin/games") ? "games" : "sets";

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Title3>{t("common.appName")}</Title3>
        <TabList selectedValue={tab} onTabSelect={(_, d) => navigate(d.value === "games" ? "/admin/games" : "/admin")}>
          <Tab value="sets">{t("admin.tabSets")}</Tab>
          <Tab value="games">{t("admin.tabGames")}</Tab>
        </TabList>
        <div className={s.spacer} />
        <ThemeToggle />
        <Caption1>{me.devBypass ? t("admin.devIdentity", { email: me.email }) : me.email}</Caption1>
        {!me.devBypass && (
          <Button as="a" href="/cdn-cgi/access/logout" appearance="subtle" icon={<SignOutRegular />}>
            {t("admin.logout")}
          </Button>
        )}
      </header>
      <main className={s.content}>
        <Outlet />
      </main>
    </div>
  );
}
