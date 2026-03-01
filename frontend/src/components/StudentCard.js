import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Alert,
} from "@mui/material";
import {
  Person,
  Edit,
  Delete,
  MoreVert,
  Phone,
  Email,
  LocationOn,
  School,
  Warning,
  LocalHospital,
  ContactEmergency,
  Badge,
  Wifi,
} from "@mui/icons-material";

const StudentCard = ({ student, onEdit, onDelete, onViewDetails }) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    onEdit(student);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete(student);
    handleMenuClose();
  };

  const handleViewDetails = () => {
    onViewDetails(student);
    handleMenuClose();
  };

  const getGradeLevelColor = (grade) => {
    if (!grade) return "default";

    // Primary grades
    if (grade.includes("Reception") || grade.includes("Class")) {
      return "primary";
    }
    // Secondary grades
    if (grade.includes("Form")) {
      return "secondary";
    }
    return "default";
  };

  const getStatusColor = (isActive) => {
    return isActive ? "success" : "error";
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

  const getInitials = (firstName, lastName) => {
    const first = firstName?.charAt(0)?.toUpperCase() || "";
    const last = lastName?.charAt(0)?.toUpperCase() || "";
    return `${first}${last}`;
  };

  const formatSchoolName = (schoolName) => {
    if (!schoolName) return "No school assigned";
    return schoolName.length > 30
      ? `${schoolName.substring(0, 30)}...`
      : schoolName;
  };

  const studentAge = calculateAge(student.date_of_birth);
  const initials = getInitials(student.first_name, student.last_name);
  const hasHealthAlerts =
    student.StudentHealth?.medical_conditions ||
    student.StudentHealth?.allergies;
  const hasEmergencyContact = student.StudentHealth?.emergency_contact_name;

  return (
    <Card sx={{ height: "100%", position: "relative" }}>
      <CardContent>
        {/* Header with avatar and menu */}
        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
          <Avatar
            sx={{
              backgroundColor:
                getGradeLevelColor(student.grade_level) + ".main",
              color: "white",
              mr: 2,
              width: 48,
              height: 48,
            }}
          >
            {initials}
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontWeight: 600,
                mb: 0.5,
                wordBreak: "break-word",
              }}
            >
              {student.first_name} {student.last_name}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Chip
                label={student.grade_level || "No grade"}
                color={getGradeLevelColor(student.grade_level)}
                size="small"
              />
              <Chip
                label={student.is_active ? "Active" : "Inactive"}
                color={getStatusColor(student.is_active)}
                size="small"
              />
              {studentAge && (
                <Chip
                  label={`Age: ${studentAge}`}
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          </Box>

          <IconButton size="small" onClick={handleMenuClick} sx={{ ml: 1 }}>
            <MoreVert />
          </IconButton>
        </Box>

        {/* Health Alerts */}
        {hasHealthAlerts && (
          <Alert severity="info" icon={<LocalHospital />} sx={{ mb: 2, py: 0 }}>
            <Typography variant="caption">
              Health information on file
              {student.StudentHealth?.medical_conditions &&
                " • Medical conditions"}
              {student.StudentHealth?.allergies && " • Allergies"}
            </Typography>
          </Alert>
        )}

        {/* Student Details */}
        <Box sx={{ space: 1.5 }}>
          {/* Student ID */}
          {student.student_id && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Badge sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                ID: {student.student_id}
              </Typography>
            </Box>
          )}

          {/* School */}
          {student.School?.name && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <School sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                {formatSchoolName(student.School.name)}
              </Typography>
            </Box>
          )}

          {/* Class Section */}
          {student.class_section && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Person sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Class: {student.class_section}
              </Typography>
            </Box>
          )}

          {/* Phone */}
          {student.phone && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Phone sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {student.phone}
              </Typography>
            </Box>
          )}

          {/* Email */}
          {student.email && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Email sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                {student.email}
              </Typography>
            </Box>
          )}

          {/* Address */}
          {student.address && (
            <Box sx={{ display: "flex", alignItems: "flex-start", mb: 1 }}>
              <LocationOn
                sx={{ fontSize: 16, color: "text.secondary", mr: 1, mt: 0.2 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                {student.address}
              </Typography>
            </Box>
          )}

          {/* Emergency Contact */}
          {hasEmergencyContact && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <ContactEmergency
                sx={{ fontSize: 16, color: "warning.main", mr: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Emergency: {student.StudentHealth.emergency_contact_name}
                {student.StudentHealth.emergency_contact_phone &&
                  ` (${student.StudentHealth.emergency_contact_phone})`}
              </Typography>
            </Box>
          )}

          {/* RFID Tag */}
          {student.rfid_tag && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Wifi sx={{ fontSize: 16, color: "info.main", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                RFID: {student.rfid_tag}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Enrollment Information */}
        {student.enrollment_date && (
          <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary">
              Enrolled: {new Date(student.enrollment_date).toLocaleDateString()}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Student</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <Delete fontSize="small" sx={{ color: "error.main" }} />
          </ListItemIcon>
          <ListItemText>Delete Student</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default StudentCard;
