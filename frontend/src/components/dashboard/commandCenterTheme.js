/**
 * Command Center Theme - aligned to super-admin mockups
 * Now supports light and dark mode
 */

export const ccFonts = {
  display: "'Space Mono', 'Courier New', monospace",
  body: "'DM Sans', 'Segoe UI', sans-serif",
};

// Dark mode colors (original command center theme)
export const ccColorsDark = {
  // Atmospheric background
  bgVoid: "#060a13",
  bgDeep: "#0a101f",
  bgPrimary: "#0f172a",
  bgSecondary: "#1e293b",
  bgElevated: "#283548",

  // Glass surfaces
  bgCard: "rgba(30, 41, 59, 0.76)",
  bgCardHover: "rgba(30, 41, 59, 0.88)",
  bgCardStrong: "rgba(30, 41, 59, 0.9)",
  glassHighlight: "rgba(255, 255, 255, 0.03)",
  surface: "rgba(255, 255, 255, 0.025)",

  // Borders
  border: "rgba(148, 163, 184, 0.14)",
  borderLight: "rgba(148, 163, 184, 0.08)",

  // Text
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textDim: "#475569",

  // Accents
  teal: "#14b8a6",
  tealBright: "#2dd4bf",
  tealGlow: "rgba(20, 184, 166, 0.16)",
  blue: "#3b82f6",
  blueGlow: "rgba(59, 130, 246, 0.16)",
  amber: "#f59e0b",
  amberGlow: "rgba(245, 158, 11, 0.14)",
  coral: "#f43f5e",
  coralGlow: "rgba(244, 63, 94, 0.14)",
  purple: "#a855f7",
  purpleGlow: "rgba(168, 85, 247, 0.16)",
  emerald: "#10b981",
  emeraldGlow: "rgba(16, 185, 129, 0.16)",
};

// Light mode colors
export const ccColorsLight = {
  // Background
  bgVoid: "#f8fafc",
  bgDeep: "#f1f5f9",
  bgPrimary: "#ffffff",
  bgSecondary: "#f8fafc",
  bgElevated: "#ffffff",

  // Glass surfaces
  bgCard: "rgba(255, 255, 255, 0.9)",
  bgCardHover: "rgba(255, 255, 255, 0.95)",
  bgCardStrong: "rgba(255, 255, 255, 0.98)",
  glassHighlight: "rgba(15, 23, 42, 0.02)",
  surface: "rgba(15, 23, 42, 0.02)",

  // Borders
  border: "rgba(15, 23, 42, 0.1)",
  borderLight: "rgba(15, 23, 42, 0.06)",

  // Text
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  textDim: "#cbd5e1",

  // Accents (navy and gold for light mode)
  teal: "#1e3a5f",
  tealBright: "#2d5a8a",
  tealGlow: "rgba(30, 58, 95, 0.12)",
  blue: "#1e40af",
  blueGlow: "rgba(30, 64, 175, 0.1)",
  amber: "#d4a853",
  amberGlow: "rgba(212, 168, 83, 0.15)",
  coral: "#dc2626",
  coralGlow: "rgba(220, 38, 38, 0.1)",
  purple: "#7c3aed",
  purpleGlow: "rgba(124, 58, 237, 0.1)",
  emerald: "#059669",
  emeraldGlow: "rgba(5, 150, 105, 0.1)",
};

// Legacy export - maintains backwards compatibility
export const ccColors = ccColorsDark;

// Get theme-aware colors
export const getThemeAwareColors = (mode = "dark") => {
  const isDark = mode === "dark";
  const colors = isDark ? ccColorsDark : ccColorsLight;

  return {
    ...colors,
    // Convenience properties for common use cases
    primary: colors.teal,
    primaryBright: colors.tealBright,
    primaryGlow: colors.tealGlow,
    accent: colors.amber,
    accentGlow: colors.amberGlow,
    bgGradient: isDark
      ? `linear-gradient(180deg, ${colors.bgDeep} 0%, ${colors.bgPrimary} 100%)`
      : `linear-gradient(180deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 100%)`,
  };
};

export const getDashboardAtmosphere = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;

  if (mode === "dark") {
    return {
      backgroundColor: colors.bgVoid,
      backgroundImage: `
        radial-gradient(ellipse 80% 50% at 20% 40%, ${colors.tealGlow} 0%, transparent 52%),
        radial-gradient(ellipse 60% 40% at 80% 20%, ${colors.blueGlow} 0%, transparent 45%),
        radial-gradient(ellipse 50% 34% at 60% 80%, ${colors.purpleGlow} 0%, transparent 50%),
        linear-gradient(180deg, ${colors.bgVoid} 0%, ${colors.bgDeep} 52%, ${colors.bgPrimary} 100%)
      `,
    };
  }

  return {
    backgroundColor: colors.bgVoid,
    backgroundImage: `
      radial-gradient(ellipse 80% 50% at 20% 40%, ${colors.tealGlow} 0%, transparent 52%),
      radial-gradient(ellipse 60% 40% at 80% 20%, ${colors.amberGlow} 0%, transparent 45%),
      linear-gradient(180deg, ${colors.bgVoid} 0%, ${colors.bgDeep} 52%, ${colors.bgPrimary} 100%)
    `,
  };
};

