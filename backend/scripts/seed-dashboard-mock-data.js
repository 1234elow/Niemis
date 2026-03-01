const { randomUUID } = require("crypto");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const {
  sequelize,
  School,
  Student,
  Class,
  Facility,
  AttendanceRecord,
  AuditLog,
  StudentTransfer,
  User,
  Staff,
} = require("../models");

const MARKER = "[DASHBOARD_SEED]";
const STUDENT_MARKER = "BDS_SEED";
const DEMO_TEACHER_PASSWORD = "teacher123";
const STUDENTS_PER_SCHOOL = 90;

const BARBADIAN_FIRST_NAMES = [
  "Aaliyah",
  "Jaden",
  "Kemar",
  "Leah",
  "Rico",
  "Naomi",
  "Tariq",
  "Shanice",
  "Andre",
  "Kiara",
  "Malik",
  "Imani",
  "Dario",
  "Sade",
  "Jerome",
  "Nia",
  "Zion",
  "Asha",
  "Khalil",
  "Mikayla",
  "Rihanna",
  "Che",
  "Tameka",
  "Marlon",
  "Daneisha",
  "Jabari",
  "Renaldo",
  "Shakera",
  "Anya",
  "Dwayne",
  "Jelani",
  "Kemarley",
  "Shavon",
  "Tyrese",
  "Kadeem",
  "Nikita",
  "Rashad",
  "Kaitlyn",
  "Akeem",
  "Shamari",
];

const BARBADIAN_LAST_NAMES = [
  "Clarke",
  "Browne",
  "Brathwaite",
  "Best",
  "Yearwood",
  "Prescod",
  "Marshall",
  "Holder",
  "Hinds",
  "Alleyne",
  "Gooding",
  "Sargeant",
  "Trotman",
  "Griffith",
  "Greaves",
  "Boyce",
  "Forde",
  "Lewis",
  "Sealy",
  "Cumberbatch",
];

const BARBADOS_DISTRICTS = [
  "Bridgetown",
  "Speightstown",
  "Oistins",
  "Holetown",
  "Six Roads",
  "Hastings",
  "Black Rock",
  "Wildey",
  "Bay Street",
  "St. George",
];

const PRIMARY_GRADE_LEVELS = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
];

const SECONDARY_GRADE_LEVELS = [
  "First Form",
  "Second Form",
  "Third Form",
  "Fourth Form",
  "Fifth Form",
];

const PRE_PRIMARY_GRADE_LEVELS = ["Reception", "Infants A", "Infants B"];
const TEACHER_PROFILES_BY_TRACK = {
  primary: [
    { first_name: "Alicia", last_name: "Browne" },
    { first_name: "Kenroy", last_name: "Clarke" },
    { first_name: "Marsha", last_name: "Griffith" },
  ],
  secondary: [
    { first_name: "Jamal", last_name: "Brathwaite" },
    { first_name: "Tiana", last_name: "Prescod" },
    { first_name: "Rohan", last_name: "Yearwood" },
  ],
  pre_primary: [
    { first_name: "Nadine", last_name: "Holder" },
    { first_name: "Keisha", last_name: "Gooding" },
    { first_name: "Ariana", last_name: "Sealy" },
  ],
};

const GRADE_AGE_RANGES = {
  Reception: [4, 5],
  "Infants A": [5, 6],
  "Infants B": [6, 7],
  "Class 1": [7, 8],
  "Class 2": [8, 9],
  "Class 3": [9, 10],
  "Class 4": [10, 11],
  "First Form": [11, 12],
  "Second Form": [12, 13],
  "Third Form": [13, 14],
  "Fourth Form": [14, 15],
  "Fifth Form": [15, 16],
};

