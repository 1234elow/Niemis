import React, { useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Stack,
  TextField,
  MenuItem,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { ccColors, ccFonts, panelWrapper } from "../commandCenterTheme";
import { formatBarbadosDateTime } from "../../../utils/dateTime";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const formatActionLabel = (action) => {
  if (!action) return "Unknown action";
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const parseAuditTime = (audit) => {
  const value = audit?.createdAt || audit?.created_at;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAuditDate = (value) => formatBarbadosDateTime(value);

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

const getAuditActorId = (audit) => {
  const actor = audit?.User || audit?.user;
  return actor?.id != null ? String(actor.id) : "";
};

const getAuditContext = (audit) => audit?.new_values?.audit_context || null;

const getAuditMethod = (audit) =>
  String(getAuditContext(audit)?.method || "").toUpperCase();

const getAuditPath = (audit) => String(getAuditContext(audit)?.path || "");

const getAuditSchoolId = (audit) => {
  const context = getAuditContext(audit);
  const schoolIdFromContext = context?.school_id;
  if (schoolIdFromContext != null && schoolIdFromContext !== "") {
    return String(schoolIdFromContext);
  }
  const schoolIdFromStaff = audit?.User?.Staff?.school_id;
  if (schoolIdFromStaff != null && schoolIdFromStaff !== "") {
    return String(schoolIdFromStaff);
  }
  const schoolIdFromSchool = audit?.User?.Staff?.School?.id;
  if (schoolIdFromSchool != null && schoolIdFromSchool !== "") {
    return String(schoolIdFromSchool);
  }
  return "";
};

const getAuditSchoolName = (audit) => {
  const school = audit?.User?.Staff?.School;
  return school?.name || "";
};

const getAuditEventType = (audit) => {
  const method = getAuditMethod(audit);
  if (method === "GET" || String(audit?.action || "").startsWith("API_READ_")) {
    return "read";
  }
  if (WRITE_METHODS.has(method)) {
    return "write";
  }
  return "write";
};

const getChangedFieldsLabel = (audit) => {
  const context = getAuditContext(audit);
  const fields = Array.isArray(context?.changed_fields)
    ? context.changed_fields.filter(Boolean)
    : [];
  if (fields.length === 0) return null;
  return `Changed: ${fields.slice(0, 4).join(", ")}${
    fields.length > 4 ? "..." : ""
  }`;
};

const toJson = (value) => {
  if (!value) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
};

const csvEscape = (value) => {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildAuditCsv = (rows) => {
  const headers = [
    "timestamp",
    "event_type",
    "actor",
    "actor_email",
    "action",
    "table_name",
    "record_id",
    "method",
    "path",
    "school_id",
    "school_name",
    "status_code",
    "duration_ms",
    "changed_fields",
  ];

  const lines = rows.map((row) => {
    const context = getAuditContext(row);
    const actor = row?.User || row?.user || {};
    return [
      row?.createdAt || row?.created_at || "",
      getAuditEventType(row),
      getAuditActor(row),
      actor?.email || "",
      row?.action || "",
      row?.table_name || "",
      row?.record_id || "",
      getAuditMethod(row),
      getAuditPath(row),
      getAuditSchoolId(row),
      getAuditSchoolName(row),
      context?.status_code ?? "",
      context?.duration_ms ?? "",
      Array.isArray(context?.changed_fields)
        ? context.changed_fields.join("; ")
        : "",
    ];
  });

  return [headers, ...lines]
    .map((line) => line.map((cell) => csvEscape(cell)).join(","))
    .join("\n");
};

const downloadCsv = (rows) => {
  const csvContent = buildAuditCsv(rows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-log-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const RecentAuditPanel = ({ recentAudits, isFetching = false, filterMeta = {} }) => {
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [pathFilter, setPathFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const fallbackActorOptions = useMemo(() => {
    const map = new Map();
    for (const audit of recentAudits) {
      const actorId = getAuditActorId(audit);
      if (!actorId || map.has(actorId)) continue;
      map.set(actorId, {
        id: actorId,
        username: audit?.User?.username || null,
        email: audit?.User?.email || null,
      });
    }
    return Array.from(map.values());
  }, [recentAudits]);

  const actorOptions = Array.isArray(filterMeta?.actor_options) &&
    filterMeta.actor_options.length > 0
      ? filterMeta.actor_options
      : fallbackActorOptions;

  const fallbackActionOptions = useMemo(() => {
    const set = new Set(recentAudits.map((audit) => audit?.action).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [recentAudits]);

  const actionOptions = Array.isArray(filterMeta?.action_options) &&
    filterMeta.action_options.length > 0
      ? filterMeta.action_options
      : fallbackActionOptions;

  const fallbackSchoolOptions = useMemo(() => {
    const map = new Map();
    for (const audit of recentAudits) {
      const schoolId = getAuditSchoolId(audit);
      if (!schoolId || map.has(schoolId)) continue;
      map.set(schoolId, {
        id: schoolId,
        name: getAuditSchoolName(audit) || `School ${schoolId}`,
      });
    }
    return Array.from(map.values());
  }, [recentAudits]);

  const schoolOptions = Array.isArray(filterMeta?.school_options) &&
    filterMeta.school_options.length > 0
      ? filterMeta.school_options
      : fallbackSchoolOptions;

  const filteredAudits = useMemo(() => {
    const pathNeedle = pathFilter.trim().toLowerCase();
    const fromTime = fromFilter ? new Date(fromFilter).getTime() : null;
    const toTime = toFilter ? new Date(toFilter).getTime() : null;

    return recentAudits.filter((audit) => {
      if (actionFilter && String(audit?.action || "") !== actionFilter) {
        return false;
      }

      if (actorFilter && getAuditActorId(audit) !== String(actorFilter)) {
        return false;
      }

      if (schoolFilter && getAuditSchoolId(audit) !== String(schoolFilter)) {
        return false;
      }

      if (eventTypeFilter !== "all" && getAuditEventType(audit) !== eventTypeFilter) {
        return false;
      }

      if (pathNeedle) {
        const haystack = `${getAuditPath(audit)} ${String(audit?.table_name || "")}`
          .toLowerCase()
          .trim();
        if (!haystack.includes(pathNeedle)) {
          return false;
        }
      }

      const auditTime = parseAuditTime(audit);
      const auditMs = auditTime ? auditTime.getTime() : null;
      if (fromTime != null && auditMs != null && auditMs < fromTime) {
        return false;
      }
      if (toTime != null && auditMs != null && auditMs > toTime) {
        return false;
      }
      return true;
    });
  }, [
    recentAudits,
    actionFilter,
    actorFilter,
    schoolFilter,
    eventTypeFilter,
    pathFilter,
    fromFilter,
    toFilter,
  ]);

  const handleResetFilters = () => {
    setActionFilter("");
    setActorFilter("");
    setSchoolFilter("");
    setEventTypeFilter("all");
    setPathFilter("");
    setFromFilter("");
    setToFilter("");
  };

  return (
    <Paper sx={panelWrapper} elevation={0}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1}
        alignItems={{ xs: "flex-start", lg: "center" }}
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Typography
          variant="h6"
          sx={{
            color: ccColors.textPrimary,
            fontWeight: 700,
            fontFamily: ccFonts.display,
          }}
        >
          Recent Audit Activity
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            size="small"
            label={`${filteredAudits.length} shown`}
            sx={{ color: ccColors.textPrimary, borderColor: ccColors.border }}
            variant="outlined"
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => downloadCsv(filteredAudits)}
            disabled={filteredAudits.length === 0}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          mb: 2,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
          gap: 1,
        }}
      >
        <TextField
          select
          size="small"
          label="Action"
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
        >
          <MenuItem value="">All actions</MenuItem>
          {actionOptions.map((action) => (
            <MenuItem key={action} value={action}>
              {formatActionLabel(action)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Actor"
          value={actorFilter}
          onChange={(event) => setActorFilter(event.target.value)}
        >
          <MenuItem value="">All actors</MenuItem>
          {actorOptions.map((actor) => {
            const actorId = String(actor.id);
            const actorLabel = actor.username || actor.email || `User ${actorId}`;
            return (
              <MenuItem key={actorId} value={actorId}>
                {actorLabel}
              </MenuItem>
            );
          })}
        </TextField>

        <TextField
          select
          size="small"
          label="School"
          value={schoolFilter}
          onChange={(event) => setSchoolFilter(event.target.value)}
        >
          <MenuItem value="">All schools</MenuItem>
          {schoolOptions.map((school) => (
            <MenuItem key={String(school.id)} value={String(school.id)}>
              {school.name || `School ${school.id}`}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Event type"
          value={eventTypeFilter}
          onChange={(event) => setEventTypeFilter(event.target.value)}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="read">Read events</MenuItem>
          <MenuItem value="write">Write events</MenuItem>
        </TextField>

        <TextField
          size="small"
          label="Path / table contains"
          value={pathFilter}
          onChange={(event) => setPathFilter(event.target.value)}
        />

        <Button size="small" variant="text" onClick={handleResetFilters}>
          Reset filters
        </Button>

        <TextField
          size="small"
          type="datetime-local"
          label="From"
          InputLabelProps={{ shrink: true }}
          value={fromFilter}
          onChange={(event) => setFromFilter(event.target.value)}
        />

        <TextField
          size="small"
          type="datetime-local"
          label="To"
          InputLabelProps={{ shrink: true }}
          value={toFilter}
          onChange={(event) => setToFilter(event.target.value)}
        />

        <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
          <Typography variant="caption" sx={{ color: ccColors.textSecondary }}>
            {isFetching ? "Refreshing..." : "Live updates every 5 seconds"}
          </Typography>
        </Box>
      </Box>

      {filteredAudits.length === 0 ? (
        <Typography variant="body2" sx={{ color: ccColors.textSecondary }}>
          No audit activity found for the selected filters.
        </Typography>
      ) : (
        <List disablePadding>
          {filteredAudits.map((audit, index) => {
            const context = getAuditContext(audit);
            const method = getAuditMethod(audit);
            const eventType = getAuditEventType(audit);
            const schoolName = getAuditSchoolName(audit);
            const schoolId = getAuditSchoolId(audit);

            return (
              <React.Fragment key={audit.id || `${audit.action}-${index}`}>
                <ListItemButton
                  onClick={() => setSelectedAudit(audit)}
                  sx={{
                    py: 1.5,
                    px: 1,
                    borderRadius: 2,
                    alignItems: "flex-start",
                    backgroundColor: index % 2 === 0 ? ccColors.surface : "transparent",
                  }}
                >
                  <ListItemText
                    primary={
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Typography sx={{ color: ccColors.textPrimary, fontWeight: 600 }}>
                          {formatActionLabel(audit.action)}
                        </Typography>
                        <Chip
                          size="small"
                          label={eventType.toUpperCase()}
                          color={eventType === "read" ? "info" : "warning"}
                          sx={{ height: 20 }}
                        />
                      </Stack>
                    }
                    secondary={
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: ccColors.textSecondary }}>
                          {`${getAuditActor(audit)} | ${audit.table_name || "system"} | ${formatAuditDate(
                            audit.createdAt || audit.created_at,
                          )}`}
                        </Typography>
                        {method || getAuditPath(audit) ? (
                          <Typography variant="caption" sx={{ color: ccColors.textMuted }}>
                            {`${method || "N/A"} ${getAuditPath(audit) || ""}`.trim()}
                          </Typography>
                        ) : null}
                        {schoolId ? (
                          <Typography variant="caption" sx={{ color: ccColors.textMuted }}>
                            {`School: ${schoolName || schoolId}`}
                          </Typography>
                        ) : null}
                        {getChangedFieldsLabel(audit) ? (
                          <Typography variant="caption" sx={{ color: ccColors.textMuted }}>
                            {getChangedFieldsLabel(audit)}
                          </Typography>
                        ) : null}
                        {context?.status_code ? (
                          <Typography variant="caption" sx={{ color: ccColors.textMuted }}>
                            {`Status: ${context.status_code} | Duration: ${
                              context.duration_ms ?? 0
                            }ms`}
                          </Typography>
                        ) : null}
                      </Box>
                    }
                  />
                </ListItemButton>
                {index < filteredAudits.length - 1 && (
                  <Divider sx={{ borderColor: ccColors.borderLight }} />
                )}
              </React.Fragment>
            );
          })}
        </List>
      )}

      <Dialog
        open={Boolean(selectedAudit)}
        onClose={() => setSelectedAudit(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Audit Event Detail</DialogTitle>
        <DialogContent dividers>
          {selectedAudit ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                <strong>Action:</strong> {selectedAudit.action || "Unknown"}
              </Typography>
              <Typography variant="body2">
                <strong>Actor:</strong> {getAuditActor(selectedAudit)}
              </Typography>
              <Typography variant="body2">
                <strong>Occurred:</strong>{" "}
                {formatAuditDate(selectedAudit.createdAt || selectedAudit.created_at)}
              </Typography>
              <Typography variant="body2">
                <strong>Method / Path:</strong>{" "}
                {`${getAuditMethod(selectedAudit) || "N/A"} ${
                  getAuditPath(selectedAudit) || "N/A"
                }`}
              </Typography>
              <Typography variant="body2">
                <strong>Table / Record:</strong>{" "}
                {`${selectedAudit.table_name || "system"} / ${
                  selectedAudit.record_id || "N/A"
                }`}
              </Typography>
              <Typography variant="body2">
                <strong>School:</strong>{" "}
                {getAuditSchoolName(selectedAudit) || getAuditSchoolId(selectedAudit) || "N/A"}
              </Typography>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Old Values
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.25,
                  borderRadius: 1,
                  backgroundColor: ccColors.surface,
                  color: ccColors.textSecondary,
                  overflowX: "auto",
                  fontSize: 12,
                  border: `1px solid ${ccColors.borderLight}`,
                }}
              >
                {toJson(selectedAudit.old_values)}
              </Box>
              <Typography variant="subtitle2">New Values</Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.25,
                  borderRadius: 1,
                  backgroundColor: ccColors.surface,
                  color: ccColors.textSecondary,
                  overflowX: "auto",
                  fontSize: 12,
                  border: `1px solid ${ccColors.borderLight}`,
                }}
              >
                {toJson(selectedAudit.new_values)}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedAudit(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default RecentAuditPanel;
