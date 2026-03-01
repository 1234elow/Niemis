import React, { useEffect, useState } from "react";
import { Card, CardContent, Box, Typography } from "@mui/material";
import {
  ccColors,
  ccFonts,
  compactGlassCard,
  getAccent,
} from "../commandCenterTheme";

/**
 * Compact StatCard with animated count-up effect
 * Used in the CompactMetricsGrid for the executive dashboard
 */
const StatCard = ({
  title,
  value,
  icon,
  color = "primary",
  subtitle,
  compact = false,
  onClick,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const accent = getAccent(color);
  const raw = String(value ?? "");
  const numericValue = parseFloat(raw.replace(/[^0-9.-]/g, "")) || 0;
  const prefix = raw.trim().startsWith("+") ? "+" : "";
  const suffix = raw.includes("%") ? "%" : "";
  const hasDecimal = String(value).includes(".");

  // Count-up animation
  useEffect(() => {
    const duration = 500;
    const startTime = Date.now();
    const startValue = displayValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (numericValue - startValue) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [numericValue]);

  const formatDisplayValue = () => {
    if (hasDecimal) {
      return `${prefix}${displayValue.toFixed(1)}${suffix}`;
    }
    return `${prefix}${Math.round(displayValue).toLocaleString()}${suffix}`;
  };

  const cardSx = compact
    ? {
        ...compactGlassCard,
        height: "100%",
        minHeight: 100,
      }
    : {
        ...compactGlassCard,
        height: "100%",
      };

  const contentSx = compact
    ? { p: 1.5, "&:last-child": { pb: 1.5 } }
    : { p: 2, "&:last-child": { pb: 2 } };

  const clickable = typeof onClick === "function";

  return (
    <Card
      sx={{
        ...cardSx,
        ...(clickable
          ? {
              cursor: "pointer",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              "&:hover": {
                transform: "translateY(-1px)",
              },
            }
          : {}),
      }}
      elevation={0}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={clickable ? `Open details for ${title}` : undefined}
    >
      <CardContent sx={contentSx}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: compact ? 1.5 : 2,
          }}
        >
          {icon && (
            <Box
              sx={{
                backgroundColor: accent.glow,
                borderRadius: compact ? 1.5 : 2,
                p: compact ? 0.8 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${accent.main}20`,
              }}
            >
              {React.cloneElement(icon, {
                sx: {
                  color: accent.main,
                  fontSize: compact ? "1.25rem" : "1.5rem",
                },
              })}
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant={compact ? "h5" : "h4"}
              sx={{
                color: accent.main,
                fontWeight: 700,
                lineHeight: 1.2,
                fontFamily: ccFonts.display,
                letterSpacing: "-0.02em",
              }}
            >
              {formatDisplayValue()}
            </Typography>
            <Typography
              variant={compact ? "caption" : "body2"}
              sx={{
                color: ccColors.textPrimary,
                fontWeight: 600,
                lineHeight: 1.3,
                fontFamily: ccFonts.body,
              }}
            >
              {title}
            </Typography>
            {subtitle && !compact && (
              <Typography
                variant="caption"
                sx={{
                  color: ccColors.textSecondary,
                  display: "block",
                  mt: 0.3,
                  fontFamily: ccFonts.body,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatCard;
