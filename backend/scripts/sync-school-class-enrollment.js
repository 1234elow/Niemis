const { Op } = require("sequelize");
const { sequelize, School, Class, Student } = require("../models");
const { normalizeGradeLevelToken } = require("../utils/classLevelPolicy");

const parseArgValue = (name, fallback = "") => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  return match.slice(prefix.length).trim();
};

const distributeEvenly = (items, bucketCount) => {
  const buckets = Array.from({ length: bucketCount }, () => []);
  if (!bucketCount) return buckets;

  for (let index = 0; index < items.length; index += 1) {
    buckets[index % bucketCount].push(items[index]);
  }
  return buckets;
};

const sortClasses = (classes) =>
  [...classes].sort(
    (a, b) =>
      String(a.section || "").localeCompare(String(b.section || "")) ||
      String(a.name || "").localeCompare(String(b.name || "")) ||
      String(a.id || "").localeCompare(String(b.id || "")),
  );

const sortStudents = (students) =>
  [...students].sort(
    (a, b) =>
      String(a.student_id || "").localeCompare(String(b.student_id || "")) ||
      String(a.last_name || "").localeCompare(String(b.last_name || "")) ||
      String(a.first_name || "").localeCompare(String(b.first_name || "")),
  );

async function syncSchoolEnrollment(school) {
  const classes = await Class.findAll({
    where: {
      school_id: school.id,
      is_active: true,
    },
    attributes: ["id", "name", "grade_level", "section", "capacity", "current_enrollment"],
  });

  const students = await Student.findAll({
    where: {
      school_id: school.id,
      is_active: true,
    },
    attributes: ["id", "student_id", "first_name", "last_name", "grade_level", "class_id"],
  });

  const classesByGrade = new Map();
  for (const classRow of classes) {
    const gradeToken = normalizeGradeLevelToken(classRow.grade_level);
    if (!classesByGrade.has(gradeToken)) classesByGrade.set(gradeToken, []);
    classesByGrade.get(gradeToken).push(classRow);
  }

  const studentsByGrade = new Map();
  for (const student of students) {
    const gradeToken = normalizeGradeLevelToken(student.grade_level);
    if (!studentsByGrade.has(gradeToken)) studentsByGrade.set(gradeToken, []);
    studentsByGrade.get(gradeToken).push(student);
  }

  let assignedTotal = 0;
  const gradeSummaries = [];

  await sequelize.transaction(async (transaction) => {
    for (const [gradeToken, gradeClassesRaw] of classesByGrade.entries()) {
      const gradeClasses = sortClasses(gradeClassesRaw);
      const gradeStudents = sortStudents(studentsByGrade.get(gradeToken) || []);

      const studentIds = gradeStudents.map((student) => student.id);
      if (studentIds.length > 0) {
        await Student.update(
          { class_id: null, class_section: null },
          {
            where: { id: { [Op.in]: studentIds } },
            transaction,
          },
        );
      }

      const buckets = distributeEvenly(gradeStudents, gradeClasses.length);
      for (let classIndex = 0; classIndex < gradeClasses.length; classIndex += 1) {
        const classRow = gradeClasses[classIndex];
        const classStudents = buckets[classIndex] || [];
        const classStudentIds = classStudents.map((student) => student.id);

        if (classStudentIds.length > 0) {
          await Student.update(
            {
              class_id: classRow.id,
              class_section: classRow.section,
            },
            {
              where: { id: { [Op.in]: classStudentIds } },
              transaction,
            },
          );
        }

        await classRow.update(
          {
            current_enrollment: classStudentIds.length,
            capacity: Math.max(1, classStudentIds.length),
          },
          { transaction },
        );

        assignedTotal += classStudentIds.length;
      }

      gradeSummaries.push({
        grade_level: gradeClasses[0]?.grade_level || gradeToken,
        classes: gradeClasses.length,
        students: gradeStudents.length,
      });
    }
  });

  return {
    school: school.name,
    class_count: classes.length,
    student_count: students.length,
    assigned_total: assignedTotal,
    grades: gradeSummaries,
  };
}

async function main() {
  const schoolId = parseArgValue("school-id");
  const schoolName = parseArgValue("school-name", "A. DaCosta Edwards Primary");

  const whereClause = {};
  if (schoolId) {
    whereClause.id = schoolId;
  } else if (schoolName) {
    whereClause.name = { [Op.iLike]: `%${schoolName}%` };
  }

  const schools = await School.findAll({
    where: whereClause,
    attributes: ["id", "name", "school_type"],
    order: [["name", "ASC"]],
  });

  if (schools.length === 0) {
    console.log("No schools matched the provided filter.");
    return;
  }

  const summaries = [];
  for (const school of schools) {
    const summary = await syncSchoolEnrollment(school);
    summaries.push(summary);
  }

  console.log("Enrollment sync complete.");
  console.log(JSON.stringify(summaries, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to sync school class enrollment:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