function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function shiftDays(baseDate, days) {
  const copy = new Date(baseDate);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function resolveSchoolTrack(school) {
  const schoolType = String(
    school?.school_type || school?.school_category || "",
  ).toLowerCase();

  if (schoolType.includes("secondary")) return "secondary";
  if (
    schoolType.includes("pre_primary") ||
    schoolType.includes("pre-primary") ||
    schoolType.includes("nursery") ||
    schoolType.includes("infant")
  ) {
    return "pre_primary";
  }
  return "primary";
}

function getGradeLevelsForSchool(school) {
  const track = resolveSchoolTrack(school);
  return getClassConfigsForTrack(track).map((config) => config.grade_level);
}

function getClassConfigsForTrack(track) {
  const withName = (grade_level, section) => ({
    grade_level,
    section,
    name: `${grade_level} - Section ${section}`,
  });

  if (track === "secondary") {
    return [
      withName("Second Form", "A"),
      withName("Third Form", "B"),
      withName("Fourth Form", "A"),
    ];
  }

  if (track === "pre_primary") {
    return [
      withName("Reception", "A"),
      withName("Infants A", "B"),
      withName("Infants B", "A"),
    ];
  }

  return [
    withName("Class 2", "A"),
    withName("Class 3", "B"),
    withName("Class 4", "A"),
  ];
}

function getDepartmentForTrack(track) {
  if (track === "secondary") return "General Studies";
  if (track === "pre_primary") return "Early Childhood";
  return "Primary Education";
}

function getTeacherProfile(track, classIndex) {
  const profiles = TEACHER_PROFILES_BY_TRACK[track] || TEACHER_PROFILES_BY_TRACK.primary;
  return profiles[classIndex % profiles.length];
}

function buildDateOfBirthForGrade(gradeLevel, schoolIndex, studentIndex) {
  const [minAge, maxAge] = GRADE_AGE_RANGES[gradeLevel] || [10, 11];
  const span = maxAge - minAge + 1;
  const age = minAge + ((schoolIndex + studentIndex) % span);

  // Keep DOB deterministic and safely in-range for the calculated age.
  const birthDate = new Date();
  birthDate.setFullYear(birthDate.getFullYear() - age);
  birthDate.setDate(birthDate.getDate() - 30);
  const backShiftDays = (schoolIndex * 17 + studentIndex * 13) % 120;
  birthDate.setDate(birthDate.getDate() - backShiftDays);

  return toIsoDate(birthDate);
}

function buildBarbadianStudentProfile(school, schoolIndex, studentIndex, studentCode) {
  const globalIndex = schoolIndex * STUDENTS_PER_SCHOOL + (studentIndex - 1);
  const listIndex = globalIndex + 1;
  const firstBase = BARBADIAN_FIRST_NAMES[globalIndex % BARBADIAN_FIRST_NAMES.length];
  const middleBase =
    BARBADIAN_FIRST_NAMES[Math.floor(globalIndex / BARBADIAN_FIRST_NAMES.length) % BARBADIAN_FIRST_NAMES.length];
  const firstName = globalIndex < BARBADIAN_FIRST_NAMES.length ? firstBase : `${firstBase} ${middleBase}`;
  const lastName =
    BARBADIAN_LAST_NAMES[(globalIndex * 7 + schoolIndex) % BARBADIAN_LAST_NAMES.length];
  const district = BARBADOS_DISTRICTS[listIndex % BARBADOS_DISTRICTS.length];
  const gradeLevels = getGradeLevelsForSchool(school);
  const gradeLevel = gradeLevels[(studentIndex - 1) % gradeLevels.length];
  const sanitizedFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const sanitizedLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const email = `${sanitizedFirst}.${sanitizedLast}.${studentCode.toLowerCase()}@students.edu.bb`;

  return {
    first_name: firstName,
    last_name: lastName,
    date_of_birth: buildDateOfBirthForGrade(gradeLevel, schoolIndex, studentIndex),
    gender: studentIndex % 2 === 0 ? "female" : "male",
    address: `${15 + studentIndex} ${district} Road, Barbados`,
    phone: `246-${2300000 + schoolIndex * 1000 + studentIndex}`,
    email,
    enrollment_date: toIsoDate(shiftDays(new Date(), -(120 + studentIndex))),
    grade_level: gradeLevel,
    class_section: studentIndex % 2 === 0 ? "A" : "B",
    is_active: true,
  };
}

async function ensureSchools() {
  const existing = await School.findAll({
    where: { is_active: true },
    limit: 4,
    order: [["name", "ASC"]],
  });

  if (existing.length >= 3) {
    return existing.slice(0, 3);
  }

  const needed = 3 - existing.length;
  const templates = [
    {
      name: "Northshore Secondary School",
      school_type: "secondary",
      school_category: "secondary",
      parish: "st_michael",
      school_code: "DDAN001",
      capacity: 900,
    },
    {
      name: "East Bay Primary School",
      school_type: "primary",
      school_category: "primary",
      parish: "christ_church",
      school_code: "DDPE002",
      capacity: 600,
    },
    {
      name: "Westside Early Learning Centre",
      school_type: "pre_primary",
      school_category: "nursery",
      parish: "st_james",
      school_code: "DDNW003",
      capacity: 200,
    },
  ];

  for (let i = 0; i < needed; i += 1) {
    const template = templates[i];
    const [school, created] = await School.findOrCreate({
      where: { school_code: template.school_code },
      defaults: {
        ...template,
        address: "Barbados",
        phone: `246-4${100000 + i}`,
        email: `admin+seed${i + 1}@niemis.bb`,
        principal_name: `Principal Office ${i + 1}`,
        is_active: true,
      },
    });

    if (
      !created &&
      (school.name !== template.name ||
        school.school_type !== template.school_type ||
        school.school_category !== template.school_category ||
        school.parish !== template.parish)
    ) {
      await school.update({
        name: template.name,
        school_type: template.school_type,
        school_category: template.school_category,
        parish: template.parish,
      });
    }
  }

  const refreshed = await School.findAll({
    where: { is_active: true },
    limit: 4,
    order: [["name", "ASC"]],
  });

  return refreshed.slice(0, 3);
}

async function ensureStudents(schools) {
  const seeded = [];

  for (let schoolIndex = 0; schoolIndex < schools.length; schoolIndex += 1) {
    const school = schools[schoolIndex];

    for (let i = 1; i <= STUDENTS_PER_SCHOOL; i += 1) {
      const studentCode = `BDS${schoolIndex + 1}${String(i).padStart(3, "0")}`;
      const legacyCode = `DM${schoolIndex + 1}${String(i).padStart(3, "0")}`;
      const profile = buildBarbadianStudentProfile(school, schoolIndex, i, studentCode);

      const existing = await Student.findOne({
        where: {
          student_id: {
            [Op.in]: [studentCode, legacyCode],
          },
        },
      });

      if (existing) {
        await existing.update({
          school_id: school.id,
          student_id: studentCode,
          ...profile,
        });
        seeded.push(existing);
      } else {
        const student = await Student.create({
          school_id: school.id,
          student_id: studentCode,
          ...profile,
        });
        seeded.push(student);
      }
    }
  }

  return seeded;
}

async function ensureClasses(schools) {
  let createdCount = 0;
  const seededClasses = [];

  for (const school of schools) {
    const track = resolveSchoolTrack(school);
    const classConfigs = getClassConfigsForTrack(track);

    for (const config of classConfigs) {
      const [classRecord, created] = await Class.findOrCreate({
        where: {
          school_id: school.id,
          grade_level: config.grade_level,
          section: config.section,
          school_year: "2025-2026",
        },
        defaults: {
          school_id: school.id,
          name: config.name,
          grade_level: config.grade_level,
          section: config.section,
          school_year: "2025-2026",
          capacity: 30,
          current_enrollment: 0,
          is_active: true,
        },
      });

      if (created) {
        createdCount += 1;
      } else if (
        classRecord.name !== config.name ||
        classRecord.grade_level !== config.grade_level ||
        !classRecord.is_active
      ) {
        await classRecord.update({
          name: config.name,
          grade_level: config.grade_level,
          is_active: true,
        });
      }

      seededClasses.push(classRecord);
    }
  }

  return {
    createdCount,
    classes: seededClasses,
  };
}

async function ensureTeachersForClasses(schools, classes) {
  const passwordHash = await bcrypt.hash(DEMO_TEACHER_PASSWORD, 10);
  const linkedTeachers = [];

  for (let schoolIndex = 0; schoolIndex < schools.length; schoolIndex += 1) {
    const school = schools[schoolIndex];
    const schoolClasses = classes
      .filter((classItem) => classItem.school_id === school.id)
      .sort((a, b) => a.name.localeCompare(b.name) || a.section.localeCompare(b.section));
    const track = resolveSchoolTrack(school);
    const department = getDepartmentForTrack(track);

    for (let classIndex = 0; classIndex < schoolClasses.length; classIndex += 1) {
      const classItem = schoolClasses[classIndex];
      const teacherProfile = getTeacherProfile(track, classIndex);
      const username = `${teacherProfile.first_name}.${teacherProfile.last_name}`.toLowerCase();
      const email = `${username}@teachers.edu.bb`;
      const employeeId = `DMT${String(schoolIndex + 1).padStart(2, "0")}${String(classIndex + 1).padStart(2, "0")}`;

      let staff = await Staff.findOne({
        where: { employee_id: employeeId },
      });

      let user = staff?.user_id ? await User.findByPk(staff.user_id) : null;

      if (!user) {
        user = await User.findOne({
          where: {
            [Op.or]: [{ username }, { email }],
          },
        });
      }

      if (!user) {
        user = await User.create({
          username,
          email,
          password_hash: passwordHash,
          role: "teacher",
          is_active: true,
        });
      } else {
        await user.update({
          username,
          email,
          password_hash: passwordHash,
          role: "teacher",
          is_active: true,
        });
      }

      if (!staff) {
        staff = await Staff.findOne({
          where: { user_id: user.id },
        });
      }

      const staffPayload = {
        user_id: user.id,
        school_id: school.id,
        employee_id: employeeId,
        first_name: teacherProfile.first_name,
        last_name: teacherProfile.last_name,
        date_of_birth: "1988-09-15",
        gender: classIndex % 2 === 0 ? "female" : "male",
        phone: `246-${4200000 + schoolIndex * 100 + classIndex}`,
        address: "Barbados",
        position: `${classItem.grade_level} Teacher`,
        role_level: "teacher",
        department,
        hire_date: "2021-09-01",
        salary: 46000,
        qualifications: "B.Ed. - Barbados Community College",
        certifications: "Trained Teacher",
        is_active: true,
      };

      if (!staff) {
        staff = await Staff.create(staffPayload);
      } else {
        await staff.update(staffPayload);
      }

      await classItem.update({
        class_teacher_id: staff.id,
        is_active: true,
      });

      linkedTeachers.push({
        first_name: teacherProfile.first_name,
        last_name: teacherProfile.last_name,
        username,
        password: DEMO_TEACHER_PASSWORD,
        school: school.name,
        class_name: classItem.name,
        class_level: classItem.grade_level,
      });
    }
  }

  return linkedTeachers;
}

async function ensureFullClassrooms(students, classes) {
  const studentsBySchool = new Map();
  for (const student of students) {
    if (!studentsBySchool.has(student.school_id)) {
      studentsBySchool.set(student.school_id, []);
    }
    studentsBySchool.get(student.school_id).push(student);
  }

  let enrolledCount = 0;

  for (const [schoolId, schoolStudents] of studentsBySchool.entries()) {
    const schoolClasses = classes
      .filter((classItem) => classItem.school_id === schoolId)
      .sort((a, b) => a.name.localeCompare(b.name) || a.section.localeCompare(b.section));

    if (schoolClasses.length === 0) continue;

    const unassigned = [...schoolStudents].sort((a, b) =>
      String(a.student_id).localeCompare(String(b.student_id)),
    );
    const baseSize = Math.floor(unassigned.length / schoolClasses.length);
    const remainder = unassigned.length % schoolClasses.length;

    for (let classIndex = 0; classIndex < schoolClasses.length; classIndex += 1) {
      const classItem = schoolClasses[classIndex];
      const targetSize = baseSize + (classIndex < remainder ? 1 : 0);
      const picked = [];

      for (let i = unassigned.length - 1; i >= 0; i -= 1) {
        if (picked.length >= targetSize) break;
        if (unassigned[i].grade_level === classItem.grade_level) {
          picked.push(unassigned.splice(i, 1)[0]);
        }
      }

      while (picked.length < targetSize && unassigned.length > 0) {
        picked.push(unassigned.shift());
      }

      for (const student of picked) {
        await student.update({
          class_id: classItem.id,
          class_section: classItem.section,
        });
      }

      await classItem.update({
        capacity: Math.max(1, targetSize),
        current_enrollment: targetSize,
        is_active: true,
      });

      enrolledCount += picked.length;
    }
  }

  return enrolledCount;
}

async function ensureFacilities(schools) {
  let createdCount = 0;
  const facilities = [
    { facility_name: "Integrated Science Laboratory", facility_type: "laboratory" },
    { facility_name: "Learning Resource Library", facility_type: "library" },
    { facility_name: "ICT Innovation Lab", facility_type: "ict_lab" },
  ];

  for (const school of schools) {
    for (const facility of facilities) {
      const existing = await Facility.findOne({
        where: {
          school_id: school.id,
          facility_type: facility.facility_type,
        },
        order: [["created_at", "ASC"]],
      });

      if (!existing) {
        await Facility.create({
          school_id: school.id,
          facility_name: facility.facility_name,
          facility_type: facility.facility_type,
          room_number: null,
          capacity: 30,
          condition_status: randomFrom(["excellent", "good", "fair"]),
          accessibility_features: "Wheelchair access",
          is_active: true,
        });
        createdCount += 1;
      } else if (
        existing.facility_name !== facility.facility_name ||
        !existing.is_active
      ) {
        await existing.update({
          facility_name: facility.facility_name,
          is_active: true,
        });
      }
    }
  }

  return createdCount;
}

async function ensureAttendance(students) {
  const statuses = ["present", "present", "present", "late", "absent", "excused"];
  let createdCount = 0;

  for (const student of students) {
    for (let dayOffset = -6; dayOffset <= 0; dayOffset += 1) {
      const attendanceDate = toIsoDate(shiftDays(new Date(), dayOffset));
      const [record, created] = await AttendanceRecord.findOrCreate({
        where: {
          student_id: student.id,
          attendance_date: attendanceDate,
          notes: `${MARKER} seeded attendance`,
        },
        defaults: {
          student_id: student.id,
          school_id: student.school_id,
          attendance_date: attendanceDate,
          status: randomFrom(statuses),
          notes: `${MARKER} seeded attendance`,
        },
      });

      if (created && record) {
        createdCount += 1;
      }
    }
  }

  return createdCount;
}

async function ensureAuditLogs() {
  await AuditLog.update(
    {
      action: AuditLog.sequelize.fn(
        "REPLACE",
        AuditLog.sequelize.col("action"),
        "DASHBOARD_DEMO_",
        "DASHBOARD_",
      ),
    },
    {
      where: {
        action: {
          [Op.like]: "DASHBOARD_DEMO_%",
        },
      },
    },
  );

  const existing = await AuditLog.count({
    where: {
      action: {
        [Op.like]: "DASHBOARD_%",
      },
    },
  });

  if (existing >= 20) {
    return 0;
  }

  const auditActions = [
    "DASHBOARD_USER_LOGIN",
    "DASHBOARD_STUDENT_UPDATE",
    "DASHBOARD_REPORT_EXPORT",
    "DASHBOARD_ATTENDANCE_SYNC",
    "DASHBOARD_TRANSFER_REVIEW",
  ];

  let createdCount = 0;
  for (let i = 0; i < 20; i += 1) {
    await AuditLog.create({
      action: randomFrom(auditActions),
      table_name: randomFrom(["students", "attendance_records", "reports", "student_transfers"]),
      new_values: {
        marker: MARKER,
        index: i + 1,
      },
      old_values: null,
      ip_address: null,
      user_agent: "dashboard-seeder",
    });
    createdCount += 1;
  }

  return createdCount;
}

async function ensureTransfers(students, schools) {
  const queryInterface = sequelize.getQueryInterface();
  const defaultSchema = sequelize.options?.define?.schema || "public";
  const transferTableRef =
    sequelize.getDialect() === "postgres"
      ? { tableName: "student_transfers", schema: defaultSchema }
      : "student_transfers";
  let columns;

  try {
    columns = await queryInterface.describeTable(transferTableRef);
  } catch (error) {
    return 0;
  }

  const textMarkerField = ["admin_notes", "transfer_reason", "reason"].find(
    (column) => Boolean(columns[column]),
  );

  if (textMarkerField) {
    const existingCount = await StudentTransfer.count({
      where: {
        [textMarkerField]: {
          [Op.like]: `%${MARKER}%`,
        },
      },
    });

    if (existingCount >= 8) {
      return 0;
    }
  }

  const firstUser = await User.findOne({ attributes: ["id"], order: [["id", "ASC"]] });
  const firstStaff = await Staff.findOne({ attributes: ["id"], order: [["id", "ASC"]] });

  const now = new Date();
  const statuses = ["pending", "approved", "rejected", "completed"];
  const rows = [];

  for (let i = 0; i < 8; i += 1) {
    const student = students[i % students.length];
    const fromSchool = schools[i % schools.length];
    const toSchool = schools[(i + 1) % schools.length];
    const row = {
      id: randomUUID(),
      student_id: student.id,
      from_school_id: fromSchool.id,
      to_school_id: toSchool.id,
      status: statuses[i % statuses.length],
      transfer_date: toIsoDate(shiftDays(now, -i)),
      effective_date: toIsoDate(shiftDays(now, 5 + i)),
      transfer_reason: `${MARKER} Administrative transfer request`,
      reason: `${MARKER} Administrative transfer request`,
      academic_year: "2025-2026",
      current_grade: student.grade_level || "Class 4",
      target_grade: student.grade_level || "Class 4",
      admin_notes: `${MARKER} seeded transfer row`,
      parent_consent: true,
      documents_transferred: i % 3 === 0,
      transcript_verified: i % 2 === 0,
      academic_records_transferred: i % 2 === 0,
      medical_records_transferred: i % 3 === 1,
      initiated_by: firstUser?.id || null,
      approved_by: firstStaff?.id || null,
      created_at: now,
      updated_at: now,
    };

    const filtered = {};
    for (const [columnName, columnDef] of Object.entries(columns)) {
      if (row[columnName] !== undefined) {
        filtered[columnName] = row[columnName];
      } else if (columnDef.allowNull === false && columnDef.defaultValue == null) {
        if (columnName === "id") {
          filtered[columnName] = randomUUID();
        } else if (columnName === "status") {
          filtered[columnName] = "pending";
        } else if (columnName.includes("date")) {
          filtered[columnName] = toIsoDate(now);
        } else if (columnName.includes("consent") || columnName.includes("transferred") || columnName.includes("verified")) {
          filtered[columnName] = false;
        } else if (columnName === "student_id") {
          filtered[columnName] = student.id;
        } else if (columnName === "from_school_id") {
          filtered[columnName] = fromSchool.id;
        } else if (columnName === "to_school_id") {
          filtered[columnName] = toSchool.id;
        } else if (columnName === "initiated_by") {
          filtered[columnName] = firstUser?.id || firstStaff?.id || randomUUID();
        } else if (columnName === "approved_by") {
          filtered[columnName] = firstStaff?.id || null;
        } else {
          filtered[columnName] = `${MARKER} auto`;
        }
      }
    }

    rows.push(filtered);
  }

  await queryInterface.bulkInsert(transferTableRef, rows);
  return rows.length;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    const schools = await ensureSchools();
    const students = await ensureStudents(schools);
    const classSeed = await ensureClasses(schools);
    const teachersLinked = await ensureTeachersForClasses(schools, classSeed.classes);
    const studentsEnrolled = await ensureFullClassrooms(students, classSeed.classes);
    const facilitiesCreated = await ensureFacilities(schools);
    const attendanceCreated = await ensureAttendance(students);
    const transfersCreated = await ensureTransfers(students, schools);
    const auditLogsCreated = await ensureAuditLogs();

    console.log("Dashboard mock seed complete");
    console.log(
      JSON.stringify(
        {
          marker: MARKER,
          student_marker: STUDENT_MARKER,
          schools_used: schools.length,
          students_seeded: students.length,
          classes_created: classSeed.createdCount,
          classes_total: classSeed.classes.length,
          teachers_linked: teachersLinked.length,
          students_enrolled_to_classes: studentsEnrolled,
          facilities_created: facilitiesCreated,
          attendance_created: attendanceCreated,
          transfers_created: transfersCreated,
          audit_logs_created: auditLogsCreated,
          teacher_credentials: teachersLinked,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to seed dashboard mock data:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
