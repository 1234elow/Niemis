import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Grid,
  Typography,
  Alert,
  Divider,
  CircularProgress,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { apiService } from "../services/apiService";

const normalizeSchoolTypeForForm = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "nursery") return "pre_primary";
  if (["pre_primary", "primary", "secondary"].includes(normalized)) {
    return normalized;
  }
  return "";
};

const SchoolFormModal = ({
  open,
  onClose,
  onSave,
  school = null,
  mode = "create",
}) => {
  const [formData, setFormData] = useState({
    name: "",
    school_type: "",
    parish: "",
    email: "",
    phone: "",
    capacity: "",
    address: "",
    principal_name: "",
    description: "",
    offers_sixth_form: false,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [parishes, setParishes] = useState([]);

  const schoolTypes = apiService.getSchoolTypes();

  useEffect(() => {
    const fetchParishes = async () => {
      try {
        const parishData = await apiService.getParishes();
        setParishes(parishData);
      } catch (error) {
        console.error("Error loading parishes:", error);
        setParishes([]);
        setSubmitError("Unable to load parish list from database.");
      }
    };

    if (open) {
      fetchParishes();
    }
  }, [open]);

  useEffect(() => {
    if (school && mode === "edit") {
      setFormData({
        name: school.name || "",
        school_type: normalizeSchoolTypeForForm(
          school.school_type || school.school_category,
        ),
        parish: school.parish || "",
        email: school.email || "",
        phone: school.phone || "",
        capacity: school.capacity || "",
        address: school.address || "",
        principal_name: school.principal_name || "",
        description: school.description || "",
        offers_sixth_form: Boolean(school.offers_sixth_form),
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: "",
        school_type: "",
        parish: "",
        email: "",
        phone: "",
        capacity: "",
        address: "",
        principal_name: "",
        description: "",
        offers_sixth_form: false,
      });
    }
    setErrors({});
    setSubmitError("");
  }, [school, mode, open]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "School name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "School name must be at least 2 characters";
    }

    if (!formData.school_type) {
      newErrors.school_type = "School type is required";
    }

    if (!formData.parish) {
      newErrors.parish = "Parish is required";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.phone && !/^[\+]?[0-9\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (
      formData.capacity &&
      (isNaN(formData.capacity) || parseInt(formData.capacity) < 1)
    ) {
      newErrors.capacity = "Capacity must be a positive number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setSubmitError("");

    try {
      // Convert capacity to integer if provided
      const schoolData = {
        ...formData,
        school_type: normalizeSchoolTypeForForm(formData.school_type),
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
      };

      let result;
      if (mode === "create") {
        result = await apiService.createSchool(schoolData);
      } else {
        result = await apiService.updateSchool(school.id, schoolData);
      }

      onSave(result);
      onClose();
    } catch (error) {
      console.error("Error saving school:", error);
      setSubmitError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          `Failed to ${mode} school. Please try again.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6" component="div">
          {mode === "create" ? "Add New School" : "Edit School"}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Basic Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="School Name *"
              value={formData.name}
              onChange={handleChange("name")}
              error={!!errors.name}
              helperText={errors.name}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth error={!!errors.school_type}>
              <InputLabel>School Type *</InputLabel>
              <Select
                value={formData.school_type}
                onChange={handleChange("school_type")}
                label="School Type *"
                disabled={loading}
              >
                {schoolTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.school_type && (
                <FormHelperText>{errors.school_type}</FormHelperText>
              )}
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth error={!!errors.parish}>
              <InputLabel>Parish *</InputLabel>
              <Select
                value={formData.parish}
                onChange={handleChange("parish")}
                label="Parish *"
                disabled={loading}
              >
                {parishes.map((parish) => (
                  <MenuItem key={parish.value} value={parish.value}>
                    {parish.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.parish && (
                <FormHelperText>{errors.parish}</FormHelperText>
              )}
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Principal Name"
              value={formData.principal_name}
              onChange={handleChange("principal_name")}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Contact Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={handleChange("email")}
              error={!!errors.email}
              helperText={errors.email}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={handleChange("phone")}
              error={!!errors.phone}
              helperText={errors.phone}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={3}
              value={formData.address}
              onChange={handleChange("address")}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Additional Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Capacity"
              type="number"
              value={formData.capacity}
              onChange={handleChange("capacity")}
              error={!!errors.capacity}
              helperText={errors.capacity || "Maximum number of students"}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(formData.offers_sixth_form)}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      offers_sixth_form: event.target.checked,
                    }))
                  }
                  disabled={loading}
                />
              }
              label="Offers Lower/Upper Sixth"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={handleChange("description")}
              helperText="Additional information about the school"
              disabled={loading}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {mode === "create" ? "Create School" : "Update School"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SchoolFormModal;
