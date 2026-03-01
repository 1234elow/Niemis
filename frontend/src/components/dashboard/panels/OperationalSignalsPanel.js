import React from "react";
import { Paper, Typography, Box, Chip } from "@mui/material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

const formatCount = (value) => Number(value || 0).toLocaleString();
const formatLabel = (value, fallback = "unknown") =>
  String(value || fallback)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Operational Signals Panel
 */
const OperationalSignalsPanel = ({
  pendingTransfers,
  totalClassEnrollment,
  activity24h,
  isFetching,
}) => {
  const topActions = Array.isArray(activity24h?.by_action)
    ? activity24h.by_action.slice(0, 4)
    : [];
  const topTables = Array.isArray(activity24h?.by_table)
    ? activity24h.by_table.slice(0, 3)
    : [];

  return (
    <Paper sx={panelWrapper} elevation={0}>
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: ccColors.textPrimary,
          fontWeight: 700,
          fontFamily: ccFonts.display,
          fontSize: "0.95rem",
        }}
      >
        Operational Signals
      </Typography>
      <Typography variant="body2" sx={{ color: ccColors.textSecondary, mb: 1 }}>
        Pending transfer queue
      </Typography>
      <Typography
        variant="h5"
        sx={{
          mb: 2,
          color: ccColors.textPrimary,
          fontWeight: 700,
          fontFamily: ccFonts.display,
        }}
      >
        {formatCount(pendingTransfers)}
      </Typography>
      <Typography variant="body2" sx={{ color: ccColors.textSecondary, mb: 1 }}>
        Students in active classes
      </Typography>
      <Typography
        variant="h5"
        sx={{
          mb: 2,
          color: ccColors.textPrimary,
          fontWeight: 700,
          fontFamily: ccFonts.display,
        }}
      >
        {formatCount(totalClassEnrollment)}
      </Typography>
      <Typography variant="body2" sx={{ color: ccColors.textSecondary, mb: 1 }}>
        Audit activity captured (24h)
      </Typography>
      <Typography
        variant="h5"
        sx={{
          mb: 1,
          color: ccColors.textPrimary,
          fontWeight: 700,
          fontFamily: ccFonts.display,
        }}
      >
        {formatCount(activity24h?.total)}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
        {topActions.length === 0 ? (
          <Typography variant="caption" sx={{ color: ccColors.textMuted }}>
            No action records in the last 24 hours.
          </Typography>
        ) : (
          topActions.map((item) => (
            <Chip
              key={`action-${item.action}`}
              label={`${formatLabel(item.action)}: ${formatCount(item.count)}`}
              size="small"
              sx={{
                backgroundColor: `${ccColors.blue}1F`,
                color: ccColors.blue,
                border: `1px solid ${ccColors.blue}55`,
              }}
            />
          ))
        )}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
        {topTables.map((item) => (
          <Chip
            key={`table-${item.table_name}`}
            label={`${formatLabel(item.table_name, "system")}: ${formatCount(item.count)}`}
            size="small"
            sx={{
              backgroundColor: `${ccColors.emerald}1F`,
              color: ccColors.emerald,
              border: `1px solid ${ccColors.emerald}55`,
            }}
          />
        ))}
      </Box>
      <Typography variant="body2" sx={{ color: ccColors.textMuted }}>
        {isFetching
          ? "Refreshing latest records..."
          : "Dashboard auto-refreshes every minute."}
      </Typography>
    </Paper>
  );
};

export default OperationalSignalsPanel;
