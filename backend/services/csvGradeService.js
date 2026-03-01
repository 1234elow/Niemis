const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const {
  CARIBBEAN_GRADE_BANDS,
  scoreToCaribbeanGrade,
  gradeToMidpointScore,
} = require("../utils/caribbeanGradeScale");

class CSVGradeService {
  static IMPORT_HEADERS = [
    "student_id",
    "subject_code",
    "numeric_score",
    "effort_grade",
    "behavior_grade",
    "comments",
  ];
  static VALID_GRADES = [
    "A+",
    "A",
    "A-",
    "B+",
    "B",
    "B-",
    "C+",
    "C",
    "C-",
    "D+",
    "D",
    "D-",
    "F",
  ];

  static GRADE_SCALE = CARIBBEAN_GRADE_BANDS.reduce((acc, band) => {
    acc[band.letter] = { min: band.min, max: band.max };
    return acc;
  }, {});

  /**
   * Parse CSV buffer into array of row objects
   * @param {Buffer} buffer - CSV file buffer
   * @returns {{ rows: Array, errors: Array }}
   */
  parseCSV(buffer) {
    const errors = [];
    let rows = [];

    try {
      const content = buffer.toString("utf-8");
      rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relaxColumnCount: true,
      });
    } catch (err) {
      errors.push({
        row: 0,
        field: "file",
        message: `Failed to parse CSV: ${err.message}`,
      });
      return { rows: [], errors };
    }

    // Validate headers
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const missingHeaders = CSVGradeService.IMPORT_HEADERS.filter(
        (h) => !headers.includes(h),
      );
      if (missingHeaders.length > 0) {
        errors.push({
          row: 0,
          field: "headers",
          message: `Missing required headers: ${missingHeaders.join(", ")}`,
        });
      }
    }

    return { rows, errors };
  }

  /**
   * Validate a single CSV row
   * @param {Object} row - Row data object
   * @param {number} rowIndex - Row index for error reporting
   * @param {Map} studentMap - Map of student_id to student object
   * @param {Map} subjectMap - Map of subject_code to subject object
   * @returns {{ valid: boolean, errors: Array, data: Object }}
   */
  validateRow(row, rowIndex, studentMap, subjectMap) {
    const errors = [];
    const data = {};
    const rowNum = rowIndex + 2; // +2 for 1-indexed and header row

    // Validate student_id
    if (!row.student_id || row.student_id.trim() === "") {
      errors.push({
        row: rowNum,
        field: "student_id",
        message: "Student ID is required",
      });
    } else {
      const student = studentMap.get(row.student_id.trim());
      if (!student) {
        errors.push({
          row: rowNum,
          field: "student_id",
          message: `Student not found: ${row.student_id}`,
        });
      } else {
        data.student = student;
        data.student_id = row.student_id.trim();
      }
    }

    // Validate subject_code
    if (!row.subject_code || row.subject_code.trim() === "") {
      errors.push({
        row: rowNum,
        field: "subject_code",
        message: "Subject code is required",
      });
    } else {
      const subject = subjectMap.get(row.subject_code.trim().toUpperCase());
      if (!subject) {
        errors.push({
          row: rowNum,
          field: "subject_code",
          message: `Subject not found: ${row.subject_code}`,
        });
      } else {
        data.subject = subject;
        data.subject_code = row.subject_code.trim().toUpperCase();
      }
    }

    // Validate numeric_score
    if (row.numeric_score !== undefined && row.numeric_score !== "") {
      const score = parseFloat(row.numeric_score);
      if (isNaN(score) || score < 0 || score > 100) {
        errors.push({
          row: rowNum,
          field: "numeric_score",
          message: "Numeric score must be between 0 and 100",
        });
      } else {
        data.numeric_score = score;
        data.grade_value = this.convertScoreToGrade(score);
      }
    } else {
      errors.push({
        row: rowNum,
        field: "numeric_score",
        message: "Numeric score is required",
      });
    }

    // Validate effort_grade
    if (!row.effort_grade || row.effort_grade.trim() === "") {
      errors.push({
        row: rowNum,
        field: "effort_grade",
        message: "Effort grade is required",
      });
    } else {
      const effortGrade = row.effort_grade.trim().toUpperCase();
      if (!CSVGradeService.VALID_GRADES.includes(effortGrade)) {
        errors.push({
          row: rowNum,
          field: "effort_grade",
          message: `Invalid effort grade: ${row.effort_grade}`,
        });
      } else {
        data.effort_grade = effortGrade;
      }
    }

    // Validate behavior_grade
    if (!row.behavior_grade || row.behavior_grade.trim() === "") {
      errors.push({
        row: rowNum,
        field: "behavior_grade",
        message: "Behavior grade is required",
      });
    } else {
      const behaviorGrade = row.behavior_grade.trim().toUpperCase();
      if (!CSVGradeService.VALID_GRADES.includes(behaviorGrade)) {
        errors.push({
          row: rowNum,
          field: "behavior_grade",
          message: `Invalid behavior grade: ${row.behavior_grade}`,
        });
      } else {
        data.behavior_grade = behaviorGrade;
      }
    }

    // Comments (optional)
    data.teacher_comments = row.comments || "";

    return {
      valid: errors.length === 0,
      errors,
      data,
    };
  }

  /**
   * Validate all rows in parsed CSV
   * @param {Array} rows - Parsed CSV rows
   * @param {Map} studentMap - Map of student_id to student object
   * @param {Map} subjectMap - Map of subject_code to subject object
   * @returns {{ validRows: Array, errors: Array }}
   */
  validateAllRows(rows, studentMap, subjectMap) {
    const validRows = [];
    const errors = [];

    rows.forEach((row, index) => {
      const result = this.validateRow(row, index, studentMap, subjectMap);
      errors.push(...result.errors);
      if (result.valid) {
        validRows.push(result.data);
      }
    });

    return { validRows, errors };
  }

  /**
   * Generate CSV export for term report
   * @param {Array} students - Array of student objects with grades
   * @param {Array} subjects - Array of subject objects
   * @param {string} termName - Name of the term
   * @returns {string} CSV string
   */
  generateExportCSV(students, subjects, termName) {
    const headers = [
      "student_id",
      "first_name",
      "last_name",
      "grade_level",
      ...subjects.map((s) => s.code),
      "effort_avg",
      "behavior_avg",
      "attendance_pct",
      "overall_grade",
      "year_end_status",
    ];

    const rows = students.map((student) => {
      const row = {
        student_id: student.student_id,
        first_name: student.first_name,
        last_name: student.last_name,
        grade_level: student.grade_level,
      };

      // Add grades for each subject
      let totalScore = 0;
      let totalEffort = 0;
      let totalBehavior = 0;
      let gradeCount = 0;

      subjects.forEach((subject) => {
        const grade = student.Grades?.find((g) => g.subject_id === subject.id);
        if (grade) {
          row[subject.code] =
            scoreToCaribbeanGrade(grade.numeric_score) ||
            grade.grade_value ||
            "-";
          totalScore +=
            grade.numeric_score || this.convertGradeToScore(grade.grade_value);
          totalEffort += this.convertGradeToScore(grade.effort_grade);
          totalBehavior += this.convertGradeToScore(grade.behavior_grade);
          gradeCount++;
        } else {
          row[subject.code] = "-";
        }
      });

      // Calculate averages
      if (gradeCount > 0) {
        row.effort_avg = this.convertScoreToGrade(totalEffort / gradeCount);
        row.behavior_avg = this.convertScoreToGrade(totalBehavior / gradeCount);
        row.overall_grade = this.convertScoreToGrade(totalScore / gradeCount);
      } else {
        row.effort_avg = "-";
        row.behavior_avg = "-";
        row.overall_grade = "-";
      }

      // Attendance percentage (placeholder - would come from attendance data)
      row.attendance_pct = student.attendance_rate || "-";
      row.year_end_status = student.year_end_status || "-";

      return row;
    });

    return stringify(rows, { header: true, columns: headers });
  }

  /**
   * Generate CSV template for import
   * @returns {string} CSV template string
   */
  generateTemplate() {
    const headers = CSVGradeService.IMPORT_HEADERS;
    const sampleRow = {
      student_id: "STU2024001",
      subject_code: "MATH",
      numeric_score: "85",
      effort_grade: "B+",
      behavior_grade: "A-",
      comments: "Good progress this term",
    };

    return stringify([sampleRow], { header: true, columns: headers });
  }

  /**
   * Convert numeric score to letter grade
   * @param {number} score - Numeric score (0-100)
   * @returns {string} Letter grade
   */
  convertScoreToGrade(score) {
    return scoreToCaribbeanGrade(score) || "F";
  }

  /**
   * Convert letter grade to numeric score (midpoint of range)
   * @param {string} grade - Letter grade
   * @returns {number} Numeric score
   */
  convertGradeToScore(grade) {
    return gradeToMidpointScore(grade) ?? 0;
  }

  /**
   * Generate year-end summary CSV
   * @param {Array} students - Array of students with year_end_status
   * @returns {string} CSV string
   */
  generateYearEndSummaryCSV(students) {
    const headers = [
      "student_id",
      "first_name",
      "last_name",
      "grade_level",
      "school",
      "year_end_status",
      "status_date",
      "notes",
    ];

    const rows = students.map((student) => ({
      student_id: student.student_id,
      first_name: student.first_name,
      last_name: student.last_name,
      grade_level: student.grade_level,
      school: student.School?.name || "-",
      year_end_status: student.year_end_status || "pending",
      status_date: student.year_end_status_date || "-",
      notes: student.year_end_notes || "",
    }));

    return stringify(rows, { header: true, columns: headers });
  }
}

module.exports = new CSVGradeService();
module.exports.CSVGradeService = CSVGradeService;
