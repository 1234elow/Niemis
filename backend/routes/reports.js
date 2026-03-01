const express = require("express");
const { Op } = require("sequelize");
const multer = require("multer");
const {
  Student,
  Staff,
  School,
  AttendanceRecord,
  AcademicRecord,
  Grade,
  Subject,
  Class,
  Term,
  User,
} = require("../models");
const { requireRole } = require("../middleware/auth");
const csvGradeService = require("../services/csvGradeService");
const logger = require("../utils/logger");
const {
  generateDataQualityOverview,
  evaluateReleaseGate,
} = require("../services/dataQualityService");
const {
  scoreToCaribbeanGrade,
  gradeToMidpointScore,
} = require("../utils/caribbeanGradeScale");

const router = express.Router();

const round1 = (value) => Math.round(value * 10) / 10;

const findTeacherStaffByUser = async (user) => {
  let teacherStaff = await Staff.findOne({
    where: { user_id: user.id, is_active: true },
    attributes: ["id", "school_id"],
  });

  if (teacherStaff) {
    return teacherStaff;
  }

  teacherStaff = await Staff.findOne({
    where: {
      is_active: true,
      [Op.or]: [
        { employee_id: user.username },
        { employee_id: { [Op.iLike]: `%${user.username}%` } },
      ],
    },
    attributes: ["id", "school_id"],
  });

  return teacherStaff;
};

const resolveSchoolScopedId = (req, requestedSchoolId = null) => {
  const scope = req.accessContext?.scope;
  const contextSchoolId = req.accessContext?.school_id;
  if (scope === "school" && contextSchoolId) {
    return contextSchoolId;
  }
  return requestedSchoolId || null;
};

const buildReleaseGateBlockedPayload = ({ action, schoolId, gate }) => ({
  error: `Data quality release gate blocked ${action}.`,
  code: "DATA_QUALITY_RELEASE_GATE_BLOCKED",
  action,
  school_id: schoolId || null,
  release_gate: gate,
  next_steps: [
    "Review Admin Dashboard -> Data Quality Monitor.",
    "Resolve critical issues in the Action Center.",
    "Re-run quality scan and retry the operation.",
  ],
});

const enforceReleaseGateForSchool = async ({
  req,
  res,
  schoolId = null,
  action = "this operation",
}) => {
  const scopedSchoolId = resolveSchoolScopedId(req, schoolId);
  await generateDataQualityOverview({
    schoolId: scopedSchoolId,
    refreshTracking: true,
  });
  const gate = await evaluateReleaseGate({
    schoolId: scopedSchoolId,
    hardFailOnWarnings: false,
  });

  if (gate.blocked) {
    return res.status(409).json(
      buildReleaseGateBlockedPayload({
        action,
        schoolId: scopedSchoolId,
        gate,
      }),
    );
  }

  return null;
};

const toNumericScore = (gradeRow) => {
  const numeric = Number(gradeRow?.numeric_score);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return gradeToMidpointScore(gradeRow?.grade_value);
};

const calculateGradeSummary = (grades = []) => {
  if (!Array.isArray(grades) || grades.length === 0) {
    return null;
  }

  const overallScores = [];
  const effortScores = [];
  const behaviorScores = [];

  for (const grade of grades) {
    const overallScore = toNumericScore(grade);
    if (Number.isFinite(overallScore)) {
      overallScores.push(overallScore);
    }

    const effortScore = gradeToMidpointScore(grade?.effort_grade);
    if (Number.isFinite(effortScore)) {
      effortScores.push(effortScore);
    }

    const behaviorScore = gradeToMidpointScore(grade?.behavior_grade);
    if (Number.isFinite(behaviorScore)) {
      behaviorScores.push(behaviorScore);
    }
  }

  if (overallScores.length === 0) {
    return null;
  }

  const overallAverage = overallScores.reduce((sum, value) => sum + value, 0) / overallScores.length;
  const effortAverage =
    effortScores.length > 0
      ? effortScores.reduce((sum, value) => sum + value, 0) / effortScores.length
      : null;
  const behaviorAverage =
    behaviorScores.length > 0
      ? behaviorScores.reduce((sum, value) => sum + value, 0) / behaviorScores.length
      : null;

  return {
    overall_average: round1(overallAverage),
    overall_grade: scoreToCaribbeanGrade(overallAverage) || "F",
    effort_average: Number.isFinite(effortAverage)
      ? scoreToCaribbeanGrade(effortAverage) || "F"
      : null,
    behavior_average: Number.isFinite(behaviorAverage)
      ? scoreToCaribbeanGrade(behaviorAverage) || "F"
      : null,
    graded_subjects: overallScores.length,
  };
};

