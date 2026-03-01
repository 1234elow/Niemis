const { sequelize, School, Student, Class } = require("../models");
const {
  normalizeGradeLevelToken,
  getAllowedClassLevelsForSchool,
  isVerifiedSixthFormSchool,
} = require("../utils/classLevelPolicy");
const { generateDataQualityOverview } = require("../services/dataQualityService");

const EXPECTED_AGE_RANGES = [
  { grade_level: "Infants A", min_age: 4, max_age: 5 },
  { grade_level: "Infants B", min_age: 5, max_age: 6 },
  { grade_level: "Reception", min_age: 6, max_age: 7 },
  { grade_level: "Class 1", min_age: 7, max_age: 8 },
  { grade_level: "Class 2", min_age: 8, max_age: 9 },
  { grade_level: "Class 3", min_age: 9, max_age: 10 },
  { grade_level: "Class 4", min_age: 10, max_age: 11 },
  { grade_level: "First Form", min_age: 11, max_age: 12 },
  { grade_level: "Second Form", min_age: 12, max_age: 13 },
  { grade_level: "Third Form", min_age: 13, max_age: 14 },
  { grade_level: "Fourth Form", min_age: 14, max_age: 15 },
  { grade_level: "Fifth Form", min_age: 15, max_age: 16 },
  { grade_level: "Lower Sixth", min_age: 16, max_age: 17 },
  { grade_level: "Upper Sixth", min_age: 17, max_age: 18 },
];

const EXPECTED_AGE_BY_GRADE = EXPECTED_AGE_RANGES.reduce((acc, row) => {
  acc[normalizeGradeLevelToken(row.grade_level)] = row;
  return acc;
}, {});

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
};

const formatDobForTargetAge = (targetAge) => {
  const today = new Date();
  const targetYear = today.getFullYear() - Number(targetAge || 0);
  const candidate = new Date(Date.UTC(targetYear, 5, 15, 0, 0, 0));
  if (today < candidate) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() - 1);
  }
  return candidate.toISOString().slice(0, 10);
};

const resolveGradeByAge = (allowedLevels, age) => {
  if (!Array.isArray(allowedLevels) || allowedLevels.length === 0) {
    return null;
  }
  if (!Number.isFinite(age)) {
    return allowedLevels[0];
  }

  const candidates = allowedLevels
    .map((grade) => {
      const expected = EXPECTED_AGE_BY_GRADE[normalizeGradeLevelToken(grade)];
      return {
        grade,
        expected,
      };
    })
    .filter((entry) => entry.expected);

  if (candidates.length === 0) {
    return allowedLevels[0];
  }

  const inRange = candidates.find(
    (entry) => age >= entry.expected.min_age && age <= entry.expected.max_age,
  );
  if (inRange) {
    return inRange.grade;
  }

  const nearest = candidates
    .map((entry) => {
      const midpoint = (entry.expected.min_age + entry.expected.max_age) / 2;
      return {
        ...entry,
        distance: Math.abs(midpoint - age),
      };
    })
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest?.grade || allowedLevels[0];
};

const buildClassPools = (classRows) => {
  const classById = {};
  const bySchoolGrade = {};

  for (const classRow of classRows) {
    const classKey = String(classRow.id);
    classById[classKey] = classRow;

    const schoolKey = String(classRow.school_id || "");
    const gradeKey = normalizeGradeLevelToken(classRow.grade_level);
    const bucketKey = `${schoolKey}::${gradeKey}`;
    if (!bySchoolGrade[bucketKey]) {
      bySchoolGrade[bucketKey] = [];
    }
    bySchoolGrade[bucketKey].push({
      ...classRow,
      tracked_enrollment: Number(classRow.current_enrollment || 0),
    });
  }

  Object.values(bySchoolGrade).forEach((rows) => {
    rows.sort((a, b) => a.tracked_enrollment - b.tracked_enrollment);
  });

  return { classById, bySchoolGrade };
};

const pickClassForStudent = (bySchoolGrade, schoolId, gradeLevel) => {
  const bucketKey = `${String(schoolId || "")}::${normalizeGradeLevelToken(gradeLevel)}`;
  const bucket = bySchoolGrade[bucketKey] || [];
  if (bucket.length === 0) {
    return null;
  }
  bucket.sort((a, b) => a.tracked_enrollment - b.tracked_enrollment);
  const selected = bucket[0];
  selected.tracked_enrollment += 1;
  return selected;
};

