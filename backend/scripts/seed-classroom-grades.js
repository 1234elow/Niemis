const { Op } = require("sequelize");
const { sequelize, Student, Class, Subject, Term, Grade } = require("../models");
const { scoreToCaribbeanGrade } = require("../utils/caribbeanGradeScale");

const SUBJECT_CODES_BY_TRACK = {
  pre_primary: ["ENG", "MATH", "ART", "MUS", "PE"],
  primary: ["ENG", "MATH", "SCI", "SS", "IT", "PE"],
  secondary: ["ENG", "MATH", "BIO", "CHEM", "PHYS", "CHIST", "GEOG", "IT"],
};

function getTrackFromGradeLevel(gradeLevelRaw) {
  const gradeLevel = String(gradeLevelRaw || "").toLowerCase();
  if (gradeLevel.includes("form")) return "secondary";
  if (gradeLevel.includes("infants") || gradeLevel.includes("reception")) return "pre_primary";
  return "primary";
}

function stringHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizedSeed(...parts) {
  const hash = stringHash(parts.join("|"));
  return (hash % 10000) / 10000;
}

function toScore(track, seed) {
  const ranges = {
    pre_primary: [68, 98],
    primary: [60, 97],
    secondary: [55, 95],
  };
  const [min, max] = ranges[track] || ranges.primary;
  const score = min + (max - min) * seed;
  return Number(score.toFixed(2));
}

function toLetterGrade(score) {
  return scoreToCaribbeanGrade(score) || "F";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");

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
      throw new Error("No active term found. Create terms before seeding grades.");
    }

    const activeClasses = await Class.findAll({
      where: {
        is_active: true,
        class_teacher_id: { [Op.ne]: null },
      },
      attributes: ["id", "name", "grade_level", "class_teacher_id"],
    });

    if (activeClasses.length === 0) {
      throw new Error("No active classes with assigned teachers found.");
    }

    const classById = new Map(activeClasses.map((classRow) => [classRow.id, classRow]));
    const classIds = [...classById.keys()];

    const students = await Student.findAll({
      where: {
        is_active: true,
        class_id: { [Op.in]: classIds },
      },
      attributes: ["id", "student_id", "first_name", "last_name", "grade_level", "class_id"],
      order: [
        ["last_name", "ASC"],
        ["first_name", "ASC"],
      ],
    });

    if (students.length === 0) {
      console.log("No students are currently linked to active classrooms.");
      return;
    }

    const neededCodes = Array.from(
      new Set(Object.values(SUBJECT_CODES_BY_TRACK).flat()),
    );
    const subjects = await Subject.findAll({
      where: {
        is_active: true,
        code: { [Op.in]: neededCodes },
      },
      attributes: ["id", "code", "name"],
    });
    const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject]));

    if (subjectByCode.size === 0) {
      throw new Error("No active subjects found for grade seeding.");
    }

    let created = 0;
    let existing = 0;
    let skippedStudents = 0;

    for (const student of students) {
      const classRow = classById.get(student.class_id);
      if (!classRow || !classRow.class_teacher_id) {
        skippedStudents += 1;
        continue;
      }

      const track = getTrackFromGradeLevel(classRow.grade_level || student.grade_level);
      const codes = SUBJECT_CODES_BY_TRACK[track] || SUBJECT_CODES_BY_TRACK.primary;
      const matchedSubjects = codes.map((code) => subjectByCode.get(code)).filter(Boolean);

      if (matchedSubjects.length === 0) {
        skippedStudents += 1;
        continue;
      }

      for (const subject of matchedSubjects) {
        const baseSeed = normalizedSeed(student.id, subject.id, currentTerm.id);
        const effortSeed = normalizedSeed("effort", student.id, subject.id, currentTerm.id);
        const behaviorSeed = normalizedSeed("behavior", student.id, subject.id, currentTerm.id);

        const numericScore = toScore(track, baseSeed);
        const effortScore = clamp(numericScore + (effortSeed - 0.5) * 12, 45, 100);
        const behaviorScore = clamp(numericScore + (behaviorSeed - 0.5) * 14, 45, 100);
        const gradeValue = toLetterGrade(numericScore);
        const effortGrade = toLetterGrade(effortScore);
        const behaviorGrade = toLetterGrade(behaviorScore);

        const [, wasCreated] = await Grade.findOrCreate({
          where: {
            student_id: student.id,
            subject_id: subject.id,
            term_id: currentTerm.id,
          },
          defaults: {
            student_id: student.id,
            subject_id: subject.id,
            class_id: classRow.id,
            term_id: currentTerm.id,
            teacher_id: classRow.class_teacher_id,
            grade_value: gradeValue,
            numeric_score: numericScore,
            effort_grade: effortGrade,
            behavior_grade: behaviorGrade,
            teacher_comments: `${student.first_name} ${student.last_name} is making steady progress in ${subject.name}.`,
            assessment_components: {
              classwork: Number(clamp(numericScore + 2.5, 0, 100).toFixed(2)),
              quizzes: Number(clamp(numericScore - 1.5, 0, 100).toFixed(2)),
              participation: Number(clamp(effortScore, 0, 100).toFixed(2)),
              behavior: Number(clamp(behaviorScore, 0, 100).toFixed(2)),
            },
            is_final: true,
          },
        });

        if (wasCreated) {
          created += 1;
        } else {
          existing += 1;
        }
      }
    }

    const gradedStudentRows = await Grade.findAll({
      attributes: ["student_id"],
      where: {
        term_id: currentTerm.id,
        class_id: { [Op.in]: classIds },
      },
      group: ["student_id"],
      raw: true,
    });
    const gradedStudentIds = new Set(
      gradedStudentRows.map((row) => String(row.student_id)),
    );
    const studentsWithoutCurrentTermGrades = students.filter(
      (student) => !gradedStudentIds.has(String(student.id)),
    ).length;

    console.log(
      JSON.stringify(
        {
          current_term: {
            id: currentTerm.id,
            name: currentTerm.name,
            school_year: currentTerm.school_year,
          },
          classroom_linked_students: students.length,
          grades_created: created,
          grades_already_existing: existing,
          students_skipped: skippedStudents,
          students_without_current_term_grades: studentsWithoutCurrentTermGrades,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to seed classroom grades:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
