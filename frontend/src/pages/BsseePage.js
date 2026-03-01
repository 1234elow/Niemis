import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Add, Refresh } from "@mui/icons-material";

import { apiService } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";

const STATUS_LABELS = {
  submitted: "Submitted",
  under_review: "Under Review",
  placement_pending: "Placement Pending",
  placed: "Placed",
  appeal_pending: "Appeal Pending",
  completed: "Completed",
  rejected: "Rejected",
};

const STATUS_COLORS = {
  submitted: "default",
  under_review: "info",
  placement_pending: "warning",
  placed: "success",
  appeal_pending: "warning",
  completed: "success",
  rejected: "error",
};

const READINESS_COLORS = {
  healthy: "success",
  watch: "warning",
  critical: "error",
};

const currentYear = new Date().getFullYear();

const initialCreateState = {
  student_id: "",
  exam_year: currentYear,
  exam_candidate_number: "",
  exam_score: "",
  english_score: "",
  math_score: "",
  preferred_school_1_id: "",
  preferred_school_2_id: "",
  preferred_school_3_id: "",
  accommodation_required: false,
  deferral_requested: false,
  citizenship_status: "national",
  notes: "",
};

const toNullableNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString();
};

const formatCount = (value) => Number(value || 0).toLocaleString();

const BsseePage = () => {
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 15,
    search: "",
    status: "",
    exam_year: currentYear,
    school_id: "",
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateState);
  const [updateDialog, setUpdateDialog] = useState({
    open: false,
    application: null,
    status: "",
    placement_school_id: "",
    review_notes: "",
  });

  const {
    data: schoolsData,
    isLoading: schoolsLoading,
  } = useQuery(["bssee-schools"], () => apiService.getSchools({ page: 1, limit: 500 }), {
    staleTime: 60 * 1000,
  });

  const {
    data: studentsData,
    isLoading: studentsLoading,
  } = useQuery(
    ["bssee-students", filters.school_id],
    () =>
      apiService.getStudents({
        page: 1,
        limit: 500,
        is_active: true,
        ...(filters.school_id ? { school_id: filters.school_id } : {}),
      }),
    {
      staleTime: 60 * 1000,
    },
  );

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useQuery(
    ["bssee-overview", filters.exam_year, filters.school_id],
    () =>
      apiService.getBsseeOverview({
        exam_year: filters.exam_year || undefined,
        school_id: filters.school_id || undefined,
      }),
    {
      keepPreviousData: true,
      staleTime: 30 * 1000,
    },
  );

  const {
    data: applicationsData,
    isLoading: applicationsLoading,
    isError: applicationsError,
    error,
    refetch: refetchApplications,
  } = useQuery(
    [
      "bssee-applications",
      filters.page,
      filters.limit,
      filters.search,
      filters.status,
      filters.exam_year,
      filters.school_id,
    ],
    () =>
      apiService.getBsseeApplications({
        page: filters.page,
        limit: filters.limit,
        search: filters.search.trim() || undefined,
        status: filters.status || undefined,
        exam_year: filters.exam_year || undefined,
        school_id: filters.school_id || undefined,
      }),
    {
      keepPreviousData: true,
      staleTime: 10 * 1000,
    },
  );

  const createMutation = useMutation((payload) => apiService.createBsseeApplication(payload), {
    onSuccess: () => {
      setNotification({ type: "success", message: "BSSEE application created successfully." });
      setCreateDialogOpen(false);
      setCreateForm(initialCreateState);
      queryClient.invalidateQueries(["bssee-overview"]);
      queryClient.invalidateQueries(["bssee-applications"]);
    },
    onError: (mutationError) => {
      setNotification({
        type: "error",
        message:
          mutationError?.response?.data?.error ||
          mutationError?.message ||
          "Failed to create BSSEE application.",
      });
    },
  });

  const updateMutation = useMutation(
    ({ applicationId, payload }) => apiService.updateBsseeApplication(applicationId, payload),
    {
      onSuccess: () => {
        setNotification({ type: "success", message: "BSSEE application updated successfully." });
        setUpdateDialog({
          open: false,
          application: null,
          status: "",
          placement_school_id: "",
          review_notes: "",
        });
        queryClient.invalidateQueries(["bssee-overview"]);
        queryClient.invalidateQueries(["bssee-applications"]);
      },
      onError: (mutationError) => {
        setNotification({
          type: "error",
          message:
            mutationError?.response?.data?.error ||
            mutationError?.message ||
            "Failed to update BSSEE application.",
        });
      },
    },
  );

  const schools = schoolsData?.schools || [];
  const students = studentsData?.students || [];
  const secondarySchools = useMemo(
    () =>
      schools.filter((school) => {
        const type = String(school.school_type || school.school_category || "").toLowerCase();
        return type === "secondary";
      }),
    [schools],
  );
  const applications = applicationsData?.applications || [];
  const statuses = applicationsData?.statuses || Object.keys(STATUS_LABELS);
  const pagination = applicationsData?.pagination || {
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: filters.limit,
  };
  const readinessScore = Number(overview?.readiness?.score || 0);
  const readinessStatus = overview?.readiness?.status || "watch";

  const handleRefresh = () => {
    refetchOverview();
    refetchApplications();
  };

  const openUpdateDialog = (application) => {
    setUpdateDialog({
      open: true,
      application,
      status: application.status || "",
      placement_school_id: application.placement_school_id || "",
      review_notes: application.review_notes || "",
    });
  };

  const closeUpdateDialog = () => {
    setUpdateDialog({
      open: false,
      application: null,
      status: "",
      placement_school_id: "",
      review_notes: "",
    });
  };

  const submitCreate = () => {
    if (!createForm.student_id) {
      setNotification({ type: "error", message: "Please select a student." });
      return;
    }

    const payload = {
      ...createForm,
      exam_year: Number(createForm.exam_year),
      exam_score: toNullableNumber(createForm.exam_score),
      english_score: toNullableNumber(createForm.english_score),
      math_score: toNullableNumber(createForm.math_score),
      preferred_school_1_id: createForm.preferred_school_1_id || null,
      preferred_school_2_id: createForm.preferred_school_2_id || null,
      preferred_school_3_id: createForm.preferred_school_3_id || null,
      exam_candidate_number: createForm.exam_candidate_number?.trim() || null,
      notes: createForm.notes?.trim() || null,
    };

    createMutation.mutate(payload);
  };

  const submitUpdate = () => {
    if (!updateDialog.application) return;
    if (updateDialog.status === "placed" && !updateDialog.placement_school_id) {
      setNotification({
        type: "error",
        message: "Placement school is required when status is set to Placed.",
      });
      return;
    }

    const payload = {
      status: updateDialog.status,
      placement_school_id: updateDialog.placement_school_id || null,
      review_notes: updateDialog.review_notes?.trim() || null,
    };

    updateMutation.mutate({
      applicationId: updateDialog.application.id,
      payload,
    });
  };

  if ((overviewLoading || applicationsLoading) && applications.length === 0) {
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
            BSSEE Admissions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage application workflow, school preferences, and placement decisions.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={handleRefresh}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setNotification(null);
              setCreateDialogOpen(true);
            }}
          >
            New Application
          </Button>
        </Stack>
      </Box>

      {notification && (
        <Alert
          severity={notification.type}
          onClose={() => setNotification(null)}
          sx={{ mb: 2 }}
        >
          {notification.message}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Applications
              </Typography>
              <Typography variant="h4">{formatCount(overview?.totals?.applications)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                In Queue
              </Typography>
              <Typography variant="h4">{formatCount(overview?.totals?.queue)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Placed
              </Typography>
              <Typography variant="h4">{formatCount(overview?.totals?.placed)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Readiness
                </Typography>
                <Chip
                  size="small"
                  color={READINESS_COLORS[readinessStatus] || "default"}
                  label={String(readinessStatus).toUpperCase()}
                />
              </Stack>
              <Typography variant="h4" sx={{ mb: 1 }}>
                {readinessScore}%
              </Typography>
              <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, readinessScore))} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search"
              value={filters.search}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  search: event.target.value,
                  page: 1,
                }))
              }
              placeholder="Student name, ID, or candidate #"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Exam Year"
              type="number"
              value={filters.exam_year}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  exam_year: event.target.value,
                  page: 1,
                }))
              }
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.status}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    status: event.target.value,
                    page: 1,
                  }))
                }
              >
                <MenuItem value="">All Statuses</MenuItem>
                {statuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {STATUS_LABELS[status] || status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>School</InputLabel>
              <Select
                label="School"
                value={filters.school_id}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    school_id: event.target.value,
                    page: 1,
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
          </Grid>
        </Grid>
      </Paper>

      {applicationsError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load BSSEE applications. {error?.message || ""}
        </Alert>
      ) : (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Primary School</TableCell>
                <TableCell>Exam Year</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Placement</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary">
                      No applications found for the selected filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {application.student_name || "Unknown student"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {application.student_code || "No ID"}
                      </Typography>
                    </TableCell>
                    <TableCell>{application.primary_school_name || "N/A"}</TableCell>
                    <TableCell>{application.exam_year}</TableCell>
                    <TableCell>
                      {application.exam_score !== null && application.exam_score !== undefined
                        ? Number(application.exam_score).toFixed(1)
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={STATUS_COLORS[application.status] || "default"}
                        label={STATUS_LABELS[application.status] || application.status}
                      />
                    </TableCell>
                    <TableCell>{application.placement_school_name || "Pending"}</TableCell>
                    <TableCell>{formatDate(application.submitted_at)}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openUpdateDialog(application)}>
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {formatCount(pagination.total_count)} total applications
            </Typography>
            <Pagination
              count={pagination.total_pages || 1}
              page={pagination.current_page || 1}
              onChange={(event, nextPage) =>
                setFilters((previous) => ({
                  ...previous,
                  page: nextPage,
                }))
              }
            />
          </Box>
        </Paper>
      )}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create BSSEE Application</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={studentsLoading}>
                <InputLabel>Student</InputLabel>
                <Select
                  label="Student"
                  value={createForm.student_id}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      student_id: event.target.value,
                    }))
                  }
                >
                  {students.map((student) => (
                    <MenuItem key={student.id} value={student.id}>
                      {student.first_name} {student.last_name} ({student.student_id})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Exam Year"
                type="number"
                value={createForm.exam_year}
                onChange={(event) =>
                  setCreateForm((previous) => ({
                    ...previous,
                    exam_year: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Candidate Number"
                value={createForm.exam_candidate_number}
                onChange={(event) =>
                  setCreateForm((previous) => ({
                    ...previous,
                    exam_candidate_number: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Exam Score"
                type="number"
                value={createForm.exam_score}
                onChange={(event) =>
                  setCreateForm((previous) => ({
                    ...previous,
                    exam_score: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="English Score"
                type="number"
                value={createForm.english_score}
                onChange={(event) =>
                  setCreateForm((previous) => ({
                    ...previous,
                    english_score: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Math Score"
                type="number"
                value={createForm.math_score}
                onChange={(event) =>
                  setCreateForm((previous) => ({
                    ...previous,
                    math_score: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth disabled={schoolsLoading}>
                <InputLabel>Preferred School 1</InputLabel>
                <Select
                  label="Preferred School 1"
                  value={createForm.preferred_school_1_id}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      preferred_school_1_id: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {secondarySchools.map((school) => (
                    <MenuItem key={school.id} value={school.id}>
                      {school.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth disabled={schoolsLoading}>
                <InputLabel>Preferred School 2</InputLabel>
                <Select
                  label="Preferred School 2"
                  value={createForm.preferred_school_2_id}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      preferred_school_2_id: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {secondarySchools.map((school) => (
                    <MenuItem key={school.id} value={school.id}>
                      {school.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth disabled={schoolsLoading}>
                <InputLabel>Preferred School 3</InputLabel>
                <Select
                  label="Preferred School 3"
                  value={createForm.preferred_school_3_id}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      preferred_school_3_id: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {secondarySchools.map((school) => (
                    <MenuItem key={school.id} value={school.id}>
                      {school.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Citizenship Status</InputLabel>
                <Select
                  label="Citizenship Status"
                  value={createForm.citizenship_status}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      citizenship_status: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="national">National</MenuItem>
                  <MenuItem value="resident">Resident</MenuItem>
                  <MenuItem value="non_national">Non-national</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Accommodation</InputLabel>
                <Select
                  label="Accommodation"
                  value={createForm.accommodation_required ? "yes" : "no"}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      accommodation_required: event.target.value === "yes",
                    }))
                  }
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Deferral</InputLabel>
                <Select
                  label="Deferral"
                  value={createForm.deferral_requested ? "yes" : "no"}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      deferral_requested: event.target.value === "yes",
                    }))
                  }
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Notes"
                value={createForm.notes}
                onChange={(event) =>
                  setCreateForm((previous) => ({
                    ...previous,
                    notes: event.target.value,
                  }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitCreate}
            disabled={createMutation.isLoading}
          >
            Create Application
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={updateDialog.open} onClose={closeUpdateDialog} fullWidth maxWidth="sm">
        <DialogTitle>Update BSSEE Application</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={updateDialog.status}
                onChange={(event) =>
                  setUpdateDialog((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))
                }
              >
                {statuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {STATUS_LABELS[status] || status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth disabled={schoolsLoading}>
              <InputLabel>Placement School</InputLabel>
              <Select
                label="Placement School"
                value={updateDialog.placement_school_id}
                onChange={(event) =>
                  setUpdateDialog((previous) => ({
                    ...previous,
                    placement_school_id: event.target.value,
                  }))
                }
              >
                <MenuItem value="">None</MenuItem>
                {secondarySchools.map((school) => (
                  <MenuItem key={school.id} value={school.id}>
                    {school.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Review Notes"
              value={updateDialog.review_notes}
              onChange={(event) =>
                setUpdateDialog((previous) => ({
                  ...previous,
                  review_notes: event.target.value,
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUpdateDialog}>Cancel</Button>
          <Button variant="contained" onClick={submitUpdate} disabled={updateMutation.isLoading}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BsseePage;
