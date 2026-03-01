import React from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Refresh, AutoFixHigh } from "@mui/icons-material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

const formatCount = (value) => Number(value || 0).toLocaleString();

const formatAuditDate = (value) => {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
};

const DATA_QUALITY_STATUS = {
  healthy: { label: "Healthy", color: "success" },
  watch: { label: "Watch", color: "warning" },
  critical: { label: "Critical", color: "error" },
};

const CHECK_SEVERITY_COLOR = {
  critical: "error",
  warning: "warning",
  info: "info",
};

const SAFE_FIX_CHECKS = new Set([
  "class_enrollment_sync",
  "student_class_reference_integrity",
  "grade_numeric_band_alignment",
  "grade_class_alignment",
]);

const toAlertSeverity = (severity) => {
  if (severity === "critical") return "error";
  if (severity === "warning") return "warning";
  return "info";
};

/**
 * Data Quality Command Center Panel
 */
const DataQualityPanel = ({
  dataQuality,
  canManage = false,
  isWorking = false,
  panelError = "",
  onRunScan,
  onUpdateIssue,
  onApplyFix,
}) => {
  const qualityScore = Math.max(
    0,
    Math.min(100, Number(dataQuality?.overall_score || 0)),
  );
  const statusMeta =
    DATA_QUALITY_STATUS[dataQuality?.status] || DATA_QUALITY_STATUS.critical;
  const totals = dataQuality?.totals || {};
  const topIssues = dataQuality?.top_issues || [];
  const predictiveAlerts = dataQuality?.predictive_alerts || [];
  const workflowSummary = dataQuality?.action_center?.workflow_summary || {};
  const actionIssues = dataQuality?.action_center?.issues || [];
  const sla = dataQuality?.sla || {};
  const releaseGate = dataQuality?.release_gate || null;

  return (
    <Paper sx={{ ...panelWrapper, borderRadius: 4 }} elevation={0}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          gap: 1,
          flexWrap: "wrap",
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
          Data Quality Command Center
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {onRunScan && (
            <Button
              size="small"
              variant="outlined"
              startIcon={
                isWorking ? (
                  <CircularProgress size={14} />
                ) : (
                  <Refresh fontSize="small" />
                )
              }
              disabled={isWorking}
              onClick={onRunScan}
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
              Run Fresh Scan
            </Button>
          )}
          <Chip
            color={statusMeta.color}
            label={`${statusMeta.label} (${qualityScore.toFixed(0)}%)`}
            sx={{ fontWeight: 700, fontFamily: ccFonts.body }}
          />
        </Box>
      </Box>

      <LinearProgress
        variant="determinate"
        value={qualityScore}
        color={statusMeta.color}
        sx={{
          mb: 2,
          height: 10,
          borderRadius: 10,
          backgroundColor: ccColors.surface,
          "& .MuiLinearProgress-bar": {
            background: `linear-gradient(90deg, ${ccColors.amber} 0%, ${ccColors.emerald} 100%)`,
            borderRadius: 10,
          },
        }}
      />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        <Chip
          size="small"
          label={`Checks: ${formatCount(totals.checks_run)}`}
          sx={{
            bgcolor: ccColors.surface,
            color: ccColors.textSecondary,
            fontWeight: 600,
            fontFamily: ccFonts.body,
          }}
        />
        <Chip
          size="small"
          label={`With issues: ${formatCount(totals.checks_with_issues)}`}
          sx={{
            bgcolor: ccColors.surface,
            color: ccColors.textSecondary,
            fontWeight: 600,
            fontFamily: ccFonts.body,
          }}
        />
        <Chip
          size="small"
          color="error"
          label={`Critical: ${formatCount(totals.critical_issues)}`}
        />
        <Chip
          size="small"
          color="warning"
          label={`Warning: ${formatCount(totals.warning_issues)}`}
        />
        <Chip
          size="small"
          label={`Open: ${formatCount(workflowSummary.open)}`}
          sx={{
            bgcolor: ccColors.surface,
            color: ccColors.textSecondary,
            fontWeight: 600,
            fontFamily: ccFonts.body,
          }}
        />
        <Chip
          size="small"
          label={`Overdue: ${formatCount(sla.overdue_issues)}`}
          sx={{
            bgcolor: ccColors.surface,
            color: ccColors.textSecondary,
            fontWeight: 600,
            fontFamily: ccFonts.body,
          }}
        />
      </Box>

      {panelError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {panelError}
        </Alert>
      )}

      {releaseGate && (
        <Alert
          severity={releaseGate.allowed ? "success" : "warning"}
          sx={{ mb: 2 }}
        >
          {releaseGate.allowed
            ? "Release gate is clear for reporting/export actions."
            : `Release gate blocked: ${releaseGate.reasons?.join(" ") || "Resolve critical quality issues first."}`}
        </Alert>
      )}

      {topIssues.length === 0 ? (
        <Alert severity="success">
          No major data-quality inconsistencies detected.
        </Alert>
      ) : (
        <List disablePadding>
          {topIssues.map((check, index) => (
            <React.Fragment key={check.key || `${check.label}-${index}`}>
                <ListItem
                  disableGutters
                  sx={{
                    py: 1.5,
                    px: 1,
                  borderRadius: 2.5,
                  backgroundColor:
                    check.severity === "critical"
                      ? ccColors.coralGlow
                      : check.severity === "warning"
                        ? ccColors.amberGlow
                        : ccColors.blueGlow,
                  display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 1,
                    border: `1px solid ${
                    check.severity === "critical"
                      ? ccColors.coral
                      : check.severity === "warning"
                        ? ccColors.amber
                        : ccColors.blue
                    }`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor:
                        check.severity === "critical"
                          ? ccColors.coral
                          : check.severity === "warning"
                            ? ccColors.amber
                            : ccColors.blue,
                      boxShadow:
                        check.severity === "critical"
                          ? `0 0 20px -5px ${ccColors.coralGlow}`
                          : check.severity === "warning"
                            ? `0 0 20px -5px ${ccColors.amberGlow}`
                            : `0 0 20px -5px ${ccColors.blueGlow}`,
                    },
                  }}
                >
                <ListItemText
                  primary={`${check.label} (${formatCount(check.issue_count)} issues)`}
                  secondary={
                    check.samples?.length
                      ? check.samples.slice(0, 2).join(" ")
                      : "No sample rows captured."
                  }
                  primaryTypographyProps={{
                    sx: { color: ccColors.textPrimary, fontWeight: 600 },
                  }}
                  secondaryTypographyProps={{
                    sx: { color: ccColors.textSecondary },
                  }}
                />
                <Chip
                  size="small"
                  color={CHECK_SEVERITY_COLOR[check.severity] || "default"}
                  label={String(check.severity || "info").toUpperCase()}
                />
              </ListItem>
              {index < topIssues.length - 1 && (
                <Divider sx={{ borderColor: ccColors.borderLight }} />
              )}
            </React.Fragment>
          ))}
        </List>
      )}

      {predictiveAlerts.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {predictiveAlerts.map((alertItem, index) => (
            <Alert
              key={`${alertItem.type || "alert"}-${index}`}
              severity={toAlertSeverity(alertItem.severity)}
              sx={{ mb: 1 }}
            >
              {alertItem.message}
            </Alert>
          ))}
        </Box>
      )}

      <Divider sx={{ my: 2, borderColor: ccColors.borderLight }} />
      <Typography
        variant="subtitle1"
        sx={{
          mb: 1,
          color: ccColors.textPrimary,
          fontWeight: 700,
          fontFamily: ccFonts.display,
        }}
      >
        Action Center
      </Typography>
      {actionIssues.length === 0 ? (
        <Typography variant="body2" sx={{ color: ccColors.textSecondary }}>
          No actionable issues at the moment.
        </Typography>
      ) : (
        <List disablePadding>
          {actionIssues.slice(0, 12).map((issue, index) => {
            const canFix = SAFE_FIX_CHECKS.has(issue.check_key);
            return (
              <React.Fragment key={issue.id || `${issue.check_key}-${index}`}>
                <ListItem
                  disableGutters
                  sx={{
                    py: 1.3,
                    px: 1,
                    borderRadius: 2,
                    backgroundColor: ccColors.surface,
                    display: "block",
                    border: `1px solid ${ccColors.borderLight}`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor: ccColors.teal,
                      backgroundColor: ccColors.glassHighlight,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      mb: 0.5,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: ccColors.textPrimary }}
                    >
                      {issue.label}
                    </Typography>
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.8 }}
                    >
                      <Chip
                        size="small"
                        label={String(issue.status || "open").replace("_", " ")}
                        sx={{
                          bgcolor: ccColors.surface,
                          color: ccColors.textSecondary,
                        }}
                      />
                      <Chip
                        size="small"
                        color={
                          CHECK_SEVERITY_COLOR[issue.severity] || "default"
                        }
                        label={`${String(issue.severity || "info").toUpperCase()} (${formatCount(issue.issue_count)})`}
                      />
                    </Box>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      mb: 1,
                      color: ccColors.textSecondary,
                    }}
                  >
                    {issue.school_name ? `${issue.school_name} | ` : ""}
                    {issue.sample_details?.[0] || "No sample details captured."}
                  </Typography>
                  {canManage && (
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {issue.status === "open" && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={isWorking}
                          onClick={() =>
                            onUpdateIssue?.(issue.id, { status: "in_progress" })
                          }
                          sx={{
                            borderColor: ccColors.border,
                            color: ccColors.textPrimary,
                            fontFamily: ccFonts.body,
                          }}
                        >
                          Start
                        </Button>
                      )}
                      {issue.status !== "resolved" ? (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={isWorking}
                          onClick={() =>
                            onUpdateIssue?.(issue.id, {
                              status: "resolved",
                              resolution_notes:
                                "Resolved from dashboard action center.",
                            })
                          }
                          sx={{
                            borderColor: ccColors.border,
                            color: ccColors.textPrimary,
                            fontFamily: ccFonts.body,
                          }}
                        >
                          Resolve
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={isWorking}
                          onClick={() =>
                            onUpdateIssue?.(issue.id, { status: "open" })
                          }
                          sx={{
                            borderColor: ccColors.border,
                            color: ccColors.textPrimary,
                            fontFamily: ccFonts.body,
                          }}
                        >
                          Reopen
                        </Button>
                      )}
                      {(issue.status === "open" ||
                        issue.status === "in_progress") && (
                        <Button
                          size="small"
                          variant="text"
                          color="warning"
                          disabled={isWorking}
                          onClick={() => {
                            const reason = window.prompt(
                              "Reason for ignoring this issue:",
                              issue.ignored_reason || "",
                            );
                            if (reason === null) return;
                            onUpdateIssue?.(issue.id, {
                              status: "ignored",
                              ignored_reason:
                                reason ||
                                "Ignored from dashboard action center.",
                            });
                          }}
                        >
                          Ignore
                        </Button>
                      )}
                      {canFix && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<AutoFixHigh fontSize="small" />}
                          disabled={isWorking}
                          onClick={() =>
                            onApplyFix?.(
                              issue.check_key,
                              issue.scope_level === "school"
                                ? issue.school_id
                                : null,
                            )
                          }
                          sx={{
                            backgroundColor: ccColors.teal,
                            fontFamily: ccFonts.body,
                            fontWeight: 700,
                            "&:hover": {
                              backgroundColor: ccColors.blue,
                            },
                          }}
                        >
                          Safe Fix
                        </Button>
                      )}
                    </Box>
                  )}
                </ListItem>
                {index < actionIssues.length - 1 && (
                  <Divider sx={{ borderColor: ccColors.borderLight }} />
                )}
              </React.Fragment>
            );
          })}
        </List>
      )}

      <Typography
        variant="caption"
        sx={{ display: "block", mt: 2, color: ccColors.textMuted }}
      >
        Last checked: {formatAuditDate(dataQuality?.generated_at)}
      </Typography>
    </Paper>
  );
};

export default DataQualityPanel;
