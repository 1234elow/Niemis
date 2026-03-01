const { Op } = require("sequelize");
const {
  sequelize,
  School,
  AttendanceRecord,
  AuditLog,
  StudentTransfer,
} = require("../models");

const SCHOOL_NAME_BY_CODE = {
  DDAN001: "Northshore Secondary School",
  DDPE002: "East Bay Primary School",
  DDNW003: "Westside Early Learning Centre",
};

function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeGeneralText(value) {
  if (typeof value !== "string") {
    return value;
  }

  let sanitized = value;
  sanitized = sanitized.replace(/\[DASHBOARD_MOCK\]\s*/gi, "");
  sanitized = sanitized.replace(/DASHBOARD_DEMO_/g, "DASHBOARD_");
  sanitized = sanitized.replace(/dashboard-mock-seeder/gi, "dashboard-seeder");
  sanitized = compactWhitespace(sanitized);
  return sanitized;
}

function sanitizeAction(action) {
  if (typeof action !== "string") {
    return action;
  }

  let sanitized = action;
  sanitized = sanitized.replace(/DASHBOARD_DEMO_/g, "DASHBOARD_");
  sanitized = sanitized.replace(/^demo_/i, "");
  sanitized = sanitized.replace(/_demo_/gi, "_");
  sanitized = sanitized.replace(/_demo$/gi, "");
  sanitized = sanitized.replace(/^demo$/i, "record");
  sanitized = sanitized.replace(/__+/g, "_");
  sanitized = compactWhitespace(sanitized);

  return sanitized || action;
}

function sanitizeTransferText(value) {
  if (typeof value !== "string") {
    return value;
  }

  let sanitized = sanitizeGeneralText(value);
  sanitized = sanitized.replace(/seeded transfer row/gi, "Administrative review note");
  sanitized = sanitized.replace(/\bmock\b/gi, "");
  sanitized = sanitized.replace(/\bdemo\b/gi, "");
  sanitized = compactWhitespace(sanitized);
  return sanitized;
}

function sanitizeAuditJson(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeGeneralText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditJson(item));
  }

  if (typeof value === "object") {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "marker" && typeof item === "string" && /\b(DASHBOARD_MOCK|demo|mock)\b/i.test(item)) {
        continue;
      }
      next[key] = sanitizeAuditJson(item);
    }
    return next;
  }

  return value;
}

function buildSchoolEmail(name, currentEmail) {
  if (typeof currentEmail === "string" && !/(demo|mock)/i.test(currentEmail)) {
    return currentEmail;
  }

  const slug = String(name || "school")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 36);
  return `admin@${slug || "school"}.edu.bb`;
}

async function cleanupSchoolMetadata() {
  const schools = await School.findAll({
    where: {
      [Op.or]: [
        { name: { [Op.iLike]: "%demo%" } },
        { name: { [Op.iLike]: "%mock%" } },
        { email: { [Op.iLike]: "%demo%" } },
        { email: { [Op.iLike]: "%mock%" } },
        { principal_name: { [Op.iLike]: "%demo%" } },
        { principal_name: { [Op.iLike]: "%mock%" } },
      ],
    },
    attributes: ["id", "school_code", "name", "email", "principal_name"],
  });

  let updated = 0;
  for (const school of schools) {
    const nextName = SCHOOL_NAME_BY_CODE[school.school_code] || sanitizeTransferText(school.name);
    const nextEmail = buildSchoolEmail(nextName, school.email);
    const nextPrincipal =
      typeof school.principal_name === "string" && /(demo|mock)/i.test(school.principal_name)
        ? "Principal Office"
        : school.principal_name;

    if (
      nextName !== school.name ||
      nextEmail !== school.email ||
      nextPrincipal !== school.principal_name
    ) {
      await school.update({
        name: nextName,
        email: nextEmail,
        principal_name: nextPrincipal,
      });
      updated += 1;
    }
  }

  return { found: schools.length, updated };
}

async function cleanupAttendanceMetadata() {
  const rows = await AttendanceRecord.findAll({
    where: {
      notes: {
        [Op.or]: [
          { [Op.iLike]: "%DASHBOARD_MOCK%" },
          { [Op.iLike]: "%demo%" },
          { [Op.iLike]: "%mock%" },
        ],
      },
    },
    attributes: ["id", "notes"],
  });

  let updated = 0;
  for (const row of rows) {
    const nextNotes = sanitizeTransferText(row.notes);
    if (nextNotes !== row.notes) {
      await row.update({ notes: nextNotes || null });
      updated += 1;
    }
  }

  return { found: rows.length, updated };
}

async function cleanupTransferMetadata() {
  const queryInterface = sequelize.getQueryInterface();
  const defaultSchema = sequelize.options?.define?.schema || "public";
  const transferTableRef =
    sequelize.getDialect() === "postgres"
      ? { tableName: "student_transfers", schema: defaultSchema }
      : "student_transfers";
  const columns = await queryInterface.describeTable(transferTableRef);
  const textFields = ["transfer_reason", "reason", "admin_notes"].filter((field) => Boolean(columns[field]));

  if (textFields.length === 0) {
    return { found: 0, updated: 0, fields: textFields };
  }

  const records = await StudentTransfer.findAll({
    attributes: ["id", ...textFields],
  });

  let found = 0;
  let updated = 0;

  for (const record of records) {
    const payload = {};
    let hasTargetPattern = false;

    for (const field of textFields) {
      const currentValue = record[field];
      if (typeof currentValue !== "string") {
        continue;
      }

      if (/(DASHBOARD_MOCK|demo|mock)/i.test(currentValue)) {
        hasTargetPattern = true;
      }

      const nextValue = sanitizeTransferText(currentValue);
      if (nextValue !== currentValue) {
        payload[field] = nextValue || null;
      }
    }

    if (hasTargetPattern) {
      found += 1;
    }

    if (Object.keys(payload).length > 0) {
      await record.update(payload);
      updated += 1;
    }
  }

  return { found, updated, fields: textFields };
}

