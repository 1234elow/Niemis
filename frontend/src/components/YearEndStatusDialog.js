import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Close,
  ArrowUpward,
  Block,
  School,
  CheckCircle,
  Warning,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";

const STATUS_OPTIONS = [
  {
    value: "promoted",
    label: "Promoted",
    icon: <ArrowUpward />,
    color: "success",
  },
  { value: "stop_down", label: "Stop Down", icon: <Block />, color: "error" },
  { value: "graduated", label: "Graduated", icon: <School />, color: "info" },
];

const YearEndStatusDialog = ({
  open,
  onClose,
  students = [],
  onUpdateComplete,
  onReleaseGateBlocked,
  mode = "bulk", // "bulk" or "single"
  selectedStudent = null,
}) => {
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [individualStatuses, setIndividualStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setSelectedStudents([]);
      setBulkStatus("");
      setBulkNotes("");
      setIndividualStatuses({});
      setError("");
      setResult(null);

      // If single mode with selected student, pre-populate
      if (mode === "single" && selectedStudent) {
        setSelectedStudents([selectedStudent.id]);
        if (selectedStudent.year_end_status) {
          setBulkStatus(selectedStudent.year_end_status);
        }
      }
    }
  }, [open, mode, selectedStudent]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedStudents(students.map((s) => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (studentId) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  };

  const handleIndividualStatusChange = (studentId, status) => {
    setIndividualStatuses((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const handleIndividualNotesChange = (studentId, notes) => {
    setIndividualStatuses((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], notes },
    }));
  };

  const handleApplyBulkStatus = () => {
    if (!bulkStatus) return;

    const newStatuses = {};
    selectedStudents.forEach((id) => {
      newStatuses[id] = { status: bulkStatus, notes: bulkNotes };
    });
    setIndividualStatuses((prev) => ({ ...prev, ...newStatuses }));
  };

  const handleSubmit = async () => {
    const studentsToUpdate = Object.entries(individualStatuses)
      .filter(([id, data]) => data.status)
      .map(([id, data]) => ({
        student_id: id,
        status: data.status,
        notes: data.notes || "",
      }));

    if (studentsToUpdate.length === 0) {
      setError("Please select at least one student and assign a status");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiService.bulkSetYearEndStatus(studentsToUpdate);
      setResult(response);
      onUpdateComplete?.(response);
    } catch (err) {
      const payload = err?.response?.data;
      if (
        err?.response?.status === 409 &&
        payload?.code === "DATA_QUALITY_RELEASE_GATE_BLOCKED"
      ) {
        onReleaseGateBlocked?.(payload);
      }
      setError(
        err.response?.data?.error || err.message || "Failed to update statuses",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const getStatusCount = (status) => {
    return Object.values(individualStatuses).filter((s) => s.status === status)
      .length;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">Set Year-End Status</Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {result ? (
          <Box>
            <Alert
              severity={result.summary.errors === 0 ? "success" : "warning"}
              sx={{ mb: 3 }}
            >
              <Typography variant="subtitle2">
                Update completed: {result.summary.success} students updated
                {result.summary.errors > 0 &&
                  `, ${result.summary.errors} errors`}
              </Typography>
            </Alert>

            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
              <Chip
                icon={<CheckCircle />}
                label={`${result.summary.success} Updated`}
                color="success"
              />
              {result.summary.errors > 0 && (
                <Chip
                  icon={<Warning />}
                  label={`${result.summary.errors} Errors`}
                  color="error"
                />
              )}
            </Box>

            {result.errors?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Errors:
                </Typography>
                {result.errors.map((err, idx) => (
                  <Typography key={idx} variant="body2" color="error">
                    Student {err.student_id}: {err.error}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <>
            {/* Bulk Actions */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Bulk Action
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={bulkStatus}
                    label="Status"
                    onChange={(e) => setBulkStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          {opt.icon}
                          {opt.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Notes (optional)"
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  sx={{ minWidth: 250 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleApplyBulkStatus}
                  disabled={!bulkStatus || selectedStudents.length === 0}
                >
                  Apply to Selected ({selectedStudents.length})
                </Button>
              </Box>
            </Paper>

            {/* Summary Chips */}
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
              {STATUS_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  icon={opt.icon}
                  label={`${opt.label}: ${getStatusCount(opt.value)}`}
                  color={opt.color}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>

            {/* Student Table */}
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ maxHeight: 400 }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedStudents.length === students.length}
                        indeterminate={
                          selectedStudents.length > 0 &&
                          selectedStudents.length < students.length
                        }
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Student ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Grade Level</TableCell>
                    <TableCell>Current Status</TableCell>
                    <TableCell>New Status</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.map((student) => {
                    const isSelected = selectedStudents.includes(student.id);
                    const individualData = individualStatuses[student.id] || {};

                    return (
                      <TableRow key={student.id} selected={isSelected}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectStudent(student.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace" }}
                          >
                            {student.student_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {student.last_name}, {student.first_name}
                        </TableCell>
                        <TableCell>{student.grade_level}</TableCell>
                        <TableCell>
                          {student.year_end_status ? (
                            <Chip
                              label={student.year_end_status.replace("_", " ")}
                              size="small"
                              color={
                                STATUS_OPTIONS.find(
                                  (o) => o.value === student.year_end_status,
                                )?.color || "default"
                              }
                            />
                          ) : (
                            <Chip
                              label="pending"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <ToggleButtonGroup
                            size="small"
                            value={individualData.status || ""}
                            exclusive
                            onChange={(e, value) =>
                              value &&
                              handleIndividualStatusChange(student.id, value)
                            }
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <ToggleButton
                                key={opt.value}
                                value={opt.value}
                                sx={{ px: 1 }}
                              >
                                <Tooltip title={opt.label}>{opt.icon}</Tooltip>
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="Notes..."
                            value={individualData.notes || ""}
                            onChange={(e) =>
                              handleIndividualNotesChange(
                                student.id,
                                e.target.value,
                              )
                            }
                            sx={{ width: 150 }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {students.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary" sx={{ py: 4 }}>
                          No students to display
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || Object.keys(individualStatuses).length === 0}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default YearEndStatusDialog;
