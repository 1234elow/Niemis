import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Collapse,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  Avatar,
  Tooltip,
} from "@mui/material";
import {
  Close,
  ExpandMore,
  ExpandLess,
  School,
  Grade as GradeIcon,
  Assessment,
  TrendingUp,
  Person,
  CalendarToday,
  Subject,
  CheckCircle,
  Warning,
} from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { apiService } from "../services/apiService";

const STANDARD_GRADES = {
  "A+": {
    label: "A Plus",
    color: "success",
    description: "97-100%",
    fullDescription: "Exceptional performance exceeding all expectations",
  },
  A: {
    label: "A",
    color: "success",
    description: "93-96%",
    fullDescription:
      "Outstanding performance demonstrating mastery of all concepts",
  },
  "A-": {
    label: "A Minus",
    color: "success",
    description: "90-92%",
    fullDescription: "Excellent performance with minor areas for refinement",
  },
  "B+": {
    label: "B Plus",
    color: "info",
    description: "87-89%",
    fullDescription: "Very good performance showing strong understanding",
  },
  B: {
    label: "B",
    color: "info",
    description: "83-86%",
    fullDescription: "Good performance with solid grasp of concepts",
  },
  "B-": {
    label: "B Minus",
    color: "info",
    description: "80-82%",
    fullDescription: "Above average performance with room for improvement",
  },
  "C+": {
    label: "C Plus",
    color: "warning",
    description: "77-79%",
    fullDescription: "Satisfactory performance meeting most requirements",
  },
  C: {
    label: "C",
    color: "warning",
    description: "73-76%",
    fullDescription: "Average performance meeting basic requirements",
  },
  "C-": {
    label: "C Minus",
    color: "warning",
    description: "70-72%",
    fullDescription: "Below average but acceptable performance",
  },
  "D+": {
    label: "D Plus",
    color: "error",
    description: "67-69%",
    fullDescription: "Poor performance requiring additional support",
  },
  D: {
    label: "D",
    color: "error",
    description: "65-66%",
    fullDescription: "Minimal passing performance with significant gaps",
  },
  "D-": {
    label: "D Minus",
    color: "error",
    description: "60-64%",
    fullDescription:
      "Barely passing performance needing immediate intervention",
  },
  F: {
    label: "F",
    color: "error",
    description: "0-59%",
    fullDescription: "Failing performance requiring comprehensive remediation",
  },
};

