import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircle,
  ErrorOutline,
  HourglassBottom,
  Refresh,
  RemoveCircleOutline,
} from "@mui/icons-material";

import { apiService } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";

const statusColorMap = {
  present: "success",
  absent: "error",
  late: "warning",
  excused: "info",
};

const formatStatusLabel = (status) => {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (dateValue) => {
  if (!dateValue) return "N/A";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString();
};

const AttendancePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState([]);
  const [schools, setSchools] = useState([]);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().slice(0, 10),
    school_id: "",
    search: "",
  });

  const loadAttendance = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.school_id) params.school_id = filters.school_id;
      const response = await apiService.getAttendance(params);
      setRecords(response.attendance || []);
    } catch (err) {
      console.error("Error loading attendance:", err);
      setError("Failed to load attendance records from the database.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await apiService.getSchools({ limit: 200 });
        setSchools(response.schools || []);
      } catch (err) {
        console.error("Error loading schools for attendance filters:", err);
      }
    };
    loadSchools();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [filters.date, filters.school_id]);

  const filteredRecords = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return records;

    return records.filter((record) => {
      const fullName =
        `${record.Student?.first_name || ""} ${record.Student?.last_name || ""}`
          .trim()
          .toLowerCase();
      const schoolName = String(record.School?.name || "").toLowerCase();
      const gradeLevel = String(record.Student?.grade_level || "").toLowerCase();
      return (
        fullName.includes(term) ||
        schoolName.includes(term) ||
        gradeLevel.includes(term)
      );
    });
  }, [records, filters.search]);

  const summary = useMemo(() => {
    const totals = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    filteredRecords.forEach((record) => {
      if (totals[record.status] !== undefined) {
        totals[record.status] += 1;
      }
    });

    const total = filteredRecords.length;
    const attendanceRate = total
      ? Math.round(((totals.present + totals.late) / total) * 100)
      : 0;

    return { ...totals, total, attendanceRate };
  }, [filteredRecords]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Attendance Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live attendance records from the database.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadAttendance}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Attendance Date"
              type="date"
              value={filters.date}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, date: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="School"
              value={filters.school_id}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  school_id: event.target.value,
                }))
              }
              disabled={user?.role === "teacher"}
            >
              <MenuItem value="">All Schools</MenuItem>
              {schools.map((school) => (
                <MenuItem key={school.id} value={school.id}>
                  {school.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Search student, school, or grade"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Records
              </Typography>
              <Typography variant="h5">{summary.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Present
              </Typography>
              <Typography variant="h5" color="success.main">
                {summary.present}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Late
              </Typography>
              <Typography variant="h5" color="warning.main">
                {summary.late}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Absent
              </Typography>
              <Typography variant="h5" color="error.main">
                {summary.absent}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Attendance Rate
              </Typography>
              <Typography variant="h5" color="primary.main">
                {summary.attendanceRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Attendance Records
        </Typography>

        {loading ? (
          <Box sx={{ py: 5, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : filteredRecords.length === 0 ? (
          <Alert severity="info">No attendance records found for these filters.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Student</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>School</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Check-in</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>{formatDate(record.attendance_date)}</TableCell>
                    <TableCell>
                      {record.Student?.first_name} {record.Student?.last_name}
                    </TableCell>
                    <TableCell>{record.Student?.grade_level || "N/A"}</TableCell>
                    <TableCell>{record.School?.name || "N/A"}</TableCell>
                    <TableCell>
                      <Chip
                        icon={
                          record.status === "present" ? (
                            <CheckCircle />
                          ) : record.status === "late" ? (
                            <HourglassBottom />
                          ) : record.status === "excused" ? (
                            <RemoveCircleOutline />
                          ) : (
                            <ErrorOutline />
                          )
                        }
                        color={statusColorMap[record.status] || "default"}
                        label={formatStatusLabel(record.status)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {record.check_in_time || record.rfid_entry_time
                        ? new Date(
                            record.rfid_entry_time ||
                              `${record.attendance_date}T${record.check_in_time}`,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default AttendancePage;