// Configure multer for CSV upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// School summary report
router.get("/school-summary/:school_id", async (req, res, next) => {
  try {
    const { school_id } = req.params;

    const school = await School.findByPk(school_id);
    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    const studentCount = await Student.count({
      where: { school_id, is_active: true },
    });
    const staffCount = await Staff.count({
      where: { school_id, is_active: true },
    });

    const report = {
      school_info: school,
      total_students: studentCount,
      total_staff: staffCount,
      capacity_utilization: school.capacity
        ? Math.round((studentCount / school.capacity) * 100)
        : null,
    };

    res.json({ report });
  } catch (error) {
    next(error);
  }
});

// Attendance report
router.get("/attendance", async (req, res, next) => {
  try {
    const { school_id, start_date, end_date } = req.query;

    const whereClause = {};
    if (school_id) whereClause.school_id = school_id;
    if (start_date && end_date) {
      whereClause.attendance_date = {
        [Op.between]: [start_date, end_date],
      };
    }

    const attendance = await AttendanceRecord.findAll({
      where: whereClause,
      include: [{ model: Student }, { model: School }],
    });

    res.json({ attendance_data: attendance });
  } catch (error) {
    next(error);
  }
});

// Get full term report with all student grades for a class
router.get(
  "/term-report/:classId/:termId",
  requireRole(["super_admin", "admin", "teacher"]),
  async (req, res, next) => {
    try {
      const { classId, termId } = req.params;

      // Verify class exists
      const classObj = await Class.findByPk(classId, {
        include: [
          { model: School, attributes: ["id", "name"] },
          {
            model: Staff,
            as: "classTeacher",
            attributes: ["id", "first_name", "last_name"],
          },
        ],
      });
      if (!classObj) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Verify term exists
      const term = await Term.findByPk(termId);
      if (!term) {
        return res.status(404).json({ error: "Term not found" });
      }

      // Role-based access check for teachers
      if (req.user.role === "teacher") {
        const teacherStaff = await findTeacherStaffByUser(req.user);
        if (!teacherStaff) {
          return res.status(403).json({
            error: "Access denied: teacher profile is not linked to a school",
          });
        }

        const sameSchool =
          String(teacherStaff.school_id) === String(classObj.school_id);
        if (!sameSchool || classObj.class_teacher_id !== teacherStaff.id) {
          return res.status(403).json({
            error: "Access denied: You are not assigned to this class",
          });
        }
      }

      // Get all students in the class with their grades for this term
      const students = await Student.findAll({
        where: {
          class_id: classId,
          school_id: classObj.school_id,
          is_active: true,
        },
        include: [
          {
            model: Grade,
            where: { term_id: termId },
            required: false,
            include: [
              { model: Subject, attributes: ["id", "name", "code"] },
              {
                model: Staff,
                as: "teacher",
                attributes: ["id", "first_name", "last_name"],
              },
            ],
          },
        ],
        order: [
          ["last_name", "ASC"],
          ["first_name", "ASC"],
        ],
      });

      // Get all subjects for this grade level
      const subjects = await Subject.findAll({
        where: { is_active: true },
        order: [["name", "ASC"]],
      });

      // Get attendance summary for each student
      const studentIds = students.map((s) => s.id);
      const attendanceData = await AttendanceRecord.findAll({
        where: {
          student_id: { [Op.in]: studentIds },
          attendance_date: {
            [Op.between]: [term.start_date, term.end_date],
          },
        },
        attributes: ["student_id", "status"],
      });

      // Calculate attendance rates
      const attendanceMap = {};
      studentIds.forEach((id) => {
        attendanceMap[id] = { total: 0, present: 0 };
      });
      attendanceData.forEach((record) => {
        attendanceMap[record.student_id].total++;
        if (record.status === "present" || record.status === "late") {
          attendanceMap[record.student_id].present++;
        }
      });

      // Format response
      const studentsWithAttendance = students.map((student) => {
        const attendance = attendanceMap[student.id] || {
          total: 0,
          present: 0,
        };
        const attendanceRate =
          attendance.total > 0
            ? Math.round((attendance.present / attendance.total) * 100 * 10) /
              10
            : null;

        return {
          ...student.toJSON(),
          attendance_rate: attendanceRate,
          attendance_days: attendance.total,
          present_days: attendance.present,
          report_summary: calculateGradeSummary(student.Grades || []),
        };
      });

      res.json({
        class: classObj,
        term,
        subjects,
        students: studentsWithAttendance,
        summary: {
          total_students: students.length,
          grades_entered: students.filter(
            (s) => s.Grades && s.Grades.length > 0,
          ).length,
          subjects_count: subjects.length,
        },
      });
    } catch (error) {
      logger.error("Error fetching term report:", error);
      next(error);
    }
  },
);

