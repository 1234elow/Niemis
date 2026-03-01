import React, { forwardRef } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Chip,
} from "@mui/material";
import { getCaribbeanGradeFromScore } from "../constants/caribbeanGradeScale";

// Modern color scheme
const themeColors = {
  primary: "#1565C0", // Deep blue
  primaryDark: "#0D47A1", // Darker blue
  primaryLight: "#E3F2FD", // Light blue background
  secondary: "#00897B", // Teal accent
  headerBg: "linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)",
  sectionBg: "#FAFAFA",
  border: "#E0E0E0", // Softer gray borders
  borderMedium: "#BDBDBD",
  text: "#212121",
  textSecondary: "#616161",
};

// Format date as DD/MM/YYYY
const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
};

// Map effort grade to simplified code (A/B/C/D)
const mapEffortCode = (effort) => {
  if (!effort) return "-";
  const upper = effort.toUpperCase();
  if (upper.startsWith("A") || upper === "1") return "A";
  if (upper.startsWith("B") || upper === "2") return "B";
  if (upper.startsWith("C") || upper === "3") return "C";
  if (upper.startsWith("D") || upper === "4") return "D";
  return effort;
};

const resolveFinalGrade = (gradeRow) => {
  if (!gradeRow) return "-";
  if (gradeRow.grade_value) return gradeRow.grade_value;
  const fromScore = getCaribbeanGradeFromScore(gradeRow.numeric_score);
  return fromScore || "-";
};

// Get MUI color for grade chips
const getGradeColor = (grade) => {
  if (!grade || grade === "-") return "default";
  const upper = grade.toUpperCase();
  if (upper.startsWith("A") || upper === "1") return "success"; // Green
  if (upper.startsWith("B") || upper === "2") return "info"; // Blue
  if (upper.startsWith("C") || upper === "3") return "warning"; // Yellow/Orange
  return "error"; // Red for D/F
};

// Common cell style for bordered tables
const cellStyle = {
  border: `1px solid ${themeColors.border}`,
  padding: "6px 10px",
  fontSize: "0.85rem",
  color: themeColors.text,
};

const headerCellStyle = {
  border: `1px solid ${themeColors.borderMedium}`,
  padding: "8px 10px",
  fontWeight: "bold",
  background: themeColors.headerBg,
  color: "#fff",
  fontSize: "0.85rem",
};