const GradeViewingModal = ({ open, onClose, classData }) => {
  const [loading, setLoading] = useState(false);
  const [gradesData, setGradesData] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [expandedStudents, setExpandedStudents] = useState({});

  useEffect(() => {
    if (open && classData) {
      loadClassGrades();
    } else {
      resetData();
    }
  }, [open, classData, selectedTerm, selectedSubject]);

  const resetData = () => {
    setGradesData(null);
    setSelectedTerm("");
    setSelectedSubject("");
    setExpandedStudents({});
  };

  const loadClassGrades = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (selectedTerm) filters.term_id = selectedTerm;
      if (selectedSubject) filters.subject_id = selectedSubject;

      const response = await apiService.getClassGrades(classData.id, filters);
      setGradesData(response);

      // Set default term if none selected
      if (!selectedTerm && response.current_term) {
        setSelectedTerm(response.current_term.id);
      }
    } catch (error) {
      console.error("Error loading class grades:", error);
      toast.error("Failed to load class grades");
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentExpanded = (studentId) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getGradeColor = (gradeValue) => {
    return STANDARD_GRADES[gradeValue]?.color || "default";
  };

  const getGradeTooltip = (gradeValue) => {
    const grade = STANDARD_GRADES[gradeValue];
    if (!grade) return "";
    return `${grade.label} (${grade.description}): ${grade.fullDescription}`;
  };

  const calculateStudentAverage = (grades) => {
    if (grades.length === 0) return null;
    const sum = grades.reduce(
      (acc, grade) => acc + (grade.numeric_score || 0),
      0,
    );
    const average = sum / grades.length;

    // Convert to standard A-F grade
    if (average >= 97) return { numeric: average, letter: "A+" };
    if (average >= 93) return { numeric: average, letter: "A" };
    if (average >= 90) return { numeric: average, letter: "A-" };
    if (average >= 87) return { numeric: average, letter: "B+" };
    if (average >= 83) return { numeric: average, letter: "B" };
    if (average >= 80) return { numeric: average, letter: "B-" };
    if (average >= 77) return { numeric: average, letter: "C+" };
    if (average >= 73) return { numeric: average, letter: "C" };
    if (average >= 70) return { numeric: average, letter: "C-" };
    if (average >= 67) return { numeric: average, letter: "D+" };
    if (average >= 65) return { numeric: average, letter: "D" };
    if (average >= 60) return { numeric: average, letter: "D-" };
    return { numeric: average, letter: "F" };
  };

  if (!gradesData && !loading) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { minHeight: "80vh" },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography
              variant="h6"
              component="div"
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <GradeIcon color="primary" />
              Class Grades - {classData?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {classData?.grade_level} • Section {classData?.section}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : gradesData ? (
          <>
            {/* Filters */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Assessment />
                  Grade Filters
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Academic Term</InputLabel>
                      <Select
                        value={selectedTerm}
                        onChange={(e) => setSelectedTerm(e.target.value)}
                        label="Academic Term"
                      >
                        <MenuItem value="">All Terms</MenuItem>
                        {gradesData.available_terms?.map((term) => (
                          <MenuItem key={term.id} value={term.id}>
                            {term.name} {term.school_year}{" "}
                            {term.is_current && "(Current)"}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Subject</InputLabel>
                      <Select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        label="Subject"
                      >
                        <MenuItem value="">All Subjects</MenuItem>
                        {gradesData.available_subjects?.map((subject) => (
                          <MenuItem key={subject.id} value={subject.id}>
                            {subject.name} ({subject.code})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Standard A-F Grading Scale Explanation */}
            <Card sx={{ mb: 3, bgcolor: "background.paper" }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <School />
                  Standard A-F Grading Scale
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Understanding the letter grades with plus/minus modifiers:
                </Typography>
                <Grid container spacing={1}>
                  {Object.entries(STANDARD_GRADES).map(([letter, info]) => (
                    <Grid item xs={6} sm={4} md={3} lg={2} key={letter}>
                      <Box
                        sx={{
                          p: 1.5,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                          textAlign: "center",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.5,
                        }}
                      >
                        <Chip
                          label={letter}
                          color={info.color}
                          size="small"
                          sx={{ fontWeight: "bold", fontSize: "0.9rem" }}
                        />
                        <Typography variant="caption" fontWeight="medium">
                          {info.label}
                        </Typography>
                        <Typography variant="caption" color="primary">
                          {info.description}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Note:</strong> This standard A-F grading scale
                    includes plus (+) and minus (-) modifiers for more precise
                    evaluation. Grades below D- (60%) indicate failing
                    performance requiring immediate intervention and
                    remediation.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: "center" }}>
                    <Typography variant="h4" color="primary">
                      {gradesData.total_students_with_grades}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Students with Grades
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: "center" }}>
                    <Typography variant="h4" color="secondary">
                      {gradesData.total_grade_entries}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Grade Entries
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: "center" }}>
                    <Typography variant="h4" color="success.main">
                      {gradesData.current_term?.name || "N/A"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Current Term
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: "center" }}>
                    <Typography variant="h4" color="info.main">
                      {gradesData.available_subjects?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Available Subjects
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Grades Table */}
            {gradesData.grades_by_student &&
            gradesData.grades_by_student.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell align="center">Total Grades</TableCell>
                      <TableCell align="center">Average</TableCell>
                      <TableCell align="center">Recent Grade</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {gradesData.grades_by_student.map((studentData) => {
                      const { student, grades } = studentData;
                      const average = calculateStudentAverage(grades);
                      const recentGrade = grades[0]; // Grades are ordered by date_entered DESC

                      return (
                        <React.Fragment key={student.id}>
                          <TableRow>
                            <TableCell>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <Avatar sx={{ width: 32, height: 32 }}>
                                  <Person />
                                </Avatar>
                                <Box>
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                  >
                                    {student.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    ID: {student.student_id}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={grades.length}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="center">
                              {average ? (
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    justifyContent: "center",
                                  }}
                                >
                                  <Tooltip
                                    title={getGradeTooltip(average.letter)}
                                    arrow
                                  >
                                    <Chip
                                      label={average.letter}
                                      color={getGradeColor(average.letter)}
                                      size="small"
                                    />
                                  </Tooltip>
                                  <Typography variant="caption">
                                    {average.numeric.toFixed(1)}%
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  No grades
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {recentGrade ? (
                                <Box>
                                  <Tooltip
                                    title={getGradeTooltip(
                                      recentGrade.grade_value,
                                    )}
                                    arrow
                                  >
                                    <Chip
                                      label={`${recentGrade.grade_value} (${recentGrade.numeric_score}%)`}
                                      color={getGradeColor(
                                        recentGrade.grade_value,
                                      )}
                                      size="small"
                                    />
                                  </Tooltip>
                                  <Typography variant="caption" display="block">
                                    {formatDate(recentGrade.date_entered)}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  No grades
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                onClick={() =>
                                  toggleStudentExpanded(student.id)
                                }
                                size="small"
                              >
                                {expandedStudents[student.id] ? (
                                  <ExpandLess />
                                ) : (
                                  <ExpandMore />
                                )}
                              </IconButton>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Grade Details */}
                          <TableRow>
                            <TableCell colSpan={5} sx={{ py: 0 }}>
                              <Collapse
                                in={expandedStudents[student.id]}
                                timeout="auto"
                                unmountOnExit
                              >
                                <Box sx={{ margin: 1 }}>
                                  <Typography variant="h6" gutterBottom>
                                    Grade History for {student.name}
                                  </Typography>
                                  {grades.length > 0 ? (
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Subject</TableCell>
                                          <TableCell>Assessment</TableCell>
                                          <TableCell>Grade</TableCell>
                                          <TableCell>Score</TableCell>
                                          <TableCell>Effort</TableCell>
                                          <TableCell>Behavior</TableCell>
                                          <TableCell>Date</TableCell>
                                          <TableCell>Comments</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {grades.map((grade) => (
                                          <TableRow key={grade.id}>
                                            <TableCell>
                                              <Chip
                                                label={
                                                  grade.subject?.code || "N/A"
                                                }
                                                size="small"
                                                variant="outlined"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Box>
                                                <Typography
                                                  variant="body2"
                                                  fontWeight="medium"
                                                >
                                                  {grade.assessment_components
                                                    ?.assessment_name || "N/A"}
                                                </Typography>
                                                <Typography
                                                  variant="caption"
                                                  color="text.secondary"
                                                >
                                                  {grade.assessment_components
                                                    ?.assessment_type || ""}
                                                </Typography>
                                              </Box>
                                            </TableCell>
                                            <TableCell>
                                              <Tooltip
                                                title={getGradeTooltip(
                                                  grade.grade_value,
                                                )}
                                                arrow
                                              >
                                                <Chip
                                                  label={grade.grade_value}
                                                  color={getGradeColor(
                                                    grade.grade_value,
                                                  )}
                                                  size="small"
                                                />
                                              </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                              {grade.numeric_score}%
                                            </TableCell>
                                            <TableCell>
                                              <Tooltip
                                                title={getGradeTooltip(
                                                  grade.effort_grade,
                                                )}
                                                arrow
                                              >
                                                <Chip
                                                  label={grade.effort_grade}
                                                  color={getGradeColor(
                                                    grade.effort_grade,
                                                  )}
                                                  size="small"
                                                  variant="outlined"
                                                />
                                              </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                              <Tooltip
                                                title={getGradeTooltip(
                                                  grade.behavior_grade,
                                                )}
                                                arrow
                                              >
                                                <Chip
                                                  label={grade.behavior_grade}
                                                  color={getGradeColor(
                                                    grade.behavior_grade,
                                                  )}
                                                  size="small"
                                                  variant="outlined"
                                                />
                                              </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                              <Typography variant="body2">
                                                {formatDate(grade.date_entered)}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Typography
                                                variant="body2"
                                                sx={{ maxWidth: 200 }}
                                              >
                                                {grade.teacher_comments ||
                                                  "No comments"}
                                              </Typography>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <Alert severity="info">
                                      No grades recorded for this student yet.
                                    </Alert>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                No grades found for the selected filters. Try adjusting the term
                or subject filters, or enter some grades first.
              </Alert>
            )}
          </>
        ) : (
          <Alert severity="warning">
            No grade data available for this class.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GradeViewingModal;
