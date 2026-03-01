const { Op } = require('sequelize');
const {
    School,
    Class,
    Student,
    Grade,
    User,
    Staff,
    AuditLog,
    DataQualityIssue,
    DataQualitySnapshot
} = require('../models');
const { scoreToCaribbeanGrade } = require('../utils/caribbeanGradeScale');
const { normalizeGradeLevelToken, getAllowedClassLevelsForSchool } = require('../utils/classLevelPolicy');

const EXPECTED_AGE_RANGES = [
    { grade_level: 'Infants A', min_age: 4, max_age: 5 },
    { grade_level: 'Infants B', min_age: 5, max_age: 6 },
    { grade_level: 'Reception', min_age: 6, max_age: 7 },
    { grade_level: 'Class 1', min_age: 7, max_age: 8 },
    { grade_level: 'Class 2', min_age: 8, max_age: 9 },
    { grade_level: 'Class 3', min_age: 9, max_age: 10 },
    { grade_level: 'Class 4', min_age: 10, max_age: 11 },
    { grade_level: 'First Form', min_age: 11, max_age: 12 },
    { grade_level: 'Second Form', min_age: 12, max_age: 13 },
    { grade_level: 'Third Form', min_age: 13, max_age: 14 },
    { grade_level: 'Fourth Form', min_age: 14, max_age: 15 },
    { grade_level: 'Fifth Form', min_age: 15, max_age: 16 },
    { grade_level: 'Lower Sixth', min_age: 16, max_age: 17 },
    { grade_level: 'Upper Sixth', min_age: 17, max_age: 18 }
];

const EXPECTED_AGE_BY_GRADE = EXPECTED_AGE_RANGES.reduce((acc, row) => {
    acc[normalizeGradeLevelToken(row.grade_level)] = row;
    return acc;
}, {});

const CHECK_SEVERITY_ORDER = {
    critical: 0,
    warning: 1,
    info: 2
};

const SEVERITY_WEIGHTS = {
    critical: 8,
    warning: 3,
    info: 1
};

const DEFAULT_CHECK_SLA = {
    critical: 48,
    warning: 120,
    info: 168
};

const TRACKED_OPEN_STATUSES = ['open', 'in_progress'];

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);

const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDelta = today.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
        age -= 1;
    }
    return age;
};

const formatStudentLabel = (student) => {
    const fullName = [student?.first_name, student?.last_name].filter(Boolean).join(' ').trim();
    const studentCode = student?.student_id ? ` (${student.student_id})` : '';
    return `${fullName || 'Unknown student'}${studentCode}`;
};

const toNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const computeWeightedScore = ({
    criticalIssues = 0,
    warningIssues = 0,
    infoIssues = 0,
    populationBase = 1,
    criticalChecks = 0,
    warningChecks = 0,
    infoChecks = 0
}) => {
    const weightedIssues =
        criticalIssues * SEVERITY_WEIGHTS.critical +
        warningIssues * SEVERITY_WEIGHTS.warning +
        infoIssues * SEVERITY_WEIGHTS.info;
    const issueImpact = Math.min(1.25, weightedIssues / Math.max(1, populationBase));
    const rawScore = 100
        - Math.round(issueImpact * 55)
        - (criticalChecks * 7)
        - (warningChecks * 3)
        - (infoChecks * 1);
    return Math.max(0, Math.min(100, rawScore));
};

const determineScoreStatus = (score) => {
    if (score >= 90) return 'healthy';
    if (score >= 75) return 'watch';
    return 'critical';
};

const buildIssueSignature = ({ checkKey, scopeLevel, schoolId = null }) => {
    const scopeToken = scopeLevel === 'school' ? `school:${schoolId}` : 'national:global';
    return `${checkKey}::${scopeToken}`;
};

const isSameId = (left, right) => String(left || '') === String(right || '');

const getCheckDomainBase = (checkKey, totals) => {
    if (checkKey.startsWith('student_')) return Math.max(1, totals.students);
    if (checkKey.startsWith('class_')) return Math.max(1, totals.classes);
    if (checkKey.startsWith('grade_')) return Math.max(1, totals.grades);
    return Math.max(1, totals.students + totals.classes);
};

const mergeSchoolSample = (store, schoolId, text) => {
    if (!text || !schoolId) return;
    if (!store[schoolId]) store[schoolId] = [];
    if (store[schoolId].length < 3) store[schoolId].push(text);
};

const formatIssueForResponse = (issue) => {
    const createdAt = issue.createdAt || issue.created_at;
    const updatedAt = issue.updatedAt || issue.updated_at;
    const dueDate = issue.due_date || null;
    return {
        id: issue.id,
        issue_signature: issue.issue_signature,
        check_key: issue.check_key,
        label: issue.label,
        severity: issue.severity,
        scope_level: issue.scope_level,
        school_id: issue.school_id || null,
        school_name: issue?.School?.name || null,
        status: issue.status,
        issue_count: toNumber(issue.issue_count),
        sample_details: issue.sample_details || [],
        assigned_to: issue.assigned_to || null,
        assigned_by: issue.assigned_by || null,
        due_date: dueDate,
        ignored_reason: issue.ignored_reason || null,
        resolution_notes: issue.resolution_notes || null,
        first_detected_at: issue.first_detected_at || createdAt || null,
        last_detected_at: issue.last_detected_at || updatedAt || null,
        resolved_at: issue.resolved_at || null,
        sla_hours: toNumber(issue.sla_hours || DEFAULT_CHECK_SLA[issue.severity] || 72),
        metadata: issue.metadata || null
    };
};

const upsertSnapshot = async ({
    snapshotDate,
    generatedAt,
    scopeLevel,
    schoolId = null,
    score,
    status,
    issueCount,
    criticalIssues,
    warningIssues,
    infoIssues,
    metadata
}) => {
    const existing = await DataQualitySnapshot.findOne({
        where: {
            snapshot_date: snapshotDate,
            scope_level: scopeLevel,
            school_id: schoolId || null
        }
    });

    const payload = {
        generated_at: generatedAt,
        overall_score: score,
        status,
        issue_count: issueCount,
        critical_issues: criticalIssues,
        warning_issues: warningIssues,
        info_issues: infoIssues,
        metadata: metadata || null
    };

    if (existing) {
        await existing.update(payload);
        return existing;
    }

    return DataQualitySnapshot.create({
        snapshot_date: snapshotDate,
        scope_level: scopeLevel,
        school_id: schoolId || null,
        ...payload
    });
};

