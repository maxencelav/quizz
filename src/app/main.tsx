import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Spinner } from "@fluentui/react-components";
import { ThemeProvider } from "./lib/theme";
import "./i18n";
import "./global.css";
import { Home } from "./pages/Home";
import { Play } from "./pages/Play";
import { NotFound } from "./pages/NotFound";

// Admin and presentation are lazy-loaded so players (on mobile) only download what they need
const lazyPage = (load: () => Promise<{ Component: React.ComponentType }>) => ({
  lazy: load,
  HydrateFallback: PageSpinner,
});

function PageSpinner() {
  return <Spinner style={{ minHeight: "100vh" }} />;
}

const router = createBrowserRouter([
  { path: "/", element: <Home />, errorElement: <NotFound /> },
  { path: "/play/:code", element: <Play />, errorElement: <NotFound /> },
  { path: "/host/:code", errorElement: <NotFound />, ...lazyPage(() => import("./pages/Host").then((m) => ({ Component: m.Host }))) },
  {
    path: "/admin",
    errorElement: <NotFound />,
    ...lazyPage(() => import("./pages/admin/AdminLayout").then((m) => ({ Component: m.AdminLayout }))),
    children: [
      { index: true, ...lazyPage(() => import("./pages/admin/SetsPage").then((m) => ({ Component: m.SetsPage }))) },
      { path: "sets/:id", ...lazyPage(() => import("./pages/admin/SetEditor").then((m) => ({ Component: m.SetEditor }))) },
      { path: "games", ...lazyPage(() => import("./pages/admin/GamesPage").then((m) => ({ Component: m.GamesPage }))) },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
