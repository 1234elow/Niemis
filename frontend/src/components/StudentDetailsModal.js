import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Chip,
  Paper,
  CircularProgress,
  IconButton,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Close,
  Person,
  School,
  Email,
  Phone,
  LocationOn,
  CalendarToday,
  Badge,
  Group,
  HealthAndSafety,
  People,
  Cake,
  Male,
  Female,
  Home,
  Assignment,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";

const StudentDetailsModal = ({ open, onClose, student }) => {
  const [loading, setLoading] = useState(false);
  const [studentDetails, setStudentDetails] = useState(null);

  useEffect(() => {
    if (open && student?.id) {
      loadStudentDetails();
    }
  }, [open, student?.id]);

  const loadStudentDetails = async () => {
    setLoading(true);
    
    try {
      const response = await apiService.getStudent(student.id);
      setStudentDetails(response.student || response);
    } catch (err) {
      console.error("Error loading student details:", err);
      // Fallback to basic student data
      setStudentDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStudentDetails(null);
    onClose();
  };

  const formatDate = (date) => {
    if (!date) return "Not provided";
    return new Date(date).toLocaleDateString();
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return "Not provided";
    return phone;
  };

  const getGenderIcon = (gender) => {
    if (gender === 'male') return <Male color="primary" />;
    if (gender === 'female') return <Female color="secondary" />;
    return <Person />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'transferred': return 'warning';
      default: return 'default';
    }
  };

  const formatGradeLevel = (gradeLevel) => {
    const gradeMap = {
      'reception': 'Reception',
      'class_1': 'Class 1',
      'class_2': 'Class 2',
      'class_3': 'Class 3',
      'class_4': 'Class 4',
      'class_5': 'Class 5',
      'class_6': 'Class 6',
      'form_1': 'Form 1',
      'form_2': 'Form 2',
      'form_3': 'Form 3',
      'form_4': 'Form 4',
      'form_5': 'Form 5',
      'form_6': 'Form 6',
    };
    return gradeMap[gradeLevel] || gradeLevel;
  };

  const studentInfo = studentDetails || student;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: "600px" }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "primary.main" }}>
              {getGenderIcon(studentInfo?.gender)}
            </Avatar>
            <Box>
              <Typography variant="h5" component="div">
                {studentInfo?.first_name && studentInfo?.last_name
                  ? `${studentInfo.first_name} ${studentInfo.last_name}`
                  : "Student Details"}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center" }}>
                {studentInfo?.student_id && (
                  <Chip
                    label={`ID: ${studentInfo.student_id}`}
                    size="small"
                    variant="outlined"
                    icon={<Badge />}
                  />
                )}
                {studentInfo?.grade_level && (
                  <Chip
                    label={formatGradeLevel(studentInfo.grade_level)}
                    size="small"
                    color="primary"
                  />
                )}
                {studentInfo?.is_active !== undefined && (
                  <Chip
                    label={studentInfo.is_active ? "Active" : "Inactive"}
                    size="small"
                    color={getStatusColor(studentInfo.is_active ? 'active' : 'inactive')}
                  />
                )}
              </Box>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && studentInfo && (
          <Box>
            {/* Basic Information */}
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom color="primary">
                <Person sx={{ mr: 1, verticalAlign: "middle" }} />
                Basic Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Full Name
                  </Typography>
                  <Typography variant="body1">
                    {studentInfo.first_name && studentInfo.last_name
                      ? `${studentInfo.first_name} ${studentInfo.last_name}`
                      : "Not provided"}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Student ID
                  </Typography>
                  <Typography variant="body1">
                    {studentInfo.student_id || "Not assigned"}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    <Cake sx={{ mr: 0.5, fontSize: "small" }} />
                    Date of Birth
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(studentInfo.date_of_birth)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Gender
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {getGenderIcon(studentInfo.gender)}
                    <Typography variant="body1">
                      {studentInfo.gender ? studentInfo.gender.charAt(0).toUpperCase() + studentInfo.gender.slice(1) : "Not specified"}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Nationality
                  </Typography>
                  <Typography variant="body1">
                    {studentInfo.nationality || "Not specified"}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Religion
                  </Typography>
                  <Typography variant="body1">
                    {studentInfo.religion || "Not specified"}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* School Information */}
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom color="primary">
                <School sx={{ mr: 1, verticalAlign: "middle" }} />
                School Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current School
                  </Typography>
                  <Typography variant="body1">
                    {studentDetails?.School?.name || studentInfo.school_name || "Not assigned"}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Grade Level
                  </Typography>
                  <Typography variant="body1">
                    {formatGradeLevel(studentInfo.grade_level)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    <CalendarToday sx={{ mr: 0.5, fontSize: "small" }} />
                    Enrollment Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(studentInfo.enrollment_date)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={studentInfo.is_active ? "Active" : "Inactive"}
                    size="small"
                    color={getStatusColor(studentInfo.is_active ? 'active' : 'inactive')}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Contact Information */}
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom color="primary">
                <LocationOn sx={{ mr: 1, verticalAlign: "middle" }} />
                Contact Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    <Home sx={{ mr: 0.5, fontSize: "small" }} />
                    Home Address
                  </Typography>
                  <Typography variant="body1">
                    {studentInfo.address || "Not provided"}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Parish
                  </Typography>
                  <Typography variant="body1">
                    {studentInfo.parish || "Not specified"}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    <Phone sx={{ mr: 0.5, fontSize: "small" }} />
                    Emergency Contact
                  </Typography>
                  <Typography variant="body1">
                    {formatPhoneNumber(studentInfo.emergency_contact_phone)}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Parents/Guardians */}
            {studentDetails?.Parents && studentDetails.Parents.length > 0 && (
              <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  <People sx={{ mr: 1, verticalAlign: "middle" }} />
                  Parents/Guardians
                </Typography>
                
                <List dense>
                  {studentDetails.Parents.map((parent, index) => (
                    <ListItem key={parent.id} divider={index < studentDetails.Parents.length - 1}>
                      <ListItemIcon>
                        <Person />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${parent.first_name} ${parent.last_name}`}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {parent.StudentParentRelationship?.relationship_type || "Guardian"}
                              {parent.StudentParentRelationship?.is_primary && " (Primary)"}
                            </Typography>
                            {parent.phone && (
                              <Typography variant="body2" color="text.secondary">
                                <Phone sx={{ fontSize: "small", mr: 0.5 }} />
                                {parent.phone}
                              </Typography>
                            )}
                            {parent.email && (
                              <Typography variant="body2" color="text.secondary">
                                <Email sx={{ fontSize: "small", mr: 0.5 }} />
                                {parent.email}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            {/* Health Information */}
            {studentDetails?.StudentHealth && (
              <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  <HealthAndSafety sx={{ mr: 1, verticalAlign: "middle" }} />
                  Health Information
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Blood Type
                    </Typography>
                    <Typography variant="body1">
                      {studentDetails.StudentHealth.blood_type || "Not recorded"}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Medical Conditions
                    </Typography>
                    <Typography variant="body1">
                      {studentDetails.StudentHealth.medical_conditions || "None recorded"}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Allergies
                    </Typography>
                    <Typography variant="body1">
                      {studentDetails.StudentHealth.allergies || "None recorded"}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Academic Notes */}
            {studentInfo.notes && (
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  <Assignment sx={{ mr: 1, verticalAlign: "middle" }} />
                  Additional Notes
                </Typography>
                <Typography variant="body1">
                  {studentInfo.notes}
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StudentDetailsModal;