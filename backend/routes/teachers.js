const express = require("express");
const { body, validationResult, query } = require("express-validator");
const { Op } = require("sequelize");
const {
  sequelize,
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
  ClassTimetableSlot,
  SchoolDayPolicy,
} = require("../models");
const { requireRole } = require("../middleware/auth");
const logger = require("../utils/logger");
const {
  CARIBBEAN_GRADE_TO_SCORE,
  scoreToCaribbeanGrade,
} = require("../utils/caribbeanGradeScale");
const {
  DEFAULT_CLASS_SECTIONS,
  getAllowedClassLevelsForSchool,
  normalizeGradeLevelToken,
  resolveGradeLevel,
} = require("../utils/classLevelPolicy");
const {
  GRADE_BANDS,
  ensureDefaultGradingPolicies,
  listGradingPolicies,
  resolveEffectiveGradingPolicy,
  calculateWeightedScore,
} = require("../services/gradingPolicyService");

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

const GRADE_TO_SCORE = CARIBBEAN_GRADE_TO_SCORE;

const toNumericScore = (gradeRow) => {
  const numeric = Number(gradeRow?.numeric_score);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return GRADE_TO_SCORE[gradeRow?.grade_value] ?? null;
};

const toDateKey = (value) => {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
};

const formatDateLabel = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const SLOT_TYPE_VALUES = new Set(["lesson", "break", "lunch", "assembly"]);
const DAY_VALUES = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

const normalizeDayValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeTimeValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  // Accept "HH:MM", "HH:MM:SS", and tolerant variants returned by DB drivers.
  const match = raw.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
};

const timeToMinutes = (value) => {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":");
  return Number(hours) * 60 + Number(minutes);
};

const intervalsOverlap = (startA, endA, startB, endB) => {
  const startAMins = timeToMinutes(startA);
  const endAMins = timeToMinutes(endA);
  const startBMins = timeToMinutes(startB);
  const endBMins = timeToMinutes(endB);

  if (
    !Number.isFinite(startAMins) ||
    !Number.isFinite(endAMins) ||
    !Number.isFinite(startBMins) ||
    !Number.isFinite(endBMins)
  ) {
    return false;
  }

  return startAMins < endBMins && startBMins < endAMins;
};

const deriveDefaultSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const buildDefaultPolicyPayload = (schoolType, actorUserId = null) => {
  const normalizedType = String(schoolType || "").toLowerCase();
  const isSecondary = normalizedType === "secondary";
  return {
    school_day_start: "08:00:00",
    school_day_end: "15:30:00",
    break_start: isSecondary ? "10:30:00" : "10:00:00",
    break_end: isSecondary ? "10:50:00" : "10:20:00",
    lunch_start: isSecondary ? "12:45:00" : "12:00:00",
    lunch_end: isSecondary ? "13:25:00" : "12:45:00",
    is_active: true,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
};

const ensureSchoolDayPolicy = async (school, actorUserId = null) => {
  let policy = await SchoolDayPolicy.findOne({
    where: {
      school_id: school.id,
      is_active: true,
    },
  });

  if (!policy) {
    policy = await SchoolDayPolicy.create({
      school_id: school.id,
      ...buildDefaultPolicyPayload(school.school_type, actorUserId),
    });
  }

  return policy;
};

const serializePolicy = (policy) => ({
  school_day_start: policy.school_day_start,
  school_day_end: policy.school_day_end,
  break_start: policy.break_start,
  break_end: policy.break_end,
  lunch_start: policy.lunch_start,
  lunch_end: policy.lunch_end,
});

const getEligibleStudentsForClassCreation = async ({ schoolId, gradeLevel }) => {
  const gradeToken = normalizeGradeLevelToken(gradeLevel);
  const students = await Student.findAll({
    where: {
      school_id: schoolId,
      is_active: true,
    },
    include: [
      {
        model: Class,
        required: false,
        attributes: ["id", "school_id", "is_active"],
      },
    ],
    attributes: ["id", "student_id", "grade_level", "class_id"],
    order: [
      ["student_id", "ASC"],
      ["last_name", "ASC"],
      ["first_name", "ASC"],
    ],
  });

  return students.filter((student) => {
    if (normalizeGradeLevelToken(student.grade_level) !== gradeToken) {
      return false;
    }

    if (!student.class_id) {
      return true;
    }

    // If linked class is missing/inactive or cross-school, treat as re-assignable.
    const assignedClass = student.Class;
    if (!assignedClass) return true;
    if (!assignedClass.is_active) return true;
    return String(assignedClass.school_id) !== String(schoolId);
  });
};

const sortClassRowsForDistribution = (classRows) =>
  [...classRows].sort(
    (a, b) =>
      String(a.section || "").localeCompare(String(b.section || "")) ||
      String(a.name || "").localeCompare(String(b.name || "")) ||
      String(a.id || "").localeCompare(String(b.id || "")),
  );

const sortStudentsForDistribution = (students) =>
  [...students].sort(
    (a, b) =>
      String(a.student_id || "").localeCompare(String(b.student_id || "")) ||
      String(a.last_name || "").localeCompare(String(b.last_name || "")) ||
      String(a.first_name || "").localeCompare(String(b.first_name || "")),
  );

const distributeEvenly = (items, bucketCount) => {
  if (!bucketCount || bucketCount < 1) return [];
  const buckets = Array.from({ length: bucketCount }, () => []);
  for (let index = 0; index < items.length; index += 1) {
    buckets[index % bucketCount].push(items[index]);
  }
  return buckets;
};

const rebalanceGradeEnrollmentForSchoolYear = async ({
  schoolId,
  gradeLevel,
  schoolYear,
  transaction,
}) => {
  const gradeToken = normalizeGradeLevelToken(gradeLevel);

  const classes = await Class.findAll({
    where: {
      school_id: schoolId,
      school_year: schoolYear,
      is_active: true,
    },
    attributes: ["id", "name", "grade_level", "section", "capacity", "current_enrollment"],
    transaction,
  });

  const gradeClasses = sortClassRowsForDistribution(
    classes.filter(
      (classRow) => normalizeGradeLevelToken(classRow.grade_level) === gradeToken,
    ),
  );

  if (gradeClasses.length === 0) {
    return {
      total_students: 0,
      class_counts: {},
    };
  }

  const gradeStudents = sortStudentsForDistribution(
    await Student.findAll({
      where: {
        school_id: schoolId,
        is_active: true,
        [Op.and]: [
          sequelize.where(
            sequelize.fn("LOWER", sequelize.col("Student.grade_level")),
            String(gradeLevel).toLowerCase(),
          ),
        ],
      },
      attributes: ["id", "student_id", "first_name", "last_name"],
      transaction,
    }),
  );

  const gradeStudentIds = gradeStudents.map((student) => student.id);
  if (gradeStudentIds.length > 0) {
    await Student.update(
      { class_id: null, class_section: null },
      {
        where: { id: { [Op.in]: gradeStudentIds } },
        transaction,
      },
    );
  }

  const buckets = distributeEvenly(gradeStudents, gradeClasses.length);
  const classCounts = {};

  for (let index = 0; index < gradeClasses.length; index += 1) {
    const classRow = gradeClasses[index];
    const bucket = buckets[index] || [];
    const bucketIds = bucket.map((student) => student.id);

    if (bucketIds.length > 0) {
      await Student.update(
        {
          class_id: classRow.id,
          class_section: classRow.section,
        },
        {
          where: { id: { [Op.in]: bucketIds } },
          transaction,
        },
      );
    }

    const enrollment = bucketIds.length;
    await classRow.update(
      {
        current_enrollment: enrollment,
        capacity: Math.max(1, enrollment),
      },
      { transaction },
    );
    classCounts[String(classRow.id)] = enrollment;
  }

  return {
    total_students: gradeStudents.length,
    class_counts: classCounts,
  };
};

const validatePolicyWindow = (policyValues) => {
  const dayStart = timeToMinutes(policyValues.school_day_start);
  const dayEnd = timeToMinutes(policyValues.school_day_end);
  const breakStart = timeToMinutes(policyValues.break_start);
  const breakEnd = timeToMinutes(policyValues.break_end);
  const lunchStart = timeToMinutes(policyValues.lunch_start);
  const lunchEnd = timeToMinutes(policyValues.lunch_end);

  if (
    !Number.isFinite(dayStart) ||
    !Number.isFinite(dayEnd) ||
    !Number.isFinite(breakStart) ||
    !Number.isFinite(breakEnd) ||
    !Number.isFinite(lunchStart) ||
    !Number.isFinite(lunchEnd)
  ) {
    return "Invalid time value";
  }

  if (dayStart >= dayEnd) return "School day end must be after school day start";
  if (breakStart >= breakEnd) return "Break end must be after break start";
  if (lunchStart >= lunchEnd) return "Lunch end must be after lunch start";

  if (breakStart < dayStart || breakEnd > dayEnd) {
    return "Break time must be inside school day hours";
  }
  if (lunchStart < dayStart || lunchEnd > dayEnd) {
    return "Lunch time must be inside school day hours";
  }
  if (breakStart < lunchEnd && lunchStart < breakEnd) {
    return "Break and lunch times cannot overlap";
  }

  return null;
};

const getPolicyLessonConflicts = (slots, policyValues) =>
  slots.filter((slot) => {
    const slotStart = timeToMinutes(slot.start_time);
    const slotEnd = timeToMinutes(slot.end_time);
    if (!Number.isFinite(slotStart) || !Number.isFinite(slotEnd)) {
      return false;
    }

    if (
      slotStart < timeToMinutes(policyValues.school_day_start) ||
      slotEnd > timeToMinutes(policyValues.school_day_end)
    ) {
      return true;
    }

    return (
      intervalsOverlap(
        slot.start_time,
        slot.end_time,
        policyValues.break_start,
        policyValues.break_end,
      ) ||
      intervalsOverlap(
        slot.start_time,
        slot.end_time,
        policyValues.lunch_start,
        policyValues.lunch_end,
      )
    );
  });

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

// Get class and timetable creation options for current teacher's school
router.get("/class-options", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const school = await School.findByPk(teacher.school_id, {
      attributes: [
        "id",
        "name",
        "school_type",
        "school_category",
        "offers_sixth_form",
      ],
    });

    if (!school) {
      return res.status(404).json({ error: "Teacher school not found" });
    }

    const [subjects, schoolClasses, policy, schoolStudents] = await Promise.all([
      Subject.findAll({
        where: { is_active: true },
        attributes: ["id", "name", "code"],
        order: [["code", "ASC"]],
      }),
      Class.findAll({
        where: {
          school_id: school.id,
          is_active: true,
        },
        attributes: [
          "id",
          "name",
          "grade_level",
          "section",
          "school_year",
          "class_teacher_id",
        ],
        order: [
          ["grade_level", "ASC"],
          ["section", "ASC"],
        ],
      }),
      ensureSchoolDayPolicy(school, req.user.id),
      Student.findAll({
        where: {
          school_id: school.id,
          is_active: true,
        },
        attributes: ["grade_level"],
      }),
    ]);

    const gradeStudentCounts = schoolStudents.reduce((acc, student) => {
      const key = String(student.grade_level || "").trim();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const allowedGradeLevels = getAllowedClassLevelsForSchool(school);

    res.json({
      school,
      default_sections: DEFAULT_CLASS_SECTIONS,
      allowed_grade_levels: allowedGradeLevels,
      subjects,
      day_policy: serializePolicy(policy),
      grade_student_counts: gradeStudentCounts,
      existing_classes: schoolClasses,
    });
  } catch (error) {
    next(error);
  }
});

// Update school day policy for teacher's school timetable rules
router.patch("/class-options/day-policy", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const school = await School.findByPk(teacher.school_id, {
      attributes: ["id", "name", "school_type"],
    });
    if (!school) {
      return res.status(404).json({ error: "Teacher school not found" });
    }

    const policy = await ensureSchoolDayPolicy(school, req.user.id);
    const currentPolicy = serializePolicy(policy);
    const nextPolicy = {
      school_day_start: normalizeTimeValue(
        req.body?.school_day_start ?? currentPolicy.school_day_start,
      ),
      school_day_end: normalizeTimeValue(
        req.body?.school_day_end ?? currentPolicy.school_day_end,
      ),
      break_start: normalizeTimeValue(req.body?.break_start ?? currentPolicy.break_start),
      break_end: normalizeTimeValue(req.body?.break_end ?? currentPolicy.break_end),
      lunch_start: normalizeTimeValue(req.body?.lunch_start ?? currentPolicy.lunch_start),
      lunch_end: normalizeTimeValue(req.body?.lunch_end ?? currentPolicy.lunch_end),
    };

    const validationError = validatePolicyWindow(nextPolicy);
    if (validationError) {
      return res.status(400).json({
        error: validationError,
        day_policy: currentPolicy,
      });
    }

    const schoolLessonSlots = await ClassTimetableSlot.findAll({
      where: {
        is_active: true,
        slot_type: "lesson",
      },
      include: [
        {
          model: Class,
          required: true,
          where: {
            school_id: school.id,
            is_active: true,
          },
          attributes: ["id", "name", "grade_level", "section"],
        },
      ],
      attributes: ["id", "class_id", "day_of_week", "start_time", "end_time"],
      order: [
        ["day_of_week", "ASC"],
        ["start_time", "ASC"],
      ],
    });

    const conflicts = getPolicyLessonConflicts(schoolLessonSlots, nextPolicy);
    if (conflicts.length > 0) {
      return res.status(409).json({
        error:
          "Policy update would conflict with existing lesson periods. Adjust lesson times first.",
        day_policy: currentPolicy,
        conflicts: conflicts.slice(0, 20).map((slot) => ({
          id: slot.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          class_id: slot.class_id,
          class_name: slot.Class?.name || null,
          grade_level: slot.Class?.grade_level || null,
          section: slot.Class?.section || null,
        })),
        conflict_count: conflicts.length,
      });
    }

    await policy.update({
      ...nextPolicy,
      updated_by: req.user.id,
    });

    res.json({
      message: "School timetable policy updated",
      day_policy: serializePolicy(policy),
    });
  } catch (error) {
    next(error);
  }
});

