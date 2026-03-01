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
  Work,
  Badge,
  Star,
  CalendarToday,
  Assignment,
} from "@mui/icons-material";

const TeacherCard = ({ teacher, onEdit, onDelete, onViewDetails }) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    onEdit(teacher);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete(teacher);
    handleMenuClose();
  };

  const handleViewDetails = () => {
    onViewDetails(teacher);
    handleMenuClose();
  };

  const getPositionColor = (position) => {
    if (!position) return "default";

    const pos = position.toLowerCase();
    if (pos.includes("principal")) return "secondary";
    if (pos.includes("head") || pos.includes("dean")) return "primary";
    if (pos.includes("teacher")) return "info";
    if (pos.includes("counselor") || pos.includes("librarian"))
      return "success";
    return "default";
  };

  const getEmploymentTypeColor = (type) => {
    if (!type) return "default";

    const empType = type.toLowerCase();
    if (empType.includes("permanent")) return "success";
    if (empType.includes("contract")) return "warning";
    if (empType.includes("part-time") || empType.includes("substitute"))
      return "info";
    return "default";
  };

  const getStatusColor = (isActive) => {
    return isActive ? "success" : "error";
  };

  const getPerformanceColor = (rating) => {
    if (!rating) return "default";

    const rate = rating.toLowerCase();
    if (rate.includes("excellent")) return "success";
    if (rate.includes("good")) return "info";
    if (rate.includes("satisfactory")) return "warning";
    if (rate.includes("needs") || rate.includes("unsatisfactory"))
      return "error";
    return "default";
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

  const teacherAge = calculateAge(teacher.date_of_birth);
  const yearsOfService = calculateYearsOfService(teacher.hire_date);
  const initials = getInitials(teacher.first_name, teacher.last_name);
  const hasPerformanceRating = teacher.performance_rating;
  const hasQualifications =
    teacher.qualification_level || teacher.certifications;

  return (
    <Card sx={{ height: "100%", position: "relative" }}>
      <CardContent>
        {/* Header with avatar and menu */}
        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
          <Avatar
            sx={{
              backgroundColor: getPositionColor(teacher.position) + ".main",
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
              {teacher.first_name} {teacher.last_name}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Chip
                label={teacher.position || "No position"}
                color={getPositionColor(teacher.position)}
                size="small"
              />
              <Chip
                label={teacher.is_active ? "Active" : "Inactive"}
                color={getStatusColor(teacher.is_active)}
                size="small"
              />
              {teacherAge && (
                <Chip
                  label={`Age: ${teacherAge}`}
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

        {/* Performance Alert */}
        {hasPerformanceRating && (
          <Alert
            severity={
              teacher.performance_rating?.toLowerCase().includes("excellent")
                ? "success"
                : teacher.performance_rating?.toLowerCase().includes("good")
                  ? "info"
                  : teacher.performance_rating
                        ?.toLowerCase()
                        .includes("satisfactory")
                    ? "warning"
                    : "error"
            }
            icon={<Star />}
            sx={{ mb: 2, py: 0 }}
          >
            <Typography variant="caption">
              Performance: {teacher.performance_rating}
            </Typography>
          </Alert>
        )}

        {/* Teacher Details */}
        <Box sx={{ space: 1.5 }}>
          {/* Employee ID */}
          {teacher.employee_id && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Badge sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                ID: {teacher.employee_id}
              </Typography>
            </Box>
          )}

          {/* School */}
          {teacher.School?.name && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <School sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                {formatSchoolName(teacher.School.name)}
              </Typography>
            </Box>
          )}

          {/* Department */}
          {teacher.department && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Assignment
                sx={{ fontSize: 16, color: "text.secondary", mr: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Dept: {teacher.department}
              </Typography>
            </Box>
          )}

          {/* Employment Type */}
          {teacher.employment_type && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Work sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                <Chip
                  label={teacher.employment_type}
                  color={getEmploymentTypeColor(teacher.employment_type)}
                  size="small"
                  variant="outlined"
                />
              </Typography>
            </Box>
          )}

          {/* Years of Experience */}
          {teacher.years_experience && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <CalendarToday
                sx={{ fontSize: 16, color: "text.secondary", mr: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Experience: {teacher.years_experience} years
              </Typography>
            </Box>
          )}

          {/* Phone */}
          {teacher.phone && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Phone sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {teacher.phone}
              </Typography>
            </Box>
          )}

          {/* Email */}
          {teacher.email && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Email sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                {teacher.email}
              </Typography>
            </Box>
          )}

          {/* Address */}
          {teacher.address && (
            <Box sx={{ display: "flex", alignItems: "flex-start", mb: 1 }}>
              <LocationOn
                sx={{ fontSize: 16, color: "text.secondary", mr: 1, mt: 0.2 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                {teacher.address}
              </Typography>
            </Box>
          )}

          {/* Qualification Level */}
          {teacher.qualification_level && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Star sx={{ fontSize: 16, color: "info.main", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Qualification: {teacher.qualification_level}
              </Typography>
            </Box>
          )}

          {/* Subjects Taught */}
          {teacher.subjects_taught && (
            <Box sx={{ display: "flex", alignItems: "flex-start", mb: 1 }}>
              <Assignment
                sx={{ fontSize: 16, color: "primary.main", mr: 1, mt: 0.2 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                Subjects: {teacher.subjects_taught}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Service Information */}
        <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: "divider" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {teacher.hire_date && (
              <Typography variant="caption" color="text.secondary">
                Hired: {new Date(teacher.hire_date).toLocaleDateString()}
              </Typography>
            )}
            {yearsOfService !== "" && (
              <Typography variant="caption" color="text.secondary">
                Service: {yearsOfService} years
              </Typography>
            )}
          </Box>
        </Box>
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
          <ListItemText>Edit Teacher</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <Delete fontSize="small" sx={{ color: "error.main" }} />
          </ListItemIcon>
          <ListItemText>Delete Teacher</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default TeacherCard;
