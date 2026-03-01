import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useFormik } from "formik";
import * as yup from "yup";
import toast from "react-hot-toast";

import { useAuth } from "../contexts/AuthContext";
import { useThemeMode } from "../contexts/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";

const validationSchema = yup.object({
  login: yup.string().required("Username or email is required"),
  password: yup.string().required("Password is required"),
});

// Animated Barbados Trident SVG Logo
const TridentLogo = ({ isDark }) => {
  const [isDrawn, setIsDrawn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsDrawn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box
      sx={{
        width: 80,
        height: 80,
        mb: 2,
        position: "relative",
      }}
    >
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        {/* Trident center prong */}
        <path
          d="M50 10 L50 75 M50 10 L45 25 M50 10 L55 25"
          stroke={isDark ? "#14b8a6" : "#1e3a5f"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: 200,
            strokeDashoffset: isDrawn ? 0 : 200,
            transition: "stroke-dashoffset 1.2s ease-out",
          }}
        />
        {/* Left prong */}
        <path
          d="M35 30 L35 55 M35 30 L30 42 M35 30 L40 42"
          stroke={isDark ? "#14b8a6" : "#1e3a5f"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: 150,
            strokeDashoffset: isDrawn ? 0 : 150,
            transition: "stroke-dashoffset 1s ease-out 0.2s",
          }}
        />
        {/* Right prong */}
        <path
          d="M65 30 L65 55 M65 30 L60 42 M65 30 L70 42"
          stroke={isDark ? "#14b8a6" : "#1e3a5f"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: 150,
            strokeDashoffset: isDrawn ? 0 : 150,
            transition: "stroke-dashoffset 1s ease-out 0.4s",
          }}
        />
        {/* Handle base */}
        <path
          d="M50 75 L50 90 M42 90 L58 90"
          stroke={isDark ? "#f59e0b" : "#d4a853"}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: 100,
            strokeDashoffset: isDrawn ? 0 : 100,
            transition: "stroke-dashoffset 0.8s ease-out 0.6s",
          }}
        />
        {/* Connecting bar */}
        <path
          d="M30 55 Q50 65 70 55"
          stroke={isDark ? "#14b8a6" : "#1e3a5f"}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: 100,
            strokeDashoffset: isDrawn ? 0 : 100,
            transition: "stroke-dashoffset 0.6s ease-out 0.8s",
          }}
        />
      </svg>
      {/* Glow effect */}
      <Box
        sx={{
          position: "absolute",
          inset: -10,
          borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle, rgba(20, 184, 166, 0.2) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(30, 58, 95, 0.15) 0%, transparent 70%)",
          opacity: isDrawn ? 1 : 0,
          transition: "opacity 1s ease-out 1s",
          pointerEvents: "none",
        }}
      />
    </Box>
  );
};

// Floating gradient orbs for background animation
const FloatingOrbs = ({ isDark }) => (
  <Box
    sx={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: 0,
    }}
  >
    {/* Orb 1 - Large, slow moving */}
    <Box
      sx={{
        position: "absolute",
        width: "40vw",
        height: "40vw",
        maxWidth: 500,
        maxHeight: 500,
        borderRadius: "50%",
        background: isDark
          ? "radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(30, 58, 95, 0.12) 0%, transparent 70%)",
        top: "10%",
        left: "-10%",
        animation: "float1 25s ease-in-out infinite",
        "@keyframes float1": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(30px, 20px)" },
        },
      }}
    />
    {/* Orb 2 - Medium, offset timing */}
    <Box
      sx={{
        position: "absolute",
        width: "30vw",
        height: "30vw",
        maxWidth: 400,
        maxHeight: 400,
        borderRadius: "50%",
        background: isDark
          ? "radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(212, 168, 83, 0.15) 0%, transparent 70%)",
        top: "60%",
        right: "-5%",
        animation: "float2 30s ease-in-out infinite",
        "@keyframes float2": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-25px, -30px)" },
        },
      }}
    />
    {/* Orb 3 - Small accent */}
    <Box
      sx={{
        position: "absolute",
        width: "20vw",
        height: "20vw",
        maxWidth: 300,
        maxHeight: 300,
        borderRadius: "50%",
        background: isDark
          ? "radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(30, 58, 95, 0.08) 0%, transparent 70%)",
        bottom: "10%",
        left: "20%",
        animation: "float3 20s ease-in-out infinite",
        "@keyframes float3": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(20px, -15px)" },
        },
      }}
    />
  </Box>
);