const run = async () => {
  const stats = {
    students_updated: 0,
    grade_policy_fixed: 0,
    age_fixed_by_grade: 0,
    age_fixed_by_dob: 0,
    class_reassigned: 0,
    class_assigned: 0,
    class_unassigned: 0,
  };

  const schools = await School.findAll({
    where: { is_active: true },
    attributes: ["id", "name", "school_type", "offers_sixth_form"],
    raw: true,
  });
  const schoolById = schools.reduce((acc, school) => {
    acc[String(school.id)] = school;
    return acc;
  }, {});

  const classRows = await Class.findAll({
    where: { is_active: true },
    attributes: ["id", "school_id", "grade_level", "current_enrollment"],
    raw: true,
  });
  const { classById, bySchoolGrade } = buildClassPools(classRows);

  const students = await Student.findAll({
    where: { is_active: true },
    attributes: [
      "id",
      "school_id",
      "class_id",
      "student_id",
      "grade_level",
      "date_of_birth",
    ],
  });

  for (const student of students) {
    const school = schoolById[String(student.school_id || "")];
    if (!school) continue;

    const allowedLevels = getAllowedClassLevelsForSchool(school);
    const allowedTokens = allowedLevels.map((level) => normalizeGradeLevelToken(level));
    const originalGrade = student.grade_level;
    const originalToken = normalizeGradeLevelToken(originalGrade);
    const originalAge = calculateAge(student.date_of_birth);
    const updates = {};

    // 1) Fix school-grade policy violations.
    if (!allowedTokens.includes(originalToken)) {
      let replacementGrade = null;

      if (school.school_type === "pre_primary") {
        if (originalToken === "infants a") replacementGrade = "Infants A";
        if (originalToken === "infants b") replacementGrade = "Infants B";
        if (!replacementGrade) {
          replacementGrade = resolveGradeByAge(allowedLevels, originalAge) || "Infants A";
        }
      } else if (originalToken === "sixth form") {
        const supportsSixth =
          Boolean(school.offers_sixth_form) || isVerifiedSixthFormSchool(school);
        replacementGrade = supportsSixth ? "Lower Sixth" : "Fifth Form";
      } else {
        replacementGrade =
          resolveGradeByAge(allowedLevels, originalAge) || allowedLevels[0];
      }

      if (replacementGrade && replacementGrade !== originalGrade) {
        updates.grade_level = replacementGrade;
        stats.grade_policy_fixed += 1;
      }
    }

    let effectiveGrade = updates.grade_level || originalGrade;
    let effectiveAge = originalAge;
    const expected = EXPECTED_AGE_BY_GRADE[normalizeGradeLevelToken(effectiveGrade)];

    // 2) Fix age-grade mismatches.
    if (
      expected &&
      Number.isFinite(effectiveAge) &&
      (effectiveAge < expected.min_age || effectiveAge > expected.max_age)
    ) {
      const ageAlignedGrade = resolveGradeByAge(allowedLevels, effectiveAge);
      if (
        ageAlignedGrade &&
        normalizeGradeLevelToken(ageAlignedGrade) !== normalizeGradeLevelToken(effectiveGrade)
      ) {
        updates.grade_level = ageAlignedGrade;
        effectiveGrade = ageAlignedGrade;
        stats.age_fixed_by_grade += 1;
      } else {
        const targetAge = Math.round((expected.min_age + expected.max_age) / 2);
        const replacementDob = formatDobForTargetAge(targetAge);
        if (replacementDob !== String(student.date_of_birth || "")) {
          updates.date_of_birth = replacementDob;
          effectiveAge = targetAge;
          stats.age_fixed_by_dob += 1;
        }
      }
    }

    // 3) Keep class aligned with school + grade.
    const currentClass = student.class_id ? classById[String(student.class_id)] : null;
    const classNeedsChange =
      !currentClass ||
      String(currentClass.school_id || "") !== String(student.school_id || "") ||
      normalizeGradeLevelToken(currentClass.grade_level) !==
        normalizeGradeLevelToken(effectiveGrade);

    if (classNeedsChange) {
      const candidateClass = pickClassForStudent(
        bySchoolGrade,
        student.school_id,
        effectiveGrade,
      );

      if (candidateClass) {
        if (String(student.class_id || "") !== String(candidateClass.id)) {
          updates.class_id = candidateClass.id;
          if (student.class_id) {
            stats.class_reassigned += 1;
          } else {
            stats.class_assigned += 1;
          }
        }
      } else if (student.class_id) {
        updates.class_id = null;
        stats.class_unassigned += 1;
      }
    }

    if (Object.keys(updates).length > 0) {
      await student.update(updates);
      stats.students_updated += 1;
    }
  }

  // 4) Re-sync class enrollment counters to actual student assignments.
  await sequelize.query(`
    UPDATE school_system.classes AS c
    SET current_enrollment = sub.student_count
    FROM (
      SELECT class_id, COUNT(*)::int AS student_count
      FROM school_system.students
      WHERE is_active = true
        AND class_id IS NOT NULL
      GROUP BY class_id
    ) AS sub
    WHERE c.id = sub.class_id;
  `);

  await sequelize.query(`
    UPDATE school_system.classes
    SET current_enrollment = 0
    WHERE is_active = true
      AND id NOT IN (
        SELECT DISTINCT class_id
        FROM school_system.students
        WHERE is_active = true
          AND class_id IS NOT NULL
      );
  `);

  const quality = await generateDataQualityOverview({ refreshTracking: true });
  const schoolTypeCheck =
    quality.checks?.find((item) => item.key === "student_school_grade_policy") || null;
  const ageCheck =
    quality.checks?.find((item) => item.key === "student_age_grade_alignment") || null;

  return {
    ...stats,
    post_scan: {
      generated_at: quality.generated_at,
      overall_score: quality.overall_score,
      student_school_grade_policy_issues: schoolTypeCheck?.issue_count ?? null,
      student_age_grade_alignment_issues: ageCheck?.issue_count ?? null,
    },
  };
};

run()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
