import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { FileDownload, PictureAsPdf, Print, Refresh } from "@mui/icons-material";
import { useQuery } from "react-query";

import { apiService } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";

const READINESS_STATUS = {
  healthy: { label: "Healthy", color: "success" },
  watch: { label: "Watch", color: "warning" },
  critical: { label: "Critical", color: "error" },
};

const CHECKLIST_STATUS = {
  complete: { label: "Complete", color: "success" },
  in_progress: { label: "In Progress", color: "warning" },
  todo: { label: "To Do", color: "default" },
};

const clampScore = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const formatDate = (value) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
};

const scoreTone = (score) => {
  if (score >= 85) return "success";
  if (score >= 65) return "warning";
  return "error";
};

const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadTextFile = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const ScoreCard = ({ label, value, subtitle }) => (
  <Paper
    sx={(theme) => ({
      p: 2,
      borderRadius: 2.5,
      border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
      height: "100%",
    })}
  >
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h4" sx={{ fontWeight: 800 }}>
      {value}
    </Typography>
    {subtitle ? (
      <Typography variant="caption" color="text.secondary">
        {subtitle}
      </Typography>
    ) : null}
  </Paper>
);

const ReadinessPage = () => {
  const navigate = useNavigate();
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfExportError, setPdfExportError] = useState("");
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    ["readiness-workspace"],
    () => apiService.getAdminDashboard(),
    {
      staleTime: 30 * 1000,
      refetchInterval: 60 * 1000,
      keepPreviousData: true,
    },
  );

  const readiness = data?.barbados_readiness || {};
  const pillars = readiness?.pillars || [];
  const checklist = readiness?.checklist || [];
  const overallScore = clampScore(readiness?.overall_score);
  const statusMeta = READINESS_STATUS[readiness?.status] || READINESS_STATUS.critical;

  const checklistSummary = useMemo(() => {
    return checklist.reduce(
      (acc, item) => {
        const status = String(item?.status || "todo");
        if (status === "complete") acc.complete += 1;
        else if (status === "in_progress") acc.in_progress += 1;
        else acc.todo += 1;
        return acc;
      },
      { complete: 0, in_progress: 0, todo: 0 },
    );
  }, [checklist]);

  const openBlockers = useMemo(
    () =>
      pillars.flatMap((pillar) =>
        (pillar?.blockers || []).map((text) => ({
          pillar_key: pillar.key,
          pillar_label: pillar.label,
          text,
          score: clampScore(pillar.score),
          actions: pillar.next_actions || [],
        })),
      ),
    [pillars],
  );

  const priorityBlockers = useMemo(
    () =>
      [...openBlockers]
        .sort((a, b) => Number(a.score || 0) - Number(b.score || 0))
        .slice(0, 8),
    [openBlockers],
  );

  const exportCsv = () => {
    const rows = [];
    const generatedAt = readiness?.generated_at || new Date().toISOString();

    rows.push(["Barbados EMIS Readiness Snapshot"]);
    rows.push(["Generated At", generatedAt]);
    rows.push(["Overall Score", `${Math.round(overallScore)}%`]);
    rows.push(["Status", statusMeta.label]);
    rows.push([]);

    rows.push(["Pillars"]);
    rows.push(["Key", "Label", "Score", "Status", "Summary", "Metrics", "Blockers", "Next Actions"]);
    pillars.forEach((pillar) => {
      rows.push([
        pillar.key || "",
        pillar.label || "",
        `${Math.round(clampScore(pillar.score))}%`,
        String(pillar.status || ""),
        pillar.summary || "",
        (pillar.metrics || []).join(" | "),
        (pillar.blockers || []).join(" | "),
        (pillar.next_actions || []).map((action) => `${action.label} (${action.path})`).join(" | "),
      ]);
    });
    rows.push([]);

    rows.push(["Checklist"]);
    rows.push(["Key", "Label", "Status", "Detail"]);
    checklist.forEach((item) => {
      rows.push([
        item.key || "",
        item.label || "",
        item.status || "",
        item.detail || "",
      ]);
    });
    rows.push([]);

    rows.push(["Priority Blockers"]);
    rows.push(["Pillar", "Score", "Blocker", "Actions"]);
    priorityBlockers.forEach((blocker) => {
      rows.push([
        blocker.pillar_label || "",
        `${Math.round(clampScore(blocker.score))}%`,
        blocker.text || "",
        (blocker.actions || []).map((action) => `${action.label} (${action.path})`).join(" | "),
      ]);
    });

    const csvText = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `barbados-readiness-${dateStamp}.csv`,
      csvText,
      "text/csv;charset=utf-8;",
    );
  };

  const printSnapshot = () => {
    const generatedLabel = formatDate(readiness?.generated_at);
    const html = `
      <html>
        <head>
          <title>Barbados Readiness Snapshot</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 6px; font-size: 24px; }
            h2 { margin: 22px 0 8px; font-size: 18px; }
            p { margin: 0 0 6px; }
            table { border-collapse: collapse; width: 100%; margin-top: 8px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; font-size: 12px; }
            th { background: #f3f4f6; font-weight: 700; }
            .meta { margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <h1>Barbados EMIS Readiness Snapshot</h1>
          <div class="meta">
            <p><strong>Generated:</strong> ${generatedLabel}</p>
            <p><strong>Overall Score:</strong> ${Math.round(overallScore)}%</p>
            <p><strong>Status:</strong> ${statusMeta.label}</p>
          </div>
          <h2>Pillars</h2>
          <table>
            <thead>
              <tr>
                <th>Pillar</th>
                <th>Score</th>
                <th>Status</th>
                <th>Summary</th>
                <th>Blockers</th>
              </tr>
            </thead>
            <tbody>
              ${pillars
                .map(
                  (pillar) => `
                    <tr>
                      <td>${pillar.label || ""}</td>
                      <td>${Math.round(clampScore(pillar.score))}%</td>
                      <td>${pillar.status || ""}</td>
                      <td>${pillar.summary || ""}</td>
                      <td>${(pillar.blockers || []).join(" | ") || "-"}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
          <h2>Implementation Checklist</h2>
          <table>
            <thead>
              <tr>
                <th>Control</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              ${checklist
                .map(
                  (item) => `
                    <tr>
                      <td>${item.label || ""}</td>
                      <td>${item.status || ""}</td>
                      <td>${item.detail || ""}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadSignedPdf = async () => {
    setPdfExportError("");
    setPdfExporting(true);
    try {
      const result = await apiService.downloadReadinessSignedPdf({ readiness });
      const filename =
        result?.filename ||
        `barbados-readiness-signed-${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = window.URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setPdfExportError(
        exportError?.response?.data?.error ||
          exportError?.message ||
          "Failed to generate signed PDF report.",
      );
    } finally {
      setPdfExporting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Barbados Readiness
        </Typography>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Failed to load readiness workspace. {error?.message || ""}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Paper
        sx={(theme) => ({
          p: 3,
          mb: 3,
          borderRadius: 3,
          background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, ${alpha(
            theme.palette.background.paper,
            0.98,
          )} 60%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
        })}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: "0.08em", fontWeight: 700 }}>
              BARBADOS EMIS
            </Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              Readiness Workspace
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Operational readiness across governance, transitions, exam pathways, and data integrity.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button
              variant="outlined"
              startIcon={<FileDownload fontSize="small" />}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<Print fontSize="small" />}
              onClick={printSnapshot}
            >
              Print / PDF
            </Button>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdf fontSize="small" />}
              onClick={downloadSignedPdf}
              disabled={pdfExporting}
            >
              Signed PDF
            </Button>
            <Chip
              color={statusMeta.color}
              label={`${statusMeta.label} (${Math.round(overallScore)}%)`}
            />
            <Button
              variant="contained"
              startIcon={<Refresh fontSize="small" />}
              onClick={() => refetch()}
              disabled={isFetching}
            >
              Refresh
            </Button>
          </Stack>
        </Box>
        <LinearProgress
          variant="determinate"
          value={overallScore}
          color={statusMeta.color}
          sx={{ height: 10, borderRadius: 100, mb: 1.5 }}
        />
        <Typography variant="caption" color="text.secondary">
          Last assessed: {formatDate(readiness?.generated_at)}
        </Typography>
      </Paper>

      {pdfExportError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {pdfExportError}
        </Alert>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <ScoreCard
            label="Readiness Pillars"
            value={pillars.length}
            subtitle="National operational domains"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ScoreCard
            label="Checklist Complete"
            value={checklistSummary.complete}
            subtitle={`${checklist.length} total controls`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ScoreCard
            label="In Progress"
            value={checklistSummary.in_progress}
            subtitle="Partial compliance"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ScoreCard
            label="Open Blockers"
            value={openBlockers.length}
            subtitle="Items requiring intervention"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Pillar Performance
            </Typography>
            {pillars.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No readiness pillars available.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {pillars.map((pillar) => {
                  const pillarScore = clampScore(pillar.score);
                  const pillarStatus = READINESS_STATUS[pillar.status] || READINESS_STATUS.critical;
                  return (
                    <Paper
                      key={pillar.key || pillar.label}
                      variant="outlined"
                      sx={(theme) => ({
                        p: 2,
                        borderRadius: 2,
                        borderColor: alpha(theme.palette.primary.main, 0.18),
                      })}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          mb: 1,
                          flexWrap: "wrap",
                        }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {pillar.label}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip size="small" color={pillarStatus.color} label={pillarStatus.label} />
                          <Chip size="small" color={scoreTone(pillarScore)} label={`${Math.round(pillarScore)}%`} />
                        </Stack>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {pillar.summary}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={pillarScore}
                        color={scoreTone(pillarScore)}
                        sx={{ height: 7, borderRadius: 99, mb: 1.25 }}
                      />
                      <Stack spacing={0.5} sx={{ mb: 1 }}>
                        {(pillar.metrics || []).map((metric, index) => (
                          <Typography
                            key={`${pillar.key || "pillar"}-metric-${index}`}
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block" }}
                          >
                            {metric}
                          </Typography>
                        ))}
                      </Stack>
                      {(pillar.blockers || []).length > 0 ? (
                        <Alert severity="warning" sx={{ mb: 1 }}>
                          {(pillar.blockers || []).join(" ")}
                        </Alert>
                      ) : null}
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 0.8 }}>
                        {(pillar.next_actions || []).map((action, index) => (
                          <Button
                            key={`${pillar.key || "pillar"}-action-${index}`}
                            size="small"
                            variant="outlined"
                            onClick={() => action?.path && navigate(action.path)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Priority Blockers
            </Typography>
            {priorityBlockers.length === 0 ? (
              <Alert severity="success">No blockers currently open.</Alert>
            ) : (
              <Stack spacing={1}>
                {priorityBlockers.map((blocker, index) => (
                  <Paper
                    key={`${blocker.pillar_key || "blocker"}-${index}`}
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: 2 }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {blocker.pillar_label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {blocker.text}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 0.8 }}>
                      {(blocker.actions || []).map((action, actionIndex) => (
                        <Button
                          key={`${blocker.pillar_key || "blocker"}-action-${actionIndex}`}
                          size="small"
                          variant="text"
                          onClick={() => action?.path && navigate(action.path)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Implementation Checklist
            </Typography>
            {checklist.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Checklist is not available.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Control</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {checklist.map((item, index) => {
                    const meta = CHECKLIST_STATUS[item.status] || CHECKLIST_STATUS.todo;
                    return (
                      <TableRow key={item.key || `item-${index}`}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.detail}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={meta.label}
                            color={meta.color}
                            variant={item.status === "todo" ? "outlined" : "filled"}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              This page updates every 60 seconds using the latest admin dashboard snapshot.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReadinessPage;
