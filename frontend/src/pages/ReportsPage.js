import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import {
  Assessment,
  Upload,
  Download,
  CheckCircle,
  Print,
  Close,
  Refresh,
  NavigateBefore,
  NavigateNext,
  Visibility,
} from "@mui/icons-material";
import { useReactToPrint } from "react-to-print";
import { toast } from "react-hot-toast";

import { useAuth } from "../contexts/AuthContext";
import { apiService } from "../services/apiService";
import TermReportTable from "../components/TermReportTable";
import CSVImportDialog from "../components/CSVImportDialog";
import StudentReportCard from "../components/StudentReportCard";
import YearEndStatusDialog from "../components/YearEndStatusDialog";

const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`reports-tabpanel-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const ReportsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Selection state
  const [classes, setClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");

  // Report data
  const [termReportData, setTermReportData] = useState(null);
  const [studentReportData, setStudentReportData] = useState(null);

  // Dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [studentReportDialogOpen, setStudentReportDialogOpen] = useState(false);
  const [yearEndDialogOpen, setYearEndDialogOpen] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [releaseGateDialogOpen, setReleaseGateDialogOpen] = useState(false);
  const [releaseGatePayload, setReleaseGatePayload] = useState(null);

  // Print ref
  const printRef = useRef();

  // Load classes and terms on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [classesRes, termsRes] = await Promise.all([
        apiService.getReportClasses(),
        apiService.getReportTerms(),
      ]);
      setClasses(classesRes.classes || []);
      setTerms(termsRes.terms || []);

      // Auto-select current term if available
      const currentTerm = termsRes.terms?.find((t) => t.is_current);
      if (currentTerm) {
        setSelectedTerm(currentTerm.id);
      }
    } catch (err) {
      console.error("Error loading initial data:", err);
      setError("Failed to load classes and terms");
    } finally {
      setLoading(false);
    }
  };

  const loadTermReport = async () => {
    if (!selectedClass || !selectedTerm) {
      setError("Please select a class and term");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await apiService.getTermReport(selectedClass, selectedTerm);
      setTermReportData(data);
    } catch (err) {
      console.error("Error loading term report:", err);
      setError(err.response?.data?.error || "Failed to load term report");
    } finally {
      setLoading(false);
    }
  };

  const handleViewStudentReport = async (student, index = 0) => {
    if (!selectedTerm) {
      toast.error("Please select a term first");
      return;
    }

    try {
      setLoading(true);
      setCurrentStudentIndex(index);
      const data = await apiService.getStudentReport(student.id, selectedTerm);
      setStudentReportData(data);
      setStudentReportDialogOpen(true);
    } catch (err) {
      console.error("Error loading student report:", err);
      toast.error("Failed to load student report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrevStudent = () => {
    const students = termReportData?.students || [];
    if (currentStudentIndex > 0) {
      handleViewStudentReport(
        students[currentStudentIndex - 1],
        currentStudentIndex - 1,
      );
    }
  };

  const handleNextStudent = () => {
    const students = termReportData?.students || [];
    if (currentStudentIndex < students.length - 1) {
      handleViewStudentReport(
        students[currentStudentIndex + 1],
        currentStudentIndex + 1,
      );
    }
  };

  const handlePrintStudentReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: studentReportData
      ? `Report_${studentReportData.student?.student_id}`
      : "Student_Report",
  });

  const extractReleaseGatePayloadFromError = async (err) => {
    if (err?.response?.status !== 409) {
      return null;
    }

    let payload = err?.response?.data;
    if (!payload) {
      return null;
    }

    if (typeof Blob !== "undefined" && payload instanceof Blob) {
      try {
        const text = await payload.text();
        payload = JSON.parse(text);
      } catch (parseError) {
        return null;
      }
    }

    if (payload?.code !== "DATA_QUALITY_RELEASE_GATE_BLOCKED") {
      return null;
    }

    return payload;
  };

  const showReleaseGateDialog = (payload) => {
    if (!payload) {
      return;
    }
    setReleaseGatePayload(payload);
    setReleaseGateDialogOpen(true);
  };

  const handleExportTermReport = async () => {
    if (!selectedClass || !selectedTerm) {
      toast.error("Please select a class and term");
      return;
    }

    try {
      setLoading(true);
      const blob = await apiService.exportTermReport(
        selectedClass,
        selectedTerm,
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const className =
        classes.find((c) => c.id === selectedClass)?.name || "class";
      const termName = terms.find((t) => t.id === selectedTerm)?.name || "term";
      link.download = `term-report_${className}_${termName}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Report exported successfully");
    } catch (err) {
      console.error("Error exporting report:", err);
      const gatePayload = await extractReleaseGatePayloadFromError(err);
      if (gatePayload) {
        showReleaseGateDialog(gatePayload);
        toast.error("Export blocked by data quality release gate");
        return;
      }
      toast.error("Failed to export report");
    } finally {
      setLoading(false);
    }
  };

  const handleYearEndBlocked = (payload) => {
    showReleaseGateDialog(payload);
    toast.error("Year-end finalization blocked by data quality release gate");
  };

  const handleImportComplete = (result) => {
    toast.success(`Imported ${result.summary.imported} grades`);
    // Reload the term report if we have one loaded
    if (termReportData) {
      loadTermReport();
    }
  };

  const handleYearEndComplete = (result) => {
    toast.success(`Updated ${result.summary.success} student statuses`);
    // Reload the term report if we have one loaded
    if (termReportData) {
      loadTermReport();
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError("");
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto", overflow: "hidden" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Reports & Analytics
        </Typography>
        <Typography color="text.secondary">
          View term reports, import grades, export data, and manage year-end
          status
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Selection Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Class</InputLabel>
              <Select
                value={selectedClass}
                label="Select Class"
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name} - {cls.grade_level} ({cls.School?.name})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Term</InputLabel>
              <Select
                value={selectedTerm}
                label="Select Term"
                onChange={(e) => setSelectedTerm(e.target.value)}
              >
                {terms.map((term) => (
                  <MenuItem key={term.id} value={term.id}>
                    {term.name} - {term.school_year}
                    {term.is_current && (
                      <Chip
                        label="Current"
                        size="small"
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              variant="contained"
              onClick={loadTermReport}
              disabled={loading || !selectedClass || !selectedTerm}
              startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
              fullWidth
            >
              Load Report
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<Assessment />}
            label="Term Reports"
            iconPosition="start"
          />
          <Tab icon={<Upload />} label="Import Grades" iconPosition="start" />
          <Tab
            icon={<Download />}
            label="Export Reports"
            iconPosition="start"
          />
          <Tab
            icon={<CheckCircle />}
            label="Year-End Status"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Tab 0: Term Reports */}
      <TabPanel value={activeTab} index={0}>
        {termReportData ? (
          <Box>
            {/* Report Header */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Typography variant="h6">
                    {termReportData.class?.name} -{" "}
                    {termReportData.class?.grade_level}
                  </Typography>
                  <Typography color="text.secondary">
                    {termReportData.term?.name} (
                    {termReportData.term?.school_year})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {termReportData.class?.School?.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}
                  >
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={handleExportTermReport}
                    >
                      Export CSV
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Quick Help Banner */}
            <Alert severity="info" sx={{ mb: 2 }} icon={<Visibility />}>
              <Typography variant="body2">
                <strong>Tip:</strong> Click the <strong>View</strong> button in
                the Report column to preview a student's report card, then use
                the Print button to print.
              </Typography>
            </Alert>

            {/* Term Report Table */}
            <TermReportTable
              students={termReportData.students || []}
              subjects={termReportData.subjects || []}
              loading={loading}
              onViewStudent={(student, index) =>
                handleViewStudentReport(student, index)
              }
            />
          </Box>
        ) : (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Assessment sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select a Class and Term
            </Typography>
            <Typography color="text.secondary">
              Choose a class and term from the dropdowns above, then click "Load
              Report" to view the term grades.
            </Typography>
          </Paper>
        )}
      </TabPanel>

      {/* Tab 1: Import Grades */}
      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Import Grades from CSV
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Upload a CSV file to bulk import grades for a class. The file
                  must contain student IDs, subject codes, and grade
                  information.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Upload />}
                  onClick={() => setImportDialogOpen(true)}
                  disabled={!selectedClass || !selectedTerm}
                  fullWidth
                >
                  Upload CSV File
                </Button>
                {(!selectedClass || !selectedTerm) && (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 1, display: "block" }}
                  >
                    Please select a class and term first
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  CSV Format Requirements
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="div"
                >
                  Required columns:
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    <li>
                      <code>student_id</code> - Student ID (e.g., STU2024001)
                    </li>
                    <li>
                      <code>subject_code</code> - Subject code (e.g., MATH)
                    </li>
                    <li>
                      <code>numeric_score</code> - Score 0-100
                    </li>
                    <li>
                      <code>effort_grade</code> - A+ through F
                    </li>
                    <li>
                      <code>behavior_grade</code> - A+ through F
                    </li>
                    <li>
                      <code>comments</code> - Optional teacher comments
                    </li>
                  </ul>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 2: Export Reports */}
      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Export Term Report
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Download the complete term report for the selected class as a
                  CSV file. Includes all student grades, attendance, and
                  year-end status.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  onClick={handleExportTermReport}
                  disabled={loading || !selectedClass || !selectedTerm}
                  fullWidth
                >
                  Download Term Report CSV
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Download Template
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Download a blank CSV template for grade import. Use this as a
                  starting point for entering grades offline.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={async () => {
                    try {
                      const blob = await apiService.downloadCSVTemplate();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "grade-import-template.csv";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      toast.error("Failed to download template");
                    }
                  }}
                  fullWidth
                >
                  Download Import Template
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 3: Year-End Status */}
      <TabPanel value={activeTab} index={3}>
        {termReportData ? (
          <Box>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Typography variant="h6">
                    Year-End Status Management
                  </Typography>
                  <Typography color="text.secondary">
                    Set promotion, stop down, or graduation status for students
                    in {termReportData.class?.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="contained"
                    onClick={() => setYearEndDialogOpen(true)}
                    fullWidth
                  >
                    Manage Year-End Status
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {/* Status Summary */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Card sx={{ bgcolor: "success.light" }}>
                  <CardContent>
                    <Typography variant="h4">
                      {termReportData.students?.filter(
                        (s) => s.year_end_status === "promoted",
                      ).length || 0}
                    </Typography>
                    <Typography>Promoted</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ bgcolor: "error.light" }}>
                  <CardContent>
                    <Typography variant="h4">
                      {termReportData.students?.filter(
                        (s) => s.year_end_status === "stop_down",
                      ).length || 0}
                    </Typography>
                    <Typography>Stop Down</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ bgcolor: "info.light" }}>
                  <CardContent>
                    <Typography variant="h4">
                      {termReportData.students?.filter(
                        (s) => s.year_end_status === "graduated",
                      ).length || 0}
                    </Typography>
                    <Typography>Graduated</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Paper sx={{ p: 2, mt: 3 }}>
              <Typography color="text.secondary">
                {termReportData.students?.filter((s) => !s.year_end_status)
                  .length || 0}{" "}
                students pending status assignment
              </Typography>
            </Paper>
          </Box>
        ) : (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <CheckCircle
              sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Load a Term Report First
            </Typography>
            <Typography color="text.secondary">
              Select a class and term, then click "Load Report" to manage
              year-end status.
            </Typography>
          </Paper>
        )}
      </TabPanel>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        classId={selectedClass}
        termId={selectedTerm}
        onImportComplete={handleImportComplete}
      />

      {/* Student Report Dialog */}
      <Dialog
        open={studentReportDialogOpen}
        onClose={() => setStudentReportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton
                onClick={handlePrevStudent}
                disabled={currentStudentIndex === 0}
                size="small"
              >
                <NavigateBefore />
              </IconButton>
              <Typography variant="h6">
                Report Card ({currentStudentIndex + 1} of{" "}
                {termReportData?.students?.length || 0})
              </Typography>
              <IconButton
                onClick={handleNextStudent}
                disabled={
                  currentStudentIndex >=
                  (termReportData?.students?.length || 1) - 1
                }
                size="small"
              >
                <NavigateNext />
              </IconButton>
            </Box>
            <Box>
              <Button
                startIcon={<Print />}
                onClick={handlePrintStudentReport}
                sx={{ mr: 1 }}
              >
                Print
              </Button>
              <IconButton onClick={() => setStudentReportDialogOpen(false)}>
                <Close />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <StudentReportCard ref={printRef} data={studentReportData} />
        </DialogContent>
      </Dialog>

      {/* Year-End Status Dialog */}
      <YearEndStatusDialog
        open={yearEndDialogOpen}
        onClose={() => setYearEndDialogOpen(false)}
        students={termReportData?.students || []}
        onUpdateComplete={handleYearEndComplete}
        onReleaseGateBlocked={handleYearEndBlocked}
      />

      <Dialog
        open={releaseGateDialogOpen}
        onClose={() => setReleaseGateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Release Gate Blocked</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {releaseGatePayload?.error ||
              "Action is blocked until critical data quality issues are resolved."}
          </Alert>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Blocking reasons
          </Typography>
          {(releaseGatePayload?.release_gate?.reasons || []).length > 0 ? (
            <List dense disablePadding>
              {(releaseGatePayload?.release_gate?.reasons || []).map((reason, index) => (
                <ListItem key={`${reason}-${index}`} disableGutters>
                  <ListItemText primary={reason} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              No detailed reasons were returned.
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Top blockers
          </Typography>
          {(releaseGatePayload?.release_gate?.top_blockers || []).length > 0 ? (
            <List dense disablePadding>
              {(releaseGatePayload?.release_gate?.top_blockers || []).slice(0, 6).map((item) => (
                <ListItem key={item.id} disableGutters>
                  <ListItemText
                    primary={`${item.label} (${item.severity?.toUpperCase?.() || "N/A"})`}
                    secondary={`${item.school_name || "National"} | ${item.issue_count || 0} issue(s)`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary">
              No blocker rows available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReleaseGateDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReportsPage;