// Get individual student term report
router.get(
  "/student-report/:studentId/:termId",
  requireRole(["super_admin", "admin", "teacher", "parent", "student"]),
  async (req, res, next) => {
    try {
      const { studentId, termId } = req.params;

      // Get student with all related data
      const student = await Student.findByPk(studentId, {
        include: [
          { model: School, attributes: ["id", "name", "school_type"] },
          {
            model: Class,
            attributes: ["id", "name", "grade_level", "section"],
          },
          {
            model: Grade,
            where: { term_id: termId },
            required: false,
            include: [
              {
                model: Subject,
                attributes: ["id", "name", "code", "is_core_subject"],
              },
              {
                model: Staff,
                as: "teacher",
                attributes: ["id", "first_name", "last_name"],
              },
            ],
          },
        ],
      });

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      // Access control
      if (req.user.role === "student" && student.user_id !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Access denied: You can only view your own report" });
      }

      // Get term info
      const term = await Term.findByPk(termId);

      // Get class gender stats if student is in a class
      let classStats = null;
      if (student.class_id) {
        const classStudents = await Student.findAll({
          where: { class_id: student.class_id, is_active: true },
          attributes: ["gender"],
        });
        classStats = {
          total: classStudents.length,
          males: classStudents.filter((s) => s.gender === "male").length,
          females: classStudents.filter((s) => s.gender === "female").length,
        };
      }
      if (!term) {
        return res.status(404).json({ error: "Term not found" });
      }

      // Get attendance for the term
      const attendanceRecords = await AttendanceRecord.findAll({
        where: {
          student_id: studentId,
          attendance_date: {
            [Op.between]: [term.start_date, term.end_date],
          },
        },
      });

      const attendanceSummary = {
        total_days: attendanceRecords.length,
        present_days: attendanceRecords.filter((a) => a.status === "present")
          .length,
        late_days: attendanceRecords.filter((a) => a.status === "late").length,
        absent_days: attendanceRecords.filter((a) => a.status === "absent")
          .length,
        excused_days: attendanceRecords.filter((a) => a.status === "excused")
          .length,
      };
      attendanceSummary.attendance_rate =
        attendanceSummary.total_days > 0
          ? Math.round(
              ((attendanceSummary.present_days + attendanceSummary.late_days) /
                attendanceSummary.total_days) *
                100 *
                10,
            ) / 10
          : null;

      const grades = student.Grades || [];
      const averages = calculateGradeSummary(grades);

      res.json({
        student: {
          id: student.id,
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          date_of_birth: student.date_of_birth,
          gender: student.gender,
          grade_level: student.grade_level,
          year_end_status: student.year_end_status,
          School: student.School,
          Class: student.Class,
        },
        term,
        grades: grades.map((g) => ({
          subject: g.Subject,
          grade_value: g.grade_value,
          numeric_score: g.numeric_score,
          assessment_components: g.assessment_components,
          effort_grade: g.effort_grade,
          behavior_grade: g.behavior_grade,
          teacher_comments: g.teacher_comments,
          teacher: g.teacher,
          is_final: g.is_final,
        })),
        attendance: attendanceSummary,
        averages,
        classStats,
      });
    } catch (error) {
      logger.error("Error fetching student report:", error);
      next(error);
    }
  },
);

