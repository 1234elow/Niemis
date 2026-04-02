import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
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
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Avatar,
  Divider,
  InputAdornment,
} from "@mui/material";
import {
  Close,
  Save,
  Person,
  Grade as GradeIcon,
  Assessment,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  DeleteOutline,
} from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { apiService } from "../services/apiService";
import {
  CARIBBEAN_GRADE_LOOKUP,
  CARIBBEAN_GRADE_SCALE,
  getCaribbeanGradeColor,
  getCaribbeanGradeFromScore,
} from "../constants/caribbeanGradeScale";

const GRADE_TYPES = [
  { value: "quiz", label: "Quiz", color: "info" },
  { value: "test", label: "Test", color: "primary" },
  { value: "assignment", label: "Assignment", color: "secondary" },
  { value: "midterm", label: "Mid-Term", color: "warning" },
  { value: "final", label: "Final Exam", color: "error" },
  { value: "project", label: "Project", color: "success" },
];

const PERFORMANCE_BAND_OPTIONS = ["GENERAL", "A", "B", "C", "D", "F"];

const GradeEntryForm = ({
  open,
  onClose,
  classData,
  onSuccess,
  focusStudentId = null,
}) => {
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [gradeType, setGradeType] = useState("quiz");
  const [assessmentName, setAssessmentName] = useState("");
  const [maxPoints, setMaxPoints] = useState(100);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [grades, setGrades] = useState({});
  const [errors, setErrors] = useState({});
  const [notes, setNotes] = useState("");
  const [gradingPolicyInfo, setGradingPolicyInfo] = useState(null);
  const [commentTemplates, setCommentTemplates] = useState([]);
  const [commentTemplatesLoading, setCommentTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateLabel, setTemplateLabel] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBand, setTemplateBand] = useState("GENERAL");

  useEffect(() => {
    if (open && classData) {
      loadStudents();
      loadGradingPolicy();
      loadCommentBank();
    } else {
      resetForm();
    }
  }, [open, classData]);

  const loadStudents = async () => {
    try {
      setStudentsLoading(true);
      const response = await apiService.getTeacherStudents(classData.id);
      const studentList = response.students || [];
      
      setStudents(studentList);
      
      // Initialize grades object with empty scores
      const initialGrades = {};
      studentList.forEach(student => {
        initialGrades[student.id] = {
          score: "",
          letter: "",
          notes: "",
          excused: false,
        };
      });
      setGrades(initialGrades);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Failed to load students");
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadGradingPolicy = async () => {
    if (!classData?.id) return;
    try {
      const response = await apiService.getTeacherGradingPolicy({
        class_id: classData.id,
      });
      setGradingPolicyInfo(response?.selected_class?.policy || null);
    } catch (error) {
      console.warn("Failed to load grading policy for class:", error?.message);
      setGradingPolicyInfo(null);
    }
  };

  const resetForm = () => {
    setGradeType("quiz");
    setAssessmentName("");
    setMaxPoints(100);
    setDueDate(new Date().toISOString().split("T")[0]);
    setGrades({});
    setErrors({});
    setNotes("");
    setStudents([]);
    setGradingPolicyInfo(null);
    setCommentTemplates([]);
    setCommentTemplatesLoading(false);
    setSelectedTemplateId("");
    setTemplateLabel("");
    setTemplateSubject("");
    setTemplateBand("GENERAL");
  };

  const loadCommentBank = async () => {
    try {
      setCommentTemplatesLoading(true);
      const response = await apiService.getTeacherCommentBank();
      setCommentTemplates(response?.templates || []);
    } catch (error) {
      console.error("Error loading comment templates:", error);
      setCommentTemplates([]);
    } finally {
      setCommentTemplatesLoading(false);
    }
  };

  const selectedTemplate = commentTemplates.find(
    (item) => String(item.id) === String(selectedTemplateId),
  );

  const handleSaveCommentTemplate = async () => {
    const label = templateLabel.trim();
    const commentText = notes.trim();
    if (!label) {
      toast.error("Template label is required.");
      return;
    }
    if (!commentText) {
      toast.error("Add assessment notes first, then save as template.");
      return;
    }

    try {
      await apiService.saveTeacherCommentTemplate({
        label,
        comment_text: commentText,
        subject: templateSubject.trim() || classData?.name || null,
        performance_band: templateBand,
      });
      toast.success("Comment template saved.");
      setTemplateLabel("");
      await loadCommentBank();
    } catch (error) {
      console.error("Error saving comment template:", error);
      toast.error("Failed to save comment template.");
    }
  };

  const handleDeleteCommentTemplate = async (templateId) => {
    try {
      await apiService.deleteTeacherCommentTemplate(templateId);
      toast.success("Comment template removed.");
      if (String(selectedTemplateId) === String(templateId)) {
        setSelectedTemplateId("");
      }
      await loadCommentBank();
    } catch (error) {
      console.error("Error deleting comment template:", error);
      toast.error("Failed to remove comment template.");
    }
  };

  const applyTemplateToStudent = (studentId) => {
    if (!selectedTemplate) {
      toast.error("Select a comment template first.");
      return;
    }
    setGrades((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes: selectedTemplate.comment_text || "",
      },
    }));
  };

  const calculateLetterGrade = (score, maxPoints) => {
    if (
      score === null ||
      score === undefined ||
      score === "" ||
      !maxPoints ||
      maxPoints <= 0
    ) {
      return "";
    }
    
    const percentage = (parseFloat(score) / parseFloat(maxPoints)) * 100;
    return getCaribbeanGradeFromScore(percentage);
  };

  const getGradeDescription = (score, maxPoints) => {
    if (
      score === null ||
      score === undefined ||
      score === "" ||
      !maxPoints ||
      maxPoints <= 0
    ) {
      return "";
    }
    
    const percentage = (parseFloat(score) / parseFloat(maxPoints)) * 100;
    const letterGrade = getCaribbeanGradeFromScore(percentage);
    return CARIBBEAN_GRADE_LOOKUP[letterGrade]?.label || "";
  };

  const getGradeColor = (letterGrade) => {
    return getCaribbeanGradeColor(letterGrade);
  };

  const handleScoreChange = (studentId, score) => {
    const numericScore = score === "" ? "" : parseFloat(score);
    const letterGrade = calculateLetterGrade(numericScore, maxPoints);
    
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        score: score,
        letter: letterGrade,
      },
    }));

    // Clear error for this student
    if (errors[studentId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[studentId];
        return newErrors;
      });
    }
  };

  const handleNotesChange = (studentId, notes) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes: notes,
      },
    }));
  };

  const toggleExcused = (studentId) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        excused: !prev[studentId].excused,
        score: !prev[studentId].excused ? "" : prev[studentId].score,
        letter: !prev[studentId].excused ? "" : prev[studentId].letter,
      },
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!assessmentName.trim()) {
      newErrors.assessmentName = "Assessment name is required";
    }

    if (!maxPoints || maxPoints <= 0) {
      newErrors.maxPoints = "Max points must be greater than 0";
    }

    // Check for students with scores
    const studentsWithGrades = students.filter(student => {
      const grade = grades[student.id];
      return !grade.excused && grade.score !== "";
    });

    if (studentsWithGrades.length === 0) {
      newErrors.general = "Please enter at least one grade or mark students as excused";
    }

    // Validate individual scores
    students.forEach(student => {
      const grade = grades[student.id];
      if (!grade.excused && grade.score !== "") {
        const score = parseFloat(grade.score);
        if (isNaN(score) || score < 0 || score > maxPoints) {
          newErrors[student.id] = `Score must be between 0 and ${maxPoints}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please correct the errors before submitting");
      return;
    }

    try {
      setLoading(true);

      // Prepare grades data for API
      const gradesData = students.map(student => {
        const grade = grades[student.id];
        return {
          student_id: student.id,
          score: grade.excused ? null : parseFloat(grade.score) || null,
          letter_grade: grade.excused ? null : grade.letter,
          excused: grade.excused,
          notes: grade.notes || null,
        };
      }).filter(grade => grade.score !== null || grade.excused);

      const payload = {
        assessment_name: assessmentName.trim(),
        assessment_type: gradeType,
        max_points: parseFloat(maxPoints),
        due_date: dueDate,
        notes: notes.trim() || null,
        grades: gradesData,
      };

      await apiService.enterGrades(classData.id, payload);
      
      toast.success(`Grades entered successfully for ${gradesData.length} students`);
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      console.error("Error entering grades:", error);
      toast.error("Failed to enter grades. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSelectedGradeType = () => {
    return GRADE_TYPES.find(type => type.value === gradeType);
  };

  const completedGrades = students.filter(student => {
    const grade = grades[student.id];
    return grade && (grade.excused || (grade.score !== "" && !errors[student.id]));
  }).length;

  const focusedStudent = focusStudentId
    ? students.find((student) => String(student.id) === String(focusStudentId))
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: "80vh" }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h6" component="div">
              Enter Grades - {classData?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {classData?.grade_level} • Section {classData?.section}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
        
        {/* Progress indicator */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Progress: {completedGrades} of {students.length} students
          </Typography>
          <Box sx={{ width: "100%", backgroundColor: "grey.200", borderRadius: 1, height: 4, mt: 1 }}>
            <Box
              sx={{
                width: students.length > 0 ? `${(completedGrades / students.length) * 100}%` : "0%",
                backgroundColor: "success.main",
                height: "100%",
                borderRadius: 1,
                transition: "width 0.3s",
              }}
            />
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        {studentsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {gradingPolicyInfo && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Term score weighting for this class: Continuous Assessment{" "}
                <strong>
                  {Number(gradingPolicyInfo.continuous_assessment_weight || 0).toFixed(0)}%
                </strong>{" "}
                and End-Term Exam{" "}
                <strong>
                  {Number(gradingPolicyInfo.end_term_exam_weight || 0).toFixed(0)}%
                </strong>
                .
              </Alert>
            )}

            {/* Assessment Setup */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                <Assessment sx={{ mr: 1 }} />
                Assessment Details
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Assessment Name"
                    value={assessmentName}
                    onChange={(e) => setAssessmentName(e.target.value)}
                    error={!!errors.assessmentName}
                    helperText={errors.assessmentName}
                    placeholder="e.g., Quiz 1, Midterm Exam, Project Assignment"
                  />
                </Grid>
                
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Assessment Type</InputLabel>
                    <Select
                      value={gradeType}
                      onChange={(e) => setGradeType(e.target.value)}
                      label="Assessment Type"
                    >
                      {GRADE_TYPES.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Chip
                              label={type.label}
                              color={type.color}
                              size="small"
                              sx={{ mr: 1 }}
                            />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Max Points"
                    type="number"
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(e.target.value)}
                    error={!!errors.maxPoints}
                    helperText={errors.maxPoints}
                    inputProps={{ min: 1, max: 1000 }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Due Date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Notes (Optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this assessment"
                  />
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Report Comment Bank
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Save reusable comment templates by subject and performance band, then insert
                them quickly into student notes.
              </Typography>

              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Template</InputLabel>
                    <Select
                      value={selectedTemplateId}
                      label="Template"
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                      disabled={commentTemplatesLoading}
                    >
                      <MenuItem value="">
                        <em>Select template</em>
                      </MenuItem>
                      {commentTemplates.map((template) => (
                        <MenuItem key={template.id} value={template.id}>
                          {template.label} ({template.performance_band || "GENERAL"})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Template Label"
                    value={templateLabel}
                    onChange={(event) => setTemplateLabel(event.target.value)}
                    placeholder="e.g., Steady Progress"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Subject"
                    value={templateSubject}
                    onChange={(event) => setTemplateSubject(event.target.value)}
                    placeholder="Mathematics"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Band</InputLabel>
                    <Select
                      value={templateBand}
                      label="Band"
                      onChange={(event) => setTemplateBand(event.target.value)}
                    >
                      {PERFORMANCE_BAND_OPTIONS.map((band) => (
                        <MenuItem key={band} value={band}>
                          {band}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleSaveCommentTemplate}
                    disabled={commentTemplatesLoading}
                  >
                    Save
                  </Button>
                </Grid>
              </Grid>

              {selectedTemplate && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {selectedTemplate.comment_text}
                </Alert>
              )}
            </Paper>

            {errors.general && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {errors.general}
              </Alert>
            )}

            {focusedStudent && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Focus student: {focusedStudent.first_name} {focusedStudent.last_name} (
                {focusedStudent.student_id})
              </Alert>
            )}

            {/* Grades Entry Table */}
            <Paper sx={{ overflow: "hidden" }}>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell align="center">Score (/{maxPoints})</TableCell>
                      <TableCell align="center">Letter Grade</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {students.map((student) => {
                      const grade = grades[student.id] || {};
                      const hasError = !!errors[student.id];
                      const letterGrade = grade.letter || "";
                      const isExcused = grade.excused;
                      
                      return (
                        <TableRow 
                          key={student.id}
                          sx={{ 
                            backgroundColor:
                              String(student.id) === String(focusStudentId)
                                ? "rgba(25, 118, 210, 0.08)"
                                : isExcused
                                  ? "action.hover"
                                  : "inherit",
                            opacity: isExcused ? 0.7 : 1,
                            outline:
                              String(student.id) === String(focusStudentId)
                                ? "1px solid rgba(25, 118, 210, 0.35)"
                                : "none",
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                              <Avatar sx={{ mr: 2, bgcolor: "primary.main" }}>
                                {(student.first_name?.[0] || "S").toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {student.first_name} {student.last_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {student.student_id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="number"
                              value={isExcused ? "" : grade.score || ""}
                              onChange={(e) => handleScoreChange(student.id, e.target.value)}
                              disabled={isExcused}
                              autoFocus={String(student.id) === String(focusStudentId)}
                              error={hasError}
                              helperText={hasError ? errors[student.id] : ""}
                              inputProps={{ 
                                min: 0, 
                                max: maxPoints,
                                step: 0.5,
                                style: { textAlign: "center" }
                              }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          
                          <TableCell align="center">
                            {letterGrade && !isExcused ? (
                              <Chip
                                label={letterGrade}
                                color={getGradeColor(letterGrade)}
                                size="small"
                                sx={{ minWidth: 40 }}
                              />
                            ) : isExcused ? (
                              <Chip
                                label="EXCUSED"
                                color="default"
                                size="small"
                                variant="outlined"
                              />
                            ) : null}
                          </TableCell>
                          
                          <TableCell>
                            <Box sx={{ minWidth: 190 }}>
                              <TextField
                                size="small"
                                multiline
                                rows={1}
                                value={grade.notes || ""}
                                onChange={(e) => handleNotesChange(student.id, e.target.value)}
                                placeholder="Optional notes..."
                                fullWidth
                              />
                              <Box sx={{ mt: 0.8, display: "flex", gap: 0.8, flexWrap: "wrap" }}>
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => applyTemplateToStudent(student.id)}
                                  disabled={!selectedTemplate}
                                >
                                  Use template
                                </Button>
                                {selectedTemplate && (
                                  <IconButton
                                    size="small"
                                    aria-label="delete template"
                                    onClick={() => handleDeleteCommentTemplate(selectedTemplate.id)}
                                  >
                                    <DeleteOutline fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant={isExcused ? "contained" : "outlined"}
                              color={isExcused ? "default" : "warning"}
                              onClick={() => toggleExcused(student.id)}
                              sx={{ minWidth: 80 }}
                            >
                              {isExcused ? "Undo" : "Excuse"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Grade Scale Reference */}
            <Paper sx={{ p: 2, mt: 3, backgroundColor: "grey.50" }}>
              <Typography variant="subtitle2" gutterBottom>
                Grading Scale Reference:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {CARIBBEAN_GRADE_SCALE.map((scale) => (
                  <Chip
                    key={scale.letter}
                    label={`${scale.letter}: ${scale.min}%-${scale.max}% (${scale.label})`}
                    color={getGradeColor(scale.letter)}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Paper>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || studentsLoading}
          startIcon={loading ? <CircularProgress size={20} /> : <Save />}
        >
          {loading ? "Saving..." : "Save Grades"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GradeEntryForm;
