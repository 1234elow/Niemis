import React from "react";
import { Box, Typography, Chip, keyframes } from "@mui/material";
import { Warning, Error as ErrorIcon } from "@mui/icons-material";
import { ccColors, ccFonts, alertBanner } from "./commandCenterTheme";

// Gentle pulse animation for critical alerts
const pulseGlow = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
`;

/**
 * Conditional Quick Alerts Bar
 * Only shows when there are critical issues or pending actions
 */
const QuickAlertsBar = ({
  criticalIssues = 0,
  pendingTransfers = 0,
  overdueIssues = 0,
  releaseGateBlocked = false,
}) => {
  // Don't render if nothing needs attention
  const totalAlerts =
    criticalIssues + (pendingTransfers > 5 ? 1 : 0) + overdueIssues;
  if (totalAlerts === 0 && !releaseGateBlocked) {
    return null;
  }

  const isCritical = criticalIssues > 0 || releaseGateBlocked;
  const bannerStyle = isCritical ? alertBanner.coral : alertBanner.amber;
  const IconComponent = isCritical ? ErrorIcon : Warning;

  const alerts = [];
  if (criticalIssues > 0) {
    alerts.push(
      `${criticalIssues} critical quality issue${criticalIssues > 1 ? "s" : ""}`,
    );
  }
  if (overdueIssues > 0) {
    alerts.push(`${overdueIssues} overdue`);
  }
  if (pendingTransfers > 5) {
    alerts.push(`${pendingTransfers} pending transfers`);
  }
  if (releaseGateBlocked) {
    alerts.push("Release gate blocked");
  }

  return (
    <Box
      sx={{
        ...bannerStyle,
        borderRadius: 2.5,
        p: 1.5,
        mb: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        animation: isCritical ? `${pulseGlow} 2s ease-in-out infinite` : "none",
        backdropFilter: "blur(12px)",
      }}
    >
      <IconComponent
        sx={{
          color: isCritical ? ccColors.coral : ccColors.amber,
          fontSize: "1.25rem",
        }}
      />
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        {alerts.map((alert, index) => (
          <React.Fragment key={alert}>
            <Typography
              variant="body2"
              sx={{
                color: ccColors.textPrimary,
                fontWeight: 600,
                fontFamily: ccFonts.body,
              }}
            >
              {alert}
            </Typography>
            {index < alerts.length - 1 && (
              <Typography
                variant="body2"
                sx={{ color: ccColors.textSecondary }}
              >
                |
              </Typography>
            )}
          </React.Fragment>
        ))}
      </Box>
      <Chip
        size="small"
        label="Review needed"
        sx={{
          backgroundColor: isCritical ? ccColors.coral : ccColors.amber,
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.7rem",
          fontFamily: ccFonts.body,
        }}
      />
    </Box>
  );
};

export default QuickAlertsBar;
