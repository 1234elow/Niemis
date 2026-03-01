const { Op } = require("sequelize");
const { sequelize, Facility } = require("../models");

const FACILITY_NAME_BY_TYPE = {
  laboratory: "Integrated Science Laboratory",
  library: "Learning Resource Library",
  ict_lab: "ICT Innovation Lab",
};

function resolveFacilityName(facility) {
  return FACILITY_NAME_BY_TYPE[facility.facility_type] || facility.facility_name;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    const demoFacilities = await Facility.findAll({
      where: {
        facility_name: {
          [Op.iLike]: "%demo%",
        },
      },
      attributes: ["id", "facility_name", "facility_type", "school_id"],
      order: [["facility_name", "ASC"]],
    });

    let updated = 0;
    let unchanged = 0;

    for (const facility of demoFacilities) {
      const normalizedName = resolveFacilityName(facility);
      if (!normalizedName || normalizedName === facility.facility_name) {
        unchanged += 1;
        continue;
      }

      await facility.update({ facility_name: normalizedName });
      updated += 1;
    }

    console.log(
      JSON.stringify(
        {
          found_demo_named_facilities: demoFacilities.length,
          updated,
          unchanged,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to rename demo facilities:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