// Export term report as CSV
router.get(
  "/export/term-report/:classId/:termId",
  requireRole(["super_admin", "admin", "teacher"]),
  async (req, res, next) => {
    try {
      const { classId, termId } = req.params;

      // Get class and term info
      const classObj = await Class.findByPk(classId);
      if (!classObj) {
        return res.status(404).json({ error: "Class not found" });
      }

      const releaseGateBlocked = await enforceReleaseGateForSchool({
        req,
        res,
        schoolId: classObj.school_id,
        action: "term report export",
      });
      if (releaseGateBlocked) {
        return releaseGateBlocked;
      }

      const term = await Term.findByPk(termId);
      if (!term) {
        return res.status(404).json({ error: "Term not found" });
      }

      // Get all subjects
      const subjects = await Subject.findAll({
        where: { is_active: true },
        order: [["name", "ASC"]],
      });

      // Get students with grades
      const students = await Student.findAll({
        where: { class_id: classId, is_active: true },
        include: [
          {
            model: Grade,
            where: { term_id: termId },
            required: false,
            include: [{ model: Subject }],
          },
        ],
        order: [
          ["last_name", "ASC"],
          ["first_name", "ASC"],
        ],
      });

      // Get attendance data
      const studentIds = students.map((s) => s.id);
      const attendanceData = await AttendanceRecord.findAll({
        where: {
          student_id: { [Op.in]: studentIds },
          attendance_date: { [Op.between]: [term.start_date, term.end_date] },
        },
      });

      // Calculate attendance rates
      const attendanceMap = {};
      studentIds.forEach((id) => {
        attendanceMap[id] = { total: 0, present: 0 };
      });
      attendanceData.forEach((record) => {
        attendanceMap[record.student_id].total++;
        if (record.status === "present" || record.status === "late") {
          attendanceMap[record.student_id].present++;
        }
      });

      // Add attendance rate to students
      const studentsWithAttendance = students.map((student) => {
        const attendance = attendanceMap[student.id] || {
          total: 0,
          present: 0,
        };
        return {
          ...student.toJSON(),
          attendance_rate:
            attendance.total > 0
              ? Math.round((attendance.present / attendance.total) * 100 * 10) /
                10
              : "-",
        };
      });

      // Generate CSV
      const csv = csvGradeService.generateExportCSV(
        studentsWithAttendance,
        subjects,
        term.name,
      );

      // Send as file download
      const filename = `term-report_${classObj.name}_${term.name.replace(/\s/g, "-")}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(csv);
    } catch (error) {
      logger.error("Error exporting term report:", error);
      next(error);
    }
  },
);

// Import grades from CSV
router.post(
  "/import-grades",
  requireRole(["super_admin", "admin", "teacher"]),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { classId, termId } = req.body;
      if (!classId || !termId) {
        return res
          .status(400)
          .json({ error: "classId and termId are required" });
      }

      // Verify class and term exist
      const classObj = await Class.findByPk(classId);
      if (!classObj) {
        return res.status(404).json({ error: "Class not found" });
      }

      const term = await Term.findByPk(termId);
      if (!term) {
        return res.status(404).json({ error: "Term not found" });
      }

      // Get teacher info
      let teacherId = null;
      if (req.user.role === "teacher") {
        const teacherStaff = await findTeacherStaffByUser(req.user);
        if (!teacherStaff) {
          return res.status(403).json({
            error: "Access denied: teacher profile is not linked to a school",
          });
        }

        const sameSchool =
          String(teacherStaff.school_id) === String(classObj.school_id);
        if (!sameSchool || classObj.class_teacher_id !== teacherStaff.id) {
          return res.status(403).json({
            error: "Access denied: You are not assigned to this class",
          });
        }
        teacherId = teacherStaff.id;
      }

      // Parse CSV
      const { rows, errors: parseErrors } = csvGradeService.parseCSV(
        req.file.buffer,
      );
      if (parseErrors.length > 0) {
        return res.status(400).json({
          error: "CSV parsing failed",
          errors: parseErrors,
        });
      }

      // Get students and subjects for validation
      const students = await Student.findAll({
        where: {
          class_id: classId,
          school_id: classObj.school_id,
          is_active: true,
        },
        attributes: ["id", "student_id", "first_name", "last_name"],
      });
      const studentMap = new Map(students.map((s) => [s.student_id, s]));

      const subjects = await Subject.findAll({ where: { is_active: true } });
      const subjectMap = new Map(subjects.map((s) => [s.code, s]));

      // Validate all rows
      const { validRows, errors: validationErrors } =
        csvGradeService.validateAllRows(rows, studentMap, subjectMap);

      if (validationErrors.length > 0 && validRows.length === 0) {
        return res.status(400).json({
          error: "All rows failed validation",
          errors: validationErrors,
        });
      }

      // Import valid grades
      const importedGrades = [];
      const importErrors = [];

      for (const row of validRows) {
        try {
          const gradeData = {
            student_id: row.student.id,
            subject_id: row.subject.id,
            class_id: classId,
            term_id: termId,
            teacher_id: teacherId || classObj.class_teacher_id,
            grade_value: row.grade_value,
            numeric_score: row.numeric_score,
            effort_grade: row.effort_grade,
            behavior_grade: row.behavior_grade,
            teacher_comments: row.teacher_comments,
            date_entered: new Date(),
            last_modified: new Date(),
          };

          // Upsert grade (update if exists, create if not)
          const [grade, created] = await Grade.upsert(gradeData, {
            returning: true,
          });

          importedGrades.push({
            student_id: row.student_id,
            subject_code: row.subject_code,
            grade: row.grade_value,
            created,
          });
        } catch (err) {
          importErrors.push({
            student_id: row.student_id,
            subject_code: row.subject_code,
            message: err.message,
          });
        }
      }

      logger.info(
        `Grades imported: ${importedGrades.length} success, ${importErrors.length + validationErrors.length} errors`,
      );

      res.json({
        message: "Import completed",
        summary: {
          total_rows: rows.length,
          imported: importedGrades.length,
          validation_errors: validationErrors.length,
          import_errors: importErrors.length,
        },
        imported_grades: importedGrades,
        validation_errors: validationErrors,
        import_errors: importErrors,
      });
    } catch (error) {
      logger.error("Error importing grades:", error);
      next(error);
    }
  },
);

// Download CSV template for import
router.get("/csv-template", (req, res) => {
  const csv = csvGradeService.generateTemplate();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="grade-import-template.csv"',
  );
  res.send(csv);
});

// Get year-end summary by school
router.get(
  "/year-end-summary/:schoolId",
  requireRole(["super_admin", "admin"]),
  async (req, res, next) => {
    try {
      const { schoolId } = req.params;

      const school = await School.findByPk(schoolId);
      if (!school) {
        return res.status(404).json({ error: "School not found" });
      }

      // Get all active students with year-end status
      const students = await Student.findAll({
        where: { school_id: schoolId, is_active: true },
        include: [
          { model: School, attributes: ["id", "name"] },
          { model: Class, attributes: ["id", "name", "grade_level"] },
        ],
        order: [
          ["grade_level", "ASC"],
          ["last_name", "ASC"],
        ],
      });

      // Calculate summary statistics
      const summary = {
        total_students: students.length,
        promoted: students.filter((s) => s.year_end_status === "promoted")
          .length,
        stop_down: students.filter((s) => s.year_end_status === "stop_down")
          .length,
        graduated: students.filter((s) => s.year_end_status === "graduated")
          .length,
        pending: students.filter((s) => !s.year_end_status).length,
      };

      // Group by grade level
      const byGradeLevel = {};
      students.forEach((student) => {
        const level = student.grade_level || "Unknown";
        if (!byGradeLevel[level]) {
          byGradeLevel[level] = {
            total: 0,
            promoted: 0,
            stop_down: 0,
            graduated: 0,
            pending: 0,
          };
        }
        byGradeLevel[level].total++;
        if (student.year_end_status === "promoted")
          byGradeLevel[level].promoted++;
        else if (student.year_end_status === "stop_down")
          byGradeLevel[level].stop_down++;
        else if (student.year_end_status === "graduated")
          byGradeLevel[level].graduated++;
        else byGradeLevel[level].pending++;
      });

      res.json({
        school,
        summary,
        by_grade_level: byGradeLevel,
        students: students.map((s) => ({
          id: s.id,
          student_id: s.student_id,
          first_name: s.first_name,
          last_name: s.last_name,
          grade_level: s.grade_level,
          class_name: s.Class?.name,
          year_end_status: s.year_end_status,
          year_end_status_date: s.year_end_status_date,
          year_end_notes: s.year_end_notes,
        })),
      });
    } catch (error) {
      logger.error("Error fetching year-end summary:", error);
      next(error);
    }
  },
);

// Export year-end summary as CSV
router.get(
  "/export/year-end-summary/:schoolId",
  requireRole(["super_admin", "admin"]),
  async (req, res, next) => {
    try {
      const { schoolId } = req.params;

      const releaseGateBlocked = await enforceReleaseGateForSchool({
        req,
        res,
        schoolId,
        action: "year-end summary export",
      });
      if (releaseGateBlocked) {
        return releaseGateBlocked;
      }

      const students = await Student.findAll({
        where: { school_id: schoolId, is_active: true },
        include: [{ model: School, attributes: ["id", "name"] }],
        order: [
          ["grade_level", "ASC"],
          ["last_name", "ASC"],
        ],
      });

      const csv = csvGradeService.generateYearEndSummaryCSV(students);

      const school = await School.findByPk(schoolId);
      const filename = `year-end-summary_${school?.name.replace(/\s/g, "-") || schoolId}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(csv);
    } catch (error) {
      logger.error("Error exporting year-end summary:", error);
      next(error);
    }
  },
);

