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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  FormControlLabel,
  Checkbox,
  Chip,
} from "@mui/material";
import {
  ExpandMore,
  Person,
  School,
  LocalHospital,
  FamilyRestroom,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";

const StudentForm = ({ open, onClose, student, onSuccess }) => {
  const [formData, setFormData] = useState({
    // Basic Information
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    student_id: "",
    school_id: "",
    grade_level: "",
    class_section: "",
    enrollment_date: "",

    // Contact Information
    address: "",
    phone: "",
    email: "",
    rfid_tag: "",

    // Health Information (optional)
    medical_conditions: "",
    allergies: "",
    medications: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",

    // Family Information (optional)
    household_income_range: "",
    housing_type: "",
    single_parent_household: false,
    food_insecurity_level: "",
  });

  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Grade levels for Barbados education system
  const gradeLevels = [
    "Reception", // Pre-Primary
    "Infants A", // Pre-Primary
    "Infants B", // Pre-Primary
    "Class 1", // Primary
    "Class 2",
    "Class 3",
    "Class 4",
    "First Form", // Secondary
    "Second Form",
    "Third Form",
    "Fourth Form",
    "Fifth Form",
    "Sixth Form",
    "Upper Sixth", // A-Level
  ];

  const genders = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ];

  const incomeRanges = [
    "Under $15,000",
    "$15,000 - $30,000",
    "$30,000 - $50,000",
    "$50,000 - $75,000",
    "Over $75,000",
    "Prefer not to say",
  ];

  const housingTypes = [
    "Own home",
    "Rental",
    "Government housing",
    "Family/relatives",
    "Other",
  ];

  const foodInsecurityLevels = ["None", "Low", "Moderate", "High"];

  // Load schools when component mounts
  useEffect(() => {
    if (open) {
      loadSchools();
    }
  }, [open]);

  // Reset form when dialog opens/closes or student changes
  useEffect(() => {
    if (open) {
      if (student) {
        // Edit mode - populate with existing data
        setFormData({
          first_name: student.first_name || "",
          last_name: student.last_name || "",
          date_of_birth: student.date_of_birth || "",
          gender: student.gender || "",
          student_id: student.student_id || "",
          school_id: student.school_id || "",
          grade_level: student.grade_level || "",
          class_section: student.class_section || "",
          enrollment_date: student.enrollment_date || "",
          address: student.address || "",
          phone: student.phone || "",
          email: student.email || "",
          rfid_tag: student.rfid_tag || "",
          medical_conditions: student.StudentHealth?.medical_conditions || "",
          allergies: student.StudentHealth?.allergies || "",
          medications: student.StudentHealth?.medications || "",
          emergency_contact_name:
            student.StudentHealth?.emergency_contact_name || "",
          emergency_contact_phone:
            student.StudentHealth?.emergency_contact_phone || "",
          household_income_range:
            student.FamilySocialAssessment?.household_income_range || "",
          housing_type: student.FamilySocialAssessment?.housing_type || "",
          single_parent_household:
            student.FamilySocialAssessment?.single_parent_household || false,
          food_insecurity_level:
            student.FamilySocialAssessment?.food_insecurity_level || "",
        });
      } else {
        // Create mode - reset to empty with defaults
        const today = new Date().toISOString().split("T")[0];
        setFormData({
          first_name: "",
          last_name: "",
          date_of_birth: "",
          gender: "",
          student_id: "",
          school_id: "",
          grade_level: "",
          class_section: "",
          enrollment_date: today,
          address: "",
          phone: "",
          email: "",
          rfid_tag: "",
          medical_conditions: "",
          allergies: "",
          medications: "",
          emergency_contact_name: "",
          emergency_contact_phone: "",
          household_income_range: "",
          housing_type: "",
          single_parent_household: false,
          food_insecurity_level: "",
        });
      }
      setError("");
      setFieldErrors({});
    }
  }, [open, student]);

  const loadSchools = async () => {
    setLoadingSchools(true);
    try {
      const response = await apiService.getSchools({ limit: 200 }); // Get more schools for dropdown
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

  const validateForm = () => {
    const errors = {};

    // Required fields
    if (!formData.first_name.trim()) {
      errors.first_name = "First name is required";
    }
    if (!formData.last_name.trim()) {
      errors.last_name = "Last name is required";
    }
    if (!formData.date_of_birth) {
      errors.date_of_birth = "Date of birth is required";
    } else {
      const age = calculateAge(formData.date_of_birth);
      if (age < 2 || age > 25) {
        errors.date_of_birth = "Age must be between 2 and 25 years";
      }
    }
    if (!formData.gender) {
      errors.gender = "Gender is required";
    }
    if (!formData.student_id.trim()) {
      errors.student_id = "Student ID is required";
    }
    if (!formData.school_id) {
      errors.school_id = "School selection is required";
    }
    if (!formData.grade_level) {
      errors.grade_level = "Grade level is required";
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
        is_active: true, // All new/edited students are active by default
      };

      let result;
      if (student) {
        // Edit mode
        result = await apiService.updateStudent(student.id, submitData);
      } else {
        // Create mode
        result = await apiService.createStudent(submitData);
      }

      onSuccess(result);
      onClose();
    } catch (err) {
      console.error("Error saving student:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          `Failed to ${student ? "update" : "create"} student`,
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
  const studentAge = calculateAge(formData.date_of_birth);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Person />
          {student ? "Edit Student" : "Add New Student"}
          {studentAge && (
            <Chip
              label={`Age: ${studentAge}`}
              size="small"
              color="info"
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

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Student ID"
                  value={formData.student_id}
                  onChange={handleChange("student_id")}
                  error={!!fieldErrors.student_id}
                  helperText={
                    fieldErrors.student_id ||
                    "Unique identifier for the student"
                  }
                  required
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="RFID Tag"
                  value={formData.rfid_tag}
                  onChange={handleChange("rfid_tag")}
                  helperText="Optional RFID tag for attendance tracking"
                  disabled={loading}
                />
              </Grid>
            </Grid>
          </Box>

          {/* School Information */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h6"
              sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
            >
              <School /> School Information
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
                  label="Grade Level"
                  value={formData.grade_level}
                  onChange={handleChange("grade_level")}
                  error={!!fieldErrors.grade_level}
                  helperText={fieldErrors.grade_level}
                  required
                  disabled={loading}
                >
                  {gradeLevels.map((grade) => (
                    <MenuItem key={grade} value={grade}>
                      {grade}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Class Section"
                  value={formData.class_section}
                  onChange={handleChange("class_section")}
                  helperText="e.g., A, B, C"
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Enrollment Date"
                  type="date"
                  value={formData.enrollment_date}
                  onChange={handleChange("enrollment_date")}
                  disabled={loading}
                  InputLabelProps={{ shrink: true }}
                />
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
            </Grid>
          </Box>

          {/* Health Information (Optional) */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <LocalHospital /> Health Information (Optional)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Medical Conditions"
                    multiline
                    rows={2}
                    value={formData.medical_conditions}
                    onChange={handleChange("medical_conditions")}
                    helperText="Any chronic conditions, disabilities, or ongoing medical issues"
                    disabled={loading}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Allergies"
                    multiline
                    rows={2}
                    value={formData.allergies}
                    onChange={handleChange("allergies")}
                    helperText="Food allergies, environmental allergies, etc."
                    disabled={loading}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Current Medications"
                    multiline
                    rows={2}
                    value={formData.medications}
                    onChange={handleChange("medications")}
                    helperText="List any medications the student is currently taking"
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
            </AccordionDetails>
          </Accordion>

          {/* Family Information (Optional) */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <FamilyRestroom /> Family & Social Information (Optional)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Household Income Range"
                    value={formData.household_income_range}
                    onChange={handleChange("household_income_range")}
                    disabled={loading}
                  >
                    {incomeRanges.map((range) => (
                      <MenuItem key={range} value={range}>
                        {range}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Housing Type"
                    value={formData.housing_type}
                    onChange={handleChange("housing_type")}
                    disabled={loading}
                  >
                    {housingTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Food Insecurity Level"
                    value={formData.food_insecurity_level}
                    onChange={handleChange("food_insecurity_level")}
                    disabled={loading}
                  >
                    {foodInsecurityLevels.map((level) => (
                      <MenuItem key={level} value={level}>
                        {level}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.single_parent_household}
                        onChange={handleChange("single_parent_household")}
                        disabled={loading}
                      />
                    }
                    label="Single Parent Household"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
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
              : student
                ? "Update Student"
                : "Create Student"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default StudentForm;
