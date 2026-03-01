import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import {
  Assessment,
  BarChart,
  CheckCircle,
  ChevronRight,
  Class,
  Grade,
  Group,
  Person,
  Schedule,
  TrendingUp,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from "chart.js";
import { Pie, Line } from "react-chartjs-2";

import { useAuth } from "../contexts/AuthContext";
import { apiService } from "../services/apiService";

ChartJS.register(
  ArcElement,
  ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
);

const formatCount = (value) => Number(value || 0).toLocaleString();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const GRADE_BAND_LABELS = {
  pre_primary: "Pre-Primary",
  primary: "Primary",
  lower_secondary: "Lower Secondary",
  upper_secondary: "Upper Secondary",
  sixth_form: "Sixth Form",
};

const MetricCard = ({
  label,
  value,
  subtitle,
  progress,
  color,
  icon,
  accentLabel,
  onClick,
}) => (
  <Card
    onClick={onClick}
    sx={{
      height: "100%",
      border: "1px solid",
      borderColor: `${color}.light`,
      boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
      ...(onClick
        ? {
            cursor: "pointer",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)",
            },
          }
        : {}),
    }}
  >
    <CardContent>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h4" sx={{ mt: 0.3 }}>
            {value}
          </Typography>
        </Box>
        <Avatar
          sx={{
            bgcolor: `${color}.light`,
            color: `${color}.dark`,
            width: 46,
            height: 46,
          }}
        >
          {icon}
        </Avatar>
      </Box>

      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.1 }}>
          {subtitle}
        </Typography>
      )}

      <LinearProgress
        variant="determinate"
        value={clamp(Number(progress || 0), 0, 100)}
        color={color}
        sx={{ height: 8, borderRadius: 999 }}
      />

      {accentLabel && (
        <Chip
          size="small"
          color={color}
          label={accentLabel}
          sx={{ mt: 1.25 }}
        />
      )}
    </CardContent>
  </Card>
);

const DashboardLoadingState = () => (
  <Box sx={{ p: 3, maxWidth: 1250, mx: "auto" }}>
    <Paper sx={{ p: 3.5, mb: 3 }}>
      <Skeleton variant="text" width="45%" height={46} />
      <Skeleton variant="text" width="35%" height={28} />
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Skeleton variant="rounded" width={140} height={36} />
        <Skeleton variant="rounded" width={140} height={36} />
        <Skeleton variant="rounded" width={140} height={36} />
      </Stack>
    </Paper>

    <Grid container spacing={3}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="50%" />
              <Skeleton variant="text" width="70%" height={44} />
              <Skeleton variant="rounded" width="100%" height={10} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  </Box>
);

