export const CARIBBEAN_GRADE_SCALE = [
  {
    letter: "A+",
    min: 90,
    max: 100,
    label: "Exceptional",
    fullDescription: "Outstanding mastery of course outcomes",
    color: "success",
  },
  {
    letter: "A",
    min: 85,
    max: 89,
    label: "Excellent",
    fullDescription: "Strong and consistent command of key concepts",
    color: "success",
  },
  {
    letter: "A-",
    min: 80,
    max: 84,
    label: "Very Good",
    fullDescription: "High performance with minor gaps",
    color: "success",
  },
  {
    letter: "B+",
    min: 75,
    max: 79,
    label: "Good Plus",
    fullDescription: "Solid understanding with growing confidence",
    color: "info",
  },
  {
    letter: "B",
    min: 70,
    max: 74,
    label: "Good",
    fullDescription: "Reliable performance across most competencies",
    color: "info",
  },
  {
    letter: "B-",
    min: 65,
    max: 69,
    label: "Developing",
    fullDescription: "Progressing, but needs reinforcement in weaker topics",
    color: "info",
  },
  {
    letter: "C+",
    min: 60,
    max: 64,
    label: "Satisfactory Plus",
    fullDescription: "Meets many core expectations",
    color: "warning",
  },
  {
    letter: "C",
    min: 55,
    max: 59,
    label: "Satisfactory",
    fullDescription: "Meets baseline expectations with support",
    color: "warning",
  },
  {
    letter: "C-",
    min: 50,
    max: 54,
    label: "Borderline Pass",
    fullDescription: "Minimum acceptable attainment",
    color: "warning",
  },
  {
    letter: "D+",
    min: 47,
    max: 49,
    label: "Limited Pass",
    fullDescription: "Below standard and needs targeted intervention",
    color: "error",
  },
  {
    letter: "D",
    min: 44,
    max: 46,
    label: "Weak",
    fullDescription: "Significant learning gaps are present",
    color: "error",
  },
  {
    letter: "D-",
    min: 40,
    max: 43,
    label: "Very Weak",
    fullDescription: "Urgent academic support required",
    color: "error",
  },
  {
    letter: "F",
    min: 0,
    max: 39,
    label: "Fail",
    fullDescription: "Does not meet minimum expected outcomes",
    color: "error",
  },
];

export const CARIBBEAN_GRADE_LOOKUP = CARIBBEAN_GRADE_SCALE.reduce(
  (acc, band) => {
    acc[band.letter] = band;
    return acc;
  },
  {},
);

export const getCaribbeanGradeFromScore = (score) => {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return "";
  }
  const band = CARIBBEAN_GRADE_SCALE.find((item) => numericScore >= item.min);
  return band?.letter || "F";
};

export const getCaribbeanGradeColor = (gradeValue) => {
  return CARIBBEAN_GRADE_LOOKUP[gradeValue]?.color || "default";
};
