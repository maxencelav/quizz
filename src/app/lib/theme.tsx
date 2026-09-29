import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "quizz:theme";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const subscribe = (cb: () => void) => {
  darkQuery.addEventListener("change", cb);
  return () => darkQuery.removeEventListener("change", cb);
};

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage unavailable (private browsing…): follow the system setting
  }
  return "system";
}

const ThemeContext = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({
  mode: "system",
  setMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const systemDark = useSyncExternalStore(subscribe, () => darkQuery.matches);
  const dark = mode === "system" ? systemDark : mode === "dark";
  const theme = dark ? webDarkTheme : webLightTheme;

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      if (m === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignored
    }
  };

  // The document background (not just the FluentProvider) must follow the theme:
  // iOS Safari uses it to color the status bar and overscroll areas.
  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = dark ? "dark" : "light";
    root.style.backgroundColor = theme.colorNeutralBackground2;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.colorNeutralBackground2);
  }, [dark, theme]);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      <FluentProvider theme={theme} style={{ minHeight: "100vh" }}>
        {children}
      </FluentProvider>
    </ThemeContext.Provider>
  );
}
