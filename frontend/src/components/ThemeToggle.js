import React from "react";
import { IconButton, Tooltip, Box } from "@mui/material";
import { LightMode, DarkMode } from "@mui/icons-material";
import { useThemeMode } from "../contexts/ThemeContext";

const ThemeToggle = ({ size = "medium", showTooltip = true }) => {
  const { mode, toggleTheme } = useThemeMode();
  const isDark = mode === "dark";

  const button = (
    <IconButton
      onClick={toggleTheme}
      color="inherit"
      size={size}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      sx={{
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s ease",
        "&:hover": {
          transform: "scale(1.1)",
          backgroundColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.08)",
        },
        "&:active": {
          transform: "scale(0.95)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isDark ? "rotate(0deg)" : "rotate(360deg)",
        }}
      >
        {isDark ? (
          <DarkMode
            sx={{
              fontSize: size === "small" ? 20 : 24,
              color: "#f59e0b",
              filter: "drop-shadow(0 0 4px rgba(245, 158, 11, 0.5))",
              transition: "all 0.3s ease",
            }}
          />
        ) : (
          <LightMode
            sx={{
              fontSize: size === "small" ? 20 : 24,
              color: "#d4a853",
              filter: "drop-shadow(0 0 4px rgba(212, 168, 83, 0.5))",
              transition: "all 0.3s ease",
            }}
          />
        )}
      </Box>
    </IconButton>
  );

  if (!showTooltip) {
    return button;
  }

  return (
    <Tooltip
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      arrow
      placement="bottom"
    >
      {button}
    </Tooltip>
  );
};

export default ThemeToggle;