async function cleanupAuditMetadata() {
  const records = await AuditLog.findAll({
    attributes: ["id", "action", "user_agent", "old_values", "new_values"],
  });

  let updated = 0;
  let found = 0;
  for (const record of records) {
    const matchesPattern =
      /(demo|mock|DASHBOARD_MOCK)/i.test(String(record.action || "")) ||
      /(demo|mock|DASHBOARD_MOCK)/i.test(String(record.user_agent || "")) ||
      /(demo|mock|DASHBOARD_MOCK)/i.test(JSON.stringify(record.old_values || {})) ||
      /(demo|mock|DASHBOARD_MOCK)/i.test(JSON.stringify(record.new_values || {}));
    if (matchesPattern) {
      found += 1;
    }

    const nextAction = sanitizeAction(record.action);
    const nextUserAgent = sanitizeGeneralText(record.user_agent);
    const nextOldValues = sanitizeAuditJson(record.old_values);
    const nextNewValues = sanitizeAuditJson(record.new_values);

    const payload = {};
    if (nextAction !== record.action) payload.action = nextAction;
    if (nextUserAgent !== record.user_agent) payload.user_agent = nextUserAgent;
    if (JSON.stringify(nextOldValues) !== JSON.stringify(record.old_values)) {
      payload.old_values = nextOldValues;
    }
    if (JSON.stringify(nextNewValues) !== JSON.stringify(record.new_values)) {
      payload.new_values = nextNewValues;
    }

    if (Object.keys(payload).length > 0) {
      await record.update(payload);
      updated += 1;
    }
  }

  return { found, updated };
}

async function getResidualCounts() {
  const queryInterface = sequelize.getQueryInterface();
  const defaultSchema = sequelize.options?.define?.schema || "public";
  const transferTableRef =
    sequelize.getDialect() === "postgres"
      ? { tableName: "student_transfers", schema: defaultSchema }
      : "student_transfers";
  const transferColumns = await queryInterface.describeTable(transferTableRef);
  const transferTextFields = ["transfer_reason", "reason", "admin_notes"].filter(
    (field) => Boolean(transferColumns[field]),
  );

  const [schoolsCount, attendanceCount] = await Promise.all([
    School.count({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: "%demo%" } },
          { name: { [Op.iLike]: "%mock%" } },
          { email: { [Op.iLike]: "%demo%" } },
          { email: { [Op.iLike]: "%mock%" } },
          { principal_name: { [Op.iLike]: "%demo%" } },
          { principal_name: { [Op.iLike]: "%mock%" } },
        ],
      },
    }),
    AttendanceRecord.count({
      where: {
        notes: {
          [Op.or]: [
            { [Op.iLike]: "%DASHBOARD_MOCK%" },
            { [Op.iLike]: "%demo%" },
            { [Op.iLike]: "%mock%" },
          ],
        },
      },
    }),
  ]);

  const auditRows = await AuditLog.findAll({
    attributes: ["id", "action", "user_agent", "old_values", "new_values"],
  });
  const auditCount = auditRows.filter(
    (row) =>
      /(demo|mock|DASHBOARD_MOCK)/i.test(String(row.action || "")) ||
      /(demo|mock|DASHBOARD_MOCK)/i.test(String(row.user_agent || "")) ||
      /(demo|mock|DASHBOARD_MOCK)/i.test(JSON.stringify(row.old_values || {})) ||
      /(demo|mock|DASHBOARD_MOCK)/i.test(JSON.stringify(row.new_values || {})),
  ).length;

  let transferCount = 0;
  if (transferTextFields.length > 0) {
    const transferRows = await StudentTransfer.findAll({
      attributes: ["id", ...transferTextFields],
    });

    transferCount = transferRows.filter((row) =>
      transferTextFields.some((field) =>
        /(DASHBOARD_MOCK|demo|mock)/i.test(String(row[field] || "")),
      ),
    ).length;
  }

  return {
    schools_with_demo_or_mock: schoolsCount,
    attendance_notes_with_demo_or_mock: attendanceCount,
    audit_rows_with_demo_or_mock: auditCount,
    transfer_rows_with_demo_or_mock: transferCount,
  };
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    const schoolResult = await cleanupSchoolMetadata();
    const attendanceResult = await cleanupAttendanceMetadata();
    const transferResult = await cleanupTransferMetadata();
    const auditResult = await cleanupAuditMetadata();
    const residual = await getResidualCounts();

    console.log(
      JSON.stringify(
        {
          cleanup: {
            schools: schoolResult,
            attendance: attendanceResult,
            transfers: transferResult,
            audit_logs: auditResult,
          },
          residual,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to clean dashboard metadata:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
