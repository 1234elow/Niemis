const PRIMARY_CLASS_LEVELS = [
  "Reception",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
];

const PRE_PRIMARY_CLASS_LEVELS = [
  "Infants A",
  "Infants B",
  "Reception",
];

const SECONDARY_CORE_LEVELS = [
  "First Form",
  "Second Form",
  "Third Form",
  "Fourth Form",
  "Fifth Form",
];

const SIXTH_FORM_LEVELS = ["Lower Sixth", "Upper Sixth"];

const DEFAULT_CLASS_SECTIONS = ["A", "B"];

const VERIFIED_SIXTH_FORM_SCHOOL_NAMES = [
  "christ church foundation school",
  "st. michael school",
];

const normalizeSchoolName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeGradeLevelToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const isVerifiedSixthFormSchool = (school) => {
  const name = normalizeSchoolName(school?.name);
  if (!name) {
    return false;
  }
  return VERIFIED_SIXTH_FORM_SCHOOL_NAMES.includes(name);
};

const getSecondaryLevels = (school) => {
  const supportsSixthForm =
    Boolean(school?.offers_sixth_form) || isVerifiedSixthFormSchool(school);
  return supportsSixthForm
    ? [...SECONDARY_CORE_LEVELS, ...SIXTH_FORM_LEVELS]
    : [...SECONDARY_CORE_LEVELS];
};

const getAllowedClassLevelsForSchool = (school) => {
  const schoolType = String(school?.school_type || "").toLowerCase();
  if (schoolType === "pre_primary") {
    return [...PRE_PRIMARY_CLASS_LEVELS];
  }
  if (schoolType === "secondary") {
    return getSecondaryLevels(school);
  }
  return [...PRIMARY_CLASS_LEVELS];
};

const buildGradeLevelMap = (levels) =>
  levels.reduce((acc, level) => {
    acc[normalizeGradeLevelToken(level)] = level;
    return acc;
  }, {});

const resolveGradeLevel = (rawGradeLevel, school) => {
  const allowedLevels = getAllowedClassLevelsForSchool(school);
  const allowedMap = buildGradeLevelMap(allowedLevels);
  const normalized = normalizeGradeLevelToken(rawGradeLevel);
  return allowedMap[normalized] || null;
};

module.exports = {
  PRE_PRIMARY_CLASS_LEVELS,
  PRIMARY_CLASS_LEVELS,
  SECONDARY_CORE_LEVELS,
  SIXTH_FORM_LEVELS,
  DEFAULT_CLASS_SECTIONS,
  VERIFIED_SIXTH_FORM_SCHOOL_NAMES,
  normalizeGradeLevelToken,
  isVerifiedSixthFormSchool,
  getAllowedClassLevelsForSchool,
  resolveGradeLevel,
};
