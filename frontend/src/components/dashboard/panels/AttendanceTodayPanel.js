import React from "react";
import { Paper, Typography, Box, Chip, LinearProgress } from "@mui/material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

const formatCount = (value) => Number(value || 0).toLocaleString();

/**
 * Attendance Today Panel
 */
const AttendanceTodayPanel = ({ attendanceToday }) => {
  const rate = Number(attendanceToday?.attendance_rate || 0);

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
        Attendance Today
      </Typography>
      <Typography
        variant="h4"
        sx={{
          color: ccColors.emerald,
          fontWeight: 700,
          fontFamily: ccFonts.display,
        }}
        gutterBottom
      >
        {rate.toFixed(1)}%
      </Typography>
      <LinearProgress
        variant="determinate"
        value={rate}
        sx={{
          mb: 2,
          height: 8,
          borderRadius: 10,
          backgroundColor: ccColors.surface,
          "& .MuiLinearProgress-bar": {
            background: `linear-gradient(90deg, ${ccColors.emerald} 0%, ${ccColors.teal} 100%)`,
            borderRadius: 10,
          },
        }}
      />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        <Chip
          size="small"
          label={`Present: ${formatCount(attendanceToday?.present)}`}
          color="success"
        />
        <Chip
          size="small"
          label={`Late: ${formatCount(attendanceToday?.late)}`}
          color="warning"
        />
        <Chip
          size="small"
          label={`Absent: ${formatCount(attendanceToday?.absent)}`}
          color="error"
        />
        <Chip
          size="small"
          label={`Excused: ${formatCount(attendanceToday?.excused)}`}
          sx={{ bgcolor: ccColors.surface, color: ccColors.textSecondary }}
        />
      </Box>
      <Typography variant="body2" sx={{ color: ccColors.textSecondary }}>
        Records captured today: {formatCount(attendanceToday?.total_records)}
      </Typography>
    </Paper>
  );
};

export default AttendanceTodayPanel;
