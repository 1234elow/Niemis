const CARIBBEAN_GRADE_BANDS = [
  { letter: "A+", min: 90, max: 100, midpoint: 95 },
  { letter: "A", min: 85, max: 89, midpoint: 87 },
  { letter: "A-", min: 80, max: 84, midpoint: 82 },
  { letter: "B+", min: 75, max: 79, midpoint: 77 },
  { letter: "B", min: 70, max: 74, midpoint: 72 },
  { letter: "B-", min: 65, max: 69, midpoint: 67 },
  { letter: "C+", min: 60, max: 64, midpoint: 62 },
  { letter: "C", min: 55, max: 59, midpoint: 57 },
  { letter: "C-", min: 50, max: 54, midpoint: 52 },
  { letter: "D+", min: 47, max: 49, midpoint: 48 },
  { letter: "D", min: 44, max: 46, midpoint: 45 },
  { letter: "D-", min: 40, max: 43, midpoint: 41.5 },
  { letter: "F", min: 0, max: 39, midpoint: 20 },
];

const CARIBBEAN_GRADE_TO_SCORE = CARIBBEAN_GRADE_BANDS.reduce((acc, band) => {
  acc[band.letter] = band.midpoint;
  return acc;
}, {});

function scoreToCaribbeanGrade(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  for (const band of CARIBBEAN_GRADE_BANDS) {
    if (numeric >= band.min) {
      return band.letter;
    }
  }

  return "F";
}

function gradeToMidpointScore(grade) {
  return CARIBBEAN_GRADE_TO_SCORE[grade] ?? null;
}

module.exports = {
  CARIBBEAN_GRADE_BANDS,
  CARIBBEAN_GRADE_TO_SCORE,
  scoreToCaribbeanGrade,
  gradeToMidpointScore,
};
