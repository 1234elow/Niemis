import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Grid,
  Button,
  TextField,
  MenuItem,
  InputAdornment,
  Chip,
  Alert,
  Pagination,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from "@mui/material";
import { Add, Search, FilterList, Refresh, Person } from "@mui/icons-material";
import { toast } from "react-hot-toast";

import { apiService } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import TeacherCard from "../components/TeacherCard";
import TeacherForm from "../components/TeacherForm";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

const TeachersPage = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 12,
  });

  // Form and dialog states
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTeacher, setDeletingTeacher] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTeacher, setDetailsTeacher] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    school_id: "",
    position: "",
    department: "",
    employment_type: "",
    status: "",
    page: 1,
  });

  // Schools for dropdown
  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);

  const positions = [
    "Principal",
    "Vice Principal",
    "Dean",
    "Department Head",
    "Teacher",
    "Substitute Teacher",
    "Teaching Assistant",
    "Guidance Counselor",
    "Librarian",
    "Sports Coordinator",
    "Administrative Staff",
    "Support Staff",
  ];

  const departments = [
    "Administration",
    "English Language Arts",
    "Mathematics",
    "Science",
    "Social Studies",
    "Physical Education",
    "Arts & Music",
    "Technology",
    "Languages",
    "Special Education",
    "Library Services",
    "Guidance & Counseling",
  ];

  const employmentTypes = [
    "Full-time Permanent",
    "Full-time Contract",
    "Part-time",
    "Substitute",
    "Temporary",
  ];

  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  // Load schools for filter dropdown
  useEffect(() => {
    const loadSchools = async () => {
      try {
        setSchoolsLoading(true);
        const response = await apiService.getSchools({ limit: 200 });
        setSchools(response.schools || []);
      } catch (err) {
        console.error("Error loading schools:", err);
      } finally {
        setSchoolsLoading(false);
      }
    };
    loadSchools();
  }, []);

  const loadTeachers = async (params = {}) => {
    setLoading(true);
    setError("");

    try {
      const searchParams = {
        page: filters.page,
        limit: pagination.per_page,
        ...filters,
        ...params,
      };

      // Remove empty values
      Object.keys(searchParams).forEach((key) => {
        if (!searchParams[key]) {
          delete searchParams[key];
        }
      });

      const response = await apiService.getTeachers(searchParams);
      setTeachers(response.teachers || []);
      setPagination(response.pagination || pagination);
    } catch (err) {
      console.error("Error loading teachers:", err);
      setError("Failed to load teachers. Please try again.");
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load teachers on component mount and when filters change
  useEffect(() => {
    loadTeachers();
  }, [filters.page]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value,
      page: 1, // Reset to first page when filtering
    }));
  };

  const handleSearch = () => {
    loadTeachers();
  };

  const handleRefresh = () => {
    loadTeachers();
  };

  const handlePageChange = (event, page) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleAddTeacher = () => {
    setEditingTeacher(null);
    setShowForm(true);
  };

  const handleEditTeacher = (teacher) => {
    setEditingTeacher(teacher);
    setShowForm(true);
  };

  const handleDeleteTeacher = (teacher) => {
    setDeletingTeacher(teacher);
    setDeleteError("");
    setShowDeleteDialog(true);
  };

  const handleViewDetails = async (teacher) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsTeacher(teacher);

    try {
      const response = await apiService.getTeacher(teacher.id);
      setDetailsTeacher(response.teacher || teacher);
    } catch (err) {
      console.error("Error loading teacher details:", err);
      toast.error("Could not load full teacher details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleFormSuccess = (result) => {
    toast.success(
      editingTeacher
        ? "Teacher updated successfully!"
        : "Teacher created successfully!",
    );
    loadTeachers(); // Refresh the list
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTeacher(null);
  };

  const confirmDelete = async () => {
    if (!deletingTeacher) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      await apiService.deleteTeacher(deletingTeacher.id);
      toast.success("Teacher deleted successfully!");
      setShowDeleteDialog(false);
      setDeletingTeacher(null);
      loadTeachers(); // Refresh the list
    } catch (err) {
      console.error("Error deleting teacher:", err);
      setDeleteError(
        err.response?.data?.error || err.message || "Failed to delete teacher",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteDialogClose = () => {
    if (!deleteLoading) {
      setShowDeleteDialog(false);
      setDeletingTeacher(null);
      setDeleteError("");
    }
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      school_id: "",
      position: "",
      department: "",
      employment_type: "",
      status: "",
      page: 1,
    });
    // Reload with cleared filters
    setTimeout(() => loadTeachers(), 100);
  };

  const closeDetailsDialog = () => {
    setDetailsOpen(false);
    setDetailsTeacher(null);
    setDetailsLoading(false);
  };

  const activeFiltersCount = Object.values({
    search: filters.search,
    school_id: filters.school_id,
    position: filters.position,
    department: filters.department,
    employment_type: filters.employment_type,
    status: filters.status,
  }).filter(Boolean).length;

  if (loading && teachers.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <Box>
      {/* Header */}
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
          <Typography variant="h4" component="h1" gutterBottom>
            Teachers Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {pagination.total_count} teachers across all schools
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddTeacher}
          >
            Add New Teacher
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 1 }}>
          <FilterList />
          <Typography variant="h6">Filters</Typography>
          {activeFiltersCount > 0 && (
            <Chip
              label={`${activeFiltersCount} active`}
              size="small"
              color="primary"
            />
          )}
        </Box>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              placeholder="Search teachers..."
              value={filters.search}
              onChange={handleFilterChange("search")}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              label="School"
              value={filters.school_id}
              onChange={handleFilterChange("school_id")}
              disabled={schoolsLoading}
            >
              <MenuItem value="">All Schools</MenuItem>
              {schools.map((school) => (
                <MenuItem key={school.id} value={school.id}>
                  {school.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              label="Position"
              value={filters.position}
              onChange={handleFilterChange("position")}
            >
              <MenuItem value="">All Positions</MenuItem>
              {positions.map((position) => (
                <MenuItem key={position} value={position}>
                  {position}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              label="Department"
              value={filters.department}
              onChange={handleFilterChange("department")}
            >
              <MenuItem value="">All Departments</MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept} value={dept}>
                  {dept}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              label="Employment"
              value={filters.employment_type}
              onChange={handleFilterChange("employment_type")}
            >
              <MenuItem value="">All Types</MenuItem>
              {employmentTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={1}>
            <TextField
              fullWidth
              select
              label="Status"
              value={filters.status}
              onChange={handleFilterChange("status")}
            >
              <MenuItem value="">All</MenuItem>
              {statusOptions.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
          <Button variant="contained" onClick={handleSearch} disabled={loading}>
            Search
          </Button>
          {activeFiltersCount > 0 && (
            <Button
              variant="outlined"
              onClick={clearFilters}
              disabled={loading}
            >
              Clear Filters
            </Button>
          )}
        </Box>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading Indicator */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Teachers Grid */}
      {!loading && teachers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Person sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No teachers found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search criteria or add a new teacher.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {teachers.map((teacher) => (
            <Grid item xs={12} sm={6} lg={4} key={teacher.id}>
              <TeacherCard
                teacher={teacher}
                onEdit={handleEditTeacher}
                onDelete={handleDeleteTeacher}
                onViewDetails={handleViewDetails}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Pagination
            count={pagination.total_pages}
            page={pagination.current_page}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Teacher Form Dialog */}
      <TeacherForm
        open={showForm}
        onClose={handleFormClose}
        teacher={editingTeacher}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onClose={handleDeleteDialogClose}
        onConfirm={confirmDelete}
        title="Delete Teacher"
        message="Are you sure you want to delete this teacher? This will deactivate the teacher and hide them from the system."
        itemName={
          deletingTeacher
            ? `${deletingTeacher.first_name} ${deletingTeacher.last_name}`
            : ""
        }
        loading={deleteLoading}
        error={deleteError}
      />

      <Dialog open={detailsOpen} onClose={closeDetailsDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Teacher Details</DialogTitle>
        <DialogContent dividers>
          {detailsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : detailsTeacher ? (
            <Box sx={{ display: "grid", gap: 1.25 }}>
              <Typography variant="h6">
                {detailsTeacher.first_name} {detailsTeacher.last_name}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2">
                <strong>Employee ID:</strong> {detailsTeacher.employee_id || "N/A"}
              </Typography>
              <Typography variant="body2">
                <strong>Position:</strong> {detailsTeacher.position || "N/A"}
              </Typography>
              <Typography variant="body2">
                <strong>Department:</strong> {detailsTeacher.department || "N/A"}
              </Typography>
              <Typography variant="body2">
                <strong>School:</strong> {detailsTeacher.School?.name || "N/A"}
              </Typography>
              <Typography variant="body2">
                <strong>Email:</strong> {detailsTeacher.email || "N/A"}
              </Typography>
              <Typography variant="body2">
                <strong>Phone:</strong> {detailsTeacher.phone || "N/A"}
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong> {detailsTeacher.is_active ? "Active" : "Inactive"}
              </Typography>
            </Box>
          ) : (
            <Typography color="text.secondary">No teacher details available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetailsDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeachersPage;
