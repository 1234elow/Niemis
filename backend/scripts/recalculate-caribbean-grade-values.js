const { Op } = require("sequelize");
const { sequelize, Grade } = require("../models");
const { scoreToCaribbeanGrade } = require("../utils/caribbeanGradeScale");

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    const grades = await Grade.findAll({
      where: {
        numeric_score: { [Op.not]: null },
      },
      attributes: ["id", "numeric_score", "grade_value"],
    });

    let updated = 0;
    let unchanged = 0;

    for (const grade of grades) {
      const normalizedGrade = scoreToCaribbeanGrade(grade.numeric_score);
      if (!normalizedGrade || normalizedGrade === grade.grade_value) {
        unchanged += 1;
        continue;
      }

      await grade.update({ grade_value: normalizedGrade });
      updated += 1;
    }

    console.log(
      JSON.stringify(
        {
          processed: grades.length,
          updated,
          unchanged,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to recalculate grade values:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
