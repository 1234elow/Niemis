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
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import {
  AutoGraph,
  Assignment,
  CalendarToday,
  CheckCircle,
  EmojiEvents,
  Email,
  EventNote,
  Grade,
  LocalFireDepartment,
  LocationOn,
  Phone,
  School,
  TrendingDown,
  TrendingUp,
  Warning,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { useAuth } from "../contexts/AuthContext";
import { apiService } from "../services/apiService";
import LoadingSpinner from "../components/LoadingSpinner";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  Legend,
);

const STUDENT_TAB_META = [
  {
    path: "/student/profile",
    label: "Profile",
    caption: "Bio and school details",
    title: "Student Profile",
    description: "View core identity and enrollment details.",
    icon: <School fontSize="small" />,
  },
  {
    path: "/student/attendance",
    label: "Attendance",
    caption: "Presence and punctuality",
    title: "Attendance Tracker",
    description: "Monitor consistency and daily participation.",
    icon: <CalendarToday fontSize="small" />,
  },
  {
    path: "/student/grades",
    label: "Grades",
    caption: "Performance by subject",
    title: "Academic Results",
    description: "Review grades, trends, and subject outcomes.",
    icon: <Grade fontSize="small" />,
  },
  {
    path: "/student/announcements",
    label: "Updates",
    caption: "School notices",
    title: "School Updates",
    description: "Stay current with notices and reminders.",
    icon: <EventNote fontSize="small" />,
  },
];

const STUDENT_TAB_PATHS = STUDENT_TAB_META.map((tab) => tab.path);
const STUDENT_PATH_TO_TAB = STUDENT_TAB_META.reduce(
  (acc, tab, index) => ({ ...acc, [tab.path]: index }),
  { "/": 0 },
);

const TAB_CONTENT_ANIMATION_SX = {
  animation: "studentTabEnter 260ms ease",
  "@keyframes studentTabEnter": {
    "0%": { opacity: 0, transform: "translateY(8px)" },
    "100%": { opacity: 1, transform: "translateY(0)" },
  },
};

const gradeToScore = (grade, gradePoints) => {
  const numericPoints = Number(gradePoints);
  if (Number.isFinite(numericPoints)) {
    return numericPoints <= 4 ? numericPoints * 25 : numericPoints;
  }

  const letter = String(grade || "").toUpperCase();
  const map = {
    "A+": 95,
    A: 87,
    "A-": 82,
    "B+": 77,
    B: 72,
    "B-": 67,
    "C+": 62,
    C: 57,
    "C-": 52,
    "D+": 48,
    D: 45,
    "D-": 41,
    F: 20,
  };

  return map[letter] ?? null;
};

const scoreToLetter = (score) => {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "N/A";
  if (numeric >= 90) return "A+";
  if (numeric >= 85) return "A";
  if (numeric >= 80) return "A-";
  if (numeric >= 75) return "B+";
  if (numeric >= 70) return "B";
  if (numeric >= 65) return "B-";
  if (numeric >= 60) return "C+";
  if (numeric >= 55) return "C";
  if (numeric >= 50) return "C-";
  if (numeric >= 47) return "D+";
  if (numeric >= 44) return "D";
  if (numeric >= 40) return "D-";
  return "F";
};

