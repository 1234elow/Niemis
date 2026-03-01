const { Op } = require("sequelize");
const { GradingPolicy } = require("../models");
const { normalizeGradeLevelToken } = require("../utils/classLevelPolicy");

const GRADE_BANDS = [
  "pre_primary",
  "primary",
  "lower_secondary",
  "upper_secondary",
  "sixth_form",
];

const DEFAULT_POLICY_ROWS = [
  {
    grade_band: "pre_primary",
    school_type: "pre_primary",
    policy_name: "Barbados Baseline: Pre-Primary",
    continuous_assessment_weight: 100,
    end_term_exam_weight: 0,
    pass_mark: 50,
    notes:
      "Baseline configuration. Schools can override to match approved local policy.",
  },
  {
    grade_band: "primary",
    school_type: "primary",
    policy_name: "Barbados Baseline: Primary",
    continuous_assessment_weight: 70,
    end_term_exam_weight: 30,
    pass_mark: 50,
    notes:
      "Baseline configuration. Schools can override to match approved local policy.",
  },
  {
    grade_band: "lower_secondary",
    school_type: "secondary",
    policy_name: "Barbados Baseline: Lower Secondary",
    continuous_assessment_weight: 60,
    end_term_exam_weight: 40,
    pass_mark: 50,
    notes:
      "Baseline configuration. Schools can override to match approved local policy.",
  },
  {
    grade_band: "upper_secondary",
    school_type: "secondary",
    policy_name: "Barbados Baseline: Upper Secondary",
    continuous_assessment_weight: 50,
    end_term_exam_weight: 50,
    pass_mark: 50,
    notes:
      "Baseline configuration. Schools can override to match approved local policy.",
  },
  {
    grade_band: "sixth_form",
    school_type: "secondary",
    policy_name: "Barbados Baseline: Sixth Form",
    continuous_assessment_weight: 40,
    end_term_exam_weight: 60,
    pass_mark: 50,
    notes:
      "Baseline configuration. Schools can override to match approved local policy.",
  },
];

const parseNumeric = (value, fallback = null) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const round2 = (value) => {
  const numeric = parseNumeric(value, 0);
  return Math.round(numeric * 100) / 100;
};

const normalizeSchoolType = (value) => String(value || "").trim().toLowerCase() || null;

const resolveGradeBandFromLevel = (gradeLevel, schoolType = null) => {
  const token = normalizeGradeLevelToken(gradeLevel);
  const normalizedSchoolType = normalizeSchoolType(schoolType);

  if (["infants a", "infants b"].includes(token)) return "pre_primary";
  if (["reception", "class 1", "class 2", "class 3", "class 4"].includes(token)) {
    return normalizedSchoolType === "pre_primary" ? "pre_primary" : "primary";
  }
  if (["first form", "second form", "third form"].includes(token)) {
    return "lower_secondary";
  }
  if (["fourth form", "fifth form"].includes(token)) {
    return "upper_secondary";
  }
  if (["lower sixth", "upper sixth"].includes(token)) {
    return "sixth_form";
  }
  if (normalizedSchoolType === "pre_primary") return "pre_primary";
  if (normalizedSchoolType === "secondary") return "lower_secondary";
  return "primary";
};

const normalizePolicyWeights = (continuousWeight, examWeight) => {
  const continuous = Math.max(0, Math.min(100, parseNumeric(continuousWeight, 0)));
  const exam = Math.max(0, Math.min(100, parseNumeric(examWeight, 0)));
  const total = continuous + exam;

  if (total <= 0) {
    return { continuous_assessment_weight: 100, end_term_exam_weight: 0 };
  }

  return {
    continuous_assessment_weight: round2((continuous / total) * 100),
    end_term_exam_weight: round2((exam / total) * 100),
  };
};

const serializePolicy = (policy) => ({
  id: policy.id,
  school_id: policy.school_id || null,
  policy_name: policy.policy_name,
  grade_band: policy.grade_band,
  school_type: policy.school_type || null,
  continuous_assessment_weight: parseNumeric(policy.continuous_assessment_weight, 0),
  end_term_exam_weight: parseNumeric(policy.end_term_exam_weight, 0),
  pass_mark: parseNumeric(policy.pass_mark, 50),
  is_active: Boolean(policy.is_active),
  notes: policy.notes || null,
  metadata: policy.metadata || null,
  created_by: policy.created_by || null,
  updated_by: policy.updated_by || null,
  created_at: policy.created_at || policy.createdAt || null,
  updated_at: policy.updated_at || policy.updatedAt || null,
});

const ensureDefaultGradingPolicies = async (actorUserId = null) => {
  const existingCount = await GradingPolicy.count({
    where: {
      school_id: null,
      is_active: true,
    },
  });

  if (existingCount > 0) return;

  const now = new Date();
  for (const row of DEFAULT_POLICY_ROWS) {
    await GradingPolicy.create({
      ...row,
      school_id: null,
      is_active: true,
      created_by: actorUserId || null,
      updated_by: actorUserId || null,
      metadata: {
        source: "barbados_baseline_defaults",
        seeded_at: now.toISOString(),
      },
    });
  }
};

