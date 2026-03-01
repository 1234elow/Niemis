import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { getTheme } from "../theme";

const STORAGE_KEY = "niemis-theme-mode";

const ThemeContext = createContext({
  mode: "dark",
  toggleTheme: () => {},
  setMode: () => {},
});

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within a ThemeProvider");
  }
  return context;
};

const getInitialMode = () => {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  // Fall back to system preference
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return "dark";
};

export const ThemeContextProvider = ({ children }) => {
  const [mode, setModeState] = useState(getInitialMode);

  // Persist to localStorage when mode changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (e) => {
      // Only auto-switch if user hasn't manually set preference
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setModeState(e.matches ? "light" : "dark");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setModeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setMode = (newMode) => {
    if (newMode === "light" || newMode === "dark") {
      setModeState(newMode);
    }
  };

  const theme = useMemo(() => getTheme(mode), [mode]);

  const contextValue = useMemo(
    () => ({
      mode,
      toggleTheme,
      setMode,
      isDark: mode === "dark",
      isLight: mode === "light",
    }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
