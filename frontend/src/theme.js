import { createTheme } from "@mui/material/styles";

// Barbados-inspired color palettes
const lightPalette = {
  mode: "light",
  primary: {
    main: "#1e3a5f", // Deep navy
    light: "#2d5a8a",
    dark: "#0f1f33",
    contrastText: "#ffffff",
  },
  secondary: {
    main: "#d4a853", // Barbados gold
    light: "#e6c67a",
    dark: "#b08a3a",
    contrastText: "#0f172a",
  },
  background: {
    default: "#f8fafc",
    paper: "#ffffff",
    elevated: "#ffffff",
  },
  text: {
    primary: "#0f172a",
    secondary: "#475569",
    muted: "#94a3b8",
  },
  divider: "rgba(15, 23, 42, 0.1)",
  grey: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
  success: {
    main: "#059669",
    light: "#10b981",
    dark: "#047857",
  },
  warning: {
    main: "#d97706",
    light: "#f59e0b",
    dark: "#b45309",
  },
  error: {
    main: "#dc2626",
    light: "#f43f5e",
    dark: "#b91c1c",
  },
  info: {
    main: "#0284c7",
    light: "#0ea5e9",
    dark: "#0369a1",
  },
  action: {
    active: "#1e3a5f",
    hover: "rgba(30, 58, 95, 0.08)",
    selected: "rgba(30, 58, 95, 0.12)",
    disabled: "rgba(15, 23, 42, 0.26)",
    disabledBackground: "rgba(15, 23, 42, 0.12)",
  },
};

const darkPalette = {
  mode: "dark",
  primary: {
    main: "#14b8a6", // Teal
    light: "#2dd4bf",
    dark: "#0d9488",
    contrastText: "#0f172a",
  },
  secondary: {
    main: "#f59e0b", // Amber
    light: "#fbbf24",
    dark: "#d97706",
    contrastText: "#0f172a",
  },
  background: {
    default: "#060a13",
    paper: "#0f172a",
    elevated: "#1e293b",
  },
  text: {
    primary: "#f1f5f9",
    secondary: "#94a3b8",
    muted: "#64748b",
  },
  divider: "rgba(148, 163, 184, 0.14)",
  grey: {
    50: "#0b1220",
    100: "#111a2b",
    200: "#182338",
    300: "#23324a",
    400: "#475569",
    500: "#64748b",
    600: "#94a3b8",
    700: "#cbd5e1",
    800: "#e2e8f0",
    900: "#f1f5f9",
  },
  success: {
    main: "#10b981",
    light: "#34d399",
    dark: "#059669",
  },
  warning: {
    main: "#f59e0b",
    light: "#fbbf24",
    dark: "#d97706",
  },
  error: {
    main: "#f43f5e",
    light: "#fb7185",
    dark: "#e11d48",
  },
  info: {
    main: "#0ea5e9",
    light: "#38bdf8",
    dark: "#0284c7",
  },
  action: {
    active: "#14b8a6",
    hover: "rgba(20, 184, 166, 0.12)",
    selected: "rgba(20, 184, 166, 0.16)",
    disabled: "rgba(241, 245, 249, 0.3)",
    disabledBackground: "rgba(241, 245, 249, 0.12)",
  },
};

const getComponents = (mode) => {
  const isDark = mode === "dark";
  const colors = isDark ? darkPalette : lightPalette;

  return {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.background.default,
          color: colors.text.primary,
          transition: "background-color 0.3s ease, color 0.3s ease",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.paper,
          backgroundImage: "none",
          border: `1px solid ${colors.divider}`,
          transition: "background-color 0.3s ease, border-color 0.3s ease",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: isDark
            ? "0 12px 28px -16px rgba(0,0,0,0.55)"
            : "0 4px 20px -8px rgba(15, 23, 42, 0.12)",
          backgroundColor: colors.background.paper,
          border: `1px solid ${colors.divider}`,
          transition:
            "background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: isDark
            ? "rgba(148,163,184,0.08)"
            : "rgba(15, 23, 42, 0.04)",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${colors.divider}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.background.paper,
          border: `1px solid ${isDark ? "rgba(148,163,184,0.18)" : colors.divider}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: isDark
            ? colors.background.paper
            : colors.primary.main,
          backgroundImage: "none",
          boxShadow: isDark
            ? "0 2px 8px rgba(0,0,0,0.3)"
            : "0 2px 8px rgba(15, 23, 42, 0.12)",
          transition: "background-color 0.3s ease, box-shadow 0.3s ease",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.background.paper,
          borderColor: colors.divider,
          transition: "background-color 0.3s ease, border-color 0.3s ease",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            transition: "background-color 0.3s ease",
            "&:hover": {
              backgroundColor: isDark
                ? "rgba(148,163,184,0.04)"
                : "rgba(15, 23, 42, 0.02)",
            },
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          transition: "background-color 0.2s ease",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: "background-color 0.2s ease, transform 0.2s ease",
        },
      },
    },
  };
};

export const getTheme = (mode = "dark") => {
  const palette = mode === "light" ? lightPalette : darkPalette;

  return createTheme({
    palette,
    typography: {
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      h1: {
        fontSize: "2.5rem",
        fontWeight: 500,
      },
      h2: {
        fontSize: "2rem",
        fontWeight: 500,
      },
      h3: {
        fontSize: "1.75rem",
        fontWeight: 500,
      },
      h4: {
        fontSize: "1.5rem",
        fontWeight: 500,
      },
      h5: {
        fontSize: "1.25rem",
        fontWeight: 500,
      },
      h6: {
        fontSize: "1rem",
        fontWeight: 500,
      },
    },
    components: getComponents(mode),
    shape: {
      borderRadius: 8,
    },
  });
};

// Export individual palettes for direct access
export { lightPalette, darkPalette };

// Default export for backward compatibility
const theme = getTheme("dark");
export default theme;
