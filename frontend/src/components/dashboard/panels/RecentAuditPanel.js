import React from "react";
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";

const formatActionLabel = (action) => {
  if (!action) return "Unknown action";
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatAuditDate = (value) => {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
};

const getAuditActor = (audit) => {
  const actor = audit?.User || audit?.user;
  if (!actor) {
    return audit?.user_id ? `User ${audit.user_id}` : "System";
  }
  const fullName = [actor.first_name, actor.last_name]
    .filter(Boolean)
    .join(" ");
  return fullName || actor.username || actor.email || "System";
};

const getAuditContext = (audit) => audit?.new_values?.audit_context || null;

const getAuditContextLabel = (audit) => {
  const context = getAuditContext(audit);
  if (!context) return null;
  const method = String(context.method || "").toUpperCase();
  const path = String(context.path || "");
  if (!method && !path) return null;
  return `${method} ${path}`.trim();
};

const getChangedFieldsLabel = (audit) => {
  const context = getAuditContext(audit);
  const fields = Array.isArray(context?.changed_fields)
    ? context.changed_fields.filter(Boolean)
    : [];
  if (fields.length === 0) return null;
  return `Changed: ${fields.slice(0, 4).join(", ")}${fields.length > 4 ? "…" : ""}`;
};

/**
 * Recent Audit Activity Panel
 */
const RecentAuditPanel = ({ recentAudits }) => {
  return (
    <Paper sx={panelWrapper} elevation={0}>
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: ccColors.textPrimary,
          fontWeight: 700,
          fontFamily: ccFonts.display,
        }}
      >
        Recent Audit Activity (Last 24 Hours)
      </Typography>
      {recentAudits.length === 0 ? (
        <Typography variant="body2" sx={{ color: ccColors.textSecondary }}>
          No audit activity found in the last 24 hours.
        </Typography>
      ) : (
        <List disablePadding>
          {recentAudits.map((audit, index) => (
            <React.Fragment key={audit.id || `${audit.action}-${index}`}>
              <ListItem
                disableGutters
                sx={{
                  py: 1.5,
                  px: 1,
                  borderRadius: 2,
                  backgroundColor:
                    index % 2 === 0 ? ccColors.surface : "transparent",
                }}
              >
                <ListItemText
                  primary={formatActionLabel(audit.action)}
                  secondary={
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                      <Typography variant="caption" sx={{ color: ccColors.textSecondary }}>
                        {`${getAuditActor(audit)} | ${audit.table_name || "system"} | ${formatAuditDate(audit.createdAt || audit.created_at)}`}
                      </Typography>
                      {getAuditContextLabel(audit) ? (
                        <Typography variant="caption" sx={{ color: ccColors.textMuted }}>
                          {getAuditContextLabel(audit)}
                        </Typography>
                      ) : null}
                      {getChangedFieldsLabel(audit) ? (
                        <Typography variant="caption" sx={{ color: ccColors.textMuted }}>
                          {getChangedFieldsLabel(audit)}
                        </Typography>
                      ) : null}
                    </Box>
                  }
                  primaryTypographyProps={{
                    sx: { color: ccColors.textPrimary, fontWeight: 500 },
                  }}
                />
              </ListItem>
              {index < recentAudits.length - 1 && (
                <Divider sx={{ borderColor: ccColors.borderLight }} />
              )}
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default RecentAuditPanel;