// Bulk update year-end status
router.post(
  "/bulk-year-end-status",
  requireRole(["super_admin", "admin", "teacher"]),
  async (req, res, next) => {
    try {
      const { students } = req.body;

      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ error: "students array is required" });
      }

      const requestedStudentIds = students
        .map((item) => item?.student_id)
        .filter(Boolean);
      const studentsForGate = requestedStudentIds.length > 0
        ? await Student.findAll({
            where: { id: { [Op.in]: requestedStudentIds } },
            attributes: ["id", "school_id"],
          })
        : [];
      const uniqueSchoolIds = Array.from(
        new Set(
          studentsForGate
            .map((studentRow) => studentRow.school_id)
            .filter(Boolean)
            .map((value) => String(value)),
        ),
      );

      if (uniqueSchoolIds.length > 0) {
        for (const schoolId of uniqueSchoolIds) {
          const releaseGateBlocked = await enforceReleaseGateForSchool({
            req,
            res,
            schoolId,
            action: "bulk year-end finalization",
          });
          if (releaseGateBlocked) {
            return releaseGateBlocked;
          }
        }
      }

      const validStatuses = ["promoted", "stop_down", "graduated"];
      const results = [];
      const errors = [];

      for (const item of students) {
        if (!item.student_id || !item.status) {
          errors.push({
            student_id: item.student_id,
            error: "student_id and status are required",
          });
          continue;
        }

        if (!validStatuses.includes(item.status)) {
          errors.push({
            student_id: item.student_id,
            error: `Invalid status: ${item.status}`,
          });
          continue;
        }

        try {
          const student = await Student.findByPk(item.student_id);
          if (!student) {
            errors.push({
              student_id: item.student_id,
              error: "Student not found",
            });
            continue;
          }

          await student.update({
            year_end_status: item.status,
            year_end_status_date: new Date(),
            year_end_status_set_by: req.user.id,
            year_end_notes: item.notes || null,
          });

          results.push({
            student_id: item.student_id,
            status: item.status,
            success: true,
          });
        } catch (err) {
          errors.push({ student_id: item.student_id, error: err.message });
        }
      }

      logger.info(
        `Bulk year-end status update: ${results.length} success, ${errors.length} errors`,
      );

      res.json({
        message: "Bulk update completed",
        summary: {
          total: students.length,
          success: results.length,
          errors: errors.length,
        },
        results,
        errors,
      });
    } catch (error) {
      logger.error("Error in bulk year-end status update:", error);
      next(error);
    }
  },
);

