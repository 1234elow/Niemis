import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Avatar,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Divider,
  Card,
  CardContent,
} from "@mui/material";
import {
  Close,
  Save,
  Person,
  CheckCircle,
  Cancel,
  Schedule,
  Warning,
  AccessTime,
  EventNote,
  Group,
  Today,
} from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { apiService } from "../services/apiService";

const ATTENDANCE_STATUS = [
  { 
    value: "present", 
    label: "Present", 
    color: "success",
    icon: <CheckCircle />,
    description: "Student was present for the entire class"
  },
  { 
    value: "absent", 
    label: "Absent", 
    color: "error",
    icon: <Cancel />,
    description: "Student was not present"
  },
  { 
    value: "late", 
    label: "Late", 
    color: "warning",
    icon: <AccessTime />,
    description: "Student arrived late to class"
  },
  { 
    value: "excused", 
    label: "Excused", 
    color: "info",
    icon: <EventNote />,
    description: "Student absence was excused (medical, family, etc.)"
  },
];

const AttendanceForm = ({ open, onClose, classData, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceTime, setAttendanceTime] = useState(new Date().toTimeString().slice(0, 5));
  const [attendance, setAttendance] = useState({});
  const [notes, setNotes] = useState("");
  const [bulkAction, setBulkAction] = useState("");
  const [selectedAll, setSelectedAll] = useState(false);

  useEffect(() => {
    if (open && classData) {
      loadStudents();
    } else {
      resetForm();
    }
  }, [open, classData]);

  const loadStudents = async () => {
    try {
      setStudentsLoading(true);
      const response = await apiService.getTeacherStudents(classData.id);
      const studentList = response.students || [];
      
      setStudents(studentList);
      
      // Initialize attendance with all students as present by default
      const initialAttendance = {};
      studentList.forEach(student => {
        initialAttendance[student.id] = {
          status: "present",
          notes: "",
          arrivalTime: "",
        };
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Failed to load students");
    } finally {
      setStudentsLoading(false);
    }
  };

  const resetForm = () => {
    setAttendanceDate(new Date().toISOString().split("T")[0]);
    setAttendanceTime(new Date().toTimeString().slice(0, 5));
    setAttendance({});
    setNotes("");
    setBulkAction("");
    setSelectedAll(false);
    setStudents([]);
  };

  const handleAttendanceChange = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: status,
        arrivalTime: status === "late" ? attendanceTime : "",
      },
    }));
  };

  const handleNotesChange = (studentId, notes) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes: notes,
      },
    }));
  };

  const handleArrivalTimeChange = (studentId, time) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        arrivalTime: time,
      },
    }));
  };

  const handleBulkAction = (status) => {
    if (!status) return;
    
    const updatedAttendance = { ...attendance };
    students.forEach(student => {
      updatedAttendance[student.id] = {
        ...updatedAttendance[student.id],
        status: status,
        arrivalTime: status === "late" ? attendanceTime : "",
      };
    });
    setAttendance(updatedAttendance);
    setBulkAction("");
    toast.success(`Marked all students as ${status}`);
  };

  const getStatusData = (status) => {
    return ATTENDANCE_STATUS.find(s => s.value === status);
  };

  const getAttendanceSummary = () => {
    const summary = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: students.length,
    };

    Object.values(attendance).forEach(record => {
      if (summary.hasOwnProperty(record.status)) {
        summary[record.status]++;
      }
    });

    return summary;
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Prepare attendance data for API
      const attendanceData = students.map(student => {
        const record = attendance[student.id];
        return {
          student_id: student.id,
          status: record.status,
          arrival_time: record.arrivalTime || null,
          notes: record.notes || null,
        };
      });

      const payload = {
        attendance_date: attendanceDate,
        attendance_time: attendanceTime,
        notes: notes.trim() || null,
        attendance_records: attendanceData,
      };

      await apiService.markAttendance(classData.id, payload);
      
      const summary = getAttendanceSummary();
      toast.success(
        `Attendance recorded: ${summary.present} present, ${summary.absent} absent, ${summary.late} late, ${summary.excused} excused`
      );
      
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      console.error("Error marking attendance:", error);
      toast.error("Failed to record attendance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const summary = getAttendanceSummary();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: "80vh" }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h6" component="div">
              Mark Attendance - {classData?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {classData?.grade_level} • Section {classData?.section}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        {studentsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Attendance Setup */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                <Schedule sx={{ mr: 1 }} />
                Attendance Details
              </Typography>
              
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Date"
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Time"
                    type="time"
                    value={attendanceTime}
                    onChange={(e) => setAttendanceTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Bulk Action</InputLabel>
                    <Select
                      value={bulkAction}
                      onChange={(e) => setBulkAction(e.target.value)}
                      label="Bulk Action"
                    >
                      <MenuItem value="">
                        <em>Select action for all students</em>
                      </MenuItem>
                      {ATTENDANCE_STATUS.map((status) => (
                        <MenuItem
                          key={status.value}
                          value={status.value}
                          onClick={() => handleBulkAction(status.value)}
                        >
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            {status.icon}
                            <Typography sx={{ ml: 1 }}>{status.label}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Class Notes (Optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="General notes about today's class..."
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Attendance Summary */}
            <Paper sx={{ p: 2, mb: 3, backgroundColor: "grey.50" }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                <Group sx={{ mr: 1 }} />
                Attendance Summary ({students.length} students)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h6" color="success.main">
                      {summary.present}
                    </Typography>
                    <Typography variant="caption">Present</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h6" color="error.main">
                      {summary.absent}
                    </Typography>
                    <Typography variant="caption">Absent</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h6" color="warning.main">
                      {summary.late}
                    </Typography>
                    <Typography variant="caption">Late</Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h6" color="info.main">
                      {summary.excused}
                    </Typography>
                    <Typography variant="caption">Excused</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Attendance Table */}
            <Paper sx={{ overflow: "hidden" }}>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="center">Arrival Time</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {students.map((student) => {
                      const record = attendance[student.id] || {};
                      const statusData = getStatusData(record.status);
                      
                      return (
                        <TableRow key={student.id}>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                              <Avatar sx={{ mr: 2, bgcolor: "primary.main" }}>
                                {(student.first_name?.[0] || "S").toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {student.first_name} {student.last_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {student.student_id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          
                          <TableCell align="center">
                            <FormControl>
                              <RadioGroup
                                value={record.status || "present"}
                                onChange={(e) => handleAttendanceChange(student.id, e.target.value)}
                                sx={{ 
                                  flexDirection: "row", 
                                  justifyContent: "center",
                                  gap: 1
                                }}
                              >
                                {ATTENDANCE_STATUS.map((status) => (
                                  <Chip
                                    key={status.value}
                                    label={status.label}
                                    color={record.status === status.value ? status.color : "default"}
                                    variant={record.status === status.value ? "filled" : "outlined"}
                                    clickable
                                    onClick={() => handleAttendanceChange(student.id, status.value)}
                                    icon={record.status === status.value ? status.icon : undefined}
                                    size="small"
                                    sx={{ cursor: "pointer" }}
                                  />
                                ))}
                              </RadioGroup>
                            </FormControl>
                          </TableCell>
                          
                          <TableCell align="center">
                            {record.status === "late" ? (
                              <TextField
                                size="small"
                                type="time"
                                value={record.arrivalTime || attendanceTime}
                                onChange={(e) => handleArrivalTimeChange(student.id, e.target.value)}
                                sx={{ width: 120 }}
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                {record.status === "present" ? "On time" : "—"}
                              </Typography>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <TextField
                              size="small"
                              multiline
                              rows={1}
                              value={record.notes || ""}
                              onChange={(e) => handleNotesChange(student.id, e.target.value)}
                              placeholder="Optional notes..."
                              sx={{ minWidth: 200 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Attendance Legend */}
            <Paper sx={{ p: 2, mt: 3, backgroundColor: "grey.50" }}>
              <Typography variant="subtitle2" gutterBottom>
                Status Descriptions:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {ATTENDANCE_STATUS.map((status) => (
                  <Chip
                    key={status.value}
                    icon={status.icon}
                    label={`${status.label}: ${status.description}`}
                    color={status.color}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Paper>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || studentsLoading}
          startIcon={loading ? <CircularProgress size={20} /> : <Save />}
        >
          {loading ? "Recording..." : "Record Attendance"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AttendanceForm;