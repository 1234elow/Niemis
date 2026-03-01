import React, { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Typography,
  Chip,
  Button,
  Tooltip,
  TextField,
  InputAdornment,
  LinearProgress,
} from "@mui/material";
import {
  Search,
  Visibility,
  TrendingUp,
  TrendingDown,
} from "@mui/icons-material";
import { getCaribbeanGradeFromScore } from "../constants/caribbeanGradeScale";

const getGradeColor = (grade) => {
  if (!grade || grade === "-") return "default";
  if (grade.startsWith("A")) return "success";
  if (grade.startsWith("B")) return "info";
  if (grade.startsWith("C")) return "warning";
  return "error";
};

const getStatusColor = (status) => {
  switch (status) {
    case "promoted":
      return "success";
    case "graduated":
      return "info";
    case "stop_down":
      return "error";
    default:
      return "default";
  }
};

const TermReportTable = ({
  students = [],
  subjects = [],
  loading = false,
  onViewStudent,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState("last_name");
  const [order, setOrder] = useState("asc");
  const [searchTerm, setSearchTerm] = useState("");

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (student) =>
          student.first_name?.toLowerCase().includes(search) ||
          student.last_name?.toLowerCase().includes(search) ||
          student.student_id?.toLowerCase().includes(search),
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[orderBy];
      let bVal = b[orderBy];

      // Handle nested values for grades
      if (orderBy === "overall_grade") {
        aVal = calculateOverallGrade(a);
        bVal = calculateOverallGrade(b);
      }

      if (aVal < bVal) return order === "asc" ? -1 : 1;
      if (aVal > bVal) return order === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [students, searchTerm, orderBy, order]);

  const calculateOverallGrade = (student) => {
    const precomputed = Number(student?.report_summary?.overall_average);
    if (Number.isFinite(precomputed)) {
      return precomputed;
    }

    const grades = student.Grades || [];
    if (grades.length === 0) return null;

    let total = 0;
    let validCount = 0;
    grades.forEach((g) => {
      if (g.numeric_score !== null && g.numeric_score !== undefined) {
        const score = parseFloat(g.numeric_score);
        if (!isNaN(score)) {
          total += score;
          validCount++;
        }
      }
    });

    if (validCount === 0) return null;
    return total / validCount;
  };

  const getStudentGradeForSubject = (student, subjectId) => {
    const grades = student.Grades || [];
    const grade = grades.find((g) => g.subject_id === subjectId);
    if (!grade) return "-";
    return getCaribbeanGradeFromScore(grade.numeric_score) || grade.grade_value;
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const gradesEntered = students.filter(
      (s) => s.Grades && s.Grades.length > 0,
    ).length;
    const avgAttendance =
      students.length > 0
        ? students.reduce((sum, s) => sum + (s.attendance_rate || 0), 0) /
          students.length
        : 0;

    return {
      totalStudents: students.length,
      gradesEntered,
      gradesNotEntered: students.length - gradesEntered,
      avgAttendance: avgAttendance.toFixed(1),
    };
  }, [students]);

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      {/* Summary Stats */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <Chip
          label={`Total: ${stats.totalStudents}`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Chip
          label={`Grades: ${stats.gradesEntered}`}
          color="success"
          variant="outlined"
          size="small"
        />
        <Chip
          label={`Pending: ${stats.gradesNotEntered}`}
          color="warning"
          variant="outlined"
          size="small"
        />
        <Chip
          label={`Att: ${stats.avgAttendance}%`}
          color="info"
          variant="outlined"
          size="small"
        />
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ width: "100%", maxWidth: 300 }}
        />
      </Box>

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{
          maxHeight: 600,
          width: "100%",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        {loading && <LinearProgress />}
        <Table
          stickyHeader
          size="small"
          sx={{
            tableLayout: "fixed",
            width: "100%",
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  width: "10%",
                  p: 1,
                }}
              >
                <TableSortLabel
                  active={orderBy === "student_id"}
                  direction={orderBy === "student_id" ? order : "asc"}
                  onClick={() => handleRequestSort("student_id")}
                >
                  <Typography variant="caption" fontWeight="bold">
                    ID
                  </Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  width: "15%",
                  p: 1,
                }}
              >
                <TableSortLabel
                  active={orderBy === "last_name"}
                  direction={orderBy === "last_name" ? order : "asc"}
                  onClick={() => handleRequestSort("last_name")}
                >
                  <Typography variant="caption" fontWeight="bold">
                    Name
                  </Typography>
                </TableSortLabel>
              </TableCell>
              {subjects.map((subject) => (
                <TableCell
                  key={subject.id}
                  align="center"
                  sx={{
                    fontWeight: "bold",
                    p: 0.5,
                    width: `${Math.max(4, 50 / Math.max(subjects.length, 1))}%`,
                  }}
                >
                  <Tooltip title={subject.name}>
                    <Typography
                      variant="caption"
                      fontWeight="bold"
                      sx={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {subject.code}
                    </Typography>
                  </Tooltip>
                </TableCell>
              ))}
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", width: "6%", p: 0.5 }}
              >
                <TableSortLabel
                  active={orderBy === "attendance_rate"}
                  direction={orderBy === "attendance_rate" ? order : "asc"}
                  onClick={() => handleRequestSort("attendance_rate")}
                >
                  <Typography variant="caption" fontWeight="bold">
                    Att
                  </Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", width: "6%", p: 0.5 }}
              >
                <Typography variant="caption" fontWeight="bold">
                  Avg
                </Typography>
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", width: "8%", p: 0.5 }}
              >
                <Typography variant="caption" fontWeight="bold">
                  Status
                </Typography>
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", width: "8%", p: 0.5 }}
              >
                <Typography variant="caption" fontWeight="bold">
                  View
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStudents
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((student, idx) => {
                const studentIndex = page * rowsPerPage + idx;
                const overallScore = calculateOverallGrade(student);
                const overallGrade =
                  student?.report_summary?.overall_grade ||
                  (overallScore !== null && !isNaN(overallScore)
                    ? getLetterGrade(overallScore)
                    : "-");

                return (
                  <TableRow key={student.id} hover>
                    <TableCell sx={{ p: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {student.student_id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ p: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {student.last_name}, {student.first_name}
                      </Typography>
                    </TableCell>
                    {subjects.map((subject) => {
                      const grade = getStudentGradeForSubject(
                        student,
                        subject.id,
                      );
                      return (
                        <TableCell
                          key={subject.id}
                          align="center"
                          sx={{ p: 0.5 }}
                        >
                          <Chip
                            label={grade}
                            size="small"
                            color={getGradeColor(grade)}
                            variant={grade === "-" ? "outlined" : "filled"}
                            sx={{
                              height: 20,
                              fontSize: "0.65rem",
                              "& .MuiChip-label": { px: 0.5 },
                            }}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ p: 0.5 }}>
                      {student.attendance_rate !== null &&
                      student.attendance_rate !== undefined &&
                      !isNaN(student.attendance_rate) ? (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Typography variant="caption">
                            {student.attendance_rate}%
                          </Typography>
                          {student.attendance_rate >= 90 ? (
                            <TrendingUp
                              sx={{
                                fontSize: 12,
                                ml: 0.25,
                                color: "success.main",
                              }}
                            />
                          ) : student.attendance_rate < 75 ? (
                            <TrendingDown
                              sx={{
                                fontSize: 12,
                                ml: 0.25,
                                color: "error.main",
                              }}
                            />
                          ) : null}
                        </Box>
                      ) : (
                        <Typography variant="caption">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ p: 0.5 }}>
                      <Chip
                        label={overallGrade}
                        size="small"
                        color={getGradeColor(overallGrade)}
                        variant={overallGrade === "-" ? "outlined" : "filled"}
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          "& .MuiChip-label": { px: 0.5 },
                        }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ p: 0.5 }}>
                      {student.year_end_status ? (
                        <Chip
                          label={student.year_end_status.replace("_", " ")}
                          size="small"
                          color={getStatusColor(student.year_end_status)}
                          sx={{
                            height: 20,
                            fontSize: "0.6rem",
                            "& .MuiChip-label": { px: 0.5 },
                          }}
                        />
                      ) : (
                        <Chip
                          label="pending"
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: "0.6rem",
                            "& .MuiChip-label": { px: 0.5 },
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ p: 0.5 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => onViewStudent?.(student, studentIndex)}
                        sx={{
                          minWidth: 0,
                          px: 1,
                          py: 0.25,
                          fontSize: "0.65rem",
                          textTransform: "none",
                        }}
                      >
                        <Visibility sx={{ fontSize: 14 }} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            {filteredStudents.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={subjects.length + 7} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    {searchTerm
                      ? "No students found matching your search"
                      : "No students in this class"}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filteredStudents.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Box>
  );
};

// Helper function to convert score to letter grade
const getLetterGrade = (score) => {
  return getCaribbeanGradeFromScore(score) || "F";
};

export default TermReportTable;
