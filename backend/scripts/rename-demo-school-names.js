const { Op } = require("sequelize");
const { sequelize, School } = require("../models");

const SCHOOL_CODE_NAME_MAP = {
  DDAN001: "Northshore Secondary School",
  DDPE002: "East Bay Primary School",
  DDNW003: "Westside Early Learning Centre",
};

const TYPE_BASED_NAME_MAP = {
  secondary: "Northshore Secondary School",
  primary: "East Bay Primary School",
  pre_primary: "Westside Early Learning Centre",
};

function resolveSchoolName(school, indexByType) {
  const mappedByCode = SCHOOL_CODE_NAME_MAP[school.school_code];
  if (mappedByCode) {
    return mappedByCode;
  }

  const typeKey = String(school.school_type || "primary").toLowerCase();
  const baseName = TYPE_BASED_NAME_MAP[typeKey] || "Barbados Community School";
  const counter = indexByType[typeKey] || 0;
  indexByType[typeKey] = counter + 1;

  if (counter === 0) {
    return baseName;
  }
  return `${baseName} ${counter + 1}`;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    const demoSchools = await School.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: "%dashboard demo%" } },
          { name: { [Op.iLike]: "%demo school%" } },
          { name: { [Op.iLike]: "%demo academy%" } },
          { name: { [Op.iLike]: "%demo primary%" } },
          { name: { [Op.iLike]: "%demo nursery%" } },
        ],
      },
      attributes: ["id", "name", "school_code", "school_type"],
      order: [["name", "ASC"]],
    });

    let updated = 0;
    let unchanged = 0;
    const indexByType = {};

    for (const school of demoSchools) {
      const normalizedName = resolveSchoolName(school, indexByType);
      if (!normalizedName || normalizedName === school.name) {
        unchanged += 1;
        continue;
      }

      await school.update({ name: normalizedName });
      updated += 1;
    }

    console.log(
      JSON.stringify(
        {
          found_demo_named_schools: demoSchools.length,
          updated,
          unchanged,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to rename demo schools:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
