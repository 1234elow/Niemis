const { Op } = require("sequelize");
const { sequelize, Class } = require("../models");

function buildClassName(classRow) {
  const gradeLevel = String(classRow.grade_level || "").trim();
  const section = String(classRow.section || "").trim();

  if (!gradeLevel && !section) {
    return String(classRow.name || "").trim();
  }
  if (!section) {
    return gradeLevel;
  }
  return `${gradeLevel} - Section ${section}`;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    const demoClasses = await Class.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: "%demo class%" } },
          { name: { [Op.iLike]: "dashboard demo %" } },
        ],
      },
      attributes: ["id", "name", "grade_level", "section"],
      order: [["name", "ASC"]],
    });

    let updated = 0;
    let skipped = 0;

    for (const classRow of demoClasses) {
      const normalizedName = buildClassName(classRow);
      if (!normalizedName || normalizedName === classRow.name) {
        skipped += 1;
        continue;
      }

      await classRow.update({ name: normalizedName });
      updated += 1;
    }

    console.log(
      JSON.stringify(
        {
          found_demo_named_classes: demoClasses.length,
          updated,
          skipped,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to rename demo classes:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