const listGradingPolicies = async ({ schoolId = null, schoolType = null } = {}) => {
  await ensureDefaultGradingPolicies();

  const whereClause = {
    is_active: true,
    [Op.or]: [{ school_id: null }],
  };

  if (schoolId) {
    whereClause[Op.or].push({ school_id: schoolId });
  }

  if (schoolType) {
    whereClause.school_type = {
      [Op.or]: [normalizeSchoolType(schoolType), null],
    };
  }

  const rows = await GradingPolicy.findAll({
    where: whereClause,
    order: [
      ["school_id", "DESC"],
      ["grade_band", "ASC"],
      ["updated_at", "DESC"],
    ],
  });

  const policies = rows.map(serializePolicy);
  const effectiveByBand = {};

  for (const gradeBand of GRADE_BANDS) {
    const scoped = policies.find(
      (row) => row.grade_band === gradeBand && schoolId && String(row.school_id) === String(schoolId),
    );
    const global = policies.find((row) => row.grade_band === gradeBand && !row.school_id);
    effectiveByBand[gradeBand] = scoped || global || null;
  }

  return { policies, effective_by_band: effectiveByBand };
};

const resolveEffectiveGradingPolicy = async ({ schoolId = null, schoolType = null, gradeLevel = null }) => {
  const gradeBand = resolveGradeBandFromLevel(gradeLevel, schoolType);
  await ensureDefaultGradingPolicies();

  let policy = null;

  if (schoolId) {
    policy = await GradingPolicy.findOne({
      where: {
        is_active: true,
        school_id: schoolId,
        grade_band: gradeBand,
      },
      order: [["updated_at", "DESC"]],
    });
  }

  if (!policy) {
    policy = await GradingPolicy.findOne({
      where: {
        is_active: true,
        school_id: null,
        grade_band: gradeBand,
      },
      order: [["updated_at", "DESC"]],
    });
  }

  if (!policy) {
    const defaultRow = DEFAULT_POLICY_ROWS.find((row) => row.grade_band === gradeBand);
    const normalized = normalizePolicyWeights(
      defaultRow?.continuous_assessment_weight,
      defaultRow?.end_term_exam_weight,
    );
    return {
      id: null,
      school_id: null,
      policy_name: defaultRow?.policy_name || "Fallback Policy",
      grade_band: gradeBand,
      school_type: normalizeSchoolType(schoolType),
      continuous_assessment_weight: normalized.continuous_assessment_weight,
      end_term_exam_weight: normalized.end_term_exam_weight,
      pass_mark: parseNumeric(defaultRow?.pass_mark, 50),
      notes: defaultRow?.notes || null,
      metadata: { source: "fallback_defaults" },
    };
  }

  return serializePolicy(policy);
};

const isEndTermAssessment = (assessmentType) => {
  const token = String(assessmentType || "").trim().toLowerCase();
  return ["final", "final_exam", "end_term_exam", "exam"].includes(token);
};

const calculateWeightedScore = ({ policy, assessmentType, scorePercent, existingComponents = {} }) => {
  const normalizedScore = Math.max(0, Math.min(100, parseNumeric(scorePercent, 0)));
  const caWeight = parseNumeric(policy?.continuous_assessment_weight, 0);
  const examWeight = parseNumeric(policy?.end_term_exam_weight, 0);

  const nextComponents = {
    continuous_assessment_score: parseNumeric(existingComponents.continuous_assessment_score, null),
    end_term_exam_score: parseNumeric(existingComponents.end_term_exam_score, null),
  };

  const appliesToExam = isEndTermAssessment(assessmentType);
  if (appliesToExam) {
    nextComponents.end_term_exam_score = normalizedScore;
  } else {
    nextComponents.continuous_assessment_score = normalizedScore;
  }

  const weightedTotal =
    (parseNumeric(nextComponents.continuous_assessment_score, 0) * caWeight) / 100 +
    (parseNumeric(nextComponents.end_term_exam_score, 0) * examWeight) / 100;

  const availableWeights = [];
  if (Number.isFinite(nextComponents.continuous_assessment_score) && caWeight > 0) {
    availableWeights.push(caWeight);
  }
  if (Number.isFinite(nextComponents.end_term_exam_score) && examWeight > 0) {
    availableWeights.push(examWeight);
  }
  const availableWeightTotal = availableWeights.reduce((sum, value) => sum + value, 0);

  const provisionalScore =
    availableWeightTotal > 0
      ? ((parseNumeric(nextComponents.continuous_assessment_score, 0) * caWeight +
          parseNumeric(nextComponents.end_term_exam_score, 0) * examWeight) /
        availableWeightTotal)
      : normalizedScore;

  const missingComponents = [];
  if (!Number.isFinite(nextComponents.continuous_assessment_score) && caWeight > 0) {
    missingComponents.push("continuous_assessment_score");
  }
  if (!Number.isFinite(nextComponents.end_term_exam_score) && examWeight > 0) {
    missingComponents.push("end_term_exam_score");
  }

  const finalScore = missingComponents.length === 0 ? weightedTotal : provisionalScore;

  return {
    score: round2(finalScore),
    provisional_score: round2(provisionalScore),
    weighted_term_score: round2(weightedTotal),
    component_key: appliesToExam ? "end_term_exam_score" : "continuous_assessment_score",
    component_scores: nextComponents,
    missing_components: missingComponents,
  };
};

module.exports = {
  GRADE_BANDS,
  DEFAULT_POLICY_ROWS,
  resolveGradeBandFromLevel,
  normalizePolicyWeights,
  ensureDefaultGradingPolicies,
  listGradingPolicies,
  resolveEffectiveGradingPolicy,
  calculateWeightedScore,
  isEndTermAssessment,
};