const calculateSlaSummary = async ({ schoolId = null }) => {
    const baseWhere = schoolId
        ? {
            [Op.or]: [
                { scope_level: 'national' },
                { scope_level: 'school', school_id: schoolId }
            ]
        }
        : {};

    const [allRows, resolvedRows] = await Promise.all([
        DataQualityIssue.findAll({
            where: baseWhere,
            attributes: [
                'id',
                'status',
                'severity',
                'first_detected_at',
                'resolved_at',
                'due_date',
                'sla_hours'
            ]
        }),
        DataQualityIssue.findAll({
            where: {
                ...baseWhere,
                status: 'resolved',
                resolved_at: {
                    [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            },
            attributes: ['id', 'first_detected_at', 'resolved_at', 'sla_hours']
        })
    ]);

    const openRows = allRows.filter((row) => TRACKED_OPEN_STATUSES.includes(row.status));
    const overdueRows = openRows.filter((row) => {
        if (!row.due_date) return false;
        return String(row.due_date) < todayIso();
    });

    const openAgeHours = openRows
        .map((row) => {
            const createdAt = row.first_detected_at || row.createdAt || row.created_at;
            if (!createdAt) return null;
            const ms = Date.now() - new Date(createdAt).getTime();
            return ms > 0 ? ms / (1000 * 60 * 60) : 0;
        })
        .filter((value) => Number.isFinite(value));

    const avgOpenAgeHours = openAgeHours.length > 0
        ? Number((openAgeHours.reduce((sum, value) => sum + value, 0) / openAgeHours.length).toFixed(1))
        : 0;

    const resolutionDurations = resolvedRows
        .map((row) => {
            if (!row.first_detected_at || !row.resolved_at) return null;
            const ms = new Date(row.resolved_at).getTime() - new Date(row.first_detected_at).getTime();
            return ms > 0 ? ms / (1000 * 60 * 60) : 0;
        })
        .filter((value) => Number.isFinite(value));

    const withinSlaResolved = resolvedRows.filter((row) => {
        if (!row.first_detected_at || !row.resolved_at) return false;
        const ms = new Date(row.resolved_at).getTime() - new Date(row.first_detected_at).getTime();
        const hours = ms > 0 ? ms / (1000 * 60 * 60) : 0;
        const slaHours = Number(row.sla_hours || 72);
        return hours <= slaHours;
    }).length;

    return {
        open_issues: openRows.length,
        overdue_issues: overdueRows.length,
        avg_open_age_hours: avgOpenAgeHours,
        avg_resolution_hours_30d: resolutionDurations.length > 0
            ? Number((resolutionDurations.reduce((sum, value) => sum + value, 0) / resolutionDurations.length).toFixed(1))
            : 0,
        within_sla_rate_30d: resolvedRows.length > 0
            ? Number(((withinSlaResolved / resolvedRows.length) * 100).toFixed(1))
            : 100
    };
};

const computePredictiveAlerts = ({
    latestScore,
    nationalTrendPoints,
    schoolBreakdown,
    unresolvedCritical,
    slaSummary
}) => {
    const alerts = [];
    if (nationalTrendPoints.length >= 3) {
        const first = toNumber(nationalTrendPoints[0].overall_score);
        const last = toNumber(nationalTrendPoints[nationalTrendPoints.length - 1].overall_score);
        const steps = Math.max(1, nationalTrendPoints.length - 1);
        const slopePerDay = (last - first) / steps;
        const projected7d = Number((last + slopePerDay * 7).toFixed(1));
        if (slopePerDay < -0.3 && projected7d < 75) {
            alerts.push({
                type: 'score_projection',
                severity: projected7d < 65 ? 'critical' : 'warning',
                message: `Score is trending down. Projected 7-day score: ${projected7d}%.`,
                details: {
                    slope_per_day: Number(slopePerDay.toFixed(2)),
                    projected_score_7d: projected7d,
                    current_score: latestScore
                }
            });
        }
    }

    if (unresolvedCritical > 0) {
        alerts.push({
            type: 'critical_issue_backlog',
            severity: 'critical',
            message: `${unresolvedCritical} unresolved critical data-quality issues require action.`,
            details: {
                unresolved_critical: unresolvedCritical
            }
        });
    }

    if (toNumber(slaSummary?.overdue_issues) > 0) {
        alerts.push({
            type: 'sla_overdue',
            severity: 'warning',
            message: `${slaSummary.overdue_issues} issues are overdue and outside their SLA.`,
            details: {
                overdue_issues: slaSummary.overdue_issues
            }
        });
    }

    const atRiskSchools = schoolBreakdown
        .filter((school) => toNumber(school.overall_score) < 70 && toNumber(school.issue_count) > 0)
        .sort((a, b) => toNumber(a.overall_score) - toNumber(b.overall_score))
        .slice(0, 3);

    if (atRiskSchools.length > 0) {
        alerts.push({
            type: 'school_risk',
            severity: 'warning',
            message: `${atRiskSchools.length} schools are below quality threshold.`,
            details: atRiskSchools.map((school) => ({
                school_id: school.school_id,
                school_name: school.school_name,
                overall_score: school.overall_score,
                issue_count: school.issue_count
            }))
        });
    }

    return alerts;
};

const buildSafeFixSummary = (payload) => ({
    fixed_records: payload.fixedRecords || 0,
    touched_entities: payload.touchedEntities || 0,
    warnings: payload.warnings || [],
    details: payload.details || {}
});

const runSafeFix = async ({ checkKey, schoolId = null }) => {
    const normalizedCheckKey = String(checkKey || '').trim();
    if (!normalizedCheckKey) {
        throw new Error('check_key is required.');
    }

    if (normalizedCheckKey === 'class_enrollment_sync') {
        const classWhere = {
            is_active: true,
            ...(schoolId ? { school_id: schoolId } : {})
        };
        const classes = await Class.findAll({
            where: classWhere,
            attributes: ['id', 'current_enrollment']
        });

        let updated = 0;
        for (const classRow of classes) {
            const actual = await Student.count({
                where: {
                    class_id: classRow.id,
                    is_active: true
                }
            });
            if (toNumber(classRow.current_enrollment) !== actual) {
                await classRow.update({ current_enrollment: actual });
                updated += 1;
            }
        }
        return buildSafeFixSummary({
            fixedRecords: updated,
            touchedEntities: classes.length,
            details: { type: 'class_enrollment_sync' }
        });
    }

    if (normalizedCheckKey === 'student_class_reference_integrity') {
        const students = await Student.findAll({
            where: {
                is_active: true,
                class_id: { [Op.not]: null },
                ...(schoolId ? { school_id: schoolId } : {})
            },
            include: [
                {
                    model: Class,
                    required: false,
                    attributes: ['id', 'school_id', 'is_active']
                }
            ],
            attributes: ['id', 'school_id', 'class_id']
        });

        let fixed = 0;
        for (const student of students) {
            const classRow = student.Class;
            const shouldUnassign =
                !classRow ||
                !classRow.is_active ||
                !isSameId(classRow.school_id, student.school_id);

            if (shouldUnassign) {
                await student.update({ class_id: null });
                fixed += 1;
            }
        }

        return buildSafeFixSummary({
            fixedRecords: fixed,
            touchedEntities: students.length,
            details: { type: 'student_class_reference_integrity' }
        });
    }

    if (normalizedCheckKey === 'grade_numeric_band_alignment') {
        const includeStudent = schoolId
            ? [
                {
                    model: Student,
                    required: true,
                    where: { school_id: schoolId },
                    attributes: ['id']
                }
            ]
            : [];

        const grades = await Grade.findAll({
            where: {
                numeric_score: { [Op.not]: null }
            },
            include: includeStudent,
            attributes: ['id', 'numeric_score', 'grade_value']
        });

        let fixed = 0;
        for (const grade of grades) {
            const expected = scoreToCaribbeanGrade(grade.numeric_score);
            if (expected && grade.grade_value !== expected) {
                await grade.update({ grade_value: expected });
                fixed += 1;
            }
        }

        return buildSafeFixSummary({
            fixedRecords: fixed,
            touchedEntities: grades.length,
            details: { type: 'grade_numeric_band_alignment' }
        });
    }

    if (normalizedCheckKey === 'grade_class_alignment') {
        const grades = await Grade.findAll({
            include: [
                {
                    model: Student,
                    required: true,
                    attributes: ['id', 'class_id', 'school_id'],
                    ...(schoolId ? { where: { school_id: schoolId } } : {})
                }
            ],
            attributes: ['id', 'class_id']
        });

        let fixed = 0;
        for (const grade of grades) {
            const studentClassId = grade?.Student?.class_id || null;
            if (!studentClassId) {
                continue;
            }
            if (!isSameId(studentClassId, grade.class_id)) {
                await grade.update({ class_id: studentClassId });
                fixed += 1;
            }
        }

        return buildSafeFixSummary({
            fixedRecords: fixed,
            touchedEntities: grades.length,
            details: { type: 'grade_class_alignment' }
        });
    }

    throw new Error(`No safe auto-fix is configured for check "${normalizedCheckKey}".`);
};

const syncTrackedIssues = async ({ detectedInstances, schoolId = null }) => {
    const now = new Date();
    const existingRows = await DataQualityIssue.findAll({
        where: schoolId
            ? {
                [Op.or]: [
                    { scope_level: 'national' },
                    { scope_level: 'school', school_id: schoolId }
                ]
            }
            : {}
    });

    const existingBySignature = existingRows.reduce((acc, row) => {
        acc[row.issue_signature] = row;
        return acc;
    }, {});

    const detectedSignatures = new Set();
    for (const instance of (detectedInstances || [])) {
        const signature = instance.issue_signature;
        detectedSignatures.add(signature);
        const existing = existingBySignature[signature];
        const payload = {
            label: instance.label,
            severity: instance.severity,
            scope_level: instance.scope_level,
            school_id: instance.school_id || null,
            issue_count: toNumber(instance.issue_count),
            sample_details: instance.sample_details || [],
            metadata: instance.metadata || null,
            last_detected_at: now
        };

        if (existing) {
            if (existing.status === 'resolved') {
                payload.status = 'open';
                payload.resolved_at = null;
                payload.resolution_notes = null;
            }
            await existing.update(payload);
        } else {
            await DataQualityIssue.create({
                issue_signature: signature,
                check_key: instance.check_key,
                status: 'open',
                first_detected_at: now,
                sla_hours: DEFAULT_CHECK_SLA[instance.severity] || 72,
                ...payload
            });
        }
    }

    for (const row of existingRows) {
        if (detectedSignatures.has(row.issue_signature)) {
            continue;
        }
        if (TRACKED_OPEN_STATUSES.includes(row.status)) {
            await row.update({
                status: 'resolved',
                issue_count: 0,
                resolved_at: now,
                resolution_notes: row.resolution_notes || 'Auto-resolved by latest data-quality scan.'
            });
            continue;
        }
        if (row.status === 'ignored') {
            await row.update({ issue_count: 0 });
        }
    }

    return DataQualityIssue.findAll({
        where: schoolId
            ? {
                [Op.or]: [
                    { scope_level: 'national' },
                    { scope_level: 'school', school_id: schoolId }
                ]
            }
            : undefined,
        include: [
            {
                model: School,
                required: false,
                attributes: ['id', 'name', 'school_code']
            }
        ],
        order: [
            ['severity', 'ASC'],
            ['status', 'ASC'],
            ['issue_count', 'DESC'],
            ['last_detected_at', 'DESC']
        ],
        limit: 100
    });
};

const getActionCenterIssues = async ({ schoolId = null, statusFilter = null, limit = 30 }) => {
    const whereClause = {};

    if (statusFilter) {
        whereClause.status = statusFilter;
    } else {
        whereClause.status = {
            [Op.in]: ['open', 'in_progress', 'ignored']
        };
    }

    if (schoolId) {
        whereClause[Op.or] = [
            { scope_level: 'national' },
            { scope_level: 'school', school_id: schoolId }
        ];
    }

    const issues = await DataQualityIssue.findAll({
        where: whereClause,
        include: [
            {
                model: School,
                required: false,
                attributes: ['id', 'name', 'school_code']
            }
        ],
        order: [
            ['severity', 'ASC'],
            ['status', 'ASC'],
            ['issue_count', 'DESC'],
            ['last_detected_at', 'DESC']
        ],
        limit
    });

    return issues.map(formatIssueForResponse);
};

const getAssignableUsers = async ({ schoolId = null }) => {
    const staffRows = await Staff.findAll({
        where: {
            is_active: true,
            ...(schoolId ? { school_id: schoolId } : {})
        },
        include: [
            {
                model: User,
                required: true,
                where: {
                    is_active: true,
                    role: { [Op.in]: ['super_admin', 'admin', 'teacher'] }
                },
                attributes: ['id', 'username', 'email', 'role']
            },
            {
                model: School,
                required: false,
                attributes: ['id', 'name']
            }
        ],
        attributes: ['id', 'first_name', 'last_name', 'role_level', 'school_id']
    });

    return staffRows.map((staff) => ({
        id: String(staff?.User?.id || ''),
        username: staff?.User?.username || '',
        email: staff?.User?.email || '',
        role: staff?.User?.role || '',
        role_level: staff.role_level,
        name: [staff.first_name, staff.last_name].filter(Boolean).join(' ').trim(),
        school_id: staff.school_id,
        school_name: staff?.School?.name || null
    }));
};

const buildDetectedIssueInstances = (checks) => {
    const instances = [];
    for (const check of checks) {
        if (toNumber(check.issue_count) <= 0) {
            continue;
        }

        const schoolBreakdown = check.school_breakdown || [];
        if (schoolBreakdown.length > 0) {
            for (const schoolRow of schoolBreakdown) {
                if (toNumber(schoolRow.issue_count) <= 0) continue;
                const signature = buildIssueSignature({
                    checkKey: check.key,
                    scopeLevel: 'school',
                    schoolId: schoolRow.school_id
                });
                instances.push({
                    issue_signature: signature,
                    check_key: check.key,
                    label: check.label,
                    severity: check.severity,
                    scope_level: 'school',
                    school_id: schoolRow.school_id,
                    issue_count: toNumber(schoolRow.issue_count),
                    sample_details: schoolRow.samples || check.samples || [],
                    metadata: {
                        compliance_rate: check.compliance_rate,
                        source: 'data_quality_scan'
                    }
                });
            }
        } else {
            const signature = buildIssueSignature({
                checkKey: check.key,
                scopeLevel: 'national'
            });
            instances.push({
                issue_signature: signature,
                check_key: check.key,
                label: check.label,
                severity: check.severity,
                scope_level: 'national',
                school_id: null,
                issue_count: toNumber(check.issue_count),
                sample_details: check.samples || [],
                metadata: {
                    compliance_rate: check.compliance_rate,
                    source: 'data_quality_scan'
                }
            });
        }
    }
    return instances;
};

const generateDataQualityOverview = async ({ schoolId = null, refreshTracking = true }) => {
    const schoolWhere = {
        is_active: true,
        ...(schoolId ? { id: schoolId } : {})
    };

    const classWhere = {
        is_active: true,
        ...(schoolId ? { school_id: schoolId } : {})
    };

    const studentWhere = {
        is_active: true,
        ...(schoolId ? { school_id: schoolId } : {})
    };

    const [activeSchools, activeClasses, activeStudents, gradeRows] = await Promise.all([
        School.findAll({
            where: schoolWhere,
            attributes: ['id', 'name', 'school_type', 'offers_sixth_form', 'school_code'],
            raw: true
        }),
        Class.findAll({
            where: classWhere,
            attributes: [
                'id',
                'school_id',
                'name',
                'grade_level',
                'section',
                'capacity',
                'current_enrollment',
                'class_teacher_id'
            ]
        }),
        Student.findAll({
            where: studentWhere,
            attributes: [
                'id',
                'student_id',
                'first_name',
                'last_name',
                'date_of_birth',
                'grade_level',
                'school_id',
                'class_id'
            ]
        }),
        Grade.findAll({
            attributes: ['id', 'student_id', 'class_id', 'grade_value', 'numeric_score'],
            include: [
                {
                    model: Student,
                    attributes: ['id', 'student_id', 'first_name', 'last_name', 'class_id', 'school_id'],
                    required: Boolean(schoolId),
                    ...(schoolId ? { where: { school_id: schoolId } } : {})
                }
            ]
        })
    ]);

    const schoolsById = activeSchools.reduce((acc, school) => {
        acc[String(school.id)] = school;
        return acc;
    }, {});

    const classesById = activeClasses.reduce((acc, classRow) => {
        acc[String(classRow.id)] = classRow;
        return acc;
    }, {});

    const schoolPopulationStats = {};
    activeSchools.forEach((school) => {
        schoolPopulationStats[String(school.id)] = {
            students: 0,
            classes: 0
        };
    });

    activeStudents.forEach((student) => {
        const key = String(student.school_id || '');
        if (!schoolPopulationStats[key]) schoolPopulationStats[key] = { students: 0, classes: 0 };
        schoolPopulationStats[key].students += 1;
    });
    activeClasses.forEach((classRow) => {
        const key = String(classRow.school_id || '');
        if (!schoolPopulationStats[key]) schoolPopulationStats[key] = { students: 0, classes: 0 };
        schoolPopulationStats[key].classes += 1;
    });

    const classEnrollmentCounts = activeStudents.reduce((acc, student) => {
        if (!student.class_id) return acc;
        const key = String(student.class_id);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const schoolTotals = {};
    const checkSchoolCounts = {};
    const checkSchoolSamples = {};
    const checkSeverityByKey = {};
    const checkLabelByKey = {};

    const ensureSchoolTotals = (schoolIdValue) => {
        if (!schoolIdValue) return null;
        const key = String(schoolIdValue);
        if (!schoolTotals[key]) {
            schoolTotals[key] = {
                issue_count: 0,
                critical_issues: 0,
                warning_issues: 0,
                info_issues: 0,
                check_counts: {}
            };
        }
        return schoolTotals[key];
    };

    const recordSchoolIssue = ({ checkKey, severity, schoolIdValue, sample }) => {
        if (!schoolIdValue) return;
        const schoolKey = String(schoolIdValue);
        const schoolBucket = ensureSchoolTotals(schoolKey);
        schoolBucket.issue_count += 1;
        if (severity === 'critical') schoolBucket.critical_issues += 1;
        if (severity === 'warning') schoolBucket.warning_issues += 1;
        if (severity === 'info') schoolBucket.info_issues += 1;
        schoolBucket.check_counts[checkKey] = (schoolBucket.check_counts[checkKey] || 0) + 1;

        if (!checkSchoolCounts[checkKey]) checkSchoolCounts[checkKey] = {};
        checkSchoolCounts[checkKey][schoolKey] = (checkSchoolCounts[checkKey][schoolKey] || 0) + 1;

        if (!checkSchoolSamples[checkKey]) checkSchoolSamples[checkKey] = {};
        mergeSchoolSample(checkSchoolSamples[checkKey], schoolKey, sample);
    };

    const checks = [];
    const registerCheck = ({ key, label, severity, issueCount, samples }) => {
        checkSeverityByKey[key] = severity;
        checkLabelByKey[key] = label;
        const schoolCounts = checkSchoolCounts[key] || {};
        const schoolBreakdown = Object.entries(schoolCounts)
            .map(([schoolKey, count]) => ({
                school_id: schoolKey,
                school_name: schoolsById[schoolKey]?.name || 'Unknown school',
                issue_count: toNumber(count),
                samples: (checkSchoolSamples[key]?.[schoolKey] || []).slice(0, 3)
            }))
            .sort((a, b) => b.issue_count - a.issue_count);

        const denominator = getCheckDomainBase(key, {
            students: activeStudents.length,
            classes: activeClasses.length,
            grades: gradeRows.length
        });
        const complianceRate = Math.max(0, Number((100 - ((toNumber(issueCount) / denominator) * 100)).toFixed(1)));

        checks.push({
            key,
            label,
            severity,
            issue_count: toNumber(issueCount),
            samples: (samples || []).slice(0, 5),
            school_breakdown: schoolBreakdown,
            compliance_rate: complianceRate
        });
    };

    let ageGradeMismatches = 0;
    const ageGradeSamples = [];
    for (const student of activeStudents) {
        const normalizedGrade = normalizeGradeLevelToken(student.grade_level);
        const expected = EXPECTED_AGE_BY_GRADE[normalizedGrade];
        if (!expected) continue;
        const age = calculateAge(student.date_of_birth);
        if (age === null) continue;

        if (age < expected.min_age || age > expected.max_age) {
            ageGradeMismatches += 1;
            const sample = `${formatStudentLabel(student)} is age ${age} in ${student.grade_level}; expected ${expected.min_age}-${expected.max_age}.`;
            if (ageGradeSamples.length < 5) ageGradeSamples.push(sample);
            recordSchoolIssue({
                checkKey: 'student_age_grade_alignment',
                severity: 'warning',
                schoolIdValue: student.school_id,
                sample
            });
        }
    }
    registerCheck({
        key: 'student_age_grade_alignment',
        label: 'Student age aligns with grade level',
        severity: 'warning',
        issueCount: ageGradeMismatches,
        samples: ageGradeSamples
    });

    let schoolGradeMismatches = 0;
    const schoolGradeSamples = [];
    for (const student of activeStudents) {
        const school = schoolsById[String(student.school_id)];
        if (!school) continue;
        const allowedGrades = getAllowedClassLevelsForSchool(school).map((gradeLevel) =>
            normalizeGradeLevelToken(gradeLevel)
        );
        const gradeToken = normalizeGradeLevelToken(student.grade_level);
        if (!gradeToken || !allowedGrades.includes(gradeToken)) {
            schoolGradeMismatches += 1;
            const sample = `${formatStudentLabel(student)} has grade ${student.grade_level || 'Unknown'} at ${school.name} (${school.school_type}).`;
            if (schoolGradeSamples.length < 5) schoolGradeSamples.push(sample);
            recordSchoolIssue({
                checkKey: 'student_school_grade_policy',
                severity: 'critical',
                schoolIdValue: student.school_id,
                sample
            });
        }
    }
    registerCheck({
        key: 'student_school_grade_policy',
        label: 'Student grade is valid for school type',
        severity: 'critical',
        issueCount: schoolGradeMismatches,
        samples: schoolGradeSamples
    });

    let orphanClassRefs = 0;
    let classSchoolMismatches = 0;
    let classGradeMismatches = 0;
    const orphanClassSamples = [];
    const classSchoolSamples = [];
    const classGradeSamples = [];
    for (const student of activeStudents) {
        if (!student.class_id) continue;
        const classRow = classesById[String(student.class_id)];
        if (!classRow) {
            orphanClassRefs += 1;
            const sample = `${formatStudentLabel(student)} is linked to a missing/inactive class (${student.class_id}).`;
            if (orphanClassSamples.length < 5) orphanClassSamples.push(sample);
            recordSchoolIssue({
                checkKey: 'student_class_reference_integrity',
                severity: 'critical',
                schoolIdValue: student.school_id,
                sample
            });
            continue;
        }
        if (!isSameId(classRow.school_id, student.school_id)) {
            classSchoolMismatches += 1;
            const sample = `${formatStudentLabel(student)} is assigned to ${classRow.name} (${classRow.section}) in another school.`;
            if (classSchoolSamples.length < 5) classSchoolSamples.push(sample);
            recordSchoolIssue({
                checkKey: 'student_class_school_alignment',
                severity: 'critical',
                schoolIdValue: student.school_id,
                sample
            });
        }
        if (normalizeGradeLevelToken(classRow.grade_level) !== normalizeGradeLevelToken(student.grade_level)) {
            classGradeMismatches += 1;
            const sample = `${formatStudentLabel(student)} grade ${student.grade_level} differs from class grade ${classRow.grade_level}.`;
            if (classGradeSamples.length < 5) classGradeSamples.push(sample);
            recordSchoolIssue({
                checkKey: 'student_class_grade_alignment',
                severity: 'warning',
                schoolIdValue: student.school_id,
                sample
            });
        }
    }
    registerCheck({
        key: 'student_class_reference_integrity',
        label: 'Students are assigned to existing active classes',
        severity: 'critical',
        issueCount: orphanClassRefs,
        samples: orphanClassSamples
    });
    registerCheck({
        key: 'student_class_school_alignment',
        label: 'Student school matches assigned class school',
        severity: 'critical',
        issueCount: classSchoolMismatches,
        samples: classSchoolSamples
    });
    registerCheck({
        key: 'student_class_grade_alignment',
        label: 'Student grade matches assigned class grade',
        severity: 'warning',
        issueCount: classGradeMismatches,
        samples: classGradeSamples
    });

    let overCapacityClasses = 0;
    let enrollmentDriftClasses = 0;
    let classesWithoutTeacher = 0;
    const capacitySamples = [];
    const enrollmentDriftSamples = [];
    const classesWithoutTeacherSamples = [];
    for (const classRow of activeClasses) {
        const classId = String(classRow.id);
        const actualEnrollment = toNumber(classEnrollmentCounts[classId] || 0);
        const configuredCapacity = toNumber(classRow.capacity || 0);
        const currentEnrollment = toNumber(classRow.current_enrollment || 0);

        if (configuredCapacity > 0 && actualEnrollment > configuredCapacity) {
            overCapacityClasses += 1;
            const sample = `${classRow.name} (${classRow.section}) has ${actualEnrollment}/${configuredCapacity} students.`;
            if (capacitySamples.length < 5) capacitySamples.push(sample);
            recordSchoolIssue({
                checkKey: 'class_capacity_limit',
                severity: 'critical',
                schoolIdValue: classRow.school_id,
                sample
            });
        }
        if (actualEnrollment !== currentEnrollment) {
            enrollmentDriftClasses += 1;
            const sample = `${classRow.name} (${classRow.section}) tracks ${currentEnrollment} but has ${actualEnrollment} assigned students.`;
            if (enrollmentDriftSamples.length < 5) enrollmentDriftSamples.push(sample);
            recordSchoolIssue({
                checkKey: 'class_enrollment_sync',
                severity: 'warning',
                schoolIdValue: classRow.school_id,
                sample
            });
        }
        if (!classRow.class_teacher_id) {
            classesWithoutTeacher += 1;
            const sample = `${classRow.name} (${classRow.section}) does not have a class teacher assigned.`;
            if (classesWithoutTeacherSamples.length < 5) classesWithoutTeacherSamples.push(sample);
            recordSchoolIssue({
                checkKey: 'class_teacher_assignment',
                severity: 'warning',
                schoolIdValue: classRow.school_id,
                sample
            });
        }
    }
    registerCheck({
        key: 'class_capacity_limit',
        label: 'Classes do not exceed configured capacity',
        severity: 'critical',
        issueCount: overCapacityClasses,
        samples: capacitySamples
    });
    registerCheck({
        key: 'class_enrollment_sync',
        label: 'Class enrollment counters match assigned students',
        severity: 'warning',
        issueCount: enrollmentDriftClasses,
        samples: enrollmentDriftSamples
    });
    registerCheck({
        key: 'class_teacher_assignment',
        label: 'Classes have an assigned class teacher',
        severity: 'warning',
        issueCount: classesWithoutTeacher,
        samples: classesWithoutTeacherSamples
    });

    const duplicateBuckets = activeStudents.reduce((acc, student) => {
        const dedupeKey = [
            String(student.first_name || '').trim().toLowerCase(),
            String(student.last_name || '').trim().toLowerCase(),
            String(student.date_of_birth || ''),
            String(student.school_id || '')
        ].join('|');
        if (!acc[dedupeKey]) acc[dedupeKey] = [];
        acc[dedupeKey].push(student);
        return acc;
    }, {});

    let duplicateProfiles = 0;
    const duplicateSamples = [];
    Object.values(duplicateBuckets).forEach((bucket) => {
        if (bucket.length <= 1) return;
        duplicateProfiles += bucket.length - 1;
        const first = bucket[0];
        const sample = `${formatStudentLabel(first)} has ${bucket.length} active profiles with the same name and date of birth.`;
        if (duplicateSamples.length < 5) duplicateSamples.push(sample);
        recordSchoolIssue({
            checkKey: 'student_duplicate_profiles',
            severity: 'warning',
            schoolIdValue: first.school_id,
            sample
        });
    });
    registerCheck({
        key: 'student_duplicate_profiles',
        label: 'Student profiles are not duplicated',
        severity: 'warning',
        issueCount: duplicateProfiles,
        samples: duplicateSamples
    });

    let gradeBandMismatches = 0;
    let gradeClassMismatches = 0;
    let orphanGradeRows = 0;
    const gradeBandSamples = [];
    const gradeClassSamples = [];
    const orphanGradeSamples = [];

    for (const gradeRow of gradeRows) {
        const numericScore = Number(gradeRow.numeric_score);
        const gradeStudent = gradeRow.Student || null;
        const schoolIdValue = gradeStudent?.school_id || classesById[String(gradeRow.class_id)]?.school_id || null;

        if (Number.isFinite(numericScore)) {
            const normalizedGrade = scoreToCaribbeanGrade(numericScore);
            if (normalizedGrade && gradeRow.grade_value !== normalizedGrade) {
                gradeBandMismatches += 1;
                const studentLabel = gradeStudent
                    ? formatStudentLabel(gradeStudent)
                    : `Student ${gradeRow.student_id}`;
                const sample = `${studentLabel} scored ${numericScore} but grade is ${gradeRow.grade_value} (expected ${normalizedGrade}).`;
                if (gradeBandSamples.length < 5) gradeBandSamples.push(sample);
                recordSchoolIssue({
                    checkKey: 'grade_numeric_band_alignment',
                    severity: 'critical',
                    schoolIdValue,
                    sample
                });
            }
        }

        if (!gradeStudent) {
            orphanGradeRows += 1;
            const sample = `Grade ${gradeRow.id} references missing student ${gradeRow.student_id}.`;
            if (orphanGradeSamples.length < 5) orphanGradeSamples.push(sample);
            continue;
        }

        if (gradeStudent.class_id && !isSameId(gradeStudent.class_id, gradeRow.class_id)) {
            gradeClassMismatches += 1;
            const sample = `${formatStudentLabel(gradeStudent)} has grade in class ${gradeRow.class_id} but is enrolled in ${gradeStudent.class_id}.`;
            if (gradeClassSamples.length < 5) gradeClassSamples.push(sample);
            recordSchoolIssue({
                checkKey: 'grade_class_alignment',
                severity: 'critical',
                schoolIdValue,
                sample
            });
        }
    }

    registerCheck({
        key: 'grade_numeric_band_alignment',
        label: 'Letter grades match Caribbean numeric bands',
        severity: 'critical',
        issueCount: gradeBandMismatches,
        samples: gradeBandSamples
    });
    registerCheck({
        key: 'grade_class_alignment',
        label: 'Grades are saved against each student current class',
        severity: 'critical',
        issueCount: gradeClassMismatches,
        samples: gradeClassSamples
    });
    registerCheck({
        key: 'grade_student_reference_integrity',
        label: 'Grade rows reference existing students',
        severity: 'critical',
        issueCount: orphanGradeRows,
        samples: orphanGradeSamples
    });

    const checksWithIssues = checks.filter((check) => check.issue_count > 0);
    const totalIssueCount = checks.reduce((sum, check) => sum + toNumber(check.issue_count), 0);
    const severityTotals = checks.reduce((acc, check) => {
        const count = toNumber(check.issue_count);
        acc[check.severity] = (acc[check.severity] || 0) + count;
        return acc;
    }, { critical: 0, warning: 0, info: 0 });

    const globalCheckCounters = checksWithIssues.reduce((acc, check) => {
        acc[check.severity] = (acc[check.severity] || 0) + 1;
        return acc;
    }, { critical: 0, warning: 0, info: 0 });

    const overallScore = computeWeightedScore({
        criticalIssues: severityTotals.critical,
        warningIssues: severityTotals.warning,
        infoIssues: severityTotals.info,
        populationBase: Math.max(1, activeStudents.length + activeClasses.length),
        criticalChecks: globalCheckCounters.critical,
        warningChecks: globalCheckCounters.warning,
        infoChecks: globalCheckCounters.info
    });
    const overallStatus = determineScoreStatus(overallScore);

    const sortedTopIssues = checksWithIssues
        .slice()
        .sort((a, b) =>
            (CHECK_SEVERITY_ORDER[a.severity] - CHECK_SEVERITY_ORDER[b.severity]) ||
            (b.issue_count - a.issue_count)
        )
        .slice(0, 8);

    const schoolBreakdown = Object.keys(schoolPopulationStats)
        .map((schoolKey) => {
            const totals = schoolTotals[schoolKey] || {
                issue_count: 0,
                critical_issues: 0,
                warning_issues: 0,
                info_issues: 0,
                check_counts: {}
            };
            const checkEntries = Object.entries(totals.check_counts || {});
            const criticalChecks = checkEntries.filter(([checkKey]) => checkSeverityByKey[checkKey] === 'critical').length;
            const warningChecks = checkEntries.filter(([checkKey]) => checkSeverityByKey[checkKey] === 'warning').length;
            const infoChecks = checkEntries.filter(([checkKey]) => checkSeverityByKey[checkKey] === 'info').length;
            const populationBase = Math.max(
                1,
                toNumber(schoolPopulationStats[schoolKey]?.students) + toNumber(schoolPopulationStats[schoolKey]?.classes)
            );
            const score = computeWeightedScore({
                criticalIssues: totals.critical_issues,
                warningIssues: totals.warning_issues,
                infoIssues: totals.info_issues,
                populationBase,
                criticalChecks,
                warningChecks,
                infoChecks
            });

            const topViolations = checkEntries
                .map(([checkKey, count]) => ({
                    check_key: checkKey,
                    label: checkLabelByKey[checkKey] || checkKey,
                    issue_count: count,
                    severity: checkSeverityByKey[checkKey] || 'warning'
                }))
                .sort((a, b) => b.issue_count - a.issue_count)
                .slice(0, 4);

            const issueImpactRatio = Math.min(1, toNumber(totals.issue_count) / populationBase);
            const complianceRate = Math.max(0, Number((100 - issueImpactRatio * 100).toFixed(1)));

            return {
                school_id: schoolKey,
                school_name: schoolsById[schoolKey]?.name || 'Unknown school',
                school_code: schoolsById[schoolKey]?.school_code || null,
                students: toNumber(schoolPopulationStats[schoolKey]?.students),
                classes: toNumber(schoolPopulationStats[schoolKey]?.classes),
                issue_count: toNumber(totals.issue_count),
                critical_issues: toNumber(totals.critical_issues),
                warning_issues: toNumber(totals.warning_issues),
                info_issues: toNumber(totals.info_issues),
                checks_with_issues: checkEntries.length,
                overall_score: score,
                status: determineScoreStatus(score),
                compliance_rate: complianceRate,
                top_policy_violations: topViolations
            };
        })
        .sort((a, b) =>
            (toNumber(a.overall_score) - toNumber(b.overall_score)) ||
            (toNumber(b.issue_count) - toNumber(a.issue_count))
        );

    const detectedInstances = buildDetectedIssueInstances(checks);
    let trackedIssueRows = [];
    if (refreshTracking) {
        trackedIssueRows = await syncTrackedIssues({ detectedInstances, schoolId });
    }

    const trackedIssues = trackedIssueRows.length > 0
        ? trackedIssueRows.map(formatIssueForResponse)
        : await getActionCenterIssues({ schoolId });

    const generatedAt = nowIso();
    const snapshotDate = todayIso();
    await upsertSnapshot({
        snapshotDate,
        generatedAt,
        scopeLevel: 'national',
        schoolId: null,
        score: overallScore,
        status: overallStatus,
        issueCount: totalIssueCount,
        criticalIssues: toNumber(severityTotals.critical),
        warningIssues: toNumber(severityTotals.warning),
        infoIssues: toNumber(severityTotals.info),
        metadata: {
            checks_with_issues: checksWithIssues.length
        }
    });

    for (const school of schoolBreakdown) {
        await upsertSnapshot({
            snapshotDate,
            generatedAt,
            scopeLevel: 'school',
            schoolId: school.school_id,
            score: school.overall_score,
            status: school.status,
            issueCount: school.issue_count,
            criticalIssues: school.critical_issues,
            warningIssues: school.warning_issues,
            infoIssues: school.info_issues,
            metadata: {
                checks_with_issues: school.checks_with_issues,
                compliance_rate: school.compliance_rate
            }
        });
    }

    const trendRows = await DataQualitySnapshot.findAll({
        where: {
            scope_level: 'national',
            school_id: null,
            snapshot_date: {
                [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            }
        },
        attributes: ['snapshot_date', 'overall_score', 'issue_count', 'critical_issues', 'warning_issues'],
        order: [['snapshot_date', 'ASC']]
    });

    const nationalTrend = trendRows.map((row) => ({
        date: row.snapshot_date,
        overall_score: toNumber(row.overall_score),
        issue_count: toNumber(row.issue_count),
        critical_issues: toNumber(row.critical_issues),
        warning_issues: toNumber(row.warning_issues)
    }));

    const slaSummary = await calculateSlaSummary({ schoolId });
    const unresolvedCriticalCount = await DataQualityIssue.count({
        where: {
            severity: 'critical',
            status: { [Op.in]: TRACKED_OPEN_STATUSES },
            ...(schoolId ? {
                [Op.or]: [
                    { scope_level: 'national' },
                    { scope_level: 'school', school_id: schoolId }
                ]
            } : {})
        }
    });

    const predictiveAlerts = computePredictiveAlerts({
        latestScore: overallScore,
        nationalTrendPoints: nationalTrend.slice(-14),
        schoolBreakdown,
        unresolvedCritical: unresolvedCriticalCount,
        slaSummary
    });

    return {
        generated_at: generatedAt,
        overall_score: overallScore,
        status: overallStatus,
        totals: {
            checks_run: checks.length,
            checks_with_issues: checksWithIssues.length,
            issue_count: totalIssueCount,
            critical_issues: toNumber(severityTotals.critical),
            warning_issues: toNumber(severityTotals.warning),
            info_issues: toNumber(severityTotals.info)
        },
        top_issues: sortedTopIssues,
        checks,
        school_breakdown: schoolId
            ? schoolBreakdown.filter((item) => isSameId(item.school_id, schoolId))
            : schoolBreakdown,
        trends: {
            national_score: nationalTrend
        },
        sla: slaSummary,
        predictive_alerts: predictiveAlerts,
        action_center: {
            issues: trackedIssues.slice(0, 30),
            workflow_summary: {
                open: trackedIssues.filter((item) => item.status === 'open').length,
                in_progress: trackedIssues.filter((item) => item.status === 'in_progress').length,
                ignored: trackedIssues.filter((item) => item.status === 'ignored').length,
                resolved_recent_30d: await DataQualityIssue.count({
                    where: {
                        status: 'resolved',
                        resolved_at: {
                            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        },
                        ...(schoolId ? {
                            [Op.or]: [
                                { scope_level: 'national' },
                                { scope_level: 'school', school_id: schoolId }
                            ]
                        } : {})
                    }
                })
            }
        }
    };
};

const listTrackedIssues = async ({ schoolId = null, status = null, limit = 30 }) => {
    const normalizedStatus = status ? String(status).trim().toLowerCase() : null;
    const normalizedLimit = Math.max(1, Math.min(200, toNumber(limit) || 30));
    return getActionCenterIssues({
        schoolId,
        statusFilter: normalizedStatus,
        limit: normalizedLimit
    });
};

const updateTrackedIssue = async ({
    issueId,
    updates = {},
    schoolId = null,
    actingUser = null,
    requestContext = {}
}) => {
    if (!issueId) {
        throw new Error('issue_id is required.');
    }

    const issue = await DataQualityIssue.findByPk(issueId, {
        include: [
            {
                model: School,
                required: false,
                attributes: ['id', 'name', 'school_code']
            }
        ]
    });
    if (!issue) {
        throw new Error('Data-quality issue not found.');
    }

    if (
        schoolId &&
        issue.scope_level === 'school' &&
        !isSameId(issue.school_id, schoolId)
    ) {
        throw new Error('This issue belongs to another school.');
    }

    const oldValues = {
        status: issue.status,
        assigned_to: issue.assigned_to,
        due_date: issue.due_date,
        ignored_reason: issue.ignored_reason,
        resolution_notes: issue.resolution_notes
    };

    const payload = {};
    const allowedStatuses = new Set(['open', 'in_progress', 'resolved', 'ignored']);
    if (Object.prototype.hasOwnProperty.call(updates, 'status') && updates.status !== undefined) {
        const normalizedStatus = String(updates.status || '').trim().toLowerCase();
        if (!allowedStatuses.has(normalizedStatus)) {
            throw new Error('Invalid issue status.');
        }
        payload.status = normalizedStatus;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'assigned_to') && updates.assigned_to !== undefined) {
        payload.assigned_to = updates.assigned_to ? String(updates.assigned_to).trim() : null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'assigned_by') && updates.assigned_by !== undefined) {
        payload.assigned_by = updates.assigned_by ? String(updates.assigned_by).trim() : null;
    } else if (
        Object.prototype.hasOwnProperty.call(updates, 'assigned_to') &&
        updates.assigned_to !== undefined &&
        actingUser?.id
    ) {
        payload.assigned_by = String(actingUser.id);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'due_date') && updates.due_date !== undefined) {
        if (!updates.due_date) {
            payload.due_date = null;
        } else {
            const dueDate = new Date(updates.due_date);
            if (Number.isNaN(dueDate.getTime())) {
                throw new Error('Invalid due_date value.');
            }
            payload.due_date = dueDate.toISOString().slice(0, 10);
        }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'ignored_reason') && updates.ignored_reason !== undefined) {
        payload.ignored_reason = updates.ignored_reason
            ? String(updates.ignored_reason).trim()
            : null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'resolution_notes') && updates.resolution_notes !== undefined) {
        payload.resolution_notes = updates.resolution_notes
            ? String(updates.resolution_notes).trim()
            : null;
    }

    if (payload.status === 'resolved') {
        payload.resolved_at = new Date();
        if (!payload.resolution_notes) {
            payload.resolution_notes = issue.resolution_notes || 'Marked as resolved from action center.';
        }
    }

    if (payload.status === 'open' || payload.status === 'in_progress') {
        payload.resolved_at = null;
    }

    if (payload.status !== 'ignored' && !Object.prototype.hasOwnProperty.call(payload, 'ignored_reason')) {
        payload.ignored_reason = null;
    }

    if (payload.status === 'ignored' && !payload.ignored_reason) {
        payload.ignored_reason = issue.ignored_reason || 'Marked as ignored from action center.';
    }

    await issue.update(payload);

    if (actingUser?.id) {
        await AuditLog.create({
            user_id: actingUser.id,
            action: 'data_quality_issue_updated',
            table_name: 'data_quality_issues',
            record_id: issue.id,
            old_values: oldValues,
            new_values: {
                status: issue.status,
                assigned_to: issue.assigned_to,
                due_date: issue.due_date,
                ignored_reason: issue.ignored_reason,
                resolution_notes: issue.resolution_notes
            },
            ip_address: requestContext.ipAddress || null,
            user_agent: requestContext.userAgent || null
        });
    }

    const reloaded = await DataQualityIssue.findByPk(issue.id, {
        include: [
            {
                model: School,
                required: false,
                attributes: ['id', 'name', 'school_code']
            }
        ]
    });
    return formatIssueForResponse(reloaded);
};

