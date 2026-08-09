"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { webDarkTheme, webLightTheme, type Theme } from "@fluentui/react-components";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ledgr.theme";

interface ThemeContextValue {
  /** What the user chose, including "system". */
  mode: ThemeMode;
  /** What "system" actually resolved to — what's on screen. */
  resolved: ResolvedTheme;
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
  /** Flips between light and dark, leaving "system" behind. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Starts at the server-rendered default. The real preference is applied in
  // the effect below — reading localStorage during render would produce markup
  // that disagrees with the server's and trip a hydration error.
  //
  // This does not cause a flash: the inline script in layout.tsx has already
  // painted the correct background colour before React runs.
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setModeState(readStoredMode());
    setSystemDark(systemPrefersDark());

    // Follow the OS if it changes while the app is open — someone on a
    // sunset-scheduled theme shouldn't have to reload.
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  // Keep the attribute in sync so the CSS in layout.tsx paints the matching
  // page background — Fluent themes only style what's inside FluentProvider.
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      theme: resolved === "dark" ? webDarkTheme : webLightTheme,
      setMode,
      toggle,
    }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return context;
}