// Create a class in teacher's own school
router.post("/classes", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const school = await School.findByPk(teacher.school_id, {
      attributes: [
        "id",
        "name",
        "school_type",
        "school_category",
        "offers_sixth_form",
      ],
    });

    if (!school) {
      return res.status(404).json({ error: "Teacher school not found" });
    }

    const rawSection = String(req.body?.section || "")
      .trim()
      .toUpperCase();
    const section = rawSection || DEFAULT_CLASS_SECTIONS[0];
    const normalizedGradeLevel = resolveGradeLevel(req.body?.grade_level, school);
    const schoolYear = String(req.body?.school_year || deriveDefaultSchoolYear()).trim();
    const capacityValue = Number(req.body?.capacity);

    if (!normalizedGradeLevel) {
      return res.status(400).json({
        error: "Invalid grade level for this school",
        allowed_grade_levels: getAllowedClassLevelsForSchool(school),
      });
    }

    if (!section || section.length > 5) {
      return res.status(400).json({ error: "Section must be between 1 and 5 characters" });
    }

    const existingClasses = await Class.findAll({
      where: {
        school_id: school.id,
        school_year: schoolYear,
        section,
      },
      attributes: ["id", "grade_level", "is_active"],
    });

    const hasDuplicate = existingClasses.some(
      (row) =>
        row.is_active &&
        normalizeGradeLevelToken(row.grade_level) ===
          normalizeGradeLevelToken(normalizedGradeLevel),
    );

    if (hasDuplicate) {
      return res.status(409).json({
        error: "A class already exists for this grade, section, and school year",
      });
    }

    const requestedCapacity = Number.isFinite(capacityValue)
      ? Math.max(1, Math.min(50, Math.round(capacityValue)))
      : 30;

    const providedName = String(req.body?.name || "").trim();
    const className = providedName || `${normalizedGradeLevel} - Section ${section}`;

    const { createdClass, assignedCount, totalGradeStudents } = await sequelize.transaction(
      async (transaction) => {
      const newClass = await Class.create(
        {
          school_id: school.id,
          class_teacher_id: teacher.id,
          name: className,
          grade_level: normalizedGradeLevel,
          section,
          school_year: schoolYear,
          capacity: requestedCapacity,
          current_enrollment: 0,
          is_active: true,
        },
        { transaction },
      );

      const rebalanceResult = await rebalanceGradeEnrollmentForSchoolYear({
        schoolId: school.id,
        gradeLevel: normalizedGradeLevel,
        schoolYear,
        transaction,
      });

      const newClassEnrollment = Number(rebalanceResult.class_counts[String(newClass.id)] || 0);
      return {
        createdClass: newClass,
        assignedCount: newClassEnrollment,
        totalGradeStudents: rebalanceResult.total_students,
      };
      },
    );

    const hydratedClass = await Class.findByPk(createdClass.id, {
      include: [
        {
          model: School,
          attributes: ["id", "name", "school_code"],
        },
      ],
    });

    res.status(201).json({
      message: "Class created successfully",
      assigned_students: assignedCount,
      available_students_for_grade: totalGradeStudents,
      requested_capacity: requestedCapacity,
      effective_capacity: Math.max(1, assignedCount),
      class: hydratedClass,
    });
  } catch (error) {
    next(error);
  }
});

