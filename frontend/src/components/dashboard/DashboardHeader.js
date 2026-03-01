import React from "react";
import { Box, Typography, Button, Chip, CircularProgress } from "@mui/material";
import { Refresh } from "@mui/icons-material";
import { ccColors, ccFonts, headerBar } from "./commandCenterTheme";

/**
 * Compact Command Center Header
 * Shows logo, data quality status, and refresh controls
 */
const DashboardHeader = ({
  username,
  dataQualityStatus,
  dataQualityScore,
  pendingTransfers,
  lastSnapshot,
  isRefreshing,
  onRefresh,
}) => {
  const getStatusColor = (status) => {
    if (status === "healthy") return "success";
    if (status === "watch") return "warning";
    return "error";
  };

  const getStatusLabel = (status) => {
    if (status === "healthy") return "Healthy";
    if (status === "watch") return "Watch";
    return "Critical";
  };

  return (
    <Box
      sx={{
        ...headerBar,
        p: { xs: 2, md: 2.5 },
        mb: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      {/* Left: Logo & Title */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${ccColors.teal} 0%, ${ccColors.blue} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "0.9rem",
            color: "#fff",
            letterSpacing: "-0.03em",
            fontFamily: ccFonts.display,
            boxShadow: `0 12px 22px -12px ${ccColors.tealGlow}`,
          }}
        >
          NI
        </Box>
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: ccColors.textPrimary,
              fontWeight: 700,
              lineHeight: 1.2,
              fontFamily: ccFonts.display,
              letterSpacing: "-0.02em",
            }}
          >
            Command Center
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: ccColors.textSecondary, fontFamily: ccFonts.body }}
          >
            Welcome, {username}
          </Typography>
        </Box>
      </Box>

      {/* Center: Status Indicators */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        <Chip
          size="small"
          color={getStatusColor(dataQualityStatus)}
          label={`Data Quality: ${getStatusLabel(dataQualityStatus)} (${Math.round(dataQualityScore)}%)`}
          sx={{
            fontWeight: 700,
            backgroundColor:
              dataQualityStatus === "healthy"
                ? ccColors.emeraldGlow
                : dataQualityStatus === "watch"
                  ? ccColors.amberGlow
                  : ccColors.coralGlow,
            border: `1px solid ${
              dataQualityStatus === "healthy"
                ? ccColors.emerald
                : dataQualityStatus === "watch"
                  ? ccColors.amber
                  : ccColors.coral
            }`,
            color:
              dataQualityStatus === "healthy"
                ? ccColors.emerald
                : dataQualityStatus === "watch"
                  ? ccColors.amber
                  : ccColors.coral,
          }}
        />
        {pendingTransfers > 0 && (
          <Chip
            size="small"
            color={pendingTransfers >= 10 ? "error" : "warning"}
            variant="outlined"
            label={`${pendingTransfers} pending transfers`}
            sx={{ fontWeight: 500 }}
          />
        )}
        <Typography
          variant="caption"
          sx={{
            color: ccColors.textMuted,
            display: { xs: "none", md: "block" },
            fontFamily: ccFonts.display,
          }}
        >
          {lastSnapshot}
        </Typography>
      </Box>

      {/* Right: Refresh Button */}
      <Button
        variant="outlined"
        size="small"
        onClick={onRefresh}
        disabled={isRefreshing}
        startIcon={
          isRefreshing ? (
            <CircularProgress size={14} color="inherit" />
          ) : (
            <Refresh fontSize="small" />
          )
        }
        sx={{
          borderColor: ccColors.border,
          color: ccColors.textPrimary,
          fontFamily: ccFonts.body,
          "&:hover": {
            borderColor: ccColors.teal,
            backgroundColor: ccColors.tealGlow,
          },
        }}
      >
        {isRefreshing ? "Refreshing..." : "Refresh"}
      </Button>
    </Box>
  );
};

export default DashboardHeader;
