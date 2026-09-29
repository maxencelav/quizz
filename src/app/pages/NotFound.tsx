import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button, makeStyles, Subtitle1, Title1, tokens } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalL,
    textAlign: "center",
  },
});

/** 404 page and route errors (used as the router's errorElement). */
export function NotFound() {
  const s = useStyles();
  const { t } = useTranslation();
  const error = useRouteError();
  const notFound = !error || (isRouteErrorResponse(error) && error.status === 404);
  if (error && !notFound) console.error(error);

  return (
    <main className={s.page}>
      <Title1>{notFound ? t("notFound.title") : t("notFound.errorTitle")}</Title1>
      <Subtitle1>{notFound ? t("notFound.subtitle") : t("notFound.errorSubtitle")}</Subtitle1>
      {/* Plain link (no client-side routing): works even if the router is in an error state */}
      <Button as="a" href="/" appearance="primary">
        {t("common.backHome")}
      </Button>
    </main>
  );
}
