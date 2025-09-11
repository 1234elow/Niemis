const express = require("express");
const { body, validationResult, query } = require("express-validator");
const {
  Staff,
  School,
  TeacherEvaluation,
  ProfessionalDevelopment,
  Class,
  Student,
  User,
  Grade,
  AttendanceRecord,
  Subject,
  Term,
} = require("../models");
const { requireRole } = require("../middleware/auth");
const logger = require("../utils/logger");

const router = express.Router();

// Helper function to find teacher with fallback lookup
const findTeacherByUser = async (user) => {
  // First try to find by user_id
  let teacher = await Staff.findOne({
    where: { user_id: user.id },
  });

  // If not found by user_id, try alternative lookup
  if (!teacher) {
    const { Op } = require("sequelize");
    teacher = await Staff.findOne({
      where: {
        [Op.or]: [
          { employee_id: user.username },
          { employee_id: { [Op.like]: `%${user.username}%` } },
        ],
      },
    });

    // If found, update the user_id
    if (teacher) {
      await teacher.update({ user_id: user.id });
      logger.info(
        `Fixed user_id relationship for teacher ${teacher.employee_id}`,
      );
    }
  }

  return teacher;
};

// Simple test route to debug 404 issues
router.get("/test", (req, res) => {
  res.json({
    message: "Teachers route is working!",
    user: req.user || "No user found",
    timestamp: new Date().toISOString(),
  });
});

// Public diagnostic route to check staff-user relationships (no auth required)
router.get("/debug-public", async (req, res) => {
  try {
    // Get all staff records
    const staff = await Staff.findAll({
      attributes: ["id", "user_id", "employee_id", "first_name", "last_name"],
      limit: 10,
    });

    // Get all teacher users
    const teachers = await User.findAll({
      where: { role: "teacher" },
      attributes: ["id", "username", "email"],
    });

    // Current user info
    const currentUser = req.user
      ? {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
        }
      : null;

    res.json({
      message: "Staff-User relationship debug info",
      currentUser,
      staff: staff.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        employee_id: s.employee_id,
        name: `${s.first_name} ${s.last_name}`,
      })),
      teachers: teachers.map((t) => ({
        id: t.id,
        username: t.username,
        email: t.email,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Debug endpoint failed",
    });
  }
});

// Teacher-specific routes (for teachers accessing their own data)

// Get current teacher's profile
router.get("/profile", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    // Find teacher using helper function
    let teacher = await findTeacherByUser(req.user);

    // If found, get full teacher data with includes
    if (teacher) {
      teacher = await Staff.findOne({
        where: { user_id: req.user.id },
        include: [
          {
            model: School,
            attributes: ["id", "name", "school_type", "parish"],
          },
          {
            model: User,
            attributes: ["id", "username", "email", "role"],
          },
        ],
      });
    }

    if (!teacher) {
      // Log debug information
      logger.error(
        `Teacher profile not found for user: ${JSON.stringify({
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
        })}`,
      );

      return res.status(404).json({
        error: "Teacher profile not found",
        debug: {
          user_id: req.user.id,
          username: req.user.username,
          suggestion:
            "Please contact administrator to link your account to a staff profile",
        },
      });
    }

    res.json({
      teacher: teacher,
      message: "Teacher profile retrieved successfully",
    });
  } catch (error) {
    logger.error("Error in teacher profile endpoint:", error);
    next(error);
  }
});