const LoginPage = () => {
  const { login, error, loading } = useAuth();
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const [showPassword, setShowPassword] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFormVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const formik = useFormik({
    initialValues: {
      login: "",
      password: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await login(values);
        toast.success("Login successful!");
      } catch (error) {
        toast.error(error.response?.data?.error || "Login failed");
      }
    },
  });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: isDark
          ? `
            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(20, 184, 166, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(59, 130, 246, 0.06) 0%, transparent 45%),
            radial-gradient(ellipse 50% 34% at 60% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 50%),
            linear-gradient(180deg, #060a13 0%, #0a101f 50%, #0f172a 100%)
          `
          : `
            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(30, 58, 95, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(212, 168, 83, 0.1) 0%, transparent 45%),
            radial-gradient(ellipse 50% 34% at 60% 80%, rgba(30, 58, 95, 0.05) 0%, transparent 50%),
            linear-gradient(180deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)
          `,
        transition: "background 0.5s ease",
      }}
    >
      <FloatingOrbs isDark={isDark} />

      {/* Theme toggle in top-right corner */}
      <Box
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
        }}
      >
        <ThemeToggle size="medium" />
      </Box>

      <Container
        component="main"
        maxWidth="sm"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          py: 4,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            padding: { xs: 3, sm: 5 },
            borderRadius: 4,
            width: "100%",
            maxWidth: 440,
            background: isDark
              ? "rgba(15, 23, 42, 0.8)"
              : "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: isDark
              ? "1px solid rgba(148, 163, 184, 0.15)"
              : "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: isDark
              ? `
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.05) inset
              `
              : `
                0 25px 50px -12px rgba(15, 23, 42, 0.15),
                0 0 0 1px rgba(255, 255, 255, 0.8) inset
              `,
            opacity: formVisible ? 1 : 0,
            transform: formVisible ? "translateY(0)" : "translateY(20px)",
            transition:
              "opacity 0.6s ease, transform 0.6s ease, background 0.3s ease, border-color 0.3s ease",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mb: 4,
            }}
          >
            <TridentLogo isDark={isDark} />

            {/* Decorative line */}
            <Box
              sx={{
                width: 60,
                height: 2,
                background: isDark
                  ? "linear-gradient(90deg, transparent, #14b8a6, transparent)"
                  : "linear-gradient(90deg, transparent, #1e3a5f, transparent)",
                mb: 2,
                borderRadius: 1,
              }}
            />

            <Typography
              component="h1"
              sx={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: { xs: "2rem", sm: "2.5rem" },
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: isDark ? "#f1f5f9" : "#0f172a",
                mb: 1,
              }}
            >
              NiEMIS
            </Typography>

            <Typography
              variant="body2"
              align="center"
              sx={{
                color: isDark ? "#94a3b8" : "#475569",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              National Integrated Education Management
            </Typography>
            <Typography
              variant="body2"
              align="center"
              sx={{
                color: isDark ? "#94a3b8" : "#475569",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              Information System
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: 2,
                backgroundColor: isDark
                  ? "rgba(244, 63, 94, 0.1)"
                  : "rgba(220, 38, 38, 0.08)",
                border: isDark
                  ? "1px solid rgba(244, 63, 94, 0.3)"
                  : "1px solid rgba(220, 38, 38, 0.2)",
                "& .MuiAlert-icon": {
                  color: isDark ? "#f43f5e" : "#dc2626",
                },
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={formik.handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="login"
              label="Username or Email"
              name="login"
              autoComplete="username"
              autoFocus
              value={formik.values.login}
              onChange={formik.handleChange}
              error={formik.touched.login && Boolean(formik.errors.login)}
              helperText={formik.touched.login && formik.errors.login}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.5)"
                    : "rgba(248, 250, 252, 0.8)",
                  transition: "all 0.2s ease",
                  "& fieldset": {
                    borderColor: isDark
                      ? "rgba(148, 163, 184, 0.2)"
                      : "rgba(15, 23, 42, 0.15)",
                  },
                  "&:hover fieldset": {
                    borderColor: isDark ? "#14b8a6" : "#1e3a5f",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: isDark ? "#14b8a6" : "#1e3a5f",
                    borderWidth: 2,
                  },
                },
                "& .MuiInputLabel-root": {
                  color: isDark ? "#94a3b8" : "#64748b",
                  "&.Mui-focused": {
                    color: isDark ? "#14b8a6" : "#1e3a5f",
                  },
                },
              }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              id="password"
              autoComplete="current-password"
              value={formik.values.password}
              onChange={formik.handleChange}
              error={formik.touched.password && Boolean(formik.errors.password)}
              helperText={formik.touched.password && formik.errors.password}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{
                        color: isDark ? "#94a3b8" : "#64748b",
                        "&:hover": {
                          color: isDark ? "#f1f5f9" : "#0f172a",
                        },
                      }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.5)"
                    : "rgba(248, 250, 252, 0.8)",
                  transition: "all 0.2s ease",
                  "& fieldset": {
                    borderColor: isDark
                      ? "rgba(148, 163, 184, 0.2)"
                      : "rgba(15, 23, 42, 0.15)",
                  },
                  "&:hover fieldset": {
                    borderColor: isDark ? "#14b8a6" : "#1e3a5f",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: isDark ? "#14b8a6" : "#1e3a5f",
                    borderWidth: 2,
                  },
                },
                "& .MuiInputLabel-root": {
                  color: isDark ? "#94a3b8" : "#64748b",
                  "&.Mui-focused": {
                    color: isDark ? "#14b8a6" : "#1e3a5f",
                  },
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 4,
                mb: 2,
                py: 1.5,
                borderRadius: 2,
                fontSize: "1rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                background: isDark
                  ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                  : "linear-gradient(135deg, #d4a853 0%, #b08a3a 100%)",
                boxShadow: isDark
                  ? "0 4px 20px -4px rgba(245, 158, 11, 0.4)"
                  : "0 4px 20px -4px rgba(212, 168, 83, 0.4)",
                color: "#0f172a",
                transition: "all 0.3s ease",
                "&:hover": {
                  background: isDark
                    ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
                    : "linear-gradient(135deg, #e6c67a 0%, #d4a853 100%)",
                  boxShadow: isDark
                    ? "0 8px 30px -4px rgba(245, 158, 11, 0.5)"
                    : "0 8px 30px -4px rgba(212, 168, 83, 0.5)",
                  transform: "translateY(-2px)",
                },
                "&:active": {
                  transform: "translateY(0)",
                },
                "&:disabled": {
                  background: isDark
                    ? "rgba(148, 163, 184, 0.2)"
                    : "rgba(148, 163, 184, 0.3)",
                  color: isDark ? "#64748b" : "#94a3b8",
                  boxShadow: "none",
                },
              }}
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>

            <Box sx={{ textAlign: "center", mt: 3 }}>
              <Typography
                variant="body2"
                sx={{
                  color: isDark ? "#64748b" : "#94a3b8",
                  fontSize: "0.85rem",
                }}
              >
                Forgot your password? Contact your system administrator.
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Typography
          variant="body2"
          sx={{
            mt: 4,
            textAlign: "center",
            color: isDark ? "#64748b" : "#94a3b8",
            opacity: formVisible ? 1 : 0,
            transition: "opacity 0.6s ease 0.3s",
          }}
        >
          Ministry of Educational Transformation
        </Typography>
        <Typography
          variant="body2"
          sx={{
            textAlign: "center",
            color: isDark ? "#475569" : "#cbd5e1",
            fontSize: "0.85rem",
            opacity: formVisible ? 1 : 0,
            transition: "opacity 0.6s ease 0.4s",
          }}
        >
          Barbados
        </Typography>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          py: 2,
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: isDark ? "#475569" : "#cbd5e1",
          }}
        >
          &copy; {new Date().getFullYear()} Ministry of Educational
          Transformation, Barbados. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;
