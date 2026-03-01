import React from "react";
import {
  Paper,
  Typography,
  List,
  ListItem,
  Box,
  Divider,
  LinearProgress,
} from "@mui/material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

const formatCount = (value) => Number(value || 0).toLocaleString();

const toPercent = (count, total) => {
  if (!total) return 0;
  return Number(((Number(count || 0) / Number(total)) * 100).toFixed(1));
};

/**
 * Distribution Panel - Shows breakdown with progress bars
 */
const DistributionPanel = ({ title, rows, total, emptyMessage }) => (
  <Paper sx={panelWrapper} elevation={0}>
    <Typography
      variant="h6"
      gutterBottom
      sx={{
        color: ccColors.textPrimary,
        fontWeight: 700,
        fontFamily: ccFonts.display,
        fontSize: "0.9rem",
      }}
    >
      {title}
    </Typography>
    {rows.length === 0 ? (
      <Typography variant="body2" sx={{ color: ccColors.textSecondary }}>
        {emptyMessage}
      </Typography>
    ) : (
      <List disablePadding>
        {rows.map((item, index) => {
          const count = Number(item.count || 0);
          const percent = toPercent(count, total);
          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <ListItem disableGutters sx={{ py: 1.25, display: "block" }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 0.8,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: ccColors.textPrimary }}
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: ccColors.textSecondary }}
                  >
                    {formatCount(count)} ({percent}%)
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={percent}
                  sx={{
                    height: 6,
                    borderRadius: 99,
                    backgroundColor: ccColors.surface,
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: ccColors.teal,
                      borderRadius: 99,
                    },
                  }}
                />
              </ListItem>
              {index < rows.length - 1 && (
                <Divider sx={{ borderColor: ccColors.borderLight }} />
              )}
            </React.Fragment>
          );
        })}
      </List>
    )}
  </Paper>
);

export default DistributionPanel;
