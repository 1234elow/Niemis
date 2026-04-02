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
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  IconButton,
} from "@mui/material";
import {
  Close,
  LocationOn,
  Phone,
  Email,
  Person,
  School,
  Group,
  Business,
} from "@mui/icons-material";
import { apiService } from "../services/apiService";

const SchoolDetailsModal = ({ open, onClose, school }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [schoolDetails, setSchoolDetails] = useState(null);

  useEffect(() => {
    if (open && school?.id) {
      loadSchoolDetails();
    }
  }, [open, school?.id]);

  const loadSchoolDetails = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await apiService.getSchool(school.id);
      setSchoolDetails(response.school || response);
    } catch (err) {
      console.error("Error loading school details:", err);
      // Instead of showing an error, fall back to using the school data we already have
      setSchoolDetails(null); // We'll use the school prop data
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSchoolDetails(null);
    setError("");
    onClose();
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return "Not provided";
    return phone;
  };

  const formatSchoolType = (type) => {
    const typeMap = {
      pre_primary: "Pre-Primary/Nursery",
      nursery: "Pre-Primary/Nursery",
      primary: "Primary",
      secondary: "Secondary",
      special: "Special",
      tertiary: "Tertiary",
    };
    return typeMap[type] || type;
  };

  const getSchoolTypeColor = (type) => {
    const colorMap = {
      pre_primary: "info",
      nursery: "info",
      primary: "success",
      secondary: "primary",
      special: "warning",
      tertiary: "secondary",
    };
    return colorMap[type] || "default";
  };

  const schoolInfo = schoolDetails || school;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: "500px" }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <School color="primary" />
            <Box>
              <Typography variant="h5" component="div">
                {schoolInfo?.name || "School Details"}
              </Typography>
              {(schoolInfo?.school_type || schoolInfo?.school_category) && (
                <Chip
                  label={formatSchoolType(
                    schoolInfo.school_type || schoolInfo.school_category,
                  )}
                  color={getSchoolTypeColor(
                    schoolInfo.school_type || schoolInfo.school_category,
                  )}
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
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

        {!loading && schoolInfo && (
          <Box>
            {/* Basic Information */}
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom color="primary">
                <Business sx={{ mr: 1, verticalAlign: "middle" }} />
                Basic Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    School Code
                  </Typography>
                  <Typography variant="body1">
                    {schoolInfo.school_code || "Not assigned"}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Parish
                  </Typography>
                  <Typography variant="body1">
                    {schoolInfo.parish || "Not specified"}
                  </Typography>
                </Grid>

                {schoolInfo.zone_id && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Zone
                    </Typography>
                    <Typography variant="body1">
                      {schoolInfo.Zone?.name || schoolInfo.zone_id}
                    </Typography>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {schoolInfo.description || "No description available"}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Contact Information */}
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom color="primary">
                <Person sx={{ mr: 1, verticalAlign: "middle" }} />
                Contact Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Principal
                  </Typography>
                  <Typography variant="body1">
                    {schoolInfo.principal_name || "Not assigned"}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    <Phone sx={{ mr: 0.5, fontSize: "small" }} />
                    Phone
                  </Typography>
                  <Typography variant="body1">
                    {formatPhoneNumber(schoolInfo.phone)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    <Email sx={{ mr: 0.5, fontSize: "small" }} />
                    Email
                  </Typography>
                  <Typography variant="body1">
                    {schoolInfo.email || "Not provided"}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    <LocationOn sx={{ mr: 0.5, fontSize: "small" }} />
                    Address
                  </Typography>
                  <Typography variant="body1">
                    {schoolInfo.address || "Address not available"}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Statistics */}
            {(schoolDetails?.statistics || schoolInfo.student_population) && (
              <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  <Group sx={{ mr: 1, verticalAlign: "middle" }} />
                  School Statistics
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: "center", p: 2, bgcolor: "primary.50", borderRadius: 1 }}>
                      <Typography variant="h4" color="primary.main">
                        {schoolDetails?.statistics?.total_students || schoolInfo.student_population || "N/A"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Students Enrolled
                      </Typography>
                    </Box>
                  </Grid>
                  
                  {schoolDetails?.statistics && (
                    <>
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ textAlign: "center", p: 2, bgcolor: "success.50", borderRadius: 1 }}>
                          <Typography variant="h4" color="success.main">
                            {schoolDetails.statistics.total_staff || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Staff Members
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ textAlign: "center", p: 2, bgcolor: "info.50", borderRadius: 1 }}>
                          <Typography variant="h4" color="info.main">
                            {schoolDetails.statistics.total_facilities || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Facilities
                          </Typography>
                        </Box>
                      </Grid>
                    </>
                  )}

                  {schoolInfo.capacity && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        School Capacity
                      </Typography>
                      <Typography variant="body1">
                        {schoolInfo.capacity} students
                        {schoolDetails?.statistics?.total_students && (
                          <Chip
                            label={`${Math.round((schoolDetails.statistics.total_students / schoolInfo.capacity) * 100)}% utilized`}
                            size="small"
                            color={
                              (schoolDetails.statistics.total_students / schoolInfo.capacity) > 0.9
                                ? "error"
                                : (schoolDetails.statistics.total_students / schoolInfo.capacity) > 0.7
                                ? "warning"
                                : "success"
                            }
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            )}

            {/* Student Population by Grade */}
            {schoolInfo.student_population && (
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  Enrollment Information
                </Typography>
                <Typography variant="body1">
                  <strong>Total Student Population:</strong> {schoolInfo.student_population}
                </Typography>
                {schoolInfo.last_enrollment_update && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Last updated: {new Date(schoolInfo.last_enrollment_update).toLocaleDateString()}
                  </Typography>
                )}
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

export default SchoolDetailsModal;