// Delete (deactivate) a teacher class
router.delete("/classes/:classId", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacherClass = await Class.findOne({
      where: {
        id: req.params.classId,
        class_teacher_id: teacher.id,
        school_id: teacher.school_id,
        is_active: true,
      },
      attributes: ["id", "name", "grade_level", "section"],
    });

    if (!teacherClass) {
      return res.status(404).json({ error: "Class not found or already removed" });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const [unenrolledCount, disabledSlotCount] = await Promise.all([
        Student.update(
          { class_id: null, class_section: null },
          {
            where: {
              class_id: teacherClass.id,
              school_id: teacher.school_id,
              is_active: true,
            },
            transaction,
          },
        ),
        ClassTimetableSlot.update(
          { is_active: false },
          {
            where: { class_id: teacherClass.id, is_active: true },
            transaction,
          },
        ),
      ]);

      await teacherClass.update(
        {
          is_active: false,
          current_enrollment: 0,
        },
        { transaction },
      );

      return {
        unenrolledStudents: Array.isArray(unenrolledCount)
          ? Number(unenrolledCount[0] || 0)
          : Number(unenrolledCount || 0),
        disabledSlots: Array.isArray(disabledSlotCount)
          ? Number(disabledSlotCount[0] || 0)
          : Number(disabledSlotCount || 0),
      };
    });

    res.json({
      message: "Class deleted successfully",
      class: {
        id: teacherClass.id,
        name: teacherClass.name,
        grade_level: teacherClass.grade_level,
        section: teacherClass.section,
      },
      unenrolled_students: result.unenrolledStudents,
      disabled_timetable_slots: result.disabledSlots,
    });
  } catch (error) {
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
        school_id: teacher.school_id,
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

// Get timetable for a specific teacher class
router.get("/classes/:classId/timetable", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacherClass = await Class.findOne({
      where: {
        id: req.params.classId,
        class_teacher_id: teacher.id,
        school_id: teacher.school_id,
        is_active: true,
      },
      include: [{ model: School, attributes: ["id", "name", "school_type"] }],
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    const [slots, policy] = await Promise.all([
      ClassTimetableSlot.findAll({
        where: {
          class_id: teacherClass.id,
          is_active: true,
        },
        include: [{ model: Subject, attributes: ["id", "name", "code"], required: false }],
        order: [
          ["day_of_week", "ASC"],
          ["start_time", "ASC"],
        ],
      }),
      ensureSchoolDayPolicy(teacherClass.School, req.user.id),
    ]);

    res.json({
      class_info: {
        id: teacherClass.id,
        name: teacherClass.name,
        grade_level: teacherClass.grade_level,
        section: teacherClass.section,
        school: teacherClass.School,
      },
      day_policy: serializePolicy(policy),
      slots,
    });
  } catch (error) {
    next(error);
  }
});

// Create timetable slot for a teacher class
router.post("/classes/:classId/timetable-slots", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacherClass = await Class.findOne({
      where: {
        id: req.params.classId,
        class_teacher_id: teacher.id,
        school_id: teacher.school_id,
        is_active: true,
      },
      include: [{ model: School, attributes: ["id", "name", "school_type"] }],
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    const slotType = String(req.body?.slot_type || "lesson").trim().toLowerCase();
    const dayOfWeek = normalizeDayValue(req.body?.day_of_week);
    const startTime = normalizeTimeValue(req.body?.start_time);
    const endTime = normalizeTimeValue(req.body?.end_time);
    const room = String(req.body?.room || "").trim() || null;
    const notes = String(req.body?.notes || "").trim() || null;
    const subjectId = req.body?.subject_id || null;

    if (!SLOT_TYPE_VALUES.has(slotType)) {
      return res.status(400).json({ error: "Invalid slot type" });
    }

    if (!DAY_VALUES.has(dayOfWeek)) {
      return res.status(400).json({ error: "Invalid day of week" });
    }

    if (!startTime || !endTime || timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return res.status(400).json({ error: "Invalid start/end time range" });
    }

    if (slotType === "lesson" && !subjectId) {
      return res.status(400).json({ error: "Subject is required for lesson slots" });
    }

    const policy = await ensureSchoolDayPolicy(teacherClass.School, req.user.id);
    const policyValues = serializePolicy(policy);

    if (
      timeToMinutes(startTime) < timeToMinutes(policyValues.school_day_start) ||
      timeToMinutes(endTime) > timeToMinutes(policyValues.school_day_end)
    ) {
      return res.status(400).json({
        error: "Slot must be within school day hours",
        day_policy: policyValues,
      });
    }

    if (
      slotType === "lesson" &&
      (intervalsOverlap(startTime, endTime, policyValues.break_start, policyValues.break_end) ||
        intervalsOverlap(startTime, endTime, policyValues.lunch_start, policyValues.lunch_end))
    ) {
      return res.status(400).json({
        error: "Selected period conflicts with break or lunch time",
        day_policy: policyValues,
      });
    }

    const potentialConflicts = await ClassTimetableSlot.findAll({
      where: {
        day_of_week: dayOfWeek,
        is_active: true,
        [Op.or]: [{ class_id: teacherClass.id }, { teacher_id: teacher.id }],
      },
      attributes: [
        "id",
        "class_id",
        "teacher_id",
        "day_of_week",
        "start_time",
        "end_time",
        "slot_type",
      ],
    });

    const conflicting = potentialConflicts.find((slot) =>
      intervalsOverlap(startTime, endTime, slot.start_time, slot.end_time),
    );

    if (conflicting) {
      const isTeacherConflict = String(conflicting.teacher_id) === String(teacher.id);
      const reason = isTeacherConflict
        ? "Teacher already has another class in this time slot"
        : "Class already has a slot in this time period";
      return res.status(409).json({ error: reason, conflict_slot: conflicting });
    }

    const slot = await ClassTimetableSlot.create({
      class_id: teacherClass.id,
      teacher_id: teacher.id,
      subject_id: slotType === "lesson" ? subjectId : null,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_type: slotType,
      room,
      notes,
      is_active: true,
    });

    const hydratedSlot = await ClassTimetableSlot.findByPk(slot.id, {
      include: [{ model: Subject, attributes: ["id", "name", "code"], required: false }],
    });

    res.status(201).json({
      message: "Timetable slot created",
      slot: hydratedSlot,
      day_policy: policyValues,
    });
  } catch (error) {
    next(error);
  }
});

// Update timetable slot for a teacher class (used by drag-and-drop and edits)
router.patch("/classes/:classId/timetable-slots/:slotId", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacherClass = await Class.findOne({
      where: {
        id: req.params.classId,
        class_teacher_id: teacher.id,
        school_id: teacher.school_id,
        is_active: true,
      },
      include: [{ model: School, attributes: ["id", "name", "school_type"] }],
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    const slot = await ClassTimetableSlot.findOne({
      where: {
        id: req.params.slotId,
        class_id: teacherClass.id,
        teacher_id: teacher.id,
        is_active: true,
      },
    });

    if (!slot) {
      return res.status(404).json({ error: "Timetable slot not found" });
    }

    const slotType = String(req.body?.slot_type || slot.slot_type)
      .trim()
      .toLowerCase();
    const dayOfWeek = normalizeDayValue(req.body?.day_of_week || slot.day_of_week);
    const startTime = normalizeTimeValue(req.body?.start_time || slot.start_time);
    const endTime = normalizeTimeValue(req.body?.end_time || slot.end_time);
    const room =
      req.body?.room === undefined
        ? slot.room
        : String(req.body?.room || "").trim() || null;
    const notes =
      req.body?.notes === undefined
        ? slot.notes
        : String(req.body?.notes || "").trim() || null;
    const subjectId =
      slotType === "lesson"
        ? req.body?.subject_id === undefined
          ? slot.subject_id
          : req.body?.subject_id || null
        : null;

    if (!SLOT_TYPE_VALUES.has(slotType)) {
      return res.status(400).json({ error: "Invalid slot type" });
    }

    if (!DAY_VALUES.has(dayOfWeek)) {
      return res.status(400).json({ error: "Invalid day of week" });
    }

    if (!startTime || !endTime || timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return res.status(400).json({ error: "Invalid start/end time range" });
    }

    if (slotType === "lesson" && !subjectId) {
      return res.status(400).json({ error: "Subject is required for lesson slots" });
    }

    const policy = await ensureSchoolDayPolicy(teacherClass.School, req.user.id);
    const policyValues = serializePolicy(policy);

    if (
      timeToMinutes(startTime) < timeToMinutes(policyValues.school_day_start) ||
      timeToMinutes(endTime) > timeToMinutes(policyValues.school_day_end)
    ) {
      return res.status(400).json({
        error: "Slot must be within school day hours",
        day_policy: policyValues,
      });
    }

    if (
      slotType === "lesson" &&
      (intervalsOverlap(startTime, endTime, policyValues.break_start, policyValues.break_end) ||
        intervalsOverlap(startTime, endTime, policyValues.lunch_start, policyValues.lunch_end))
    ) {
      return res.status(400).json({
        error: "Selected period conflicts with break or lunch time",
        day_policy: policyValues,
      });
    }

    const potentialConflicts = await ClassTimetableSlot.findAll({
      where: {
        id: { [Op.ne]: slot.id },
        day_of_week: dayOfWeek,
        is_active: true,
        [Op.or]: [{ class_id: teacherClass.id }, { teacher_id: teacher.id }],
      },
      attributes: [
        "id",
        "class_id",
        "teacher_id",
        "day_of_week",
        "start_time",
        "end_time",
        "slot_type",
      ],
    });

    const conflicting = potentialConflicts.find((candidate) =>
      intervalsOverlap(startTime, endTime, candidate.start_time, candidate.end_time),
    );

    if (conflicting) {
      const isTeacherConflict = String(conflicting.teacher_id) === String(teacher.id);
      const reason = isTeacherConflict
        ? "Teacher already has another class in this time slot"
        : "Class already has a slot in this time period";
      return res.status(409).json({ error: reason, conflict_slot: conflicting });
    }

    await slot.update({
      subject_id: slotType === "lesson" ? subjectId : null,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_type: slotType,
      room,
      notes,
    });

    const hydratedSlot = await ClassTimetableSlot.findByPk(slot.id, {
      include: [{ model: Subject, attributes: ["id", "name", "code"], required: false }],
    });

    res.json({
      message: "Timetable slot updated",
      slot: hydratedSlot,
      day_policy: policyValues,
    });
  } catch (error) {
    next(error);
  }
});

// Remove timetable slot from a teacher class
router.delete("/classes/:classId/timetable-slots/:slotId", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacherClass = await Class.findOne({
      where: {
        id: req.params.classId,
        class_teacher_id: teacher.id,
        school_id: teacher.school_id,
        is_active: true,
      },
      attributes: ["id"],
    });

    if (!teacherClass) {
      return res
        .status(403)
        .json({ error: "Access denied: Class not assigned to this teacher" });
    }

    const slot = await ClassTimetableSlot.findOne({
      where: {
        id: req.params.slotId,
        class_id: teacherClass.id,
        teacher_id: teacher.id,
      },
    });

    if (!slot) {
      return res.status(404).json({ error: "Timetable slot not found" });
    }

    await slot.update({ is_active: false });

    res.json({ message: "Timetable slot removed successfully" });
  } catch (error) {
    next(error);
  }
});