// Get teacher's assigned classes
router.get("/classes", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    // Find teacher using helper function
    const teacher = await findTeacherByUser(req.user);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const classes = await Class.findAll({
      where: {
        class_teacher_id: teacher.id,
        is_active: true,
      },
      include: [
        {
          model: School,
          attributes: ["name", "school_code"],
        },
      ],
      order: [
        ["grade_level", "ASC"],
        ["section", "ASC"],
      ],
    });

    res.json({
      classes: classes,
      total_classes: classes.length,
      message: "Teacher classes retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
});

// Get students in teacher's specific class
router.get("/classes/:classId/students", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const { classId } = req.params;

    const teacher = await findTeacherByUser(req.user);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Verify the class belongs to this teacher
    const teacherClass = await Class.findOne({
      where: {
        id: classId,
        class_teacher_id: teacher.id,
        is_active: true,
      },
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    const students = await Student.findAll({
      where: {
        class_id: classId,
        is_active: true,
      },
      attributes: [
        "id",
        "student_id",
        "first_name",
        "last_name",
        "date_of_birth",
        "grade_level",
        "enrollment_date",
      ],
      order: [
        ["last_name", "ASC"],
        ["first_name", "ASC"],
      ],
    });

    res.json({
      students: students,
      class_info: teacherClass,
      total_students: students.length,
      message: "Class students retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
});

// Mark attendance for teacher's class
router.post("/classes/:classId/attendance", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const { classId } = req.params;
    const { attendance_records, attendance_date } = req.body;

    const teacher = await findTeacherByUser(req.user);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Verify the class belongs to this teacher
    const teacherClass = await Class.findOne({
      where: {
        id: classId,
        class_teacher_id: teacher.id,
        is_active: true,
      },
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    // Implement attendance marking logic
    logger.info(
      `Processing attendance for teacher ${teacher.employee_id}, class ${classId}`,
    );

    if (
      !attendance_records ||
      !Array.isArray(attendance_records) ||
      attendance_records.length === 0
    ) {
      return res.status(400).json({ error: "No attendance records provided" });
    }

    if (!attendance_date) {
      return res.status(400).json({ error: "Attendance date is required" });
    }

    // Get school_id from class data
    const classWithSchool = await Class.findOne({
      where: { id: classId },
      include: [{ model: School, attributes: ["id"] }],
    });

    if (!classWithSchool || !classWithSchool.School) {
      return res.status(404).json({ error: "Class or school not found" });
    }

    const school_id = classWithSchool.School.id;
    const processedRecords = [];
    const errors = [];

    // Process each attendance record
    for (const record of attendance_records) {
      try {
        const { student_id, status, arrival_time, notes } = record;

        // Validate student belongs to this class
        const student = await Student.findOne({
          where: {
            id: student_id,
            class_id: classId,
            is_active: true,
          },
        });

        if (!student) {
          errors.push(`Student ${student_id} not found in this class`);
          continue;
        }

        // Check if attendance already exists for this date
        const existingRecord = await AttendanceRecord.findOne({
          where: {
            student_id: student_id,
            attendance_date: attendance_date,
          },
        });

        // Handle time format - convert to full timestamp since column is TIMESTAMP
        let checkInTime = null;
        if (arrival_time) {
          // Convert "HH:MM" to full timestamp for the attendance date
          // Combine attendance_date with arrival_time
          try {
            const dateStr = attendance_date; // YYYY-MM-DD format
            const timeStr = arrival_time.includes(':') ? arrival_time : '00:00';
            checkInTime = new Date(`${dateStr}T${timeStr}:00`);
          } catch (error) {
            logger.warn(`Invalid arrival time format: ${arrival_time}, skipping check_in_time`);
            checkInTime = null;
          }
        }

        const attendanceData = {
          student_id: student_id,
          school_id: school_id,
          attendance_date: attendance_date,
          status: status,
          check_in_time: checkInTime,
          notes: notes || null,
        };

        let attendanceRecord;
        if (existingRecord) {
          // Update existing record
          await existingRecord.update(attendanceData);
          attendanceRecord = existingRecord;
          logger.info(
            `Updated attendance for student ${student.student_id}: ${status}`,
          );
        } else {
          // Create new record
          attendanceRecord = await AttendanceRecord.create(attendanceData);
          logger.info(
            `Created attendance for student ${student.student_id}: ${status}`,
          );
        }

        processedRecords.push({
          student_id: student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          status: status,
          record_id: attendanceRecord.id,
        });
      } catch (error) {
        logger.error(
          `Error processing attendance for student ${record.student_id}:`,
          error.message,
        );
        errors.push(
          `Failed to process attendance for student ${record.student_id}: ${error.message}`,
        );
      }
    }

    logger.info(
      `Attendance processed: ${processedRecords.length} successful, ${errors.length} errors`,
    );

    res.json({
      message: "Attendance marking completed",
      class_id: classId,
      attendance_date: attendance_date,
      records_processed: processedRecords.length,
      records_with_errors: errors.length,
      processed_records: processedRecords,
      errors: errors.length > 0 ? errors : undefined,
      success: errors.length === 0,
    });
  } catch (error) {
    next(error);
  }
});

// Enter grades for teacher's class
router.post("/classes/:classId/grades", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const { classId } = req.params;
    const { grades } = req.body;

    const teacher = await findTeacherByUser(req.user);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Verify the class belongs to this teacher
    const teacherClass = await Class.findOne({
      where: {
        id: classId,
        class_teacher_id: teacher.id,
        is_active: true,
      },
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    // Implement grade entry logic
    logger.info(
      `Processing grades for teacher ${teacher.employee_id}, class ${classId}`,
    );

    const {
      assessment_name,
      assessment_type,
      max_points = 100,
      due_date,
      notes,
      grades: gradeData,
    } = req.body;

    if (!gradeData || !Array.isArray(gradeData) || gradeData.length === 0) {
      return res.status(400).json({ error: "No grade data provided" });
    }

    if (!assessment_name || !assessment_type) {
      return res
        .status(400)
        .json({ error: "Assessment name and type are required" });
    }

    // Get current term
    const currentTerm = await Term.findOne({
      where: { is_current: true, is_active: true },
    });

    if (!currentTerm) {
      return res.status(404).json({ error: "No current active term found" });
    }

    // For simplicity, we'll use Mathematics as the default subject
    // In a real system, the class would be associated with a specific subject
    const defaultSubject = await Subject.findOne({
      where: { code: "MATH" },
    });

    if (!defaultSubject) {
      return res.status(404).json({ error: "Default subject not found" });
    }

    const processedGrades = [];
    const errors = [];

    // Helper function to convert numeric score to standard A-F letter grade with plus/minus
    const convertToStandardGrade = (letterGrade, numericScore) => {
      // If excused, return null
      if (!letterGrade || !numericScore) return null;

      const score = parseFloat(numericScore);

      // Standard A-F grading with plus/minus modifiers
      if (score >= 97) return "A+";
      if (score >= 93) return "A";
      if (score >= 90) return "A-";
      if (score >= 87) return "B+";
      if (score >= 83) return "B";
      if (score >= 80) return "B-";
      if (score >= 77) return "C+";
      if (score >= 73) return "C";
      if (score >= 70) return "C-";
      if (score >= 67) return "D+";
      if (score >= 65) return "D";
      if (score >= 60) return "D-";
      return "F";
    };

    // Process each grade
    for (const gradeRecord of gradeData) {
      try {
        const {
          student_id,
          score,
          letter_grade,
          excused,
          notes: studentNotes,
        } = gradeRecord;

        // Validate student belongs to this class
        const student = await Student.findOne({
          where: {
            id: student_id,
            class_id: classId,
            is_active: true,
          },
        });

        if (!student) {
          errors.push(`Student ${student_id} not found in this class`);
          continue;
        }

        // Skip excused students
        if (excused) {
          logger.info(
            `Student ${student.student_id} excused from ${assessment_name}`,
          );
          continue;
        }

        if (score === null || score === undefined) {
          errors.push(
            `No score provided for student ${student.first_name} ${student.last_name}`,
          );
          continue;
        }

        // Check if grade already exists for this student, subject, and term
        const existingGrade = await Grade.findOne({
          where: {
            student_id: student_id,
            subject_id: defaultSubject.id,
            term_id: currentTerm.id,
            teacher_id: teacher.id,
          },
        });

        const standardGrade = convertToStandardGrade(letter_grade, score);

        const gradeData = {
          student_id: student_id,
          subject_id: defaultSubject.id,
          class_id: classId,
          term_id: currentTerm.id,
          teacher_id: teacher.id,
          grade_value: standardGrade,
          numeric_score: parseFloat(score),
          effort_grade: standardGrade, // Default same as grade_value
          behavior_grade: standardGrade, // Default same as grade_value
          teacher_comments:
            studentNotes || `${assessment_type}: ${assessment_name}`,
          assessment_components: {
            assessment_name: assessment_name,
            assessment_type: assessment_type,
            max_points: max_points,
            raw_score: score,
            letter_grade: letter_grade,
            due_date: due_date,
          },
          date_entered: new Date(),
          last_modified: new Date(),
          is_final: false,
        };

        let grade;
        if (existingGrade) {
          // Update existing grade
          await existingGrade.update({
            ...gradeData,
            last_modified: new Date(),
            // Preserve original date_entered
            date_entered: existingGrade.date_entered,
          });
          grade = existingGrade;
          logger.info(
            `Updated grade for student ${student.student_id}: ${score}/${max_points} (${barbarosGrade})`,
          );
        } else {
          // Create new grade
          grade = await Grade.create(gradeData);
          logger.info(
            `Created grade for student ${student.student_id}: ${score}/${max_points} (${barbarosGrade})`,
          );
        }

        processedGrades.push({
          student_id: student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          numeric_score: parseFloat(score),
          letter_grade: letter_grade,
          barbados_grade: barbarosGrade,
          grade_id: grade.id,
        });
      } catch (error) {
        logger.error(
          `Error processing grade for student ${gradeRecord.student_id}:`,
          error.message,
        );
        errors.push(
          `Failed to process grade for student ${gradeRecord.student_id}: ${error.message}`,
        );
      }
    }

    logger.info(
      `Grades processed: ${processedGrades.length} successful, ${errors.length} errors`,
    );

    res.json({
      message: "Grade entry completed",
      class_id: classId,
      assessment_name: assessment_name,
      assessment_type: assessment_type,
      term: currentTerm.name,
      subject: defaultSubject.name,
      grades_processed: processedGrades.length,
      grades_with_errors: errors.length,
      processed_grades: processedGrades,
      errors: errors.length > 0 ? errors : undefined,
      success: errors.length === 0,
    });
  } catch (error) {
    next(error);
  }
});

// Get all teachers with pagination
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("school_id").optional().isUUID(),
    query("role_level")
      .optional()
      .isIn(["teacher", "senior_teacher", "principal", "vice_principal"]),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { page = 1, limit = 12, school_id, role_level } = req.query;
      const offset = (page - 1) * limit;

      const whereConditions = { is_active: true };
      if (school_id) whereConditions.school_id = school_id;
      if (role_level) whereConditions.role_level = role_level;

      const teachers = await Staff.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: School,
            attributes: ["name", "school_code", "school_category"],
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [
          ["last_name", "ASC"],
          ["first_name", "ASC"],
        ],
      });

      res.json({
        teachers: teachers.rows,
        totalCount: teachers.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(teachers.count / limit),
        hasNext: offset + teachers.rows.length < teachers.count,
        hasPrevious: page > 1,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get grades for teacher's specific class
router.get("/classes/:classId/grades", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const { classId } = req.params;
    const { term_id, subject_id } = req.query;

    const teacher = await findTeacherByUser(req.user);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Verify the class belongs to this teacher
    const teacherClass = await Class.findOne({
      where: {
        id: classId,
        class_teacher_id: teacher.id,
        is_active: true,
      },
      include: [
        {
          model: School,
          attributes: ["name", "school_code"],
        },
      ],
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    // Build where conditions for grades
    const whereConditions = {
      class_id: classId,
      teacher_id: teacher.id,
    };

    if (term_id) whereConditions.term_id = term_id;
    if (subject_id) whereConditions.subject_id = subject_id;

    // Get grades with student and related information
    const grades = await Grade.findAll({
      where: whereConditions,
      include: [
        {
          model: Student,
          attributes: [
            "id",
            "student_id",
            "first_name",
            "last_name",
            "date_of_birth",
          ],
        },
        {
          model: Subject,
          attributes: ["id", "name", "code"],
        },
        {
          model: Term,
          attributes: ["id", "name", "school_year", "term_number"],
        },
      ],
      order: [
        [Student, "last_name", "ASC"],
        [Student, "first_name", "ASC"],
        ["date_entered", "DESC"],
      ],
    });

    // Get current term if not specified
    let currentTerm = null;
    if (!term_id) {
      currentTerm = await Term.findOne({
        where: { is_current: true, is_active: true },
      });
    }

    // Get available terms for filtering
    const availableTerms = await Term.findAll({
      where: { is_active: true },
      attributes: ["id", "name", "school_year", "term_number", "is_current"],
      order: [["school_year", "DESC"], ["term_number", "ASC"]],
    });

    // Get available subjects for filtering
    const availableSubjects = await Subject.findAll({
      where: { is_active: true },
      attributes: ["id", "name", "code"],
      order: [["code", "ASC"]],
    });

    // Group grades by student for easier frontend handling
    const gradesByStudent = {};
    grades.forEach((grade) => {
      const studentId = grade.Student.id;
      if (!gradesByStudent[studentId]) {
        gradesByStudent[studentId] = {
          student: {
            id: grade.Student.id,
            student_id: grade.Student.student_id,
            name: `${grade.Student.first_name} ${grade.Student.last_name}`,
            first_name: grade.Student.first_name,
            last_name: grade.Student.last_name,
          },
          grades: [],
        };
      }
      gradesByStudent[studentId].grades.push({
        id: grade.id,
        grade_value: grade.grade_value,
        numeric_score: grade.numeric_score,
        effort_grade: grade.effort_grade,
        behavior_grade: grade.behavior_grade,
        teacher_comments: grade.teacher_comments,
        assessment_components: grade.assessment_components,
        date_entered: grade.date_entered,
        last_modified: grade.last_modified,
        is_final: grade.is_final,
        subject: grade.Subject,
        term: grade.Term,
      });
    });

    res.json({
      class_info: {
        id: teacherClass.id,
        name: teacherClass.name,
        grade_level: teacherClass.grade_level,
        section: teacherClass.section,
        school: teacherClass.School,
      },
      grades_by_student: Object.values(gradesByStudent),
      total_students_with_grades: Object.keys(gradesByStudent).length,
      total_grade_entries: grades.length,
      current_term: currentTerm,
      available_terms: availableTerms,
      available_subjects: availableSubjects,
      filters: {
        term_id: term_id || currentTerm?.id || null,
        subject_id: subject_id || null,
      },
      message: "Class grades retrieved successfully",
    });
  } catch (error) {
    logger.error("Error retrieving class grades:", error);
    next(error);
  }
});

// Get individual student's grade history in teacher's class
router.get("/classes/:classId/students/:studentId/grades", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const { classId, studentId } = req.params;

    const teacher = await findTeacherByUser(req.user);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Verify the class belongs to this teacher and student is in class
    const teacherClass = await Class.findOne({
      where: {
        id: classId,
        class_teacher_id: teacher.id,
        is_active: true,
      },
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    // Verify student is in this class
    const student = await Student.findOne({
      where: {
        id: studentId,
        class_id: classId,
        is_active: true,
      },
    });

    if (!student) {
      return res
        .status(404)
        .json({ error: "Student not found in this class" });
    }

    // Get all grades for this student
    const grades = await Grade.findAll({
      where: {
        student_id: studentId,
        class_id: classId,
        teacher_id: teacher.id,
      },
      include: [
        {
          model: Subject,
          attributes: ["id", "name", "code"],
        },
        {
          model: Term,
          attributes: ["id", "name", "school_year", "term_number"],
        },
      ],
      order: [["date_entered", "DESC"]],
    });

    res.json({
      student: {
        id: student.id,
        student_id: student.student_id,
        name: `${student.first_name} ${student.last_name}`,
        first_name: student.first_name,
        last_name: student.last_name,
      },
      class_info: teacherClass,
      grades: grades.map((grade) => ({
        id: grade.id,
        grade_value: grade.grade_value,
        numeric_score: grade.numeric_score,
        effort_grade: grade.effort_grade,
        behavior_grade: grade.behavior_grade,
        teacher_comments: grade.teacher_comments,
        assessment_components: grade.assessment_components,
        date_entered: grade.date_entered,
        last_modified: grade.last_modified,
        is_final: grade.is_final,
        subject: grade.Subject,
        term: grade.Term,
      })),
      total_grades: grades.length,
      message: "Student grade history retrieved successfully",
    });
  } catch (error) {
    logger.error("Error retrieving student grades:", error);
    next(error);
  }
});

// Get teacher by ID
router.get("/:id", async (req, res, next) => {
  try {
    const teacher = await Staff.findByPk(req.params.id, {
      include: [{ model: School, attributes: ["name"] }],
    });
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }
    res.json({ teacher });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