const StudentReportCard = forwardRef(({ data, printMode = false }, ref) => {
  if (!data) return null;

  const { student, term, grades, attendance, averages, classStats } = data;
  const school = student?.School;

  // Calculate Term Avg from mid-term scores (T1-MID = classwork from assessment_components)
  const midTermScores =
    grades
      ?.filter((g) => g.assessment_components?.classwork != null)
      .map((g) => Number(g.assessment_components.classwork)) || [];
  const termAvg =
    midTermScores.length > 0
      ? Math.round(
          (midTermScores.reduce((a, b) => a + b, 0) / midTermScores.length) *
            10,
        ) / 10
      : Number.isFinite(Number(averages?.overall_average))
        ? Number(averages.overall_average)
        : "-";

  // Calculate Exam Avg from end-term scores (T1-END = numeric_score)
  const endTermScores =
    grades
      ?.filter((g) => g.numeric_score != null)
      .map((g) => Number(g.numeric_score)) || [];
  const examAvg =
    endTermScores.length > 0
      ? Math.round(
          (endTermScores.reduce((a, b) => a + b, 0) / endTermScores.length) *
            10,
        ) / 10
      : Number.isFinite(Number(averages?.overall_average))
        ? Number(averages.overall_average)
        : "-";

  const overallGrade = averages?.overall_grade || "-";

  // Get class gender counts (from classStats if available)
  const totalMales = classStats?.males || "-";
  const totalFemales = classStats?.females || "-";

  // Format year/term display
  const yearTermDisplay = term
    ? `${term.school_year || new Date().getFullYear()}/${term.name || "Term 1"}`
    : `${new Date().getFullYear()}/Term 1`;

  return (
    <Box
      ref={ref}
      sx={{
        p: printMode ? 2 : 3,
        maxWidth: 850,
        mx: "auto",
        bgcolor: "#fff",
        color: themeColors.text,
        fontFamily: "Arial, sans-serif",
        "@media print": {
          p: "10mm",
          maxWidth: "100%",
          fontSize: "11pt",
        },
      }}
    >
      {/* ===== HEADER SECTION ===== */}
      <Box
        sx={{
          display: "flex",
          mb: 2,
          p: 2,
          background: themeColors.headerBg,
          borderRadius: 2,
          alignItems: "center",
        }}
      >
        {/* Logo Placeholder */}
        <Box
          sx={{
            width: 70,
            height: 70,
            border: "2px solid rgba(255,255,255,0.5)",
            borderRadius: 1,
            mr: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            bgcolor: "rgba(255,255,255,0.1)",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "rgba(255,255,255,0.7)",
              textAlign: "center",
              fontSize: "0.6rem",
            }}
          >
            SCHOOL
            <br />
            LOGO
          </Typography>
        </Box>

        {/* School Info */}
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: "bold",
              fontSize: "1.2rem",
              mb: 0.5,
              color: "#fff",
            }}
          >
            {school?.name || "School Name"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.9)" }}
          >
            {school?.parish || school?.district || "Parish"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.9)" }}
          >
            TEL: {school?.phone || school?.contact_phone || "-"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.9)" }}
          >
            EMAIL: {school?.email || school?.contact_email || "-"} | WEBSITE:{" "}
            {school?.website || "-"}
          </Typography>
        </Box>
      </Box>

      {/* ===== STUDENT INFORMATION GRID ===== */}
      <TableContainer
        sx={{
          mb: 2,
          borderRadius: 1,
          border: `1px solid ${themeColors.border}`,
          overflow: "hidden",
        }}
      >
        <Table size="small" sx={{ tableLayout: "fixed" }}>
          <TableBody>
            <TableRow sx={{ bgcolor: "#fff" }}>
              <TableCell sx={cellStyle} width="50%">
                <strong>Name of pupil:</strong> {student?.first_name}{" "}
                {student?.last_name}
              </TableCell>
              <TableCell sx={cellStyle} width="50%">
                <strong>Grade Level:</strong> {student?.grade_level || "-"}
              </TableCell>
            </TableRow>
            <TableRow sx={{ bgcolor: themeColors.sectionBg }}>
              <TableCell sx={cellStyle}>
                <strong>Date of Birth:</strong>{" "}
                {formatDate(student?.date_of_birth)}
              </TableCell>
              <TableCell sx={cellStyle}>
                <strong>Form:</strong>{" "}
                {student?.Class?.grade_level || student?.grade_level || "-"}{" "}
                {student?.Class?.section || ""}
              </TableCell>
            </TableRow>
            <TableRow sx={{ bgcolor: "#fff" }}>
              <TableCell sx={cellStyle}>
                <strong>OpenEMIS No:</strong> {student?.student_id || "-"}
              </TableCell>
              <TableCell sx={cellStyle}>
                <strong>Total Males:</strong> {totalMales}
              </TableCell>
            </TableRow>
            <TableRow sx={{ bgcolor: themeColors.sectionBg }}>
              <TableCell sx={cellStyle}>
                <strong>Year/Term:</strong> {yearTermDisplay}
              </TableCell>
              <TableCell sx={cellStyle}>
                <strong>Total Females:</strong> {totalFemales}
              </TableCell>
            </TableRow>
            <TableRow sx={{ bgcolor: "#fff" }}>
              <TableCell sx={cellStyle}>
                <strong>Term Avg:</strong>{" "}
                <Box
                  component="span"
                  sx={{ color: themeColors.secondary, fontWeight: "bold" }}
                >
                  {termAvg !== "-" ? `${termAvg}%` : "-"}
                </Box>
              </TableCell>
              <TableCell sx={cellStyle}>
                <strong>Exam Avg:</strong>{" "}
                <Box
                  component="span"
                  sx={{ color: themeColors.primary, fontWeight: "bold" }}
                >
                  {examAvg !== "-" ? `${examAvg}% (${overallGrade})` : "-"}
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* ===== TITLE BANNER ===== */}
      <Box
        sx={{
          background: themeColors.headerBg,
          color: "#fff",
          py: 1,
          px: 2,
          borderRadius: 1,
          textAlign: "center",
          mb: 1,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: "bold",
            fontSize: "1rem",
            letterSpacing: "0.5px",
          }}
        >
          END OF TERM REPORT CARD
        </Typography>
      </Box>

      {/* ===== EFFORT GRADE KEY ===== */}
      <Typography
        variant="body2"
        sx={{
          textAlign: "center",
          mb: 2,
          fontSize: "0.75rem",
          fontStyle: "italic",
          color: themeColors.textSecondary,
        }}
      >
        (A) - Very Good | (B/1) - Good | (C/2) - Fair | (D/3) - Poor
      </Typography>

      {/* ===== SUBJECTS TABLE ===== */}
      <TableContainer
        sx={{
          mb: 2,
          borderRadius: 1,
          border: `1px solid ${themeColors.border}`,
          overflow: "hidden",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headerCellStyle} width="20%">
                SUBJECT
              </TableCell>
              <TableCell sx={headerCellStyle} width="12%" align="center">
                T1-MID
              </TableCell>
              <TableCell sx={headerCellStyle} width="12%" align="center">
                T1-END
              </TableCell>
              <TableCell sx={headerCellStyle} width="10%" align="center">
                FINAL
              </TableCell>
              <TableCell sx={headerCellStyle} width="10%" align="center">
                EFFORT
              </TableCell>
              <TableCell sx={headerCellStyle} width="36%">
                SUBJECT COMMENT
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {grades?.map((grade, idx) => (
              <TableRow
                key={idx}
                sx={{ bgcolor: idx % 2 === 0 ? "#fff" : themeColors.sectionBg }}
              >
                <TableCell sx={cellStyle}>
                  {grade.subject?.name || grade.subject_name || "-"}
                </TableCell>
                <TableCell sx={cellStyle} align="center">
                  {grade.assessment_components?.classwork != null
                    ? grade.assessment_components.classwork
                    : "-"}
                </TableCell>
                <TableCell sx={cellStyle} align="center">
                  {grade.numeric_score != null ? grade.numeric_score : "-"}
                </TableCell>
                <TableCell sx={cellStyle} align="center">
                  <Chip
                    label={resolveFinalGrade(grade)}
                    size="small"
                    color={getGradeColor(resolveFinalGrade(grade))}
                    sx={{ fontWeight: "bold" }}
                  />
                </TableCell>
                <TableCell sx={cellStyle} align="center">
                  <Chip
                    label={mapEffortCode(grade.effort_grade)}
                    size="small"
                    color={getGradeColor(grade.effort_grade)}
                    sx={{ fontWeight: "bold" }}
                  />
                </TableCell>
                <TableCell sx={{ ...cellStyle, fontSize: "0.75rem" }}>
                  {grade.teacher_comments || "-"}
                </TableCell>
              </TableRow>
            ))}
            {(!grades || grades.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  sx={{ ...cellStyle, color: themeColors.textSecondary }}
                  align="center"
                >
                  No grades recorded for this term
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ===== ATTENDANCE ROW ===== */}
      <TableContainer
        sx={{
          mb: 2,
          borderRadius: 1,
          border: `1px solid ${themeColors.border}`,
          overflow: "hidden",
        }}
      >
        <Table size="small">
          <TableBody>
            <TableRow sx={{ bgcolor: "#fff" }}>
              <TableCell sx={cellStyle} width="50%">
                <strong>Days Absent:</strong>{" "}
                <Box
                  component="span"
                  sx={{
                    color:
                      (attendance?.absent_days || 0) > 5
                        ? "error.main"
                        : "inherit",
                    fontWeight:
                      (attendance?.absent_days || 0) > 5 ? "bold" : "normal",
                  }}
                >
                  {attendance?.absent_days || 0}
                </Box>
              </TableCell>
              <TableCell sx={cellStyle} width="50%">
                <strong>Next Term:</strong> _______________
              </TableCell>
            </TableRow>
            <TableRow sx={{ bgcolor: themeColors.sectionBg }}>
              <TableCell sx={cellStyle}>
                <strong>Sessions Late:</strong> {attendance?.late_days || 0}
              </TableCell>
              <TableCell sx={cellStyle}>
                <strong>Promoted to Form:</strong>{" "}
                {student?.year_end_status === "promoted" ? (
                  <Box
                    component="span"
                    sx={{ color: "success.main", fontWeight: "bold" }}
                  >
                    Yes
                  </Box>
                ) : student?.year_end_status === "retained" ? (
                  <Box
                    component="span"
                    sx={{ color: "error.main", fontWeight: "bold" }}
                  >
                    No (Retained)
                  </Box>
                ) : student?.year_end_status === "graduated" ? (
                  <Box
                    component="span"
                    sx={{ color: themeColors.secondary, fontWeight: "bold" }}
                  >
                    Graduated
                  </Box>
                ) : (
                  "_______________"
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* ===== EXTRA CURRICULARS ===== */}
      <Box
        sx={{
          border: `1px solid ${themeColors.border}`,
          borderRadius: 1,
          p: 1.5,
          mb: 2,
          minHeight: 60,
          bgcolor: themeColors.sectionBg,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: "bold",
            fontSize: "0.85rem",
            mb: 0.5,
            color: themeColors.primary,
          }}
        >
          EXTRA CURRICULARS:
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.8rem", color: themeColors.textSecondary }}
        >
          {/* Placeholder for extra curricular activities */}
        </Typography>
      </Box>

      {/* ===== GENERAL COMMENT ===== */}
      <Box
        sx={{
          border: `1px solid ${themeColors.border}`,
          borderRadius: 1,
          p: 1.5,
          mb: 2,
          minHeight: 60,
          bgcolor: themeColors.sectionBg,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: "bold",
            fontSize: "0.85rem",
            mb: 0.5,
            color: themeColors.primary,
          }}
        >
          GENERAL COMMENT:
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.8rem", color: themeColors.textSecondary }}
        >
          {/* Placeholder for general comment */}
        </Typography>
      </Box>

      {/* ===== PRINCIPAL/YEAR HEAD COMMENT ===== */}
      <Box
        sx={{
          border: `1px solid ${themeColors.border}`,
          borderRadius: 1,
          p: 1.5,
          mb: 3,
          minHeight: 60,
          bgcolor: themeColors.sectionBg,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: "bold",
            fontSize: "0.85rem",
            mb: 0.5,
            color: themeColors.primary,
          }}
        >
          PRINCIPAL/SENIOR TEACHER/YEAR HEAD COMMENT:
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.8rem", color: themeColors.textSecondary }}
        >
          {/* Placeholder for principal comment */}
        </Typography>
      </Box>

      {/* ===== SIGNATURES ===== */}
      <Grid container spacing={4} sx={{ mb: 3 }}>
        <Grid item xs={6}>
          <Box
            sx={{
              borderBottom: `1px solid ${themeColors.borderMedium}`,
              mb: 0.5,
              height: 30,
            }}
          />
          <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
            <strong>Form Teacher:</strong> _______________
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Box
            sx={{
              borderBottom: `1px solid ${themeColors.borderMedium}`,
              mb: 0.5,
              height: 30,
            }}
          />
          <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
            <strong>Principal/Deputy/Year Head's Signature</strong>
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: "0.75rem",
              mt: 0.5,
              color: themeColors.textSecondary,
            }}
          >
            Principal: _______________
          </Typography>
        </Grid>
      </Grid>

      {/* ===== FOOTER ===== */}
      <Box sx={{ textAlign: "center", mt: 2 }}>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.75rem", mb: 1, color: themeColors.textSecondary }}
        >
          1 of 1
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: "block", color: themeColors.textSecondary }}
        >
          Generated on {new Date().toLocaleDateString("en-GB")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: 1,
            borderTop: `2px solid ${themeColors.primary}`,
            pt: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: themeColors.textSecondary, fontSize: "0.7rem" }}
          >
            Ministry of Education, Technological and Vocational Training
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: themeColors.primary,
              fontSize: "0.7rem",
              fontWeight: "bold",
            }}
          >
            Report Card
          </Typography>
        </Box>
      </Box>
    </Box>
  );
});

StudentReportCard.displayName = "StudentReportCard";

export default StudentReportCard;
