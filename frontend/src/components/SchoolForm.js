import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { apiService } from "../services/apiService";

const SchoolForm = ({ open, onClose, school, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    school_type: "",
    parish: "",
    email: "",
    phone: "",
    address: "",
    principal_name: "",
    capacity: "",
    description: "",
    offers_sixth_form: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [parishes, setParishes] = useState([]);

  const schoolTypes = apiService.getSchoolTypes();

  // Fetch parishes when component mounts
  useEffect(() => {
    const fetchParishes = async () => {
      try {
        const parishesData = await apiService.getParishes();
        setParishes(parishesData);
      } catch (error) {
        console.error("Error fetching parishes:", error);
        // Set fallback parishes if API fails
        setParishes([
          { value: "St. Michael", label: "St. Michael" },
          { value: "Christ Church", label: "Christ Church" },
          { value: "St. Philip", label: "St. Philip" },
          { value: "St. James", label: "St. James" },
          { value: "St. John", label: "St. John" },
          { value: "St. Andrew", label: "St. Andrew" },
          { value: "St. George", label: "St. George" },
          { value: "St. Peter", label: "St. Peter" },
          { value: "St. Lucy", label: "St. Lucy" },
          { value: "St. Joseph", label: "St. Joseph" },
          { value: "St. Thomas", label: "St. Thomas" },
        ]);
      }
    };
    fetchParishes();
  }, []);

  // Reset form when dialog opens/closes or school changes
  useEffect(() => {
    if (open) {
      if (school) {
        // Edit mode - populate with existing data
        setFormData({
          name: school.name || "",
          school_type: school.school_category || school.school_type || "",
          parish: school.parish || "",
          email: school.email || "",
          phone: school.phone || "",
          address: school.address || "",
          principal_name: school.principal_name || "",
          capacity: school.capacity || "",
          description: school.description || "",
          offers_sixth_form: Boolean(school.offers_sixth_form),
        });
      } else {
        // Create mode - reset to empty
        setFormData({
          name: "",
          school_type: "",
          parish: "",
          email: "",
          phone: "",
          address: "",
          principal_name: "",
          capacity: "",
          description: "",
          offers_sixth_form: false,
        });
      }
      setError("");
      setFieldErrors({});
    }
  }, [open, school]);

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "School name is required";
    } else if (formData.name.length < 2) {
      errors.name = "School name must be at least 2 characters";
    }

    if (!formData.school_type) {
      errors.school_type = "School type is required";
    }

    if (!formData.parish) {
      errors.parish = "Parish is required";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (formData.phone && !/^[\+]?[0-9\s\-\(\)]+$/.test(formData.phone)) {
      errors.phone = "Please enter a valid phone number";
    }

    if (
      formData.capacity &&
      (isNaN(formData.capacity) || formData.capacity < 1)
    ) {
      errors.capacity = "Capacity must be a positive number";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const submitData = {
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
      };

      let result;
      if (school) {
        // Edit mode
        result = await apiService.updateSchool(school.id, submitData);
      } else {
        // Create mode
        result = await apiService.createSchool(submitData);
      }

      onSuccess(result);
      onClose();
    } catch (err) {
      console.error("Error saving school:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          `Failed to ${school ? "update" : "create"} school`,
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
      <form onSubmit={handleSubmit}>
        <DialogTitle>{school ? "Edit School" : "Add New School"}</DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="School Name"
                value={formData.name}
                onChange={handleChange("name")}
                error={!!fieldErrors.name}
                helperText={fieldErrors.name}
                required
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="School Type"
                value={formData.school_type}
                onChange={handleChange("school_type")}
                error={!!fieldErrors.school_type}
                helperText={fieldErrors.school_type}
                required
                disabled={loading}
              >
                {schoolTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Parish"
                value={formData.parish}
                onChange={handleChange("parish")}
                error={!!fieldErrors.parish}
                helperText={fieldErrors.parish}
                required
                disabled={loading}
              >
                {parishes && Array.isArray(parishes) && parishes.map((parish) => (
                  <MenuItem key={parish.value} value={parish.value}>
                    {parish.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Principal Name"
                value={formData.principal_name}
                onChange={handleChange("principal_name")}
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange("email")}
                error={!!fieldErrors.email}
                helperText={fieldErrors.email}
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={handleChange("phone")}
                error={!!fieldErrors.phone}
                helperText={fieldErrors.phone}
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Capacity"
                type="number"
                value={formData.capacity}
                onChange={handleChange("capacity")}
                error={!!fieldErrors.capacity}
                helperText={fieldErrors.capacity}
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
                label="Address"
                multiline
                rows={2}
                value={formData.address}
                onChange={handleChange("address")}
                disabled={loading}
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
                disabled={loading}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? "Saving..." : school ? "Update School" : "Create School"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default SchoolForm;