const ATTENDANCE_PRESENT_STATUSES = new Set(["present", "late", "excused"]);

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const normalizeTermValue = (term) =>
  String(term || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getTermRank = (termValue) => {
  const term = normalizeTermValue(termValue);
  if (!term) return 99;
  if (term.includes("1") || term.includes("first")) return 1;
  if (term.includes("2") || term.includes("second")) return 2;
  if (term.includes("3") || term.includes("third")) return 3;
  return 50;
};

const formatTermLabel = (schoolYear, term) =>
  `${schoolYear || "Unknown Year"} ${term || "Term"}`.trim();

const getSchoolYearStart = (schoolYear) => {
  const match = String(schoolYear || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : 0;
};

const deriveSchoolTermFromDate = (rawDate) => {
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const termRank =
    month >= 9 && month <= 12 ? 1 : month >= 1 && month <= 3 ? 2 : 3;
  const term = `Term ${termRank}`;
  const schoolYearStart = month >= 9 ? year : year - 1;
  const schoolYear = `${schoolYearStart}-${schoolYearStart + 1}`;

  return { schoolYear, term, termRank };
};

const StudentInfoCard = ({ student, school }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Avatar
          sx={{
            width: 60,
            height: 60,
            mr: 2,
            backgroundColor: "primary.main",
            fontSize: "1.5rem",
          }}
        >
          {student?.first_name?.[0]}
          {student?.last_name?.[0]}
        </Avatar>
        <Box>
          <Typography variant="h6" component="div">
            {student?.first_name} {student?.last_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ID: {student?.student_id || "N/A"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Grade: {student?.grade_level || "N/A"} | Section:{" "}
            {student?.class_section || "N/A"}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <School sx={{ mr: 1, color: "primary.main" }} />
        <Typography variant="body2">{school?.name || "N/A"}</Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <LocationOn sx={{ mr: 1, color: "text.secondary" }} />
        <Typography variant="body2" color="text.secondary">
          {school?.parish || "N/A"}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <CalendarToday sx={{ mr: 1, color: "text.secondary" }} />
        <Typography variant="body2" color="text.secondary">
          Enrolled:{" "}
          {student?.enrollment_date
            ? new Date(student.enrollment_date).toLocaleDateString()
            : "N/A"}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Email sx={{ mr: 1, color: "text.secondary" }} />
        <Typography variant="body2" color="text.secondary">
          {student?.email || "N/A"}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Phone sx={{ mr: 1, color: "text.secondary" }} />
        <Typography variant="body2" color="text.secondary">
          {student?.phone || "N/A"}
        </Typography>
      </Box>
    </CardContent>
  </Card>
);

const AttendanceCard = ({ attendanceData }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Attendance Overview
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2">This Month</Typography>
          <Typography variant="body2" color="primary">
            {attendanceData.thisMonth}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={attendanceData.thisMonth}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2">This Term</Typography>
          <Typography variant="body2" color="success.main">
            {attendanceData.thisTerm}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={attendanceData.thisTerm}
          sx={{ height: 8, borderRadius: 4 }}
          color="success"
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Recent Attendance
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {attendanceData.recent.length === 0 && (
            <Chip label="No recent records" size="small" variant="outlined" />
          )}
          {attendanceData.recent.map((day, index) => (
            <Chip
              key={`${day.date}-${index}`}
              label={day.date}
              color={day.present ? "success" : "error"}
              size="small"
              variant="outlined"
            />
          ))}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const GradesCard = ({ grades }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Academic Performance
      </Typography>

      {grades.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No grade records available yet.
        </Typography>
      ) : (
        <List dense>
          {grades.map((subject, index) => (
            <React.Fragment key={subject.name}>
              <ListItem>
                <ListItemIcon>
                  <Assignment color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={subject.name}
                  secondary={`Current Grade: ${subject.currentGrade}`}
                />
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mr: 1 }}
                  >
                    {subject.average}%
                  </Typography>
                  {subject.trend === "up" ? (
                    <TrendingUp color="success" />
                  ) : subject.trend === "down" ? (
                    <TrendingDown color="warning" />
                  ) : (
                    <Warning color="disabled" />
                  )}
                </Box>
              </ListItem>
              {index < grades.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </CardContent>
  </Card>
);

const AnnouncementsCard = ({ announcements }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        School Updates
      </Typography>

      {announcements.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No updates available right now.
        </Typography>
      ) : (
        <List dense>
          {announcements.map((announcement, index) => (
            <React.Fragment key={`${announcement.title}-${index}`}>
              <ListItem>
                <ListItemIcon>
                  <EventNote color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={announcement.title}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {announcement.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {announcement.date}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < announcements.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </CardContent>
  </Card>
);

const AttendanceHeatmapCard = ({ days }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        4-Week Attendance Heatmap
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Green days are present/late/excused, red days are absent.
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.8 }}>
        {days.map((day) => {
          const tone =
            day.status === "present"
              ? "rgba(16, 185, 129, 0.88)"
              : day.status === "absent"
                ? "rgba(239, 68, 68, 0.84)"
                : "rgba(148, 163, 184, 0.35)";
          return (
            <Box
              key={day.dateKey}
              title={`${day.label}: ${day.statusLabel}`}
              sx={{
                borderRadius: 1.2,
                minHeight: 26,
                border: "1px solid rgba(15,23,42,0.08)",
                backgroundColor: tone,
              }}
            />
          );
        })}
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1.6, flexWrap: "wrap", rowGap: 0.7 }}>
        <Chip size="small" label="Present / Late / Excused" color="success" />
        <Chip size="small" label="Absent" color="error" />
        <Chip size="small" label="No record" variant="outlined" />
      </Stack>
    </CardContent>
  </Card>
);

const ProfileCompletionCard = ({ profileCompletion, onOpenProfile }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Profile Completion
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
        Keep your information complete so reports and communication stay accurate.
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
        <Typography variant="body2">Completion</Typography>
        <Typography variant="body2" color="primary.main">
          {profileCompletion.percentage}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={clampPercent(profileCompletion.percentage)}
        sx={{ height: 9, borderRadius: 999, mb: 1.3 }}
      />

      {profileCompletion.missing.length === 0 ? (
        <Alert severity="success" sx={{ mb: 1.2 }}>
          Your profile is complete.
        </Alert>
      ) : (
        <>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.8 }}>
            Missing fields
          </Typography>
          <Box sx={{ display: "flex", gap: 0.7, flexWrap: "wrap", mb: 1.2 }}>
            {profileCompletion.missing.slice(0, 5).map((field) => (
              <Chip key={field} size="small" color="warning" variant="outlined" label={field} />
            ))}
            {profileCompletion.missing.length > 5 && (
              <Chip size="small" label={`+${profileCompletion.missing.length - 5} more`} />
            )}
          </Box>
          <Button size="small" variant="outlined" onClick={onOpenProfile}>
            Review Profile
          </Button>
        </>
      )}
    </CardContent>
  </Card>
);

const StudentDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [school, setSchool] = useState(null);
  const [error, setError] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({
    attendance_rate: 0,
    total_days: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [academicRecords, setAcademicRecords] = useState([]);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        setLoading(true);
        setError(null);

        const studentResponse = await apiService.api.get("/students/profile");
        const studentData = studentResponse.data.student;
        setStudent(studentData);
        setSchool(studentData.School || null);

        if (!studentData?.id) {
          return;
        }

        const [attendanceResult, academicsResult] = await Promise.allSettled([
          apiService.getStudentAttendance(studentData.id),
          apiService.getStudentAcademics(studentData.id),
        ]);

        if (attendanceResult.status === "fulfilled") {
          const attendancePayload = attendanceResult.value || {};
          setAttendanceSummary(attendancePayload.attendance_summary || {});
          setRecentAttendance(attendancePayload.recent_attendance || []);
        } else {
          console.error("Student attendance load failed:", attendanceResult.reason);
        }

        if (academicsResult.status === "fulfilled") {
          const academicsPayload = academicsResult.value || {};
          setAcademicRecords(academicsPayload.academic_records || []);
        } else {
          console.error("Student academics load failed:", academicsResult.reason);
        }
      } catch (err) {
        console.error("Error fetching student dashboard data:", err);
        if (err.response?.status === 403) {
          setError("Access denied: Student role required.");
        } else if (err.response?.status === 404) {
          setError("Student profile not found.");
        } else {
          setError("Failed to load student dashboard data.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === "student") {
      fetchStudentData();
    } else {
      setError("Access denied: Student role required.");
      setLoading(false);
    }
  }, [user]);

  const attendanceData = useMemo(() => {
    const thisTerm = Number(attendanceSummary.attendance_rate) || 0;
    return {
      thisMonth: thisTerm,
      thisTerm,
      recent: recentAttendance.slice(0, 5).map((item) => ({
        date: new Date(item.attendance_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        present: ["present", "late", "excused"].includes(item.status),
      })),
    };
  }, [attendanceSummary, recentAttendance]);

  const gradeRows = useMemo(() => {
    const grouped = academicRecords.reduce((acc, row) => {
      const key = row.subject || "Unspecified Subject";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(row);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([subjectName, rows]) => {
        const scoredRows = rows
          .map((row) => ({
            ...row,
            derivedScore: gradeToScore(row.grade, row.grade_points),
          }))
          .filter((row) => Number.isFinite(row.derivedScore));

        if (scoredRows.length === 0) {
          return {
            name: subjectName,
            currentGrade: rows[0]?.grade || "N/A",
            average: 0,
            trend: "flat",
          };
        }

        const orderedRows = [...scoredRows].sort((a, b) => {
          const yearDiff =
            getSchoolYearStart(a.school_year) - getSchoolYearStart(b.school_year);
          if (yearDiff !== 0) {
            return yearDiff;
          }
          return getTermRank(a.term) - getTermRank(b.term);
        });
        const current = orderedRows[orderedRows.length - 1];
        const previous = orderedRows.length > 1 ? orderedRows[orderedRows.length - 2] : null;
        const average = Math.round(
          orderedRows.reduce((sum, row) => sum + row.derivedScore, 0) /
            orderedRows.length,
        );

        return {
          name: subjectName,
          currentGrade: current.grade || scoreToLetter(current.derivedScore),
          average,
          trend:
            !previous || current.derivedScore === previous.derivedScore
              ? "flat"
              : current.derivedScore > previous.derivedScore
                ? "up"
                : "down",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [academicRecords]);

  const announcements = useMemo(() => {
    const items = [];
    const todayLabel = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    items.push({
      title: "Attendance Snapshot",
      message: `Current attendance rate is ${attendanceData.thisTerm}%.`,
      date: `Updated ${todayLabel}`,
    });

    items.push({
      title: "Academic Snapshot",
      message:
        gradeRows.length > 0
          ? `${gradeRows.length} subject record(s) are available in your profile.`
          : "No academic records are available yet.",
      date: `Updated ${todayLabel}`,
    });

    if (school?.description) {
      items.push({
        title: "School Notice",
        message: school.description,
        date: `From ${school.name}`,
      });
    }

    return items;
  }, [attendanceData.thisTerm, gradeRows.length, school]);

  const overallAverage = useMemo(() => {
    if (gradeRows.length === 0) {
      return null;
    }
    const value =
      gradeRows.reduce((sum, row) => sum + Number(row.average || 0), 0) /
      gradeRows.length;
    return Math.round(value);
  }, [gradeRows]);

  const attendanceHistory = useMemo(
    () =>
      [...recentAttendance].sort(
        (a, b) => new Date(b.attendance_date) - new Date(a.attendance_date),
      ),
    [recentAttendance],
  );

  const attendanceHeatmapDays = useMemo(() => {
    const byDate = new Map();
    attendanceHistory.forEach((row) => {
      const key = String(row.attendance_date || "");
      if (!byDate.has(key)) {
        byDate.set(key, String(row.status || "").toLowerCase());
      }
    });

    const today = new Date();
    const days = [];
    for (let offset = 27; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(date.getDate()).padStart(2, "0")}`;
      const status = byDate.get(dateKey) || null;
      days.push({
        dateKey,
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        status: ATTENDANCE_PRESENT_STATUSES.has(status)
          ? "present"
          : status === "absent"
            ? "absent"
            : "none",
        statusLabel: status
          ? status.charAt(0).toUpperCase() + status.slice(1)
          : "No record",
      });
    }

    return days;
  }, [attendanceHistory]);

  const subjectInsights = useMemo(() => {
    const validRows = gradeRows.filter((row) => Number(row.average) > 0);
    const topSubject = validRows.length
      ? [...validRows].sort((a, b) => b.average - a.average)[0]
      : null;
    const riskSubjects = validRows
      .filter((row) => row.average < 55)
      .sort((a, b) => a.average - b.average);
    const improvingCount = gradeRows.filter((row) => row.trend === "up").length;

    return { topSubject, riskSubjects, improvingCount };
  }, [gradeRows]);

  const profileCompletion = useMemo(() => {
    const checks = [
      { label: "First name", valid: Boolean(student?.first_name) },
      { label: "Last name", valid: Boolean(student?.last_name) },
      { label: "Student ID", valid: Boolean(student?.student_id) },
      { label: "Date of birth", valid: Boolean(student?.date_of_birth) },
      { label: "Gender", valid: Boolean(student?.gender) },
      { label: "Email", valid: Boolean(student?.email) },
      { label: "Phone", valid: Boolean(student?.phone) },
      { label: "Address", valid: Boolean(student?.address) },
      { label: "Grade level", valid: Boolean(student?.grade_level) },
      { label: "Class section", valid: Boolean(student?.class_section) },
      { label: "School", valid: Boolean(school?.name) },
      { label: "Enrollment date", valid: Boolean(student?.enrollment_date) },
    ];

    const completed = checks.filter((item) => item.valid).length;
    return {
      percentage: Math.round((completed / checks.length) * 100),
      missing: checks.filter((item) => !item.valid).map((item) => item.label),
    };
  }, [school?.name, student]);

  const upcomingActions = useMemo(() => {
    const actions = [];

    if (subjectInsights.riskSubjects.length > 0) {
      const risk = subjectInsights.riskSubjects[0];
      actions.push({
        id: "risk-subject",
        title: `Support needed in ${risk.name}`,
        description: `Current average is ${risk.average}%. Review this subject and work with your teacher.`,
        cta: "Open Grades",
        targetPath: "/student/grades",
        tone: "warning",
      });
    }

    if (attendanceData.thisTerm < 90) {
      actions.push({
        id: "attendance-recovery",
        title: "Attendance follow-up",
        description: `Current attendance is ${attendanceData.thisTerm}%. Aim for 90% or higher this term.`,
        cta: "View Attendance",
        targetPath: "/student/attendance",
        tone: "error",
      });
    }

    if (profileCompletion.missing.length > 0) {
      actions.push({
        id: "profile-completion",
        title: "Complete your profile",
        description: `${profileCompletion.missing.length} profile field(s) still need to be completed.`,
        cta: "Update Profile",
        targetPath: "/student/profile",
        tone: "info",
      });
    }

    actions.push({
      id: "updates-check",
      title: "Check school updates",
      description: "Review latest school notices and reminders from your dashboard.",
      cta: "Open Updates",
      targetPath: "/student/announcements",
      tone: "primary",
    });

    return actions.slice(0, 4);
  }, [attendanceData.thisTerm, profileCompletion.missing.length, subjectInsights.riskSubjects]);

  const termComparison = useMemo(() => {
    const gradeByTerm = new Map();
    academicRecords.forEach((row) => {
      const score = gradeToScore(row.grade, row.grade_points);
      if (!Number.isFinite(score)) return;
      const schoolYear = row.school_year || "Unknown Year";
      const term = row.term || "Term";
      const key = `${schoolYear}::${term}`;
      const existing = gradeByTerm.get(key) || { schoolYear, term, sum: 0, count: 0 };
      existing.sum += score;
      existing.count += 1;
      gradeByTerm.set(key, existing);
    });

    const attendanceByTerm = new Map();
    attendanceHistory.forEach((row) => {
      const bucket = deriveSchoolTermFromDate(row.attendance_date);
      if (!bucket) return;
      const key = `${bucket.schoolYear}::${bucket.term}`;
      const existing = attendanceByTerm.get(key) || {
        schoolYear: bucket.schoolYear,
        term: bucket.term,
        present: 0,
        total: 0,
      };
      existing.total += 1;
      if (ATTENDANCE_PRESENT_STATUSES.has(String(row.status || "").toLowerCase())) {
        existing.present += 1;
      }
      attendanceByTerm.set(key, existing);
    });

    const keys = Array.from(new Set([...gradeByTerm.keys(), ...attendanceByTerm.keys()]));
    const sorted = keys
      .map((key) => {
        const [schoolYear, term] = key.split("::");
        return { key, schoolYear, term };
      })
      .sort((a, b) => {
        const yearDiff = getSchoolYearStart(a.schoolYear) - getSchoolYearStart(b.schoolYear);
        if (yearDiff !== 0) return yearDiff;
        return getTermRank(a.term) - getTermRank(b.term);
      })
      .slice(-6);

    return {
      labels: sorted.map((row) => formatTermLabel(row.schoolYear, row.term)),
      gradeSeries: sorted.map((row) => {
        const item = gradeByTerm.get(row.key);
        return item && item.count > 0 ? Math.round(item.sum / item.count) : null;
      }),
      attendanceSeries: sorted.map((row) => {
        const item = attendanceByTerm.get(row.key);
        return item && item.total > 0 ? Math.round((item.present / item.total) * 100) : null;
      }),
    };
  }, [academicRecords, attendanceHistory]);

  const termComparisonChartData = useMemo(
    () => ({
      labels: termComparison.labels,
      datasets: [
        {
          label: "Grade average",
          data: termComparison.gradeSeries,
          borderColor: "#1d4ed8",
          backgroundColor: "rgba(29, 78, 216, 0.15)",
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: "Attendance rate",
          data: termComparison.attendanceSeries,
          borderColor: "#059669",
          backgroundColor: "rgba(5, 150, 105, 0.15)",
          tension: 0.28,
          spanGaps: true,
        },
      ],
    }),
    [termComparison],
  );

  const termComparisonChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: "Score / Rate (%)" },
        },
      },
    }),
    [],
  );

  const achievements = useMemo(() => {
    let attendanceStreak = 0;
    for (const row of attendanceHistory) {
      const status = String(row.status || "").toLowerCase();
      if (ATTENDANCE_PRESENT_STATUSES.has(status)) {
        attendanceStreak += 1;
      } else {
        break;
      }
    }

    const badges = [];
    if (attendanceStreak >= 5) {
      badges.push({
        key: "attendance-streak",
        label: `${attendanceStreak}-day attendance streak`,
        icon: <LocalFireDepartment fontSize="small" />,
        color: "warning",
      });
    }
    if (overallAverage !== null && overallAverage >= 80) {
      badges.push({
        key: "high-average",
        label: `High average (${overallAverage}%)`,
        icon: <EmojiEvents fontSize="small" />,
        color: "success",
      });
    }
    if (subjectInsights.improvingCount > 0) {
      badges.push({
        key: "improving-subjects",
        label: `${subjectInsights.improvingCount} improving subject(s)`,
        icon: <AutoGraph fontSize="small" />,
        color: "primary",
      });
    }
    if (profileCompletion.percentage === 100) {
      badges.push({
        key: "profile-complete",
        label: "Profile complete",
        icon: <CheckCircle fontSize="small" />,
        color: "info",
      });
    }
    if (badges.length === 0) {
      badges.push({
        key: "first-step",
        label: "Keep building your streaks",
        icon: <AutoGraph fontSize="small" />,
        color: "default",
      });
    }
    return badges;
  }, [
    attendanceHistory,
    overallAverage,
    profileCompletion.percentage,
    subjectInsights.improvingCount,
  ]);

  const handleTabNavigation = (targetPath) => {
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  const hasComparisonData =
    termComparison.labels.length > 0 &&
    (termComparison.gradeSeries.some((value) => value !== null) ||
      termComparison.attendanceSeries.some((value) => value !== null));

  const tabValue = STUDENT_PATH_TO_TAB[location.pathname] ?? 0;
  const activeTab = STUDENT_TAB_META[tabValue] || STUDENT_TAB_META[0];
  const tabBadges = useMemo(
    () => [
      student?.student_id ? `ID ${student.student_id}` : "Profile",
      `${attendanceData.thisTerm}% this term`,
      `${gradeRows.length} subject${gradeRows.length === 1 ? "" : "s"}`,
      `${announcements.length} update${announcements.length === 1 ? "" : "s"}`,
    ],
    [
      student?.student_id,
      attendanceData.thisTerm,
      gradeRows.length,
      announcements.length,
    ],
  );

  const handleTabChange = (_, nextTab) => {
    const targetPath = STUDENT_TAB_PATHS[nextTab] || "/student/profile";
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Student Portal
      </Typography>

      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Welcome back, {student?.first_name}. Manage your profile, attendance, grades, and updates.
      </Typography>

      <Paper
        sx={{
          p: 1.2,
          mb: 2,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(140deg, #f8fbff 0%, #eef4ff 100%)",
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            minHeight: 70,
            "& .MuiTabs-indicator": {
              height: "100%",
              borderRadius: 2,
              background:
                "linear-gradient(135deg, rgba(30, 64, 175, 0.2) 0%, rgba(14, 116, 144, 0.2) 100%)",
            },
          }}
        >
          {STUDENT_TAB_META.map((tab) => (
            <Tab
              key={tab.path}
              disableRipple
              icon={tab.icon}
              iconPosition="start"
              label={
                <Box sx={{ textAlign: "left", py: 0.3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {tab.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.1 }}>
                    {tab.caption}
                  </Typography>
                </Box>
              }
              sx={{
                textTransform: "none",
                minHeight: 68,
                alignItems: "flex-start",
                justifyContent: "center",
                borderRadius: 2,
                mr: 0.8,
                zIndex: 1,
              }}
            />
          ))}
        </Tabs>
      </Paper>

      <Paper
        sx={{
          p: { xs: 2, md: 2.4 },
          mb: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(128deg, #ffffff 0%, #f4f9ff 100%)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
              {activeTab.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {activeTab.description}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={tabBadges[tabValue]}
            color="primary"
            variant="outlined"
          />
        </Box>
      </Paper>

      {tabValue === 0 && (
        <Grid container spacing={3} sx={TAB_CONTENT_ANIMATION_SX}>
          <Grid item xs={12} md={4}>
            <StudentInfoCard student={student} school={school} />
          </Grid>

          <Grid item xs={12} md={8}>
            <Grid container spacing={2} sx={{ height: "100%" }}>
              <Grid item xs={12} sm={6}>
                <Card>
                  <CardContent sx={{ textAlign: "center" }}>
                    <CheckCircle
                      sx={{ fontSize: 40, color: "success.main", mb: 1 }}
                    />
                    <Typography variant="h4" color="success.main">
                      {attendanceData.thisMonth}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Attendance
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card>
                  <CardContent sx={{ textAlign: "center" }}>
                    <Grade sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
                    <Typography variant="h4" color="primary.main">
                      {overallAverage !== null ? scoreToLetter(overallAverage) : "N/A"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Overall Letter Grade
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <ProfileCompletionCard
                  profileCompletion={profileCompletion}
                  onOpenProfile={() => handleTabNavigation("/student/profile")}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} md={6}>
            <AttendanceHeatmapCard days={attendanceHeatmapDays} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Achievement Streaks
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
                  Milestones generated from your attendance and academic trends.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={0.8}>
                  {achievements.map((badge) => (
                    <Chip
                      key={badge.key}
                      icon={badge.icon}
                      label={badge.label}
                      color={badge.color}
                      variant={badge.color === "default" ? "outlined" : "filled"}
                    />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <AnnouncementsCard announcements={announcements} />
          </Grid>
          <Grid item xs={12} md={6}>
            <AttendanceCard attendanceData={attendanceData} />
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <Grid container spacing={3} sx={TAB_CONTENT_ANIMATION_SX}>
          <Grid item xs={12} md={8}>
            <AttendanceCard attendanceData={attendanceData} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Attendance Summary
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total tracked school days: {attendanceSummary.total_days || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current attendance rate: {attendanceData.thisTerm}%
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Current streak:{" "}
                <strong>
                  {achievements.find((item) => item.key === "attendance-streak")
                    ? achievements.find((item) => item.key === "attendance-streak")?.label
                    : "No active streak"}
                </strong>
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleTabNavigation("/student/announcements")}
              >
                View Actions
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <AttendanceHeatmapCard days={attendanceHeatmapDays} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Term Performance Trend
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.6 }}>
                  Comparison of attendance and grade averages across recent terms.
                </Typography>
                <Box sx={{ height: 260 }}>
                  {hasComparisonData ? (
                    <Line
                      data={termComparisonChartData}
                      options={termComparisonChartOptions}
                    />
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
                        Trend data appears once more records are available.
                      </Typography>
                    </Paper>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 2 && (
        <Grid container spacing={3} sx={TAB_CONTENT_ANIMATION_SX}>
          <Grid item xs={12} md={8}>
            <GradesCard grades={gradeRows} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Academic Progress
              </Typography>
              {overallAverage === null ? (
                <Typography variant="body2" color="text.secondary">
                  No graded records are available yet.
                </Typography>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Average score: {overallAverage}%
                  </Typography>
                  <Chip
                    sx={{ mt: 1 }}
                    color="primary"
                    label={`Overall: ${scoreToLetter(overallAverage)}`}
                  />
                  {subjectInsights.topSubject && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.1 }}>
                      Top subject:{" "}
                      <strong>
                        {subjectInsights.topSubject.name} ({subjectInsights.topSubject.average}
                        %)
                      </strong>
                    </Typography>
                  )}
                  {subjectInsights.riskSubjects.length > 0 && (
                    <Box sx={{ mt: 1.2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.6 }}>
                        Subjects at risk
                      </Typography>
                      <Stack direction="row" spacing={0.8} flexWrap="wrap" rowGap={0.8}>
                        {subjectInsights.riskSubjects.slice(0, 3).map((subject) => (
                          <Chip
                            key={subject.name}
                            size="small"
                            color="warning"
                            label={`${subject.name} (${subject.average}%)`}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Term-over-Term Comparison
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.6 }}>
                  Track how your overall grades and attendance move over time.
                </Typography>
                <Box sx={{ height: 290 }}>
                  {hasComparisonData ? (
                    <Line
                      data={termComparisonChartData}
                      options={termComparisonChartOptions}
                    />
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
                        Not enough historical records for comparison yet.
                      </Typography>
                    </Paper>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 3 && (
        <Grid container spacing={3} sx={TAB_CONTENT_ANIMATION_SX}>
          <Grid item xs={12} md={7}>
            <AnnouncementsCard announcements={announcements} />
          </Grid>
          <Grid item xs={12} md={5}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Action Center
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Every action below takes you directly to the tab where you can address it.
                </Typography>

                <Stack spacing={1.2}>
                  {upcomingActions.map((action) => {
                    const actionColor =
                      action.tone === "error"
                        ? "error.main"
                        : action.tone === "warning"
                          ? "warning.main"
                          : action.tone === "info"
                            ? "info.main"
                            : "primary.main";

                    return (
                      <Paper
                        key={action.id}
                        sx={{
                          p: 1.5,
                          border: "1px solid",
                          borderColor: "divider",
                          borderLeftWidth: 4,
                          borderLeftColor: actionColor,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {action.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {action.description}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleTabNavigation(action.targetPath)}
                        >
                          {action.cta}
                        </Button>
                      </Paper>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default StudentDashboard;