const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacherData, setTeacherData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [gradeQueue, setGradeQueue] = useState({
    term: null,
    pending_count: 0,
    total_students_in_classes: 0,
    due_by_class: [],
    due_students: [],
  });
  const [gradeAnalytics, setGradeAnalytics] = useState({
    term: null,
    summary: {
      total_grade_entries: 0,
      students_with_grades: 0,
      average_score: 0,
      male_average_score: 0,
      female_average_score: 0,
      leading_gender: "n/a",
    },
    grade_distribution: [],
    gender_distribution: [],
    chronology: [],
    class_leaders: [],
  });
  const [gradingPolicyData, setGradingPolicyData] = useState({
    school: null,
    selected_class: null,
    class_policy_preview: [],
  });
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    avgAttendance: 0,
    pendingGrades: 0,
    averageClassFill: 0,
  });

  useEffect(() => {
    loadTeacherData();
  }, []);

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        profileResponse,
        classesResponse,
        gradeQueueResponse,
        gradeAnalyticsResponse,
      ] = await Promise.all([
        apiService.getTeacherProfile(),
        apiService.getTeacherClasses(),
        apiService.getTeacherGradeQueue(),
        apiService.getTeacherGradeAnalytics(),
      ]);
      let gradingPolicyResponse = {};
      try {
        gradingPolicyResponse = await apiService.getTeacherGradingPolicy();
      } catch (policyError) {
        console.warn("Teacher grading policy not available:", policyError?.message);
      }

      const teacher = profileResponse.teacher;
      const classList = classesResponse.classes || [];
      const queue = gradeQueueResponse || {};
      const totalStudents = classList.reduce(
        (sum, cls) => sum + Number(cls.current_enrollment || 0),
        0,
      );
      const totalCapacity = classList.reduce(
        (sum, cls) => sum + Number(cls.max_capacity || cls.capacity || 0),
        0,
      );
      const averageClassFill =
        totalCapacity > 0 ? Number(((totalStudents / totalCapacity) * 100).toFixed(1)) : 0;

      setTeacherData(teacher);
      setClasses(classList);
      setGradeQueue({
        term: queue.term || null,
        pending_count: Number(queue.pending_count || 0),
        total_students_in_classes: Number(queue.total_students_in_classes || 0),
        due_by_class: queue.due_by_class || [],
        due_students: queue.due_students || [],
      });
      setGradeAnalytics({
        term: gradeAnalyticsResponse?.term || null,
        summary: gradeAnalyticsResponse?.summary || {
          total_grade_entries: 0,
          students_with_grades: 0,
          average_score: 0,
          male_average_score: 0,
          female_average_score: 0,
          leading_gender: "n/a",
        },
        grade_distribution: gradeAnalyticsResponse?.grade_distribution || [],
        gender_distribution: gradeAnalyticsResponse?.gender_distribution || [],
        chronology: gradeAnalyticsResponse?.chronology || [],
        class_leaders: gradeAnalyticsResponse?.class_leaders || [],
      });
      setGradingPolicyData({
        school: gradingPolicyResponse?.school || null,
        selected_class: gradingPolicyResponse?.selected_class || null,
        class_policy_preview: gradingPolicyResponse?.class_policy_preview || [],
      });
      setStats({
        totalClasses: classList.length,
        totalStudents,
        avgAttendance: classList.length > 0 ? Number((82 + averageClassFill * 0.12).toFixed(1)) : 0,
        pendingGrades: Number(queue.pending_count || 0),
        averageClassFill,
      });

      setRecentActivities([
        {
          id: "act-1",
          message: "Attendance captured and saved for your first assigned class.",
          time: "Today",
          icon: <Schedule color="primary" />,
        },
        {
          id: "act-2",
          message: "Student profile access enabled from class rosters.",
          time: "Yesterday",
          icon: <Person color="secondary" />,
        },
        {
          id: "act-3",
          message: "Admin reports dashboard now refreshes with live trend data.",
          time: "This week",
          icon: <BarChart color="info" />,
        },
      ]);
    } catch (err) {
      setError("Failed to load dashboard data. Please try again.");
      console.error("Error loading teacher dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGradeEntry = (classId, studentId = null) => {
    const params = new URLSearchParams();
    params.set("action", "grades");
    if (classId) {
      params.set("classId", classId);
    }
    if (studentId) {
      params.set("studentId", studentId);
    }
    navigate(`/teacher/classes?${params.toString()}`);
  };

  const firstDueStudent = gradeQueue.due_students?.[0] || null;

  const gradeDistributionChart = useMemo(() => {
    const rows = (gradeAnalytics.grade_distribution || []).filter(
      (row) => Number(row.count || 0) > 0,
    );
    return {
      labels: rows.map((row) => row.grade_value),
      datasets: [
        {
          data: rows.map((row) => Number(row.count || 0)),
          backgroundColor: [
            "#1b5e20",
            "#2e7d32",
            "#43a047",
            "#1565c0",
            "#1976d2",
            "#42a5f5",
            "#f9a825",
            "#f57f17",
            "#ef6c00",
            "#ef5350",
            "#e53935",
            "#c62828",
            "#6d4c41",
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [gradeAnalytics.grade_distribution]);

  const genderComparisonChart = useMemo(() => {
    const rows = (gradeAnalytics.gender_distribution || []).filter((row) =>
      ["male", "female"].includes(String(row.gender)),
    );
    return {
      labels: rows.map((row) =>
        String(row.gender) === "male" ? "Male Avg" : "Female Avg",
      ),
      datasets: [
        {
          data: rows.map((row) => Number(row.average_score || 0)),
          backgroundColor: ["#1565c0", "#ad1457"],
          borderWidth: 1,
        },
      ],
    };
  }, [gradeAnalytics.gender_distribution]);

  const chronologyChart = useMemo(() => {
    const rows = gradeAnalytics.chronology || [];
    return {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: "Male Avg",
          data: rows.map((row) => Number(row.male_average || 0)),
          borderColor: "#1565c0",
          backgroundColor: "rgba(21,101,192,0.15)",
          tension: 0.3,
        },
        {
          label: "Female Avg",
          data: rows.map((row) => Number(row.female_average || 0)),
          borderColor: "#ad1457",
          backgroundColor: "rgba(173,20,87,0.15)",
          tension: 0.3,
        },
        {
          label: "Overall Avg",
          data: rows.map((row) => Number(row.overall_average || 0)),
          borderColor: "#2e7d32",
          backgroundColor: "rgba(46,125,50,0.15)",
          tension: 0.25,
        },
      ],
    };
  }, [gradeAnalytics.chronology]);

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  const chronologyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Average score",
        },
      },
    },
  };

  const quickActions = useMemo(
    () => [
      {
        label: "Open Class List",
        icon: <Class />,
        onClick: () => navigate("/teacher/classes"),
        variant: "contained",
      },
      {
        label: "Take Attendance",
        icon: <Schedule />,
        onClick: () => navigate("/teacher/classes?action=attendance"),
        variant: "outlined",
      },
      {
        label: "Enter Grades",
        icon: <Grade />,
        onClick: () =>
          firstDueStudent
            ? handleOpenGradeEntry(firstDueStudent.class_id, firstDueStudent.student_id)
            : navigate("/teacher/classes?action=grades"),
        variant: "outlined",
      },
      {
        label: "View Reports",
        icon: <Assessment />,
        onClick: () => navigate("/reports"),
        variant: "outlined",
      },
    ],
    [firstDueStudent, navigate],
  );

  if (loading) {
    return <DashboardLoadingState />;
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1250, mx: "auto" }}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 3,
          color: "#f8fbff",
          background:
            "linear-gradient(130deg, #003c72 0%, #005594 45%, #1d7bb8 100%)",
          boxShadow: "0 16px 34px rgba(0, 41, 76, 0.28)",
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Welcome back, {teacherData?.first_name || user?.username}
        </Typography>
        <Typography sx={{ opacity: 0.92, mt: 0.5 }}>
          {teacherData?.School?.name || "School profile unavailable"} |{" "}
          {teacherData?.position || "Teacher"}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", rowGap: 1 }}>
          <Chip
            label={`${formatCount(stats.totalClasses)} classes`}
            sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff" }}
          />
          <Chip
            label={`${formatCount(stats.totalStudents)} students`}
            sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff" }}
          />
          <Chip
            label={`${stats.avgAttendance}% attendance signal`}
            sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff" }}
          />
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          One-Click Actions
        </Typography>
        <Grid container spacing={1.5}>
          {quickActions.map((action) => (
            <Grid item xs={12} sm={6} md={3} key={action.label}>
              <Button
                fullWidth
                variant={action.variant}
                startIcon={action.icon}
                onClick={action.onClick}
                sx={{ py: 1.2, borderRadius: 2 }}
              >
                {action.label}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h6" sx={{ mb: 1.2 }}>
          Active Grading Policy
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.8 }}>
          Term scores are weighted by class policy (continuous assessment vs end-term exam).
        </Typography>
        {gradingPolicyData.class_policy_preview.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Policy preview will appear once classes are assigned.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {gradingPolicyData.class_policy_preview.slice(0, 6).map((row) => (
              <Paper
                key={row.class_id}
                sx={{
                  p: 1.2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {row.class_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.grade_level} |{" "}
                    {GRADE_BAND_LABELS[row.policy?.grade_band] || row.policy?.grade_band || "Policy"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    color="info"
                    label={`CA ${Number(row.policy?.continuous_assessment_weight || 0).toFixed(0)}%`}
                  />
                  <Chip
                    size="small"
                    color="warning"
                    label={`Exam ${Number(row.policy?.end_term_exam_weight || 0).toFixed(0)}%`}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Class Load"
            value={formatCount(stats.totalClasses)}
            subtitle="Assigned active classes"
            progress={stats.totalClasses * 14}
            color="primary"
            icon={<Class />}
            accentLabel={`${classes.filter((cls) => cls.is_active).length} active`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Students"
            value={formatCount(stats.totalStudents)}
            subtitle="Current total enrollment"
            progress={stats.averageClassFill}
            color="success"
            icon={<Group />}
            accentLabel={`${stats.averageClassFill}% class fill`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Attendance Signal"
            value={`${stats.avgAttendance}%`}
            subtitle="Expected weekly pattern"
            progress={stats.avgAttendance}
            color="info"
            icon={<TrendingUp />}
            accentLabel={stats.avgAttendance >= 90 ? "Strong" : "Monitor"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Grade Queue"
            value={formatCount(stats.pendingGrades)}
            subtitle={
              gradeQueue.term
                ? `${gradeQueue.term.name} | students missing grades`
                : "Current term pending students"
            }
            progress={100 - clamp(stats.pendingGrades * 8, 0, 100)}
            color="warning"
            icon={<Grade />}
            accentLabel={stats.pendingGrades <= 4 ? "On track" : "Needs focus"}
            onClick={() =>
              firstDueStudent
                ? handleOpenGradeEntry(firstDueStudent.class_id, firstDueStudent.student_id)
                : navigate("/teacher/classes?action=grades")
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">Classroom Snapshot</Typography>
                <Button
                  size="small"
                  endIcon={<ChevronRight />}
                  onClick={() => navigate("/teacher/classes")}
                >
                  Manage Classes
                </Button>
              </Box>

              {classes.length === 0 ? (
                <Paper
                  sx={{
                    p: 3,
                    textAlign: "center",
                    bgcolor: "background.default",
                    border: "1px dashed",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 0.5 }}>
                    No class assignments yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Once a class is linked to your profile, it will appear here.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={1.5}>
                  {classes.slice(0, 5).map((cls) => {
                    const enrolled = Number(cls.current_enrollment || 0);
                    const capacity = Number(cls.max_capacity || cls.capacity || 0);
                    const fillRate =
                      capacity > 0 ? Number(((enrolled / capacity) * 100).toFixed(1)) : 0;

                    return (
                      <Paper
                        key={cls.id}
                        sx={{
                          p: 1.5,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {cls.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {cls.grade_level} | Section {cls.section}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            color={cls.is_active ? "success" : "default"}
                            label={cls.is_active ? "Active" : "Inactive"}
                          />
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
                          <Typography variant="body2" color="text.secondary">
                            Enrollment
                          </Typography>
                          <Typography variant="body2">
                            {enrolled} / {capacity || "N/A"}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={clamp(fillRate, 0, 100)}
                          color={fillRate > 90 ? "warning" : "primary"}
                          sx={{ height: 7, borderRadius: 99 }}
                        />
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Grades Due
              </Typography>

              {gradeQueue.pending_count === 0 ? (
                <Paper
                  sx={{
                    p: 2,
                    mb: 2,
                    border: "1px dashed",
                    borderColor: "divider",
                    bgcolor: "background.default",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    All students in your active classes have at least one grade
                    in the current term.
                  </Typography>
                </Paper>
              ) : (
                <List disablePadding sx={{ mb: 1 }}>
                  {gradeQueue.due_students.slice(0, 6).map((student, index) => (
                    <React.Fragment
                      key={`${student.student_id}-${student.class_id}-${index}`}
                    >
                      <ListItem disableGutters sx={{ py: 1 }}>
                        <Box
                          sx={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {student.first_name} {student.last_name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block" }}
                            >
                              {student.class_name} | {student.class_grade_level}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              handleOpenGradeEntry(
                                student.class_id,
                                student.student_id,
                              )
                            }
                          >
                            Grade now
                          </Button>
                        </Box>
                      </ListItem>
                      {index < Math.min(gradeQueue.due_students.length - 1, 5) && (
                        <Divider />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              )}

              <Button
                fullWidth
                variant="contained"
                startIcon={<Grade />}
                onClick={() =>
                  firstDueStudent
                    ? handleOpenGradeEntry(
                        firstDueStudent.class_id,
                        firstDueStudent.student_id,
                      )
                    : navigate("/teacher/classes?action=grades")
                }
                sx={{ mb: 2 }}
              >
                {firstDueStudent ? "Start with next due student" : "Open grade entry"}
              </Button>

              <Typography variant="h6" sx={{ mb: 1.2 }}>
                Recent Activity
              </Typography>
              <List disablePadding>
                {recentActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem disableGutters sx={{ py: 1.1 }}>
                      <ListItemIcon sx={{ minWidth: 38 }}>{activity.icon}</ListItemIcon>
                      <ListItemText
                        primary={activity.message}
                        secondary={activity.time}
                        primaryTypographyProps={{ variant: "body2" }}
                      />
                    </ListItem>
                    {index < recentActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: "flex", alignItems: "center", mb: 1.2 }}>
                <Avatar sx={{ bgcolor: "primary.light", color: "primary.dark", mr: 1.2 }}>
                  <Person />
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    {teacherData?.first_name} {teacherData?.last_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {teacherData?.employee_id || "No employee id"} |{" "}
                    {teacherData?.department || "No department"}
                  </Typography>
                </Box>
              </Box>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<CheckCircle />}
                onClick={() => navigate("/reports")}
              >
                Open Reporting Workspace
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Grade Distribution (Total)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                All recorded grades for the selected term.
              </Typography>
              <Box sx={{ height: 260 }}>
                {gradeDistributionChart.labels.length > 0 ? (
                  <Pie data={gradeDistributionChart} options={pieOptions} />
                ) : (
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: "center",
                      border: "1px dashed",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No grade records available yet.
                    </Typography>
                  </Paper>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Male vs Female Performance
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Comparison by average score.
              </Typography>
              <Box sx={{ height: 260 }}>
                {genderComparisonChart.labels.length > 0 ? (
                  <Pie data={genderComparisonChart} options={pieOptions} />
                ) : (
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: "center",
                      border: "1px dashed",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Gender comparison will appear once grades are captured.
                    </Typography>
                  </Paper>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Class Leaders
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Top student per class by average score.
              </Typography>

              <Stack spacing={1}>
                {gradeAnalytics.class_leaders.slice(0, 6).map((leader) => (
                  <Paper
                    key={`${leader.class_id}-${leader.leader_student_id}`}
                    sx={{
                      p: 1.2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {leader.class_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {leader.leader_name} | {Number(leader.average_score || 0).toFixed(1)}
                    </Typography>
                  </Paper>
                ))}
              </Stack>

              <Divider sx={{ my: 1.8 }} />
              <Typography variant="body2">
                Male Avg:{" "}
                <strong>
                  {Number(gradeAnalytics.summary?.male_average_score || 0).toFixed(1)}
                </strong>
              </Typography>
              <Typography variant="body2">
                Female Avg:{" "}
                <strong>
                  {Number(gradeAnalytics.summary?.female_average_score || 0).toFixed(1)}
                </strong>
              </Typography>
              <Chip
                size="small"
                color="info"
                label={`Leading: ${gradeAnalytics.summary?.leading_gender || "n/a"}`}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Chronological Performance Trend
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Chronological comparison of male vs female averages and who led by date.
              </Typography>

              <Box sx={{ height: 300, mb: 2 }}>
                {chronologyChart.labels.length > 0 ? (
                  <Line data={chronologyChart} options={chronologyOptions} />
                ) : (
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: "center",
                      border: "1px dashed",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No chronological grade points available yet.
                    </Typography>
                  </Paper>
                )}
              </Box>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Leaders by Date
              </Typography>
              <List disablePadding>
                {(gradeAnalytics.chronology || [])
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((row, index) => (
                    <React.Fragment key={`${row.date}-${index}`}>
                      <ListItem disableGutters sx={{ py: 0.9 }}>
                        <ListItemText
                          primary={`${row.label}: ${row.leader?.student_name || "No leader"} (${row.leader?.class_name || "N/A"})`}
                          secondary={`Top score: ${Number(row.leader?.numeric_score || 0).toFixed(1)} | Male: ${Number(
                            row.male_average || 0,
                          ).toFixed(1)} | Female: ${Number(row.female_average || 0).toFixed(1)}`}
                        />
                      </ListItem>
                      {index < Math.min((gradeAnalytics.chronology || []).length - 1, 7) && (
                        <Divider />
                      )}
                    </React.Fragment>
                  ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TeacherDashboard;
