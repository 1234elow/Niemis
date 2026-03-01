import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar,
} from "@mui/material";
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
  Settings,
} from "@mui/icons-material";

import { useAuth } from "../contexts/AuthContext";
import { useThemeMode } from "../contexts/ThemeContext";
import ThemeToggle from "./ThemeToggle";

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { mode } = useThemeMode();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: mode === "dark" ? "background.paper" : "primary.main",
        borderBottom: (theme) =>
          mode === "dark" ? `1px solid ${theme.palette.divider}` : "none",
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          NiEMIS - National Integrated Education Management System
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ThemeToggle size="medium" />

          <Typography
            variant="body2"
            sx={{ display: { xs: "none", sm: "block" }, ml: 1 }}
          >
            {user?.username} ({user?.role})
          </Typography>

          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
        </Box>

        <Menu
          id="profile-menu"
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          keepMounted
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleMenuClose}>
            <AccountCircle sx={{ mr: 1 }} />
            Profile
          </MenuItem>
          <MenuItem onClick={handleMenuClose}>
            <Settings sx={{ mr: 1 }} />
            Settings
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <Logout sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
