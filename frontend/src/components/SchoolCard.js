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
} from "@mui/material";
import {
  School,
  Edit,
  Delete,
  MoreVert,
  Phone,
  Email,
  LocationOn,
  People,
  Person,
} from "@mui/icons-material";

const SchoolCard = ({ school, onEdit, onDelete, onViewDetails }) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    onEdit(school);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete(school);
    handleMenuClose();
  };

  const handleViewDetails = () => {
    onViewDetails(school);
    handleMenuClose();
  };

  const getSchoolTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case "primary":
        return "primary";
      case "secondary":
        return "secondary";
      case "nursery":
      case "pre_primary":
        return "info";
      case "special":
        return "warning";
      case "tertiary":
        return "success";
      default:
        return "default";
    }
  };

  const formatParish = (parish) => {
    if (!parish) return "";
    return parish.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatSchoolType = (type) => {
    if (!type) return "";
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Card sx={{ height: "100%", position: "relative" }}>
      <CardContent>
        {/* Header with school icon and menu */}
        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
          <Box
            sx={{
              backgroundColor: "primary.light",
              borderRadius: 2,
              p: 1,
              mr: 2,
              minWidth: 48,
            }}
          >
            <School sx={{ color: "primary.main" }} />
          </Box>
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
              {school.name}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Chip
                label={formatSchoolType(
                  school.school_category || school.school_type,
                )}
                color={getSchoolTypeColor(
                  school.school_category || school.school_type,
                )}
                size="small"
              />
              {school.parish && (
                <Chip
                  label={formatParish(school.parish)}
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

        {/* School Details */}
        <Box sx={{ space: 1.5 }}>
          {school.principal_name && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Person sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Principal: {school.principal_name}
              </Typography>
            </Box>
          )}

          {school.student_population && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <People sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Students: {school.student_population.toLocaleString()}
              </Typography>
            </Box>
          )}

          {school.phone && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Phone sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {school.phone}
              </Typography>
            </Box>
          )}

          {school.email && (
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Email sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                {school.email}
              </Typography>
            </Box>
          )}

          {school.address && (
            <Box sx={{ display: "flex", alignItems: "flex-start", mb: 1 }}>
              <LocationOn
                sx={{ fontSize: 16, color: "text.secondary", mr: 1, mt: 0.2 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ wordBreak: "break-word" }}
              >
                {school.address}
              </Typography>
            </Box>
          )}

          {school.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {school.description}
            </Typography>
          )}
        </Box>

        {/* School Code */}
        {school.school_code && (
          <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary">
              School Code: {school.school_code}
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
            <School fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit School</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <Delete fontSize="small" sx={{ color: "error.main" }} />
          </ListItemIcon>
          <ListItemText>Delete School</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default SchoolCard;
