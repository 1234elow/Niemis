import React from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Alert,
} from "@mui/material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

const formatAuditDate = (value) => {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
};

const READINESS_STATUS = {
  healthy: { label: "On Track", color: "success" },
  watch: { label: "Needs Attention", color: "warning" },
  critical: { label: "At Risk", color: "error" },
};

const CHECKLIST_STATUS = {
  complete: { label: "Complete", color: "success" },
  in_progress: { label: "In Progress", color: "warning" },
  todo: { label: "To Do", color: "default" },
};

/**
 * Barbados EMIS Readiness Panel
 */
const BarbadosReadinessPanel = ({ readiness, onNavigate, onOpenWorkspace }) => {
  const overallScore = Math.max(
    0,
    Math.min(100, Number(readiness?.overall_score || 0)),
  );
  const statusMeta =
    READINESS_STATUS[readiness?.status] || READINESS_STATUS.critical;
  const pillars = readiness?.pillars || [];
  const checklist = readiness?.checklist || [];

  return (
    <Paper sx={{ ...panelWrapper, borderRadius: 4 }} elevation={0}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: ccColors.textPrimary,
            fontFamily: ccFonts.display,
            letterSpacing: "-0.02em",
          }}
        >
          Barbados EMIS Readiness
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            color={statusMeta.color}
            label={`${statusMeta.label} (${Math.round(overallScore)}%)`}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => onOpenWorkspace?.()}
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
            Open Workspace
          </Button>
        </Box>
      </Box>

      <LinearProgress
        variant="determinate"
        value={overallScore}
        color={statusMeta.color}
        sx={{
          mb: 2,
          height: 10,
          borderRadius: 99,
          backgroundColor: ccColors.surface,
          "& .MuiLinearProgress-bar": {
            background: `linear-gradient(90deg, ${ccColors.emerald} 0%, ${ccColors.teal} 100%)`,
            borderRadius: 99,
          },
        }}
      />

      {pillars.length === 0 ? (
        <Typography variant="body2" sx={{ color: ccColors.textSecondary }}>
          Readiness metrics are still being generated.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {pillars.map((pillar) => {
            const pillarStatus =
              READINESS_STATUS[pillar.status] || READINESS_STATUS.critical;
            const score = Math.max(0, Math.min(100, Number(pillar.score || 0)));
            return (
              <Grid item xs={12} md={6} key={pillar.key || pillar.label}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    borderColor: ccColors.border,
                    backgroundColor: ccColors.surface,
                    height: "100%",
                    transition:
                      "border-color 220ms ease, box-shadow 220ms ease, transform 220ms ease",
                    "&:hover": {
                      transform: "translateY(-1px)",
                      borderColor: ccColors.teal,
                      boxShadow: `0 18px 32px -18px ${ccColors.tealGlow}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        color: ccColors.textPrimary,
                        fontFamily: ccFonts.display,
                      }}
                    >
                      {pillar.label}
                    </Typography>
                    <Chip
                      size="small"
                      color={pillarStatus.color}
                      label={`${score}%`}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ color: ccColors.textSecondary, mb: 1 }}
                  >
                    {pillar.summary}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={score}
                    color={pillarStatus.color}
                    sx={{
                      mb: 1.2,
                      height: 6,
                      borderRadius: 99,
                      backgroundColor: ccColors.borderLight,
                      "& .MuiLinearProgress-bar": {
                        backgroundColor:
                          pillar.status === "warning"
                            ? ccColors.amber
                            : ccColors.emerald,
                        borderRadius: 99,
                      },
                    }}
                  />
                  <Stack spacing={0.5} sx={{ mb: 1 }}>
                    {(pillar.metrics || []).slice(0, 3).map((metric, index) => (
                      <Typography
                        key={`${pillar.key || "pillar"}-metric-${index}`}
                        variant="caption"
                        sx={{ display: "block", color: ccColors.textMuted }}
                      >
                        {metric}
                      </Typography>
                    ))}
                  </Stack>
                  {(pillar.blockers || []).length > 0 && (
                    <Alert severity="warning" sx={{ mb: 1, py: 0.5 }}>
                      {(pillar.blockers || [])[0]}
                    </Alert>
                  )}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", rowGap: 0.8 }}
                  >
                    {(pillar.next_actions || [])
                      .slice(0, 2)
                      .map((action, index) => (
                        <Button
                          key={`${pillar.key || "pillar"}-action-${index}`}
                          size="small"
                          variant="outlined"
                          onClick={() => onNavigate?.(action.path)}
                          sx={{
                            borderColor: ccColors.border,
                            color: ccColors.textPrimary,
                            fontSize: "0.75rem",
                            fontFamily: ccFonts.body,
                            "&:hover": {
                              borderColor: ccColors.teal,
                              backgroundColor: ccColors.tealGlow,
                            },
                          }}
                        >
                          {action.label}
                        </Button>
                      ))}
                  </Stack>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {checklist.length > 0 && (
        <>
          <Divider sx={{ my: 2, borderColor: ccColors.borderLight }} />
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              mb: 1,
              color: ccColors.textPrimary,
              fontFamily: ccFonts.display,
            }}
          >
            Implementation Checklist
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap", rowGap: 1 }}
          >
            {checklist.map((item, index) => {
              const checklistMeta =
                CHECKLIST_STATUS[item.status] || CHECKLIST_STATUS.todo;
              return (
                <Chip
                  key={item.key || `checklist-${index}`}
                  size="small"
                  color={checklistMeta.color}
                  variant={item.status === "todo" ? "outlined" : "filled"}
                  label={`${checklistMeta.label}: ${item.label}`}
                />
              );
            })}
          </Stack>
        </>
      )}

      <Typography
        variant="caption"
        sx={{ display: "block", mt: 2, color: ccColors.textMuted }}
      >
        Last assessed: {formatAuditDate(readiness?.generated_at)}
      </Typography>
    </Paper>
  );
};

export default BarbadosReadinessPanel;