// Legacy export for backwards compatibility
export const dashboardAtmosphere = getDashboardAtmosphere("dark");

export const noiseOverlaySx = {
  pointerEvents: "none",
  position: "absolute",
  inset: 0,
  opacity: 0.03,
  zIndex: 1,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
};

export const getGlassCard = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;

  return {
    background: colors.bgCard,
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: `1px solid ${colors.border}`,
    boxShadow:
      mode === "dark"
        ? `0 20px 40px -20px rgba(0,0,0,0.55), 0 0 0 1px ${colors.glassHighlight} inset`
        : `0 10px 30px -15px rgba(15, 23, 42, 0.12), 0 0 0 1px ${colors.glassHighlight} inset`,
    borderRadius: 3,
    transition:
      "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
  };
};

// Legacy export
export const glassCard = getGlassCard("dark");

export const getCompactGlassCard = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;
  const base = getGlassCard(mode);

  return {
    ...base,
    borderRadius: 2.5,
    transition:
      "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
    "&:hover": {
      transform: "translateY(-2px) scale(1.01)",
      borderColor: colors.teal,
      boxShadow: `0 12px 32px -12px ${colors.tealGlow}`,
    },
  };
};

// Legacy export
export const compactGlassCard = getCompactGlassCard("dark");

export const getHeaderBar = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;

  return {
    ...getGlassCard(mode),
    background: colors.bgCardStrong,
    borderRadius: 4,
  };
};

// Legacy export
export const headerBar = getHeaderBar("dark");

export const getAlertBanner = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;

  return {
    amber: {
      background: `linear-gradient(90deg, ${colors.amberGlow} 0%, transparent 92%)`,
      borderLeft: `4px solid ${colors.amber}`,
      color: colors.amber,
    },
    coral: {
      background: `linear-gradient(90deg, ${colors.coralGlow} 0%, transparent 92%)`,
      borderLeft: `4px solid ${colors.coral}`,
      color: colors.coral,
    },
  };
};

// Legacy export
export const alertBanner = getAlertBanner("dark");

export const getTabStyles = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;

  return {
    indicator: {
      display: "none",
    },
    tab: {
      color: colors.textSecondary,
      fontWeight: 700,
      textTransform: "none",
      minHeight: 44,
      borderRadius: 2,
      fontFamily: ccFonts.body,
      transition: "all 0.2s ease",
      "&:hover": {
        color: colors.textPrimary,
        backgroundColor: colors.glassHighlight,
      },
      "&.Mui-selected": {
        color: colors.teal,
        backgroundColor: colors.tealGlow,
        boxShadow: `0 0 0 1px ${colors.teal} inset`,
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: -1,
          left: "50%",
          transform: "translateX(-50%)",
          width: 24,
          height: 3,
          borderRadius: "3px 3px 0 0",
          backgroundColor: colors.teal,
        },
      },
    },
    badge: {
      backgroundColor: colors.coral,
      color: "#fff",
      fontSize: "0.7rem",
      fontWeight: 700,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
    },
  };
};

// Legacy export
export const tabStyles = getTabStyles("dark");

export const getAccentColors = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;

  return {
    primary: { main: colors.blue, glow: colors.blueGlow },
    success: { main: colors.emerald, glow: colors.emeraldGlow },
    info: { main: colors.teal, glow: colors.tealGlow },
    warning: { main: colors.amber, glow: colors.amberGlow },
    error: { main: colors.coral, glow: colors.coralGlow },
    secondary: { main: colors.purple, glow: colors.purpleGlow },
  };
};

// Legacy exports
export const accentColors = getAccentColors("dark");

export const getAccent = (colorName, mode = "dark") => {
  const colors = getAccentColors(mode);
  return colors[colorName] || colors.primary;
};

export const getPanelWrapper = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;

  return {
    ...getGlassCard(mode),
    p: 3,
    transition: "all 0.25s ease",
    "&:hover": {
      borderColor: colors.teal,
      boxShadow: `0 0 40px -10px ${colors.tealGlow}`,
    },
  };
};

// Legacy export
export const panelWrapper = getPanelWrapper("dark");

export const getChartTheme = (mode = "dark") => {
  const colors = mode === "dark" ? ccColorsDark : ccColorsLight;

  return {
    gridColor:
      mode === "dark" ? "rgba(148, 163, 184, 0.12)" : "rgba(15, 23, 42, 0.08)",
    tickColor: colors.textSecondary,
    tooltipBg: colors.bgSecondary,
    tooltipBorder: colors.border,
  };
};

// Legacy export
export const chartTheme = getChartTheme("dark");

export default {
  ccColors,
  ccColorsDark,
  ccColorsLight,
  ccFonts,
  getThemeAwareColors,
  getDashboardAtmosphere,
  dashboardAtmosphere,
  noiseOverlaySx,
  getGlassCard,
  glassCard,
  getCompactGlassCard,
  compactGlassCard,
  getHeaderBar,
  headerBar,
  getAlertBanner,
  alertBanner,
  getTabStyles,
  tabStyles,
  getAccentColors,
  accentColors,
  getAccent,
  getPanelWrapper,
  panelWrapper,
  getChartTheme,
  chartTheme,
};