// Get teacher grade queue (students in assigned classes without grades for current term)
router.get("/grade-queue", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const currentTerm =
      (await Term.findOne({
        where: { is_current: true, is_active: true },
        order: [["term_number", "ASC"]],
      })) ||
      (await Term.findOne({
        where: { is_active: true },
        order: [
          ["school_year", "DESC"],
          ["term_number", "DESC"],
        ],
      }));

    if (!currentTerm) {
      return res.json({
        term: null,
        pending_count: 0,
        total_students_in_classes: 0,
        due_by_class: [],
        due_students: [],
      });
    }

    const teacherClasses = await Class.findAll({
      where: {
        class_teacher_id: teacher.id,
        school_id: teacher.school_id,
        is_active: true,
      },
      attributes: ["id", "name", "grade_level", "section"],
      order: [
        ["grade_level", "ASC"],
        ["section", "ASC"],
      ],
    });

    if (teacherClasses.length === 0) {
      return res.json({
        term: {
          id: currentTerm.id,
          name: currentTerm.name,
          school_year: currentTerm.school_year,
          term_number: currentTerm.term_number,
        },
        pending_count: 0,
        total_students_in_classes: 0,
        due_by_class: [],
        due_students: [],
      });
    }

    const classIds = teacherClasses.map((classRow) => classRow.id);

    const [students, existingGrades] = await Promise.all([
      Student.findAll({
        where: {
          class_id: { [Op.in]: classIds },
          school_id: teacher.school_id,
          is_active: true,
        },
        attributes: [
          "id",
          "student_id",
          "first_name",
          "last_name",
          "class_id",
          "grade_level",
        ],
        order: [
          ["last_name", "ASC"],
          ["first_name", "ASC"],
        ],
      }),
      Grade.findAll({
        where: {
          class_id: { [Op.in]: classIds },
          term_id: currentTerm.id,
        },
        attributes: ["student_id", "class_id"],
        raw: true,
      }),
    ]);

    const classLookup = new Map(
      teacherClasses.map((classRow) => [String(classRow.id), classRow]),
    );

    const gradedStudentIds = new Set(
      existingGrades.map((row) => String(row.student_id)),
    );

    const dueStudents = students
      .filter((student) => !gradedStudentIds.has(String(student.id)))
      .map((student) => {
        const classInfo = classLookup.get(String(student.class_id));
        return {
          student_id: student.id,
          student_code: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          grade_level: student.grade_level,
          class_id: student.class_id,
          class_name: classInfo?.name || "Unknown Class",
          class_grade_level: classInfo?.grade_level || student.grade_level,
          class_section: classInfo?.section || "",
        };
      });

    const dueByClassMap = dueStudents.reduce((acc, row) => {
      const key = String(row.class_id);
      if (!acc.has(key)) {
        acc.set(key, {
          class_id: row.class_id,
          class_name: row.class_name,
          class_grade_level: row.class_grade_level,
          class_section: row.class_section,
          pending_count: 0,
        });
      }

      acc.get(key).pending_count += 1;
      return acc;
    }, new Map());

    const dueByClass = Array.from(dueByClassMap.values()).sort(
      (a, b) => b.pending_count - a.pending_count,
    );

    res.json({
      term: {
        id: currentTerm.id,
        name: currentTerm.name,
        school_year: currentTerm.school_year,
        term_number: currentTerm.term_number,
      },
      pending_count: dueStudents.length,
      total_students_in_classes: students.length,
      due_by_class: dueByClass,
      due_students: dueStudents,
    });
  } catch (error) {
    logger.error("Error retrieving teacher grade queue:", error);
    next(error);
  }
});

