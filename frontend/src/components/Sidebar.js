import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Toolbar,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Dashboard,
  School,
  People,
  PersonAdd,
  CheckCircle,
  Business,
  Assessment,
  Wifi,
  Security,
  Person,
  Grade,
  Announcement,
  CalendarToday,
  HowToReg,
  VerifiedUser,
  SettingsSuggest,
} from "@mui/icons-material";

import { useAuth } from "../contexts/AuthContext";
import { useThemeMode } from "../contexts/ThemeContext";
import { getThemeAwareColors, ccFonts } from "./dashboard/commandCenterTheme";

const menuItems = [
  {
    text: "Dashboard",
    icon: <Dashboard />,
    path: "/",
    roles: ["super_admin", "admin", "teacher", "parent", "student"],
    permission: "dashboard.view",
  },
  {
    text: "Schools",
    icon: <School />,
    path: "/schools",
    roles: ["super_admin", "admin"],
    permission: "schools.view",
  },
  {
    text: "Students",
    icon: <People />,
    path: "/students",
    roles: ["super_admin", "admin", "teacher", "parent"],
    permission: "students.view",
  },
  {
    text: "Teachers",
    icon: <PersonAdd />,
    path: "/teachers",
    roles: ["super_admin", "admin"],
    permission: "teachers.view",
  },
  {
    text: "Attendance",
    icon: <CheckCircle />,
    path: "/attendance",
    roles: ["super_admin", "admin", "teacher"],
    permission: "attendance.view",
  },
  {
    text: "Facilities",
    icon: <Business />,
    path: "/facilities",
    roles: ["super_admin", "admin"],
    permission: "facilities.view",
  },
  {
    text: "Reports",
    icon: <Assessment />,
    path: "/reports",
    roles: ["super_admin", "admin", "teacher"],
    permission: "reports.view",
  },
  {
    text: "BSSEE Admissions",
    icon: <HowToReg />,
    path: "/bssee",
    roles: ["super_admin", "admin"],
    permission: "bssee.view",
  },
  {
    text: "Barbados Readiness",
    icon: <VerifiedUser />,
    path: "/readiness",
    roles: ["super_admin", "admin"],
    permission: "dashboard.view",
  },
  {
    text: "Operations Hub",
    icon: <SettingsSuggest />,
    path: "/operations",
    roles: ["super_admin", "admin"],
    permission: "data_quality.view",
  },
  // Student-specific menu items
  {
    text: "My Profile",
    icon: <Person />,
    path: "/student/profile",
    roles: ["student"],
    permission: "students.view.self",
  },
  {
    text: "My Grades",
    icon: <Grade />,
    path: "/student/grades",
    roles: ["student"],
    permission: "reports.view.self",
  },
  {
    text: "My Attendance",
    icon: <CalendarToday />,
    path: "/student/attendance",
    roles: ["student"],
    permission: "attendance.view.self",
  },
  {
    text: "School News",
    icon: <Announcement />,
    path: "/student/announcements",
    roles: ["student"],
    permission: "dashboard.view",
  },
  {
    text: "Access Control",
    icon: <Security />,
    path: "/access-control",
    roles: ["super_admin"],
    permission: "access.matrix.view",
  },
];

const drawerWidth = 272;

const Sidebar = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const theme = useTheme();
  const { mode } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const colors = getThemeAwareColors(mode);

  const filteredMenuItems = menuItems.filter(
    (item) => item.roles.includes(user?.role) && hasPermission(item.permission),
  );

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  };

  const drawer = (
    <>
      <Toolbar />
      <List>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ px: 1, py: 0.3 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                borderRadius: 2,
                border: `1px solid transparent`,
                minHeight: 42,
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: colors.glassHighlight,
                  borderColor: colors.borderLight,
                },
                "&.Mui-selected": {
                  backgroundColor: colors.primaryGlow,
                  borderColor: colors.primary,
                  boxShadow: `0 0 18px -10px ${colors.primaryGlow}`,
                  "&:hover": {
                    backgroundColor: colors.primaryGlow,
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color:
                    location.pathname === item.path
                      ? colors.primary
                      : colors.textSecondary,
                  transition: "color 0.2s ease",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{
                  color:
                    location.pathname === item.path
                      ? colors.textPrimary
                      : colors.textSecondary,
                  "& .MuiTypography-root": {
                    fontFamily: ccFonts.body,
                    fontSize: "0.88rem",
                    fontWeight: location.pathname === item.path ? 700 : 600,
                    transition: "color 0.2s ease",
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ borderColor: colors.borderLight, my: 1 }} />

      {user?.role === "super_admin" && (
        <List>
          <ListItem disablePadding sx={{ px: 1, py: 0.3 }}>
            <ListItemButton
              onClick={() => handleNavigation("/rfid-management")}
              sx={{
                borderRadius: 2,
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: colors.glassHighlight,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: colors.textSecondary }}>
                <Wifi />
              </ListItemIcon>
              <ListItemText
                primary="RFID Management"
                sx={{
                  color: colors.textSecondary,
                  "& .MuiTypography-root": {
                    fontFamily: ccFonts.body,
                    fontSize: "0.84rem",
                    fontWeight: 600,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding sx={{ px: 1, py: 0.3 }}>
            <ListItemButton
              onClick={() => handleNavigation("/system-admin")}
              sx={{
                borderRadius: 2,
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: colors.glassHighlight,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: colors.textSecondary }}>
                <Security />
              </ListItemIcon>
              <ListItemText
                primary="System Admin"
                sx={{
                  color: colors.textSecondary,
                  "& .MuiTypography-root": {
                    fontFamily: ccFonts.body,
                    fontSize: "0.84rem",
                    fontWeight: 600,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      )}
    </>
  );

  return (
    <Drawer
      variant={isMobile ? "temporary" : "permanent"}
      open={isMobile ? open : true}
      onClose={onClose}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          border: "none",
          borderRight: `1px solid ${colors.border}`,
          background: colors.bgGradient,
          color: colors.textPrimary,
          transition: "background 0.3s ease, border-color 0.3s ease",
        },
      }}
    >
      {drawer}
    </Drawer>
  );
};

export default Sidebar;
