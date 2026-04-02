import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Refresh, PlayArrow, AutoFixHigh } from "@mui/icons-material";

import { apiService } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";

const STATUS_COLORS = {
  healthy: "success",
  watch: "warning",
  critical: "error",
};

const transferStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
];

const transferPriorityOptions = [
  { value: "", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "normal", label: "Normal" },
];

const formatCount = (value) => Number(value || 0).toLocaleString();

const formatDate = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
};

const deriveAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const OperationsPage = () => {
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState(null);
  const [initiationType, setInitiationType] = useState("student");
  const [transferFilters, setTransferFilters] = useState({
    status: "",
    priority: "",
    student_search: "",
    page: 1,
  });
  const [teacherTransferFilters, setTeacherTransferFilters] = useState({
    status: "",
    priority: "",
    teacher_search: "",
    page: 1,
  });
  const [studentDirectorySearch, setStudentDirectorySearch] = useState("");
  const [teacherDirectorySearch, setTeacherDirectorySearch] = useState("");
  const [studentInputValue, setStudentInputValue] = useState("");
  const [teacherInputValue, setTeacherInputValue] = useState("");
  const [selectedStudentOption, setSelectedStudentOption] = useState(null);
  const [selectedTeacherOption, setSelectedTeacherOption] = useState(null);
  const [studentTransferDraft, setStudentTransferDraft] = useState({
    student_id: "",
    to_school_id: "",
    transfer_reason: "",
    academic_year: deriveAcademicYear(),
    target_grade: "",
    effective_date: "",
    admin_notes: "",
  });
  const [teacherTransferDraft, setTeacherTransferDraft] = useState({
    teacher_id: "",
    to_school_id: "",
    transfer_reason: "",
    effective_date: "",
    admin_notes: "",
  });
  const [playbookPreview, setPlaybookPreview] = useState(null);
  const [rolloverForm, setRolloverForm] = useState({
    school_id: "",
    from_year: "",
    to_year: "",
    options: {
      create_terms: true,
      clone_classes: true,
      promote_students: false,
      deactivate_source_classes: false,
    },
  });
  const [rolloverPreview, setRolloverPreview] = useState(null);

  const {
    data: schoolsData,
    isLoading: schoolsLoading,
  } = useQuery(["operations-schools"], () => apiService.getSchools({ page: 1, limit: 500 }), {
    staleTime: 60 * 1000,
  });

  const {
    data: zonePerformance,
    isLoading: zonesLoading,
    refetch: refetchZones,
  } = useQuery(["operations-zone-performance"], () => apiService.getZonePerformance(), {
    staleTime: 30 * 1000,
  });

  const {
    data: transferWorkflow,
    isLoading: transfersLoading,
    refetch: refetchTransfers,
  } = useQuery(
    [
      "operations-transfer-workflow",
      transferFilters.status,
      transferFilters.priority,
      transferFilters.student_search,
      transferFilters.page,
    ],
    () =>
      apiService.getTransferWorkflow({
        status: transferFilters.status || undefined,
        priority: transferFilters.priority || undefined,
        student_search: transferFilters.student_search || undefined,
        page: transferFilters.page,
        limit: 15,
      }),
    {
      keepPreviousData: true,
      staleTime: 10 * 1000,
    },
  );

  const {
    data: teacherTransferWorkflow,
    isLoading: teacherTransfersLoading,
    refetch: refetchTeacherTransfers,
  } = useQuery(
    [
      "operations-teacher-transfer-workflow",
      teacherTransferFilters.status,
      teacherTransferFilters.priority,
      teacherTransferFilters.teacher_search,
      teacherTransferFilters.page,
    ],
    () =>
      apiService.getTeacherTransferWorkflow({
        status: teacherTransferFilters.status || undefined,
        priority: teacherTransferFilters.priority || undefined,
        teacher_search: teacherTransferFilters.teacher_search || undefined,
        page: teacherTransferFilters.page,
        limit: 15,
      }),
    {
      keepPreviousData: true,
      staleTime: 10 * 1000,
    },
  );

  const { data: studentDirectoryData, isLoading: studentDirectoryLoading } = useQuery(
    ["operations-student-directory", studentDirectorySearch],
    () =>
      apiService.getStudentDirectory({
        search: studentDirectorySearch || undefined,
        limit: 50,
      }),
    {
      keepPreviousData: true,
      staleTime: 20 * 1000,
      enabled: initiationType === "student",
    },
  );

  const { data: staffDirectoryData, isLoading: staffDirectoryLoading } = useQuery(
    ["operations-staff-directory", teacherDirectorySearch],
    () =>
      apiService.getStaffDirectory({
        search: teacherDirectorySearch || undefined,
        limit: 50,
        role_level: "teacher",
      }),
    {
      keepPreviousData: true,
      staleTime: 20 * 1000,
      enabled: initiationType === "teacher",
    },
  );

  const {
    data: playbooksData,
    isLoading: playbooksLoading,
    refetch: refetchPlaybooks,
  } = useQuery(["operations-playbooks"], () => apiService.getDataQualityPlaybooks(), {
    staleTime: 20 * 1000,
  });

  const transferActionMutation = useMutation(
    ({ transferId, payload }) => apiService.updateTransferWorkflow(transferId, payload),
    {
      onSuccess: () => {
        setNotification({ type: "success", message: "Transfer workflow updated." });
        queryClient.invalidateQueries(["operations-transfer-workflow"]);
      },
      onError: (error) => {
        setNotification({
          type: "error",
          message:
            error?.response?.data?.error || error?.message || "Failed to update transfer workflow.",
        });
      },
    },
  );

  const teacherTransferActionMutation = useMutation(
    ({ transferId, payload }) => apiService.updateTeacherTransferWorkflow(transferId, payload),
    {
      onSuccess: () => {
        setNotification({ type: "success", message: "Teacher transfer workflow updated." });
        queryClient.invalidateQueries(["operations-teacher-transfer-workflow"]);
      },
      onError: (error) => {
        setNotification({
          type: "error",
          message:
            error?.response?.data?.error ||
            error?.message ||
            "Failed to update teacher transfer workflow.",
        });
      },
    },
  );

  const initiateStudentTransferMutation = useMutation(
    (payload) => apiService.initiateStudentTransfer(payload),
    {
      onSuccess: (result) => {
        setNotification({
          type: "success",
          message: result?.message || "Student transfer initiated successfully.",
        });
        setStudentTransferDraft({
          student_id: "",
          to_school_id: "",
          transfer_reason: "",
          academic_year: deriveAcademicYear(),
          target_grade: "",
          effective_date: "",
          admin_notes: "",
        });
        queryClient.invalidateQueries(["operations-transfer-workflow"]);
      },
      onError: (error) => {
        setNotification({
          type: "error",
          message:
            error?.response?.data?.error ||
            error?.message ||
            "Failed to initiate student transfer.",
        });
      },
    },
  );

  const initiateTeacherTransferMutation = useMutation(
    (payload) => apiService.initiateTeacherTransfer(payload),
    {
      onSuccess: (result) => {
        setNotification({
          type: "success",
          message: result?.message || "Teacher transfer initiated successfully.",
        });
        setTeacherTransferDraft({
          teacher_id: "",
          to_school_id: "",
          transfer_reason: "",
          effective_date: "",
          admin_notes: "",
        });
        queryClient.invalidateQueries(["operations-teacher-transfer-workflow"]);
      },
      onError: (error) => {
        setNotification({
          type: "error",
          message:
            error?.response?.data?.error ||
            error?.message ||
            "Failed to initiate teacher transfer.",
        });
      },
    },
  );

  const playbookPreviewMutation = useMutation(
    (checkKey) => apiService.getDataQualityPlaybookPreview(checkKey),
    {
      onSuccess: (result) => {
        setPlaybookPreview(result);
      },
      onError: (error) => {
        setNotification({
          type: "error",
          message:
            error?.response?.data?.error || error?.message || "Failed to load playbook preview.",
        });
      },
    },
  );

  const applyPlaybookMutation = useMutation(
    ({ checkKey }) => apiService.applyDataQualityPlaybook(checkKey, {}),
    {
      onSuccess: (result) => {
        setNotification({ type: "success", message: result?.message || "Playbook applied." });
        queryClient.invalidateQueries(["operations-playbooks"]);
        queryClient.invalidateQueries(["operations-zone-performance"]);
      },
      onError: (error) => {
        setNotification({
          type: "error",
          message: error?.response?.data?.error || error?.message || "Failed to apply playbook.",
        });
      },
    },
  );

  const rolloverPreviewMutation = useMutation(
    (params) => apiService.getRolloverPreview(params),
    {
      onSuccess: (result) => {
        setRolloverPreview(result);
      },
      onError: (error) => {
        setNotification({
          type: "error",
          message:
            error?.response?.data?.error || error?.message || "Failed to generate rollover preview.",
        });
      },
    },
  );

  const executeRolloverMutation = useMutation(
    (payload) => apiService.executeRollover(payload),
    {
      onSuccess: (result) => {
        setNotification({
          type: "success",
          message: result?.message || "Academic year rollover executed.",
        });
        queryClient.invalidateQueries(["operations-zone-performance"]);
      },
      onError: (error) => {
        setNotification({
          type: "error",
          message:
            error?.response?.data?.error || error?.message || "Rollover execution failed.",
        });
      },
    },
  );

  const schools = schoolsData?.schools || [];
  const zoneRows = zonePerformance?.zones || [];
  const schoolPoints = zonePerformance?.school_points || [];
  const studentTransfers = transferWorkflow?.transfers || [];
  const studentTransferPagination = transferWorkflow?.pagination || {};
  const teacherTransfers = teacherTransferWorkflow?.transfers || [];
  const teacherTransferPagination = teacherTransferWorkflow?.pagination || {};
  const transfers = studentTransfers;
  const transferPagination = studentTransferPagination;
  const studentDirectory = studentDirectoryData?.students || [];
  const staffDirectory = staffDirectoryData?.staff || [];
  const playbooks = playbooksData?.playbooks || [];
  const selectedStudent =
    studentDirectory.find((row) => row.id === studentTransferDraft.student_id) ||
    (selectedStudentOption?.id === studentTransferDraft.student_id ? selectedStudentOption : null);
  const selectedTeacher =
    staffDirectory.find((row) => row.id === teacherTransferDraft.teacher_id) ||
    (selectedTeacherOption?.id === teacherTransferDraft.teacher_id ? selectedTeacherOption : null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStudentDirectorySearch(studentInputValue.trim());
    }, 180);
    return () => clearTimeout(timer);
  }, [studentInputValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTeacherDirectorySearch(teacherInputValue.trim());
    }, 180);
    return () => clearTimeout(timer);
  }, [teacherInputValue]);

  const highRiskSchools = useMemo(
    () => [...schoolPoints].sort((a, b) => Number(a.performance_score || 0) - Number(b.performance_score || 0)).slice(0, 10),
    [schoolPoints],
  );

  const refreshAll = async () => {
    await Promise.all([
      refetchZones(),
      refetchTransfers(),
      refetchTeacherTransfers(),
      refetchPlaybooks(),
    ]);
  };

  const triggerRolloverPreview = () => {
    rolloverPreviewMutation.mutate({
      school_id: rolloverForm.school_id || undefined,
      from_year: rolloverForm.from_year || undefined,
      to_year: rolloverForm.to_year || undefined,
    });
  };

  const triggerRolloverExecute = () => {
    executeRolloverMutation.mutate({
      school_id: rolloverForm.school_id || undefined,
      from_year: rolloverForm.from_year || undefined,
      to_year: rolloverForm.to_year || undefined,
      options: rolloverForm.options,
    });
  };

  const submitStudentTransfer = () => {
    if (!studentTransferDraft.student_id || !studentTransferDraft.to_school_id) {
      setNotification({
        type: "error",
        message: "Select a student and target school before submitting.",
      });
      return;
    }
    if (!studentTransferDraft.transfer_reason.trim()) {
      setNotification({
        type: "error",
        message: "Transfer reason is required.",
      });
      return;
    }

    initiateStudentTransferMutation.mutate({
      ...studentTransferDraft,
      transfer_reason: studentTransferDraft.transfer_reason.trim(),
      target_grade:
        studentTransferDraft.target_grade ||
        selectedStudent?.current_grade ||
        selectedStudent?.grade_level,
      effective_date: studentTransferDraft.effective_date || undefined,
      admin_notes: studentTransferDraft.admin_notes || undefined,
    });
  };

  const submitTeacherTransfer = () => {
    if (!teacherTransferDraft.teacher_id || !teacherTransferDraft.to_school_id) {
      setNotification({
        type: "error",
        message: "Select a teacher and target school before submitting.",
      });
      return;
    }
    if (!teacherTransferDraft.transfer_reason.trim()) {
      setNotification({
        type: "error",
        message: "Transfer reason is required.",
      });
      return;
    }

    initiateTeacherTransferMutation.mutate({
      ...teacherTransferDraft,
      transfer_reason: teacherTransferDraft.transfer_reason.trim(),
      effective_date: teacherTransferDraft.effective_date || undefined,
      admin_notes: teacherTransferDraft.admin_notes || undefined,
    });
  };

  if (zonesLoading || transfersLoading || teacherTransfersLoading || playbooksLoading || schoolsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Operations Hub
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Zone heatmap, transfer workflow, data-quality playbooks, and year rollover controls.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Refresh />} onClick={refreshAll}>
          Refresh All
        </Button>
      </Box>

      {notification ? (
        <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 2 }}>
          {notification.message}
        </Alert>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {zoneRows.map((zone) => (
          <Grid item xs={12} md={4} key={zone.key}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="h6">{zone.name}</Typography>
                  <Chip
                    size="small"
                    color={STATUS_COLORS[zone.status] || "default"}
                    label={`${Math.round(Number(zone.overall_score || 0))}%`}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {zone.description}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                  <Chip size="small" label={`Schools: ${formatCount(zone.schools_count)}`} />
                  <Chip size="small" label={`Students: ${formatCount(zone.student_count)}`} />
                  <Chip size="small" label={`Attendance: ${Number(zone.attendance_rate || 0).toFixed(1)}%`} />
                  <Chip size="small" label={`Pending transfers: ${formatCount(zone.pending_transfers)}`} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Transfer Intake Desk
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Start student and teacher transfers from one place with guided fields.
            </Typography>
            <Tabs
              value={initiationType}
              onChange={(_, nextValue) => setInitiationType(nextValue)}
              sx={{ mb: 1.5 }}
            >
              <Tab value="student" label="Student Transfer" />
              <Tab value="teacher" label="Teacher Transfer" />
            </Tabs>
            <Divider sx={{ mb: 1.5 }} />

            {initiationType === "student" ? (
              <Stack spacing={1.25}>
                <Autocomplete
                  options={studentDirectory}
                  loading={studentDirectoryLoading}
                  value={selectedStudent}
                  inputValue={studentInputValue}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  onInputChange={(_, value, reason) => {
                    if (reason === "clear") {
                      setStudentInputValue("");
                      return;
                    }
                    if (reason === "input" || reason === "reset") {
                      setStudentInputValue(value || "");
                    }
                  }}
                  onChange={(_, value) => {
                    setSelectedStudentOption(value || null);
                    setStudentTransferDraft((previous) => ({
                      ...previous,
                      student_id: value?.id || "",
                      to_school_id:
                        value?.school_id && previous.to_school_id === value.school_id
                          ? ""
                          : previous.to_school_id,
                      target_grade:
                        value?.current_grade || value?.grade_level || previous.target_grade,
                    }));
                  }}
                  getOptionLabel={(option) =>
                    `${option?.first_name || ""} ${option?.last_name || ""} (${option?.student_id || "No ID"})`
                  }
                  renderInput={(params) => <TextField {...params} label="Select Student" />}
                />
                <FormControl fullWidth>
                  <InputLabel>Target School</InputLabel>
                  <Select
                    value={studentTransferDraft.to_school_id}
                    label="Target School"
                    onChange={(event) =>
                      setStudentTransferDraft((previous) => ({
                        ...previous,
                        to_school_id: event.target.value,
                      }))
                    }
                  >
                    {schools
                      .filter((school) => school.id !== selectedStudent?.school_id)
                      .map((school) => (
                        <MenuItem key={school.id} value={school.id}>
                          {school.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <Grid container spacing={1.25}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Academic Year"
                      value={studentTransferDraft.academic_year}
                      onChange={(event) =>
                        setStudentTransferDraft((previous) => ({
                          ...previous,
                          academic_year: event.target.value,
                        }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Target Grade"
                      value={studentTransferDraft.target_grade}
                      onChange={(event) =>
                        setStudentTransferDraft((previous) => ({
                          ...previous,
                          target_grade: event.target.value,
                        }))
                      }
                    />
                  </Grid>
                </Grid>
                <TextField
                  fullWidth
                  label="Effective Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={studentTransferDraft.effective_date}
                  onChange={(event) =>
                    setStudentTransferDraft((previous) => ({
                      ...previous,
                      effective_date: event.target.value,
                    }))
                  }
                />
                <TextField
                  fullWidth
                  label="Transfer Reason"
                  multiline
                  minRows={2}
                  value={studentTransferDraft.transfer_reason}
                  onChange={(event) =>
                    setStudentTransferDraft((previous) => ({
                      ...previous,
                      transfer_reason: event.target.value,
                    }))
                  }
                />
                <TextField
                  fullWidth
                  label="Admin Notes (Optional)"
                  multiline
                  minRows={2}
                  value={studentTransferDraft.admin_notes}
                  onChange={(event) =>
                    setStudentTransferDraft((previous) => ({
                      ...previous,
                      admin_notes: event.target.value,
                    }))
                  }
                />
                <Button
                  variant="contained"
                  onClick={submitStudentTransfer}
                  disabled={initiateStudentTransferMutation.isLoading}
                >
                  Submit Student Transfer
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.25}>
                <Autocomplete
                  options={staffDirectory}
                  loading={staffDirectoryLoading}
                  value={selectedTeacher}
                  inputValue={teacherInputValue}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  onInputChange={(_, value, reason) => {
                    if (reason === "clear") {
                      setTeacherInputValue("");
                      return;
                    }
                    if (reason === "input" || reason === "reset") {
                      setTeacherInputValue(value || "");
                    }
                  }}
                  onChange={(_, value) => {
                    setSelectedTeacherOption(value || null);
                    setTeacherTransferDraft((previous) => ({
                      ...previous,
                      teacher_id: value?.id || "",
                      to_school_id:
                        value?.school_id && previous.to_school_id === value.school_id
                          ? ""
                          : previous.to_school_id,
                    }));
                  }}
                  getOptionLabel={(option) =>
                    `${option?.first_name || ""} ${option?.last_name || ""} (${option?.employee_id || "No ID"})`
                  }
                  renderInput={(params) => <TextField {...params} label="Select Teacher" />}
                />
                <FormControl fullWidth>
                  <InputLabel>Target School</InputLabel>
                  <Select
                    value={teacherTransferDraft.to_school_id}
                    label="Target School"
                    onChange={(event) =>
                      setTeacherTransferDraft((previous) => ({
                        ...previous,
                        to_school_id: event.target.value,
                      }))
                    }
                  >
                    {schools
                      .filter((school) => school.id !== selectedTeacher?.school_id)
                      .map((school) => (
                        <MenuItem key={school.id} value={school.id}>
                          {school.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Effective Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={teacherTransferDraft.effective_date}
                  onChange={(event) =>
                    setTeacherTransferDraft((previous) => ({
                      ...previous,
                      effective_date: event.target.value,
                    }))
                  }
                />
                <TextField
                  fullWidth
                  label="Transfer Reason"
                  multiline
                  minRows={2}
                  value={teacherTransferDraft.transfer_reason}
                  onChange={(event) =>
                    setTeacherTransferDraft((previous) => ({
                      ...previous,
                      transfer_reason: event.target.value,
                    }))
                  }
                />
                <TextField
                  fullWidth
                  label="Admin Notes (Optional)"
                  multiline
                  minRows={2}
                  value={teacherTransferDraft.admin_notes}
                  onChange={(event) =>
                    setTeacherTransferDraft((previous) => ({
                      ...previous,
                      admin_notes: event.target.value,
                    }))
                  }
                />
                <Button
                  variant="contained"
                  onClick={submitTeacherTransfer}
                  disabled={initiateTeacherTransferMutation.isLoading}
                >
                  Submit Teacher Transfer
                </Button>
              </Stack>
            )}
          </Paper>

          <Paper sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Transfer Workflow 2.0
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={transferFilters.status}
                    onChange={(event) =>
                      setTransferFilters((previous) => ({
                        ...previous,
                        status: event.target.value,
                        page: 1,
                      }))
                    }
                  >
                    {transferStatusOptions.map((option) => (
                      <MenuItem key={option.value || "all"} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    label="Priority"
                    value={transferFilters.priority}
                    onChange={(event) =>
                      setTransferFilters((previous) => ({
                        ...previous,
                        priority: event.target.value,
                        page: 1,
                      }))
                    }
                  >
                    {transferPriorityOptions.map((option) => (
                      <MenuItem key={option.value || "all"} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Student Search"
                  value={transferFilters.student_search}
                  onChange={(event) =>
                    setTransferFilters((previous) => ({
                      ...previous,
                      student_search: event.target.value,
                      page: 1,
                    }))
                  }
                />
              </Grid>
            </Grid>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Route</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>SLA</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No transfers found for current filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {transfer.student_name || "Unknown student"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transfer.student_code || "No student ID"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{transfer.from_school_name || "Unknown"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          to {transfer.to_school_name || "Unknown"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={transfer.status} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {transfer.stage}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            transfer.priority === "critical"
                              ? "error"
                              : transfer.priority === "high"
                                ? "warning"
                                : "default"
                          }
                          label={transfer.priority}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {transfer.sla_due_at ? formatDate(transfer.sla_due_at) : "N/A"}
                        </Typography>
                        {transfer.is_overdue ? (
                          <Chip size="small" color="error" label="Overdue" sx={{ ml: 1 }} />
                        ) : null}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {transfer.status === "pending" ? (
                            <Button
                              size="small"
                              onClick={() =>
                                transferActionMutation.mutate({
                                  transferId: transfer.id,
                                  payload: { action: "approve" },
                                })
                              }
                            >
                              Approve
                            </Button>
                          ) : null}
                          {transfer.status === "approved" ? (
                            <Button
                              size="small"
                              onClick={() =>
                                transferActionMutation.mutate({
                                  transferId: transfer.id,
                                  payload: {
                                    action: "complete",
                                    academic_records_transferred: true,
                                    medical_records_transferred: true,
                                  },
                                })
                              }
                            >
                              Complete
                            </Button>
                          ) : null}
                          {["pending", "approved"].includes(transfer.status) ? (
                            <Button
                              size="small"
                              color="error"
                              onClick={() =>
                                transferActionMutation.mutate({
                                  transferId: transfer.id,
                                  payload: { action: "reject" },
                                })
                              }
                            >
                              Reject
                            </Button>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              {formatCount(transferPagination.total_count)} total transfer workflow records.
            </Typography>
          </Paper>

          <Paper sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Teacher Transfer Workflow
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={teacherTransferFilters.status}
                    onChange={(event) =>
                      setTeacherTransferFilters((previous) => ({
                        ...previous,
                        status: event.target.value,
                        page: 1,
                      }))
                    }
                  >
                    {transferStatusOptions.map((option) => (
                      <MenuItem key={`teacher-status-${option.value || "all"}`} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    label="Priority"
                    value={teacherTransferFilters.priority}
                    onChange={(event) =>
                      setTeacherTransferFilters((previous) => ({
                        ...previous,
                        priority: event.target.value,
                        page: 1,
                      }))
                    }
                  >
                    {transferPriorityOptions.map((option) => (
                      <MenuItem key={`teacher-priority-${option.value || "all"}`} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Teacher Search"
                  value={teacherTransferFilters.teacher_search}
                  onChange={(event) =>
                    setTeacherTransferFilters((previous) => ({
                      ...previous,
                      teacher_search: event.target.value,
                      page: 1,
                    }))
                  }
                />
              </Grid>
            </Grid>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Route</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>SLA</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teacherTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No teacher transfers found for current filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  teacherTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {transfer.teacher_name || "Unknown teacher"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {transfer.teacher_code || "No employee ID"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transfer.teacher_position || "No role recorded"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{transfer.from_school_name || "Unknown"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          to {transfer.to_school_name || "Unknown"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={transfer.status} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {transfer.stage}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            transfer.priority === "critical"
                              ? "error"
                              : transfer.priority === "high"
                                ? "warning"
                                : "default"
                          }
                          label={transfer.priority}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {transfer.sla_due_at ? formatDate(transfer.sla_due_at) : "N/A"}
                        </Typography>
                        {transfer.is_overdue ? (
                          <Chip size="small" color="error" label="Overdue" sx={{ ml: 1 }} />
                        ) : null}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {transfer.status === "pending" ? (
                            <Button
                              size="small"
                              onClick={() =>
                                teacherTransferActionMutation.mutate({
                                  transferId: transfer.id,
                                  payload: { action: "approve" },
                                })
                              }
                            >
                              Approve
                            </Button>
                          ) : null}
                          {transfer.status === "approved" ? (
                            <Button
                              size="small"
                              onClick={() =>
                                teacherTransferActionMutation.mutate({
                                  transferId: transfer.id,
                                  payload: {
                                    action: "mark_handover",
                                    class_handover_completed: true,
                                    documents_verified: true,
                                  },
                                })
                              }
                            >
                              Mark Handover
                            </Button>
                          ) : null}
                          {transfer.status === "approved" ? (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() =>
                                teacherTransferActionMutation.mutate({
                                  transferId: transfer.id,
                                  payload: {
                                    action: "complete",
                                    class_handover_completed: true,
                                    documents_verified: true,
                                  },
                                })
                              }
                            >
                              Complete
                            </Button>
                          ) : null}
                          {["pending", "approved"].includes(transfer.status) ? (
                            <Button
                              size="small"
                              color="error"
                              onClick={() =>
                                teacherTransferActionMutation.mutate({
                                  transferId: transfer.id,
                                  payload: { action: "reject" },
                                })
                              }
                            >
                              Reject
                            </Button>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              {formatCount(teacherTransferPagination.total_count)} total teacher transfer records.
            </Typography>
          </Paper>

          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Data Quality Auto-Remediation Playbooks
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Playbook</TableCell>
                  <TableCell>Impact</TableCell>
                  <TableCell>Open Issues</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {playbooks.map((playbook) => (
                  <TableRow key={playbook.key}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {playbook.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {playbook.summary}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={`${playbook.estimated_minutes} min`} />
                    </TableCell>
                    <TableCell>{formatCount(playbook.open_issue_count)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          onClick={() => playbookPreviewMutation.mutate(playbook.key)}
                        >
                          Preview
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<AutoFixHigh fontSize="small" />}
                          onClick={() => applyPlaybookMutation.mutate({ checkKey: playbook.key })}
                          disabled={playbook.open_issue_count === 0}
                        >
                          Apply
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {playbookPreview ? (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {playbookPreview?.playbook?.title}
                </Typography>
                <Typography variant="caption">
                  Estimated impact: {formatCount(playbookPreview?.estimate?.issue_count)} records across{" "}
                  {formatCount(playbookPreview?.estimate?.schools_affected)} schools.
                </Typography>
              </Alert>
            ) : null}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              School Performance Heatmap
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>School</TableCell>
                  <TableCell>Zone</TableCell>
                  <TableCell>Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {highRiskSchools.map((school) => (
                  <TableRow key={school.school_id}>
                    <TableCell>{school.school_name}</TableCell>
                    <TableCell>{school.zone_name || "Unmapped"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={STATUS_COLORS[school.status] || "default"}
                        label={`${Math.round(Number(school.performance_score || 0))}%`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Academic Year Rollover Wizard
            </Typography>
            <Stack spacing={1.25}>
              <FormControl fullWidth>
                <InputLabel>School Scope</InputLabel>
                <Select
                  label="School Scope"
                  value={rolloverForm.school_id}
                  onChange={(event) =>
                    setRolloverForm((previous) => ({
                      ...previous,
                      school_id: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="">All Schools</MenuItem>
                  {schools.map((school) => (
                    <MenuItem key={school.id} value={school.id}>
                      {school.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="From Year (YYYY-YYYY)"
                value={rolloverForm.from_year}
                onChange={(event) =>
                  setRolloverForm((previous) => ({
                    ...previous,
                    from_year: event.target.value,
                  }))
                }
              />
              <TextField
                label="To Year (YYYY-YYYY)"
                value={rolloverForm.to_year}
                onChange={(event) =>
                  setRolloverForm((previous) => ({
                    ...previous,
                    to_year: event.target.value,
                  }))
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={rolloverForm.options.create_terms}
                    onChange={(event) =>
                      setRolloverForm((previous) => ({
                        ...previous,
                        options: {
                          ...previous.options,
                          create_terms: event.target.checked,
                        },
                      }))
                    }
                  />
                }
                label="Create target-year terms"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={rolloverForm.options.clone_classes}
                    onChange={(event) =>
                      setRolloverForm((previous) => ({
                        ...previous,
                        options: {
                          ...previous.options,
                          clone_classes: event.target.checked,
                        },
                      }))
                    }
                  />
                }
                label="Clone class structure"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={rolloverForm.options.promote_students}
                    onChange={(event) =>
                      setRolloverForm((previous) => ({
                        ...previous,
                        options: {
                          ...previous.options,
                          promote_students: event.target.checked,
                        },
                      }))
                    }
                  />
                }
                label="Promote/retain students from year-end status"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={rolloverForm.options.deactivate_source_classes}
                    onChange={(event) =>
                      setRolloverForm((previous) => ({
                        ...previous,
                        options: {
                          ...previous.options,
                          deactivate_source_classes: event.target.checked,
                        },
                      }))
                    }
                  />
                }
                label="Deactivate source-year classes"
              />

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  onClick={triggerRolloverPreview}
                  disabled={rolloverPreviewMutation.isLoading}
                >
                  Preview
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={triggerRolloverExecute}
                  disabled={executeRolloverMutation.isLoading}
                >
                  Execute
                </Button>
              </Stack>
            </Stack>

            {rolloverPreview ? (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Preview {rolloverPreview.from_year} to {rolloverPreview.to_year}
                </Typography>
                <Typography variant="caption" sx={{ display: "block" }}>
                  Source classes: {formatCount(rolloverPreview?.summary?.source_classes)} | Target classes:{" "}
                  {formatCount(rolloverPreview?.summary?.target_classes)}
                </Typography>
                <Typography variant="caption" sx={{ display: "block" }}>
                  Promote candidates: {formatCount(rolloverPreview?.summary?.promote_candidates)} | Pending transfers:{" "}
                  {formatCount(rolloverPreview?.summary?.pending_transfers)}
                </Typography>
                {(rolloverPreview?.warnings || []).slice(0, 3).map((warning, index) => (
                  <Typography key={`warn-${index}`} variant="caption" sx={{ display: "block" }}>
                    - {warning}
                  </Typography>
                ))}
              </Alert>
            ) : null}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OperationsPage;
