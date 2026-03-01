import React from "react";
import { Paper, Typography, Box, Chip } from "@mui/material";
import { SwapHoriz } from "@mui/icons-material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

const formatCount = (value) => Number(value || 0).toLocaleString();

/**
 * Transfer Status Panel
 */
const TransferStatusPanel = ({ transfersSummary }) => {
  const pending = Number(transfersSummary?.pending || 0);
  const pendingSeverity =
    pending === 0 ? "success" : pending < 10 ? "warning" : "error";

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
        Transfer Status
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <SwapHoriz sx={{ mr: 1, color: ccColors.textSecondary }} />
        <Typography
          variant="h4"
          sx={{
            color: ccColors.textPrimary,
            fontWeight: 700,
            fontFamily: ccFonts.display,
          }}
        >
          {formatCount(transfersSummary?.total)}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Chip
          size="small"
          label={`Pending: ${formatCount(transfersSummary?.pending)}`}
          color={pendingSeverity}
        />
        <Chip
          size="small"
          label={`Approved: ${formatCount(transfersSummary?.approved)}`}
          color="success"
        />
        <Chip
          size="small"
          label={`Rejected: ${formatCount(transfersSummary?.rejected)}`}
          color="error"
        />
        <Chip
          size="small"
          label={`Completed: ${formatCount(transfersSummary?.completed)}`}
          sx={{ bgcolor: ccColors.blueGlow, color: ccColors.blue }}
        />
      </Box>
    </Paper>
  );
};

export default TransferStatusPanel;
