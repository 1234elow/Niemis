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
} from "@mui/material";
import { Add, Search, FilterList, Refresh, Person } from "@mui/icons-material";
import { toast } from "react-hot-toast";

import { apiService } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import StudentCard from "../components/StudentCard";
import StudentForm from "../components/StudentForm";
import StudentDetailsModal from "../components/StudentDetailsModal";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

const StudentsPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
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
  const [editingStudent, setEditingStudent] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    school_id: "",
    grade_level: "",
    status: "",
    page: 1,
  });

  // Schools for dropdown
  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);

  const gradeLevels = apiService.getGradeLevels();
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

  const loadStudents = async (params = {}) => {
    setLoading(true);
    setError("");

    try {
      const searchParams = {
        page: filters.page,
        limit: pagination.per_page,
        ...filters,
        ...params,
      };

      if (searchParams.status === "active") {
        searchParams.is_active = true;
      } else if (searchParams.status === "inactive") {
        searchParams.is_active = false;
      }
      delete searchParams.status;

      // Remove empty values
      Object.keys(searchParams).forEach((key) => {
        if (
          searchParams[key] === "" ||
          searchParams[key] === null ||
          searchParams[key] === undefined
        ) {
          delete searchParams[key];
        }
      });

      const response = await apiService.getStudents(searchParams);
      setStudents(response.students || []);
      setPagination(response.pagination || pagination);
    } catch (err) {
      console.error("Error loading students:", err);
      setError("Failed to load students. Please try again.");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // Load students on component mount and when filters change
  useEffect(() => {
    loadStudents();
  }, [filters.page]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value,
      page: 1, // Reset to first page when filtering
    }));
  };

  const handleSearch = () => {
    loadStudents();
  };

  const handleRefresh = () => {
    loadStudents();
  };

  const handlePageChange = (event, page) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleAddStudent = () => {
    setEditingStudent(null);
    setShowForm(true);
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setShowForm(true);
  };

  const handleDeleteStudent = (student) => {
    setDeletingStudent(student);
    setDeleteError("");
    setShowDeleteDialog(true);
  };

  const handleViewDetails = (student) => {
    setSelectedStudent(student);
    setShowDetailsModal(true);
  };

  const handleDetailsModalClose = () => {
    setShowDetailsModal(false);
    setSelectedStudent(null);
  };

  const handleFormSuccess = (result) => {
    toast.success(
      editingStudent
        ? "Student updated successfully!"
        : "Student created successfully!",
    );
    loadStudents(); // Refresh the list
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingStudent(null);
  };

  const confirmDelete = async () => {
    if (!deletingStudent) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      await apiService.deleteStudent(deletingStudent.id);
      toast.success("Student deleted successfully!");
      setShowDeleteDialog(false);
      setDeletingStudent(null);
      loadStudents(); // Refresh the list
    } catch (err) {
      console.error("Error deleting student:", err);
      setDeleteError(
        err.response?.data?.error || err.message || "Failed to delete student",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteDialogClose = () => {
    if (!deleteLoading) {
      setShowDeleteDialog(false);
      setDeletingStudent(null);
      setDeleteError("");
    }
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      school_id: "",
      grade_level: "",
      status: "",
      page: 1,
    });
    // Reload with cleared filters
    setTimeout(() => loadStudents(), 100);
  };

  const activeFiltersCount = Object.values({
    search: filters.search,
    school_id: filters.school_id,
    grade_level: filters.grade_level,
    status: filters.status,
  }).filter(Boolean).length;

  if (loading && students.length === 0) {
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
            Students Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {pagination.total_count} students across all schools
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
            onClick={handleAddStudent}
          >
            Add New Student
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
              placeholder="Search students..."
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

          <Grid item xs={12} sm={6} md={3}>
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
              label="Grade Level"
              value={filters.grade_level}
              onChange={handleFilterChange("grade_level")}
            >
              <MenuItem value="">All Grades</MenuItem>
              {gradeLevels.map((grade) => (
                <MenuItem key={grade.value} value={grade.value}>
                  {grade.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              label="Status"
              value={filters.status}
              onChange={handleFilterChange("status")}
            >
              <MenuItem value="">All Status</MenuItem>
              {statusOptions.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={loading}
                fullWidth
              >
                Search
              </Button>
              {activeFiltersCount > 0 && (
                <Button
                  variant="outlined"
                  onClick={clearFilters}
                  disabled={loading}
                >
                  Clear
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>
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

      {/* Students Grid */}
      {!loading && students.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Person sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No students found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search criteria or add a new student.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {students.map((student) => (
            <Grid item xs={12} sm={6} lg={4} key={student.id}>
              <StudentCard
                student={student}
                onEdit={handleEditStudent}
                onDelete={handleDeleteStudent}
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

      {/* Student Form Dialog */}
      <StudentForm
        open={showForm}
        onClose={handleFormClose}
        student={editingStudent}
        onSuccess={handleFormSuccess}
      />

      {/* Student Details Modal */}
      <StudentDetailsModal
        open={showDetailsModal}
        onClose={handleDetailsModalClose}
        student={selectedStudent}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onClose={handleDeleteDialogClose}
        onConfirm={confirmDelete}
        title="Delete Student"
        message="Are you sure you want to delete this student? This will deactivate the student and hide them from the system."
        itemName={
          deletingStudent
            ? `${deletingStudent.first_name} ${deletingStudent.last_name}`
            : ""
        }
        loading={deleteLoading}
        error={deleteError}
      />
    </Box>
  );
};

export default StudentsPage;
