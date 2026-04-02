import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import { useLocation } from "react-router-dom";

import { useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import LoadingSpinner from "./components/LoadingSpinner";

// Lazy load pages for better performance
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const StudentDashboard = React.lazy(() => import("./pages/StudentDashboard"));
const TeacherDashboard = React.lazy(() => import("./pages/TeacherDashboard"));
const MyClassesPage = React.lazy(() => import("./pages/MyClassesPage"));
const SchoolsPage = React.lazy(() => import("./pages/SchoolsPage"));
const StudentsPage = React.lazy(() => import("./pages/StudentsPage"));
const TeachersPage = React.lazy(() => import("./pages/TeachersPage"));
const AttendancePage = React.lazy(() => import("./pages/AttendancePage"));
const FacilitiesPage = React.lazy(() => import("./pages/FacilitiesPage"));
const ReportsPage = React.lazy(() => import("./pages/ReportsPage"));
const AccessControlPage = React.lazy(() => import("./pages/AccessControlPage"));
const BsseePage = React.lazy(() => import("./pages/BsseePage"));
const ReadinessPage = React.lazy(() => import("./pages/ReadinessPage"));
const OperationsPage = React.lazy(() => import("./pages/OperationsPage"));

// Error boundary for lazy loaded components
class LazyLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Lazy loading error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6" color="error">
            Failed to load page. Please refresh and try again.
          </Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PermissionRoute = ({ permission, children }) => {
  const { loading, hasPermission } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!hasPermission(permission)) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" color="error" gutterBottom>
          Access denied
        </Typography>
        <Typography color="text.secondary">
          You do not have permission to access this area.
        </Typography>
      </Box>
    );
  }

  return children;
};

const DashboardRouter = () => {
  const { user, loading, refreshUser } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Ensure user is authenticated
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Debug info for development only
  const debugInfo =
    import.meta.env.VITE_DEBUG_MODE === "true" ? (
      <Box
        sx={{
          position: "fixed",
          top: 10,
          right: 10,
          backgroundColor: "info.main",
          color: "info.contrastText",
          p: 1,
          borderRadius: 1,
          fontSize: "0.75rem",
          zIndex: 9999,
          cursor: "pointer",
        }}
        onClick={() => refreshUser()}
      >
        DEBUG: User={user?.username}, Role={user?.role}, Type=
        {typeof user?.role} (Click to refresh)
      </Box>
    ) : null;

  // Route students to their dedicated dashboard with error boundary
  if (user.role === "student") {
    return (
      <>
        {debugInfo}
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <StudentDashboard />
          </Suspense>
        </LazyLoadErrorBoundary>
      </>
    );
  }

  // Route teachers to their dashboard
  if (user.role === "teacher") {
    return (
      <>
        {debugInfo}
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <TeacherDashboard />
          </Suspense>
        </LazyLoadErrorBoundary>
      </>
    );
  }

  // Route all other roles to the admin dashboard
  return (
    <>
      {debugInfo}
      <LazyLoadErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <DashboardPage />
        </Suspense>
      </LazyLoadErrorBoundary>
    </>
  );
};

const AppLayout = ({ children }) => {
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [sidebarOpen, setSidebarOpen] = React.useState(!isMobile);

  React.useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const isCommandCenterView = location.pathname === "/";

  return (
    <Box sx={{ display: "flex" }}>
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isCommandCenterView ? 0 : 3,
          marginTop: 8, // Account for navbar height
          marginLeft: 0,
          minHeight: "100vh",
          backgroundColor: isCommandCenterView ? "#060a13" : "background.default",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" />
          ) : (
            <LazyLoadErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <LoginPage />
              </Suspense>
            </LazyLoadErrorBoundary>
          )
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardRouter />} />
                <Route
                  path="/schools"
                  element={
                    <PermissionRoute permission="schools.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <SchoolsPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/students"
                  element={
                    <PermissionRoute permission="students.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <StudentsPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/teachers"
                  element={
                    <PermissionRoute permission="teachers.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <TeachersPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <PermissionRoute permission="attendance.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <AttendancePage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/facilities"
                  element={
                    <PermissionRoute permission="facilities.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <FacilitiesPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <PermissionRoute permission="reports.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <ReportsPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/operations"
                  element={
                    <PermissionRoute permission="data_quality.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <OperationsPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/access-control"
                  element={
                    <PermissionRoute permission="access.matrix.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <AccessControlPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/bssee"
                  element={
                    <PermissionRoute permission="bssee.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <BsseePage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/readiness"
                  element={
                    <PermissionRoute permission="dashboard.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <ReadinessPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                {/* Student-specific routes */}
                <Route
                  path="/student/profile"
                  element={
                    <PermissionRoute permission="students.view.self">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <StudentDashboard />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/student/grades"
                  element={
                    <PermissionRoute permission="reports.view.self">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <StudentDashboard />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/student/attendance"
                  element={
                    <PermissionRoute permission="attendance.view.self">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <StudentDashboard />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/student/announcements"
                  element={
                    <PermissionRoute permission="dashboard.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <StudentDashboard />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                {/* Teacher-specific routes */}
                <Route
                  path="/teacher/dashboard"
                  element={
                    <PermissionRoute permission="dashboard.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <TeacherDashboard />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/teacher/classes"
                  element={
                    <PermissionRoute permission="classes.view">
                      <LazyLoadErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <MyClassesPage />
                        </Suspense>
                      </LazyLoadErrorBoundary>
                    </PermissionRoute>
                  }
                />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