const applySafeAutoFix = async ({
    checkKey,
    schoolId = null,
    actingUser = null,
    requestContext = {}
}) => {
    const summary = await runSafeFix({ checkKey, schoolId });

    if (actingUser?.id) {
        await AuditLog.create({
            user_id: actingUser.id,
            action: 'data_quality_safe_fix_applied',
            table_name: 'data_quality_issues',
            record_id: null,
            old_values: null,
            new_values: {
                check_key: checkKey,
                school_id: schoolId || null,
                summary
            },
            ip_address: requestContext.ipAddress || null,
            user_agent: requestContext.userAgent || null
        });
    }

    const refreshed = await generateDataQualityOverview({
        schoolId,
        refreshTracking: true
    });

    return {
        check_key: checkKey,
        school_id: schoolId || null,
        summary,
        refreshed: {
            generated_at: refreshed.generated_at,
            overall_score: refreshed.overall_score,
            status: refreshed.status,
            totals: refreshed.totals
        }
    };
};

const evaluateReleaseGate = async ({
    schoolId = null,
    hardFailOnWarnings = false
}) => {
    const whereClause = {
        status: { [Op.in]: TRACKED_OPEN_STATUSES },
        ...(schoolId ? {
            [Op.or]: [
                { scope_level: 'national' },
                { scope_level: 'school', school_id: schoolId }
            ]
        } : {})
    };

    const openIssues = await DataQualityIssue.findAll({
        where: whereClause,
        attributes: ['id', 'check_key', 'label', 'severity', 'issue_count', 'scope_level', 'school_id'],
        include: [
            {
                model: School,
                required: false,
                attributes: ['id', 'name', 'school_code']
            }
        ],
        order: [
            ['severity', 'ASC'],
            ['issue_count', 'DESC']
        ]
    });

    const counts = openIssues.reduce((acc, issue) => {
        acc.total += 1;
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
    }, { total: 0, critical: 0, warning: 0, info: 0 });

    const blocked = toNumber(counts.critical) > 0 || (hardFailOnWarnings && toNumber(counts.warning) > 0);
    const reasons = [];
    if (toNumber(counts.critical) > 0) {
        reasons.push(`${counts.critical} critical open issue(s) detected.`);
    }
    if (hardFailOnWarnings && toNumber(counts.warning) > 0) {
        reasons.push(`${counts.warning} warning issue(s) blocking because hard-fail on warnings is enabled.`);
    }

    return {
        allowed: !blocked,
        blocked,
        hard_fail_warnings: Boolean(hardFailOnWarnings),
        counts,
        reasons,
        top_blockers: openIssues.slice(0, 10).map((issue) => ({
            id: issue.id,
            check_key: issue.check_key,
            label: issue.label,
            severity: issue.severity,
            issue_count: toNumber(issue.issue_count),
            scope_level: issue.scope_level,
            school_id: issue.school_id || null,
            school_name: issue?.School?.name || null
        }))
    };
};

const getAssignableUserOptions = async ({ schoolId = null }) =>
    getAssignableUsers({ schoolId });

module.exports = {
    generateDataQualityOverview,
    listTrackedIssues,
    updateTrackedIssue,
    applySafeAutoFix,
    evaluateReleaseGate,
    getAssignableUserOptions
};