// Get available terms
router.get("/terms", async (req, res, next) => {
  try {
    const terms = await Term.findAll({
      where: { is_active: true },
      order: [
        ["school_year", "DESC"],
        ["term_number", "ASC"],
      ],
    });
    res.json({ terms });
  } catch (error) {
    next(error);
  }
});

// Get classes for current user (teacher sees their classes, admin sees all)
router.get(
  "/classes",
  requireRole(["super_admin", "admin", "teacher"]),
  async (req, res, next) => {
    try {
      const { school_id } = req.query;

      let whereClause = { is_active: true };

      if (req.user.role === "teacher") {
        const teacherStaff = await findTeacherStaffByUser(req.user);
        if (!teacherStaff) {
          return res.status(403).json({
            error: "Access denied: teacher profile is not linked to a school",
          });
        }
        whereClause.class_teacher_id = teacherStaff.id;
        whereClause.school_id = teacherStaff.school_id;
      } else if (school_id) {
        whereClause.school_id = school_id;
      }

      if (req.accessContext?.scope === "school" && req.accessContext?.school_id) {
        whereClause.school_id = req.accessContext.school_id;
      }

      const classes = await Class.findAll({
        where: whereClause,
        include: [
          { model: School, attributes: ["id", "name"] },
          {
            model: Staff,
            as: "classTeacher",
            attributes: ["id", "first_name", "last_name"],
          },
        ],
        order: [
          ["grade_level", "ASC"],
          ["section", "ASC"],
        ],
      });

      res.json({ classes });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
