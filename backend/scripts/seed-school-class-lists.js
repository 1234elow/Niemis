const { Op } = require("sequelize");
const { sequelize, School, Class } = require("../models");
const {
  DEFAULT_CLASS_SECTIONS,
  VERIFIED_SIXTH_FORM_SCHOOL_NAMES,
  getAllowedClassLevelsForSchool,
} = require("../utils/classLevelPolicy");

const SCHOOL_YEAR = "2025-2026";

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

async function markVerifiedSixthFormSchools() {
  const schools = await School.findAll({
    where: { is_active: true },
    attributes: ["id", "name", "offers_sixth_form"],
  });

  let toggled = 0;
  for (const school of schools) {
    const shouldOffer = VERIFIED_SIXTH_FORM_SCHOOL_NAMES.includes(normalize(school.name));
    if (school.offers_sixth_form !== shouldOffer) {
      await school.update({ offers_sixth_form: shouldOffer });
      toggled += 1;
    }
  }

  return toggled;
}

async function ensureClassLists() {
  const schools = await School.findAll({
    where: { is_active: true },
    attributes: [
      "id",
      "name",
      "school_type",
      "school_category",
      "offers_sixth_form",
    ],
    order: [["name", "ASC"]],
  });

  let created = 0;
  let skipped = 0;

  for (const school of schools) {
    const levels = getAllowedClassLevelsForSchool(school);

    for (const gradeLevel of levels) {
      for (const section of DEFAULT_CLASS_SECTIONS) {
        const existing = await Class.findOne({
          where: {
            school_id: school.id,
            school_year: SCHOOL_YEAR,
            section,
            [Op.and]: sequelize.where(
              sequelize.fn("LOWER", sequelize.col("grade_level")),
              String(gradeLevel).toLowerCase(),
            ),
          },
        });

        if (existing) {
          skipped += 1;
          continue;
        }

        await Class.create({
          school_id: school.id,
          name: `${gradeLevel} - Section ${section}`,
          grade_level: gradeLevel,
          section,
          class_teacher_id: null,
          school_year: SCHOOL_YEAR,
          capacity: 30,
          current_enrollment: 0,
          is_active: true,
        });
        created += 1;
      }
    }
  }

  return { schools: schools.length, created, skipped };
}

async function run() {
  try {
    await sequelize.authenticate();
    const toggled = await markVerifiedSixthFormSchools();
    const classResult = await ensureClassLists();

    console.log(
      JSON.stringify(
        {
          school_year: SCHOOL_YEAR,
          sixth_form_flags_updated: toggled,
          ...classResult,
          verified_sixth_form_schools: VERIFIED_SIXTH_FORM_SCHOOL_NAMES,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to seed school class lists:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