// Get effective grading policy for teacher school / class context
router.get("/grading-policy", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const { class_id: classId } = req.query;
    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const school = await School.findByPk(teacher.school_id, {
      attributes: ["id", "name", "school_type"],
    });
    if (!school) {
      return res.status(404).json({ error: "School not found for teacher profile" });
    }

    await ensureDefaultGradingPolicies(req.user?.id || null);

    const policyList = await listGradingPolicies({
      schoolId: school.id,
      schoolType: school.school_type,
    });

    let classContext = null;
    if (classId) {
      const teacherClass = await Class.findOne({
        where: {
          id: classId,
          class_teacher_id: teacher.id,
          school_id: teacher.school_id,
          is_active: true,
        },
        attributes: ["id", "name", "grade_level", "section"],
      });

      if (!teacherClass) {
        return res
          .status(403)
          .json({ error: "Access denied: Class not assigned to this teacher" });
      }

      classContext = teacherClass;
    }

    const effectivePolicy = classContext
      ? await resolveEffectiveGradingPolicy({
          schoolId: school.id,
          schoolType: school.school_type,
          gradeLevel: classContext.grade_level,
        })
      : null;

    const teacherClasses = await Class.findAll({
      where: {
        class_teacher_id: teacher.id,
        school_id: teacher.school_id,
        is_active: true,
      },
      attributes: ["id", "name", "grade_level", "section"],
      order: [
        ["grade_level", "ASC"],
        ["section", "ASC"],
      ],
    });

    const classPolicyPreview = await Promise.all(
      teacherClasses.map(async (classRow) => {
        const policy = await resolveEffectiveGradingPolicy({
          schoolId: school.id,
          schoolType: school.school_type,
          gradeLevel: classRow.grade_level,
        });

        return {
          class_id: classRow.id,
          class_name: classRow.name,
          grade_level: classRow.grade_level,
          section: classRow.section,
          policy,
        };
      }),
    );

    res.json({
      school: {
        id: school.id,
        name: school.name,
        school_type: school.school_type,
      },
      grade_bands: GRADE_BANDS,
      policies: policyList.policies,
      effective_by_band: policyList.effective_by_band,
      selected_class: classContext
        ? {
            id: classContext.id,
            name: classContext.name,
            grade_level: classContext.grade_level,
            section: classContext.section,
            policy: effectivePolicy,
          }
        : null,
      class_policy_preview: classPolicyPreview,
    });
  } catch (error) {
    logger.error("Error retrieving teacher grading policy:", error);
    next(error);
  }
});

