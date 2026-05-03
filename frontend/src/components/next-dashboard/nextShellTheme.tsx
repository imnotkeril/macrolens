"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  nextDashboardCssTokenColors,
  nextDashboardCssVars,
  type NextDashboardThemeMode,
} from "@/components/next-dashboard/nextDashboardConfig";

const STORAGE_KEY = "next-dashboard-theme";

export type NextShellThemeContextValue = {
  theme: NextDashboardThemeMode;
  setTheme: Dispatch<SetStateAction<NextDashboardThemeMode>>;
  toggleTheme: () => void;
  shellThemeVars: CSSProperties;
  /** Semantic CSS variable refs — same object for dark/light; palette switches via `shellThemeVars` on the shell root */
  colors: typeof nextDashboardCssTokenColors;
};

const NextShellThemeContext = createContext<NextShellThemeContextValue | null>(null);

function useShellThemeState(): Omit<NextShellThemeContextValue, "colors"> {
  const [theme, setTheme] = useState<NextDashboardThemeMode>("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const shellThemeVars = useMemo(() => nextDashboardCssVars(theme), [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggleTheme, shellThemeVars };
}

/** Mount once in `app/next/layout.tsx` so every `/next` page shares theme + tokens */
export function NextShellThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, toggleTheme, shellThemeVars } = useShellThemeState();
  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      shellThemeVars,
      colors: nextDashboardCssTokenColors,
    }),
    [theme, setTheme, toggleTheme, shellThemeVars],
  );

  return <NextShellThemeContext.Provider value={value}>{children}</NextShellThemeContext.Provider>;
}

/** Theme + `shellThemeVars` + `colors` for any screen under `/next` */
export function useNextShellTheme(): NextShellThemeContextValue {
  const ctx = useContext(NextShellThemeContext);
  if (!ctx) {
    throw new Error(
      "useNextShellTheme must be used within NextShellThemeProvider — ensure app/next/layout.tsx wraps children with it.",
    );
  }
  return ctx;
}
