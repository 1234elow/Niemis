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
import { Add, Search, FilterList, Refresh } from "@mui/icons-material";
import { toast } from "react-hot-toast";

import { apiService } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import SchoolCard from "../components/SchoolCard";
import SchoolForm from "../components/SchoolForm";
import SchoolDetailsModal from "../components/SchoolDetailsModal";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

const SchoolsPage = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
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
  const [editingSchool, setEditingSchool] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingSchool, setDeletingSchool] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    school_type: "",
    parish: "",
    page: 1,
  });

  const schoolTypes = apiService.getSchoolTypes();
  const [parishes, setParishes] = useState([]);

  // Load parishes on component mount
  useEffect(() => {
    const loadParishes = async () => {
      try {
        const parishData = await apiService.getParishes();
        setParishes(parishData);
      } catch (error) {
        console.error("Error loading parishes:", error);
      }
    };
    loadParishes();
  }, []);

  const loadSchools = async (params = {}) => {
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

      const response = await apiService.getSchools(searchParams);
      setSchools(response.schools || []);
      setPagination(response.pagination || pagination);
    } catch (err) {
      console.error("Error loading schools:", err);
      setError("Failed to load schools. Please try again.");
      setSchools([]);
    } finally {
      setLoading(false);
    }
  };

  // Load schools on component mount and when filters change
  useEffect(() => {
    loadSchools();
  }, [filters.page]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value,
      page: 1, // Reset to first page when filtering
    }));
  };

  const handleSearch = () => {
    loadSchools();
  };

  const handleRefresh = () => {
    loadSchools();
  };

  const handlePageChange = (event, page) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleAddSchool = () => {
    setEditingSchool(null);
    setShowForm(true);
  };

  const handleEditSchool = (school) => {
    setEditingSchool(school);
    setShowForm(true);
  };

  const handleDeleteSchool = (school) => {
    setDeletingSchool(school);
    setDeleteError("");
    setShowDeleteDialog(true);
  };

  const handleViewDetails = (school) => {
    setSelectedSchool(school);
    setShowDetailsModal(true);
  };

  const handleDetailsModalClose = () => {
    setShowDetailsModal(false);
    setSelectedSchool(null);
  };

  const handleFormSuccess = (result) => {
    toast.success(
      editingSchool
        ? "School updated successfully!"
        : "School created successfully!",
    );
    loadSchools(); // Refresh the list
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSchool(null);
  };

  const confirmDelete = async () => {
    if (!deletingSchool) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      await apiService.deleteSchool(deletingSchool.id);
      toast.success("School deleted successfully!");
      setShowDeleteDialog(false);
      setDeletingSchool(null);
      loadSchools(); // Refresh the list
    } catch (err) {
      console.error("Error deleting school:", err);
      setDeleteError(
        err.response?.data?.error || err.message || "Failed to delete school",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteDialogClose = () => {
    if (!deleteLoading) {
      setShowDeleteDialog(false);
      setDeletingSchool(null);
      setDeleteError("");
    }
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      school_type: "",
      parish: "",
      page: 1,
    });
    // Reload with cleared filters
    setTimeout(() => loadSchools(), 100);
  };

  const activeFiltersCount = Object.values({
    search: filters.search,
    school_type: filters.school_type,
    parish: filters.parish,
  }).filter(Boolean).length;

  if (loading && schools.length === 0) {
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
            Schools Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {pagination.total_count} schools across Barbados
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
            onClick={handleAddSchool}
          >
            Add New School
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
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              placeholder="Search schools..."
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
              label="School Type"
              value={filters.school_type}
              onChange={handleFilterChange("school_type")}
            >
              <MenuItem value="">All Types</MenuItem>
              {schoolTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              select
              label="Parish"
              value={filters.parish}
              onChange={handleFilterChange("parish")}
            >
              <MenuItem value="">All Parishes</MenuItem>
              {parishes && Array.isArray(parishes) && parishes.map((parish) => (
                <MenuItem key={parish.value} value={parish.value}>
                  {parish.label}
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

      {/* Schools Grid */}
      {!loading && schools.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No schools found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search criteria or add a new school.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {schools.map((school) => (
            <Grid item xs={12} sm={6} lg={4} key={school.id}>
              <SchoolCard
                school={school}
                onEdit={handleEditSchool}
                onDelete={handleDeleteSchool}
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

      {/* School Form Dialog */}
      <SchoolForm
        open={showForm}
        onClose={handleFormClose}
        school={editingSchool}
        onSuccess={handleFormSuccess}
      />

      {/* School Details Modal */}
      <SchoolDetailsModal
        open={showDetailsModal}
        onClose={handleDetailsModalClose}
        school={selectedSchool}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onClose={handleDeleteDialogClose}
        onConfirm={confirmDelete}
        title="Delete School"
        message="Are you sure you want to delete this school? This will deactivate the school and hide it from the system."
        itemName={deletingSchool?.name}
        loading={deleteLoading}
        error={deleteError}
      />
    </Box>
  );
};

export default SchoolsPage;
