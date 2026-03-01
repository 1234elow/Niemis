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
  Box,
  CircularProgress,
  Alert,
  Typography,
  FormControlLabel,
  Checkbox,
  Chip,
} from "@mui/material";
import { Person, School, Badge, Work } from "@mui/icons-material";
import { apiService } from "../services/apiService";

const TeacherForm = ({ open, onClose, teacher, onSuccess }) => {
  const [formData, setFormData] = useState({
    // Basic Information
    first_name: "",
    last_name: "",
    employee_id: "",
    date_of_birth: "",
    gender: "",
    national_id: "",

    // Professional Information
    school_id: "",
    position: "",
    department: "",
    hire_date: "",
    employment_type: "",
    qualification_level: "",
    years_experience: "",

    // Contact Information
    phone: "",
    email: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",

    // Professional Details
    subjects_taught: "",
    certifications: "",
    professional_development: "",
    performance_rating: "",
  });

  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const genders = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ];

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

  const qualificationLevels = [
    "Certificate",
    "Diploma",
    "Bachelor's Degree",
    "Master's Degree",
    "Doctorate",
    "Professional Certification",
  ];

  const performanceRatings = [
    "Excellent",
    "Good",
    "Satisfactory",
    "Needs Improvement",
    "Unsatisfactory",
  ];

  // Load schools when component mounts
  useEffect(() => {
    if (open) {
      loadSchools();
    }
  }, [open]);

  // Reset form when dialog opens/closes or teacher changes
  useEffect(() => {
    if (open) {
      if (teacher) {
        // Edit mode - populate with existing data
        setFormData({
          first_name: teacher.first_name || "",
          last_name: teacher.last_name || "",
          employee_id: teacher.employee_id || "",
          date_of_birth: teacher.date_of_birth || "",
          gender: teacher.gender || "",
          national_id: teacher.national_id || "",
          school_id: teacher.school_id || "",
          position: teacher.position || "",
          department: teacher.department || "",
          hire_date: teacher.hire_date || "",
          employment_type: teacher.employment_type || "",
          qualification_level: teacher.qualification_level || "",
          years_experience: teacher.years_experience || "",
          phone: teacher.phone || "",
          email: teacher.email || "",
          address: teacher.address || "",
          emergency_contact_name: teacher.emergency_contact_name || "",
          emergency_contact_phone: teacher.emergency_contact_phone || "",
          subjects_taught: teacher.subjects_taught || "",
          certifications: teacher.certifications || "",
          professional_development: teacher.professional_development || "",
          performance_rating: teacher.performance_rating || "",
        });
      } else {
        // Create mode - reset to empty with defaults
        const today = new Date().toISOString().split("T")[0];
        setFormData({
          first_name: "",
          last_name: "",
          employee_id: "",
          date_of_birth: "",
          gender: "",
          national_id: "",
          school_id: "",
          position: "",
          department: "",
          hire_date: today,
          employment_type: "",
          qualification_level: "",
          years_experience: "",
          phone: "",
          email: "",
          address: "",
          emergency_contact_name: "",
          emergency_contact_phone: "",
          subjects_taught: "",
          certifications: "",
          professional_development: "",
          performance_rating: "",
        });
      }
      setError("");
      setFieldErrors({});
    }
  }, [open, teacher]);

  const loadSchools = async () => {
    setLoadingSchools(true);
    try {
      const response = await apiService.getSchools({ limit: 200 });
      setSchools(response.schools || []);
    } catch (err) {
      console.error("Error loading schools:", err);
      setError("Failed to load schools list");
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleChange = (field) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const calculateYearsOfService = (hireDate) => {
    if (!hireDate) return "";
    const today = new Date();
    const hire = new Date(hireDate);
    let years = today.getFullYear() - hire.getFullYear();
    const monthDiff = today.getMonth() - hire.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < hire.getDate())
    ) {
      years--;
    }
    return years;
  };

  const validateForm = () => {
    const errors = {};

    // Required fields
    if (!formData.first_name.trim()) {
      errors.first_name = "First name is required";
    }
    if (!formData.last_name.trim()) {
      errors.last_name = "Last name is required";
    }
    if (!formData.employee_id.trim()) {
      errors.employee_id = "Employee ID is required";
    }
    if (!formData.date_of_birth) {
      errors.date_of_birth = "Date of birth is required";
    } else {
      const age = calculateAge(formData.date_of_birth);
      if (age < 18 || age > 80) {
        errors.date_of_birth = "Age must be between 18 and 80 years";
      }
    }
    if (!formData.gender) {
      errors.gender = "Gender is required";
    }
    if (!formData.school_id) {
      errors.school_id = "School selection is required";
    }
    if (!formData.position) {
      errors.position = "Position is required";
    }
    if (!formData.employment_type) {
      errors.employment_type = "Employment type is required";
    }

    // Optional but validated fields
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    if (formData.phone && !/^[\+]?[0-9\s\-\(\)]+$/.test(formData.phone)) {
      errors.phone = "Please enter a valid phone number";
    }
    if (
      formData.emergency_contact_phone &&
      !/^[\+]?[0-9\s\-\(\)]+$/.test(formData.emergency_contact_phone)
    ) {
      errors.emergency_contact_phone =
        "Please enter a valid emergency contact phone";
    }
    if (
      formData.years_experience &&
      (isNaN(formData.years_experience) ||
        formData.years_experience < 0 ||
        formData.years_experience > 60)
    ) {
      errors.years_experience = "Years of experience must be between 0 and 60";
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
        is_active: true, // All new/edited teachers are active by default
      };

      let result;
      if (teacher) {
        // Edit mode
        result = await apiService.updateTeacher(teacher.id, submitData);
      } else {
        // Create mode
        result = await apiService.createTeacher(submitData);
      }

      onSuccess(result);
      onClose();
    } catch (err) {
      console.error("Error saving teacher:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          `Failed to ${teacher ? "update" : "create"} teacher`,
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

  const selectedSchool = schools.find(
    (school) => school.id === formData.school_id,
  );
  const teacherAge = calculateAge(formData.date_of_birth);
  const yearsOfService = calculateYearsOfService(formData.hire_date);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Person />
          {teacher ? "Edit Teacher" : "Add New Teacher"}
          {teacherAge && (
            <Chip
              label={`Age: ${teacherAge}`}
              size="small"
              color="info"
              sx={{ ml: 1 }}
            />
          )}
          {yearsOfService !== "" && (
            <Chip
              label={`Service: ${yearsOfService} years`}
              size="small"
              color="success"
              sx={{ ml: 1 }}
            />
          )}
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Basic Information */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h6"
              sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Person /> Basic Information
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={formData.first_name}
                  onChange={handleChange("first_name")}
                  error={!!fieldErrors.first_name}
                  helperText={fieldErrors.first_name}
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={formData.last_name}
                  onChange={handleChange("last_name")}
                  error={!!fieldErrors.last_name}
                  helperText={fieldErrors.last_name}
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Employee ID"
                  value={formData.employee_id}
                  onChange={handleChange("employee_id")}
                  error={!!fieldErrors.employee_id}
                  helperText={
                    fieldErrors.employee_id ||
                    "Unique identifier for the teacher"
                  }
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="National ID"
                  value={formData.national_id}
                  onChange={handleChange("national_id")}
                  helperText="National identification number"
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={handleChange("date_of_birth")}
                  error={!!fieldErrors.date_of_birth}
                  helperText={fieldErrors.date_of_birth}
                  required
                  disabled={loading}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Gender"
                  value={formData.gender}
                  onChange={handleChange("gender")}
                  error={!!fieldErrors.gender}
                  helperText={fieldErrors.gender}
                  required
                  disabled={loading}
                >
                  {genders.map((gender) => (
                    <MenuItem key={gender.value} value={gender.value}>
                      {gender.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Box>

          {/* Professional Information */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h6"
              sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Work /> Professional Information
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="School"
                  value={formData.school_id}
                  onChange={handleChange("school_id")}
                  error={!!fieldErrors.school_id}
                  helperText={fieldErrors.school_id}
                  required
                  disabled={loading || loadingSchools}
                >
                  {schools.map((school) => (
                    <MenuItem key={school.id} value={school.id}>
                      {school.name} ({school.school_category})
                    </MenuItem>
                  ))}
                </TextField>
                {loadingSchools && (
                  <CircularProgress size={20} sx={{ mt: 1 }} />
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Position"
                  value={formData.position}
                  onChange={handleChange("position")}
                  error={!!fieldErrors.position}
                  helperText={fieldErrors.position}
                  required
                  disabled={loading}
                >
                  {positions.map((position) => (
                    <MenuItem key={position} value={position}>
                      {position}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Department"
                  value={formData.department}
                  onChange={handleChange("department")}
                  disabled={loading}
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept} value={dept}>
                      {dept}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Employment Type"
                  value={formData.employment_type}
                  onChange={handleChange("employment_type")}
                  error={!!fieldErrors.employment_type}
                  helperText={fieldErrors.employment_type}
                  required
                  disabled={loading}
                >
                  {employmentTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Hire Date"
                  type="date"
                  value={formData.hire_date}
                  onChange={handleChange("hire_date")}
                  disabled={loading}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Qualification Level"
                  value={formData.qualification_level}
                  onChange={handleChange("qualification_level")}
                  disabled={loading}
                >
                  {qualificationLevels.map((qual) => (
                    <MenuItem key={qual} value={qual}>
                      {qual}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Years of Experience"
                  type="number"
                  value={formData.years_experience}
                  onChange={handleChange("years_experience")}
                  error={!!fieldErrors.years_experience}
                  helperText={
                    fieldErrors.years_experience ||
                    "Total years of teaching experience"
                  }
                  disabled={loading}
                  inputProps={{ min: 0, max: 60 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Performance Rating"
                  value={formData.performance_rating}
                  onChange={handleChange("performance_rating")}
                  disabled={loading}
                >
                  {performanceRatings.map((rating) => (
                    <MenuItem key={rating} value={rating}>
                      {rating}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            {selectedSchool && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: "grey.100",
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Selected School: <strong>{selectedSchool.name}</strong> -{" "}
                  {selectedSchool.parish?.replace(/_/g, " ")}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Contact Information */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Contact Information
            </Typography>

            <Grid container spacing={2}>
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
                  label="Emergency Contact Name"
                  value={formData.emergency_contact_name}
                  onChange={handleChange("emergency_contact_name")}
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Emergency Contact Phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange("emergency_contact_phone")}
                  error={!!fieldErrors.emergency_contact_phone}
                  helperText={fieldErrors.emergency_contact_phone}
                  disabled={loading}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Professional Development */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Professional Development
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Subjects Taught"
                  multiline
                  rows={2}
                  value={formData.subjects_taught}
                  onChange={handleChange("subjects_taught")}
                  helperText="List the subjects this teacher is qualified to teach"
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Certifications"
                  multiline
                  rows={2}
                  value={formData.certifications}
                  onChange={handleChange("certifications")}
                  helperText="Professional certifications, licenses, and qualifications"
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Professional Development"
                  multiline
                  rows={2}
                  value={formData.professional_development}
                  onChange={handleChange("professional_development")}
                  helperText="Recent training, workshops, conferences attended"
                  disabled={loading}
                />
              </Grid>
            </Grid>
          </Box>
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
            {loading
              ? "Saving..."
              : teacher
                ? "Update Teacher"
                : "Create Teacher"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TeacherForm;