// Get grade analytics for teacher classes
router.get("/grade-analytics", async (req, res, next) => {
  try {
    if (req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Access denied: Teacher role required" });
    }

    const { class_id: classIdFilter, term_id: termIdFilter } = req.query;

    const teacher = await findTeacherByUser(req.user);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacherClasses = await Class.findAll({
      where: {
        class_teacher_id: teacher.id,
        school_id: teacher.school_id,
        is_active: true,
      },
      attributes: ["id", "name", "grade_level", "section"],
      order: [
        ["grade_level", "ASC"],
        ["section", "ASC"],
      ],
    });

    if (teacherClasses.length === 0) {
      return res.json({
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
    }

    const classLookup = new Map(
      teacherClasses.map((classRow) => [String(classRow.id), classRow]),
    );

    let classIds = teacherClasses.map((classRow) => classRow.id);

    if (classIdFilter) {
      const normalizedFilter = String(classIdFilter);
      if (!classLookup.has(normalizedFilter)) {
        return res.status(403).json({
          error: "Access denied: class is not assigned to this teacher",
        });
      }
      classIds = [normalizedFilter];
    }

    const selectedTerm =
      (termIdFilter
        ? await Term.findOne({
            where: {
              id: termIdFilter,
              is_active: true,
            },
          })
        : null) ||
      (await Term.findOne({
        where: { is_current: true, is_active: true },
        order: [["term_number", "ASC"]],
      })) ||
      (await Term.findOne({
        where: { is_active: true },
        order: [
          ["school_year", "DESC"],
          ["term_number", "DESC"],
        ],
      }));

    if (!selectedTerm) {
      return res.json({
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
    }

    const [students, grades] = await Promise.all([
      Student.findAll({
        where: {
          class_id: { [Op.in]: classIds },
          school_id: teacher.school_id,
          is_active: true,
        },
        attributes: ["id", "first_name", "last_name", "student_id", "gender", "class_id"],
      }),
      Grade.findAll({
        where: {
          teacher_id: teacher.id,
          term_id: selectedTerm.id,
          class_id: { [Op.in]: classIds },
        },
        attributes: [
          "id",
          "student_id",
          "class_id",
          "grade_value",
          "numeric_score",
          "date_entered",
          "created_at",
          "updated_at",
        ],
        order: [["date_entered", "ASC"]],
      }),
    ]);

    const studentLookup = new Map(students.map((student) => [String(student.id), student]));
    const enrichedGrades = grades
      .map((grade) => {
        const student = studentLookup.get(String(grade.student_id));
        const numericScore = toNumericScore(grade);
        if (!student || !Number.isFinite(numericScore)) {
          return null;
        }

        const classInfo = classLookup.get(String(grade.class_id));
        const enteredAt = grade.date_entered || grade.created_at || grade.updated_at;

        return {
          grade_id: grade.id,
          grade_value: scoreToCaribbeanGrade(numericScore) || grade.grade_value,
          numeric_score: Number(numericScore),
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          student_code: student.student_id,
          gender: student.gender || "unspecified",
          class_id: grade.class_id,
          class_name: classInfo?.name || "Unknown Class",
          class_grade_level: classInfo?.grade_level || "N/A",
          date_key: toDateKey(enteredAt),
        };
      })
      .filter(Boolean);

    const gradeValuesOrder = [
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

    const gradeDistributionMap = gradeValuesOrder.reduce((acc, value) => {
      acc[value] = 0;
      return acc;
    }, {});

    const genderStats = {
      male: { totalScore: 0, count: 0 },
      female: { totalScore: 0, count: 0 },
      other: { totalScore: 0, count: 0 },
      unspecified: { totalScore: 0, count: 0 },
    };

    const studentAggregate = new Map();
    const chronologyMap = new Map();

    for (const row of enrichedGrades) {
      if (gradeDistributionMap[row.grade_value] !== undefined) {
        gradeDistributionMap[row.grade_value] += 1;
      }

      const genderKey = ["male", "female", "other"].includes(String(row.gender))
        ? String(row.gender)
        : "unspecified";
      genderStats[genderKey].totalScore += row.numeric_score;
      genderStats[genderKey].count += 1;

      if (!studentAggregate.has(String(row.student_id))) {
        studentAggregate.set(String(row.student_id), {
          student_id: row.student_id,
          student_name: row.student_name,
          gender: row.gender,
          class_id: row.class_id,
          class_name: row.class_name,
          total_score: 0,
          count: 0,
        });
      }
      const aggregate = studentAggregate.get(String(row.student_id));
      aggregate.total_score += row.numeric_score;
      aggregate.count += 1;

      if (row.date_key) {
        if (!chronologyMap.has(row.date_key)) {
          chronologyMap.set(row.date_key, {
            date: row.date_key,
            male_scores: [],
            female_scores: [],
            other_scores: [],
            all_scores: [],
            top: null,
          });
        }

        const dateBucket = chronologyMap.get(row.date_key);
        dateBucket.all_scores.push(row.numeric_score);
        if (genderKey === "male") dateBucket.male_scores.push(row.numeric_score);
        if (genderKey === "female") dateBucket.female_scores.push(row.numeric_score);
        if (genderKey !== "male" && genderKey !== "female") {
          dateBucket.other_scores.push(row.numeric_score);
        }

        if (!dateBucket.top || row.numeric_score > dateBucket.top.numeric_score) {
          dateBucket.top = {
            student_id: row.student_id,
            student_name: row.student_name,
            class_name: row.class_name,
            numeric_score: row.numeric_score,
          };
        }
      }
    }

    const safeAverage = (total, count) => (count > 0 ? Number((total / count).toFixed(2)) : 0);

    const maleAverage = safeAverage(
      genderStats.male.totalScore,
      genderStats.male.count,
    );
    const femaleAverage = safeAverage(
      genderStats.female.totalScore,
      genderStats.female.count,
    );
    const overallAverage = safeAverage(
      enrichedGrades.reduce((sum, row) => sum + row.numeric_score, 0),
      enrichedGrades.length,
    );

    let leadingGender = "n/a";
    if (genderStats.male.count > 0 || genderStats.female.count > 0) {
      leadingGender = maleAverage > femaleAverage ? "male" : "female";
      if (maleAverage === femaleAverage) {
        leadingGender = "tie";
      }
    }

    const gradeDistribution = gradeValuesOrder.map((gradeValue) => ({
      grade_value: gradeValue,
      count: gradeDistributionMap[gradeValue] || 0,
    }));

    const genderDistribution = ["male", "female", "other", "unspecified"].map((gender) => ({
      gender,
      grade_entries: genderStats[gender].count,
      average_score: safeAverage(genderStats[gender].totalScore, genderStats[gender].count),
    }));

    const chronology = Array.from(chronologyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        date: row.date,
        label: formatDateLabel(row.date),
        male_average: safeAverage(
          row.male_scores.reduce((sum, value) => sum + value, 0),
          row.male_scores.length,
        ),
        female_average: safeAverage(
          row.female_scores.reduce((sum, value) => sum + value, 0),
          row.female_scores.length,
        ),
        overall_average: safeAverage(
          row.all_scores.reduce((sum, value) => sum + value, 0),
          row.all_scores.length,
        ),
        leader: row.top,
      }));

    const classLeadersMap = new Map();
    for (const aggregate of studentAggregate.values()) {
      const averageScore = safeAverage(aggregate.total_score, aggregate.count);
      const existingLeader = classLeadersMap.get(String(aggregate.class_id));
      if (!existingLeader || averageScore > existingLeader.average_score) {
        classLeadersMap.set(String(aggregate.class_id), {
          class_id: aggregate.class_id,
          class_name: aggregate.class_name,
          leader_student_id: aggregate.student_id,
          leader_name: aggregate.student_name,
          leader_gender: aggregate.gender,
          average_score: averageScore,
          grade_entries: aggregate.count,
        });
      }
    }

    const classLeaders = Array.from(classLeadersMap.values()).sort(
      (a, b) => b.average_score - a.average_score,
    );

    res.json({
      term: {
        id: selectedTerm.id,
        name: selectedTerm.name,
        school_year: selectedTerm.school_year,
        term_number: selectedTerm.term_number,
      },
      summary: {
        total_grade_entries: enrichedGrades.length,
        students_with_grades: studentAggregate.size,
        average_score: overallAverage,
        male_average_score: maleAverage,
        female_average_score: femaleAverage,
        leading_gender: leadingGender,
      },
      grade_distribution: gradeDistribution,
      gender_distribution: genderDistribution,
      chronology,
      class_leaders: classLeaders,
    });
  } catch (error) {
    logger.error("Error retrieving teacher grade analytics:", error);
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
        school_id: teacher.school_id,
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
        school_id: teacher.school_id,
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
        school_id: teacher.school_id,
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
      where: { id: classId, school_id: teacher.school_id, is_active: true },
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
            school_id: teacher.school_id,
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
        school_id: teacher.school_id,
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

    const maxPointsNumeric = Number(max_points);
    if (!Number.isFinite(maxPointsNumeric) || maxPointsNumeric <= 0) {
      return res.status(400).json({ error: "max_points must be greater than 0" });
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

    const teacherSchool = await School.findByPk(teacher.school_id, {
      attributes: ["id", "school_type"],
    });
    const effectivePolicy = await resolveEffectiveGradingPolicy({
      schoolId: teacherSchool?.id || null,
      schoolType: teacherSchool?.school_type || null,
      gradeLevel: teacherClass.grade_level,
    });

    const processedGrades = [];
    const errors = [];

    // Convert numeric score to the Caribbean A-F scale used system-wide.
    const convertToStandardGrade = (numericScore) => {
      if (numericScore === null || numericScore === undefined || numericScore === "") {
        return null;
      }
      return scoreToCaribbeanGrade(numericScore);
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
            school_id: teacher.school_id,
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

        const scorePercent = (Number(score) / maxPointsNumeric) * 100;
        const existingComponents =
          existingGrade && existingGrade.assessment_components
            ? existingGrade.assessment_components
            : {};
        const weightedScore = calculateWeightedScore({
          policy: effectivePolicy,
          assessmentType: assessment_type,
          scorePercent,
          existingComponents,
        });
        const standardGrade = convertToStandardGrade(weightedScore.score);

        const persistedGradeData = {
          student_id: student_id,
          subject_id: defaultSubject.id,
          class_id: classId,
          term_id: currentTerm.id,
          teacher_id: teacher.id,
          grade_value: standardGrade,
          numeric_score: weightedScore.score,
          effort_grade: standardGrade, // Default same as grade_value
          behavior_grade: standardGrade, // Default same as grade_value
          teacher_comments:
            studentNotes || `${assessment_type}: ${assessment_name}`,
          assessment_components: {
            ...existingComponents,
            assessment_name,
            assessment_type,
            max_points: maxPointsNumeric,
            raw_score: Number(score),
            raw_percentage_score: Math.round(scorePercent * 100) / 100,
            letter_grade,
            due_date,
            grading_policy: {
              policy_id: effectivePolicy?.id || null,
              policy_name: effectivePolicy?.policy_name || null,
              grade_band: effectivePolicy?.grade_band || null,
              continuous_assessment_weight:
                Number(effectivePolicy?.continuous_assessment_weight || 0),
              end_term_exam_weight: Number(effectivePolicy?.end_term_exam_weight || 0),
              pass_mark: Number(effectivePolicy?.pass_mark || 50),
            },
            continuous_assessment_score: weightedScore.component_scores
              .continuous_assessment_score,
            end_term_exam_score: weightedScore.component_scores.end_term_exam_score,
            weighted_term_score: weightedScore.weighted_term_score,
            provisional_score: weightedScore.provisional_score,
            missing_policy_components: weightedScore.missing_components,
            policy_component_updated: weightedScore.component_key,
          },
          date_entered: new Date(),
          last_modified: new Date(),
          is_final: false,
        };

        let grade;
        if (existingGrade) {
          // Update existing grade
          await existingGrade.update({
            ...persistedGradeData,
            last_modified: new Date(),
            // Preserve original date_entered
            date_entered: existingGrade.date_entered,
          });
          grade = existingGrade;
          logger.info(
            `Updated grade for student ${student.student_id}: ${score}/${max_points} (${standardGrade})`,
          );
        } else {
          // Create new grade
          grade = await Grade.create(persistedGradeData);
          logger.info(
            `Created grade for student ${student.student_id}: ${score}/${max_points} (${standardGrade})`,
          );
        }

        processedGrades.push({
          student_id: student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          assessment_score: Number(score),
          assessment_percentage: Math.round(scorePercent * 100) / 100,
          numeric_score: weightedScore.score,
          weighted_term_score: weightedScore.weighted_term_score,
          provisional_score: weightedScore.provisional_score,
          letter_grade: letter_grade,
          barbados_grade: standardGrade,
          policy_band: effectivePolicy?.grade_band || null,
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
      grading_policy: effectivePolicy,
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
        school_id: teacher.school_id,
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
          where: {
            school_id: teacher.school_id,
          },
          required: true,
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
        grade_value:
          scoreToCaribbeanGrade(grade.numeric_score) || grade.grade_value,
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
        school_id: teacher.school_id,
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
        school_id: teacher.school_id,
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
        grade_value:
          scoreToCaribbeanGrade(grade.numeric_score) || grade.grade_value,
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
