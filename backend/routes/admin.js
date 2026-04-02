const express = require('express');
const { Op } = require('sequelize');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
    School,
    Zone,
    Parish,
    Student,
    Staff,
    User,
    AuditLog,
    StudentTransfer,
    TeacherTransfer,
    Class,
    AttendanceRecord,
    Facility,
    Grade,
    Term,
    BsseeApplication,
    GradingPolicy,
    DataQualityIssue,
    sequelize
} = require('../models');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { scoreToCaribbeanGrade } = require('../utils/caribbeanGradeScale');
const { normalizeGradeLevelToken, getAllowedClassLevelsForSchool, isVerifiedSixthFormSchool } = require('../utils/classLevelPolicy');
const {
    BARBADOS_ZONE_DEFINITIONS,
    resolveBarbadosZoneKeyForSchool,
    getZoneDefinitionByKey
} = require('../utils/barbadosEducationZones');
const { resolveAccessContextForUser, getAccessControlMatrix } = require('../middleware/accessControl');
const { resolveAccessRoleKey } = require('../config/accessControl');
const {
    generateDataQualityOverview,
    listTrackedIssues,
    updateTrackedIssue,
    applySafeAutoFix,
    evaluateReleaseGate,
    getAssignableUserOptions
} = require('../services/dataQualityService');
const {
    GRADE_BANDS,
    ensureDefaultGradingPolicies,
    listGradingPolicies,
    normalizePolicyWeights,
    resolveGradeBandFromLevel
} = require('../services/gradingPolicyService');

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

const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) {
        return null;
    }

    const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
        return null;
    }

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

const buildQualityCheck = ({
    key,
    label,
    severity,
    issueCount,
    samples = []
}) => ({
    key,
    label,
    severity,
    issue_count: Number(issueCount || 0),
    samples: samples.slice(0, 5)
});

const resolveModelField = (model, candidates, fallback = null) => {
    for (const candidate of candidates) {
        if (model?.rawAttributes?.[candidate]) {
            return candidate;
        }
    }
    return fallback;
};

const resolveAuditTimestampValue = (auditRow) =>
    auditRow?.createdAt || auditRow?.created_at || null;

const formatAuditHistorySummary = (auditRow) => {
    const action = String(auditRow?.action || '');
    const oldValues = auditRow?.old_values || {};
    const newValues = auditRow?.new_values || {};

    if (action === 'user_access_assignment_updated') {
        const roleFrom = oldValues?.role || 'unchanged';
        const roleTo = newValues?.role || roleFrom;
        const accessRoleTo = newValues?.target_access_role || 'unchanged';
        const status = typeof newValues?.is_active === 'boolean'
            ? (newValues.is_active ? 'active' : 'inactive')
            : 'unchanged';
        return `Access updated: role ${roleFrom} -> ${roleTo}, target access ${accessRoleTo}, status ${status}.`;
    }

    if (action === 'staff_role_change') {
        const fromRole = oldValues?.role_level || 'unknown';
        const toRole = newValues?.role_level || 'unknown';
        return `Staff role level updated: ${fromRole} -> ${toRole}.`;
    }

    if (action === 'USER_REGISTERED') {
        return 'User account created.';
    }

    if (action === 'PASSWORD_CHANGED') {
        return 'Password changed.';
    }

    if (action === 'USER_PASSWORD_RESET') {
        return 'Password reset by Super Admin.';
    }

    if (action === 'USER_ACCOUNT_CREATED_BY_SUPER_ADMIN') {
        return 'User account created by Super Admin.';
    }

    return action
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
};

const parseBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return fallback;
};

const ACCESS_ROLE_MUTATION_MAP = {
    super_admin: { user_role: 'super_admin', staff_role_level: null, requires_staff: false, requires_school: false },
    ministry_admin: { user_role: 'admin', staff_role_level: 'department_head', requires_staff: false, requires_school: false },
    school_admin: { user_role: 'admin', staff_role_level: 'principal', requires_staff: true, requires_school: true },
    data_clerk: { user_role: 'admin', staff_role_level: 'support', requires_staff: true, requires_school: true },
    teacher: { user_role: 'teacher', staff_role_level: 'teacher', requires_staff: true, requires_school: true },
    parent: { user_role: 'parent', staff_role_level: null, requires_staff: false, requires_school: false },
    student: { user_role: 'student', staff_role_level: null, requires_staff: false, requires_school: false }
};

const ACCESS_ROLE_LABELS = {
    super_admin: 'Super Admin',
    ministry_admin: 'Ministry Admin',
    school_admin: 'School Admin',
    data_clerk: 'Data Clerk',
    teacher: 'Teacher',
    parent: 'Parent',
    student: 'Student'
};

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateSystemPassword = (prefix = 'NiEMIS') => {
    const base = crypto.randomBytes(9).toString('base64url');
    return `${prefix}!${base}9aA`;
};

const sanitizeNameValue = (value, fallback) => {
    const normalized = String(value || '').trim();
    if (!normalized) return fallback;
    return normalized.slice(0, 50);
};

const generateEmployeeId = (accessRole) => {
    const roleToken = String(accessRole || 'STAFF')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 4)
        .padEnd(4, 'X');
    const randomToken = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${roleToken}-${randomToken}`;
};

const clampScore = (value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
};

const resolveScoreStatus = (score) => {
    if (score >= 85) return 'healthy';
    if (score >= 65) return 'watch';
    return 'critical';
};

const BSSEE_STATUSES = [
    'submitted',
    'under_review',
    'placement_pending',
    'placed',
    'appeal_pending',
    'completed',
    'rejected'
];

const normalizeBsseeStatus = (value, fallback = 'submitted') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (BSSEE_STATUSES.includes(normalized)) {
        return normalized;
    }
    return fallback;
};

const normalizeExamYear = (value) => {
    const examYear = Number(value);
    if (!Number.isInteger(examYear) || examYear < 2020 || examYear > 2100) {
        return null;
    }
    return examYear;
};

const toNullableNumber = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const DATA_QUALITY_PLAYBOOKS = [
    {
        key: 'class_enrollment_sync',
        title: 'Reconcile class enrollment counters',
        summary: 'Syncs class current_enrollment with active student assignments.',
        severity: 'warning',
        estimated_minutes: 5,
        safe: true
    },
    {
        key: 'student_class_reference_integrity',
        title: 'Unassign invalid class references',
        summary: 'Clears student class links when class is missing/inactive/cross-school.',
        severity: 'critical',
        estimated_minutes: 8,
        safe: true
    },
    {
        key: 'grade_numeric_band_alignment',
        title: 'Align letter grades to Caribbean score bands',
        summary: 'Recalculates letter grades from numeric scores using the Caribbean scale.',
        severity: 'critical',
        estimated_minutes: 6,
        safe: true
    },
    {
        key: 'grade_class_alignment',
        title: 'Re-point grades to student current class',
        summary: 'Updates grade.class_id to match each student enrolled class.',
        severity: 'critical',
        estimated_minutes: 6,
        safe: true
    }
];

const normalizeSchoolYear = (value) => {
    const normalized = String(value || '').trim();
    const match = normalized.match(/^(\d{4})-(\d{4})$/);
    if (!match) return null;
    const startYear = Number(match[1]);
    const endYear = Number(match[2]);
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) return null;
    if (endYear !== startYear + 1) return null;
    return `${startYear}-${endYear}`;
};

const deriveNextSchoolYear = (schoolYear) => {
    const normalized = normalizeSchoolYear(schoolYear);
    if (!normalized) return null;
    const [startYear] = normalized.split('-').map((value) => Number(value));
    return `${startYear + 1}-${startYear + 2}`;
};

const GRADE_TOKEN_TO_LABEL = {
    'infants a': 'Infants A',
    'infants b': 'Infants B',
    reception: 'Reception',
    'class 1': 'Class 1',
    'class 2': 'Class 2',
    'class 3': 'Class 3',
    'class 4': 'Class 4',
    'first form': 'First Form',
    'second form': 'Second Form',
    'third form': 'Third Form',
    'fourth form': 'Fourth Form',
    'fifth form': 'Fifth Form',
    'lower sixth': 'Lower Sixth',
    'upper sixth': 'Upper Sixth'
};

const GRADE_PROGRESSIONS = {
    'infants a': 'infants b',
    'infants b': 'reception',
    reception: 'class 1',
    'class 1': 'class 2',
    'class 2': 'class 3',
    'class 3': 'class 4',
    'class 4': 'first form',
    'first form': 'second form',
    'second form': 'third form',
    'third form': 'fourth form',
    'fourth form': 'fifth form',
    'fifth form': 'lower sixth',
    'lower sixth': 'upper sixth',
    'upper sixth': null
};

const resolvePromotedGradeLevel = (gradeLevel) => {
    const normalized = normalizeGradeLevelToken(gradeLevel);
    const nextToken = GRADE_PROGRESSIONS[normalized];
    if (!nextToken) return null;
    return GRADE_TOKEN_TO_LABEL[nextToken] || null;
};

const resolveCurrentSchoolYear = async () => {
    const currentTerm = await Term.findOne({
        where: { is_active: true, is_current: true },
        order: [['school_year', 'DESC'], ['term_number', 'ASC']]
    });
    if (currentTerm?.school_year) {
        return normalizeSchoolYear(currentTerm.school_year);
    }

    const latestClass = await Class.findOne({
        where: { is_active: true },
        attributes: ['school_year'],
        order: [['school_year', 'DESC']]
    });
    return normalizeSchoolYear(latestClass?.school_year || null);
};

const appendAdminNotes = (existingNotes, nextLine) => {
    const current = String(existingNotes || '').trim();
    const updateLine = String(nextLine || '').trim();
    if (!updateLine) return current || null;
    if (!current) return updateLine;
    return `${current}\n${updateLine}`;
};

const formatBsseeApplication = (application) => ({
    id: application.id,
    student_id: application.student_id,
    student_name: application?.Student
        ? `${application.Student.first_name || ''} ${application.Student.last_name || ''}`.trim()
        : null,
    student_code: application?.Student?.student_id || null,
    primary_school_id: application.primary_school_id,
    primary_school_name: application?.primarySchool?.name || null,
    exam_year: Number(application.exam_year || 0),
    exam_candidate_number: application.exam_candidate_number || null,
    exam_score: application.exam_score !== null ? Number(application.exam_score) : null,
    english_score: application.english_score !== null ? Number(application.english_score) : null,
    math_score: application.math_score !== null ? Number(application.math_score) : null,
    status: application.status,
    preferred_school_1_id: application.preferred_school_1_id || null,
    preferred_school_2_id: application.preferred_school_2_id || null,
    preferred_school_3_id: application.preferred_school_3_id || null,
    preferred_school_1_name: application?.preferredSchool1?.name || null,
    preferred_school_2_name: application?.preferredSchool2?.name || null,
    preferred_school_3_name: application?.preferredSchool3?.name || null,
    placement_school_id: application.placement_school_id || null,
    placement_school_name: application?.placementSchool?.name || null,
    accommodation_required: Boolean(application.accommodation_required),
    deferral_requested: Boolean(application.deferral_requested),
    citizenship_status: application.citizenship_status || 'national',
    notes: application.notes || null,
    review_notes: application.review_notes || null,
    submitted_by: application.submitted_by || null,
    reviewed_by: application.reviewed_by || null,
    submitted_at: application.submitted_at || application.created_at || null,
    reviewed_at: application.reviewed_at || null,
    placed_at: application.placed_at || null,
    created_at: application.created_at || application.createdAt || null,
    updated_at: application.updated_at || application.updatedAt || null
});

const resolveScopedSchoolId = (req, requestedSchoolId = null) => {
    const accessScope = req.accessContext?.scope || null;
    const contextSchoolId = req.accessContext?.school_id || null;
    if (accessScope === 'school' && contextSchoolId) {
        return contextSchoolId;
    }
    return requestedSchoolId || null;
};

const READINESS_STATUSES = new Set(['healthy', 'watch', 'critical']);
const READINESS_REPORT_SIGNING_SECRET = process.env.READINESS_REPORT_SIGNING_SECRET
    || process.env.JWT_SECRET
    || 'niemis-readiness-signing-secret';

const sanitizeReadinessText = (value, maxLength = 500) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized.slice(0, maxLength);
};

const normalizeReadinessPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const normalizedStatus = String(payload.status || '').trim().toLowerCase();
    const normalized = {
        generated_at: payload.generated_at || new Date().toISOString(),
        overall_score: clampScore(payload.overall_score || 0),
        status: READINESS_STATUSES.has(normalizedStatus) ? normalizedStatus : 'critical',
        pillars: [],
        checklist: []
    };

    const pillars = Array.isArray(payload.pillars) ? payload.pillars : [];
    const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];

    normalized.pillars = pillars.slice(0, 20).map((pillar, index) => {
        const pillarStatus = String(pillar?.status || '').trim().toLowerCase();
        return {
            key: sanitizeReadinessText(pillar?.key || `pillar_${index + 1}`, 80),
            label: sanitizeReadinessText(pillar?.label || `Pillar ${index + 1}`, 180),
            score: clampScore(pillar?.score || 0),
            status: READINESS_STATUSES.has(pillarStatus) ? pillarStatus : resolveScoreStatus(clampScore(pillar?.score || 0)),
            summary: sanitizeReadinessText(pillar?.summary || '', 900),
            metrics: (Array.isArray(pillar?.metrics) ? pillar.metrics : [])
                .slice(0, 12)
                .map((metric) => sanitizeReadinessText(metric, 220))
                .filter(Boolean),
            blockers: (Array.isArray(pillar?.blockers) ? pillar.blockers : [])
                .slice(0, 12)
                .map((blocker) => sanitizeReadinessText(blocker, 260))
                .filter(Boolean),
            next_actions: (Array.isArray(pillar?.next_actions) ? pillar.next_actions : [])
                .slice(0, 8)
                .map((action, actionIndex) => ({
                    label: sanitizeReadinessText(action?.label || `Action ${actionIndex + 1}`, 120),
                    path: sanitizeReadinessText(action?.path || '', 180)
                }))
                .filter((action) => Boolean(action.label))
        };
    });

    normalized.checklist = checklist.slice(0, 40).map((item, index) => {
        const status = String(item?.status || '').trim().toLowerCase();
        return {
            key: sanitizeReadinessText(item?.key || `check_${index + 1}`, 80),
            label: sanitizeReadinessText(item?.label || `Checklist ${index + 1}`, 220),
            status: ['complete', 'in_progress', 'todo'].includes(status) ? status : 'todo',
            detail: sanitizeReadinessText(item?.detail || '', 380)
        };
    });

    return normalized;
};

const signReadinessPayload = ({ readiness, userId }) => {
    const reportId = crypto.randomUUID();
    const signedAt = new Date().toISOString();
    const canonicalPayload = JSON.stringify({
        report_id: reportId,
        signed_at: signedAt,
        signed_by_user_id: String(userId || ''),
        readiness
    });

    const digest = crypto
        .createHmac('sha256', READINESS_REPORT_SIGNING_SECRET)
        .update(canonicalPayload)
        .digest('hex');

    return {
        report_id: reportId,
        signed_at: signedAt,
        signed_by_user_id: String(userId || ''),
        algorithm: 'HMAC-SHA256',
        digest
    };
};

const ensurePdfSpace = (doc, minimumHeight = 80) => {
    if (doc.y + minimumHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
    }
};

const writeReadinessPdf = ({ doc, readiness, signature, generatedBy }) => {
    const generatedAtLabel = new Date(readiness.generated_at || signature.signed_at).toLocaleString();

    doc.info.Title = 'Barbados EMIS Readiness Report';
    doc.info.Author = 'NiEMIS';
    doc.info.Subject = 'Signed Readiness Snapshot';
    doc.info.Keywords = 'Barbados,NiEMIS,Readiness,EMIS';

    doc.font('Helvetica-Bold').fontSize(20).text('Barbados EMIS Readiness Report', { align: 'left' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(11).text(`Generated: ${generatedAtLabel}`);
    doc.text(`Overall Readiness Score: ${Math.round(clampScore(readiness.overall_score))}%`);
    doc.text(`Status: ${String(readiness.status || 'critical').toUpperCase()}`);
    doc.text(`Generated By: ${sanitizeReadinessText(generatedBy || 'Unknown')}`);
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#555').text(`Report ID: ${signature.report_id}`);
    doc.fillColor('black');
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(14).text('Readiness Pillars');
    doc.moveDown(0.3);

    (readiness.pillars || []).forEach((pillar, index) => {
        ensurePdfSpace(doc, 130);
        doc.font('Helvetica-Bold').fontSize(11).text(`${index + 1}. ${pillar.label}`);
        doc.font('Helvetica').fontSize(10).text(
            `Score: ${Math.round(clampScore(pillar.score))}% | Status: ${String(pillar.status || 'critical').toUpperCase()}`
        );
        if (pillar.summary) {
            doc.text(`Summary: ${pillar.summary}`);
        }
        if (pillar.metrics?.length) {
            doc.text(`Metrics: ${pillar.metrics.join(' | ')}`);
        }
        if (pillar.blockers?.length) {
            doc.fillColor('#8a4b00').text(`Blockers: ${pillar.blockers.join(' | ')}`);
            doc.fillColor('black');
        } else {
            doc.fillColor('#1d6e32').text('Blockers: None');
            doc.fillColor('black');
        }
        if (pillar.next_actions?.length) {
            const actions = pillar.next_actions
                .map((action) => `${action.label}${action.path ? ` (${action.path})` : ''}`)
                .join(' | ');
            doc.text(`Next Actions: ${actions}`);
        }
        doc.moveDown(0.6);
    });

    ensurePdfSpace(doc, 140);
    doc.font('Helvetica-Bold').fontSize(14).text('Implementation Checklist');
    doc.moveDown(0.4);
    (readiness.checklist || []).forEach((item, index) => {
        ensurePdfSpace(doc, 48);
        doc.font('Helvetica-Bold').fontSize(10).text(`${index + 1}. ${item.label}`);
        doc.font('Helvetica').fontSize(9).text(`Status: ${String(item.status || 'todo').toUpperCase()}`);
        if (item.detail) {
            doc.text(`Detail: ${item.detail}`);
        }
        doc.moveDown(0.35);
    });

    ensurePdfSpace(doc, 150);
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(13).text('Digital Signature');
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(9).text(`Algorithm: ${signature.algorithm}`);
    doc.text(`Signed At: ${new Date(signature.signed_at).toLocaleString()}`);
    doc.text(`Signed By User ID: ${signature.signed_by_user_id}`);
    doc.text('Signature Digest:');
    doc.font('Courier').fontSize(8).text(signature.digest, { width: 500 });
    doc.font('Helvetica').fontSize(8).fillColor('#555').text(
        'Verification note: The digest is generated server-side across the canonical readiness payload and signing metadata.',
        { width: 500 }
    );
    doc.fillColor('black');
};

// Admin dashboard statistics
router.get('/dashboard', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const safeQuery = async (queryFn, fallback, metricName) => {
            try {
                return await queryFn();
            } catch (error) {
                logger.error(`Admin dashboard metric failed: ${metricName}`, {
                    error: error.message
                });
                return fallback;
            }
        };

        const resolveField = (model, candidates, fallback = null) => {
            for (const candidate of candidates) {
                if (model?.rawAttributes?.[candidate]) {
                    return candidate;
                }
            }
            return fallback;
        };

        const toDateKey = (value) => {
            if (!value) {
                return null;
            }

            if (value instanceof Date && !Number.isNaN(value.getTime())) {
                return value.toISOString().slice(0, 10);
            }

            if (typeof value === 'string') {
                if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
                    return value.slice(0, 10);
                }

                const parsed = new Date(value);
                if (!Number.isNaN(parsed.getTime())) {
                    return parsed.toISOString().slice(0, 10);
                }
            }

            return null;
        };

        const formatDateLabel = (dateValue) =>
            dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const buildDateWindow = (days) => {
            const result = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let offset = days - 1; offset >= 0; offset -= 1) {
                const day = new Date(today);
                day.setDate(day.getDate() - offset);
                result.push(day);
            }

            return result;
        };

        const buildEmptyTrend = (days, valueFactory) =>
            buildDateWindow(days).map((date) => {
                const dateKey = toDateKey(date);
                return {
                    date: dateKey,
                    label: formatDateLabel(date),
                    ...valueFactory()
                };
            });

        const auditTimestampField = resolveField(AuditLog, ['createdAt', 'created_at'], null);
        const attendanceDateField = resolveField(AttendanceRecord, ['attendance_date', 'attendanceDate'], null);
        const studentCreatedField = resolveField(Student, ['createdAt', 'created_at'], null);
        const transferCreatedField = resolveField(StudentTransfer, ['createdAt', 'created_at'], null);

        const sinceLast24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sinceLast30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const todayIso = new Date().toISOString().slice(0, 10);

        const totalSchools = await safeQuery(
            () => School.count({ where: { is_active: true } }),
            0,
            'total_schools'
        );

        const totalStudents = await safeQuery(
            () => Student.count({ where: { is_active: true } }),
            0,
            'total_students'
        );

        const totalStaff = await safeQuery(
            () => Staff.count({ where: { is_active: true } }),
            0,
            'total_staff'
        );

        const recentActivity = auditTimestampField
            ? await safeQuery(
                () => AuditLog.count({
                    where: {
                        [auditTimestampField]: {
                            [Op.gte]: sinceLast24Hours
                        }
                    }
                }),
                0,
                'recent_activity'
            )
            : 0;

        const activityByAction = auditTimestampField
            ? await safeQuery(
                () => AuditLog.findAll({
                    attributes: [
                        'action',
                        [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
                    ],
                    where: {
                        [auditTimestampField]: {
                            [Op.gte]: sinceLast24Hours
                        }
                    },
                    group: ['action'],
                    order: [[AuditLog.sequelize.literal('count'), 'DESC']],
                    limit: 6,
                    raw: true
                }),
                [],
                'recent_activity_by_action'
            )
            : [];

        const activityByTable = auditTimestampField
            ? await safeQuery(
                () => AuditLog.findAll({
                    attributes: [
                        'table_name',
                        [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
                    ],
                    where: {
                        [auditTimestampField]: {
                            [Op.gte]: sinceLast24Hours
                        }
                    },
                    group: ['table_name'],
                    order: [[AuditLog.sequelize.literal('count'), 'DESC']],
                    limit: 6,
                    raw: true
                }),
                [],
                'recent_activity_by_table'
            )
            : [];

        const recentAudits = auditTimestampField
            ? await safeQuery(
                () => AuditLog.findAll({
                    attributes: ['id', 'user_id', 'action', 'table_name', 'record_id', auditTimestampField],
                    where: {
                        [auditTimestampField]: {
                            [Op.gte]: sinceLast24Hours
                        }
                    },
                    order: [[auditTimestampField, 'DESC']],
                    limit: 100
                }),
                [],
                'recent_audits'
            )
            : [];

        const pendingTransfers = await safeQuery(
            () => StudentTransfer.count({
                where: { status: 'pending' }
            }),
            0,
            'pending_transfers'
        );

        const attendanceToday = attendanceDateField
            ? await safeQuery(
            async () => {
                const [totalRecords, present, late, absent, excused] = await Promise.all([
                    AttendanceRecord.count({ where: { [attendanceDateField]: todayIso } }),
                    AttendanceRecord.count({ where: { [attendanceDateField]: todayIso, status: 'present' } }),
                    AttendanceRecord.count({ where: { [attendanceDateField]: todayIso, status: 'late' } }),
                    AttendanceRecord.count({ where: { [attendanceDateField]: todayIso, status: 'absent' } }),
                    AttendanceRecord.count({ where: { [attendanceDateField]: todayIso, status: 'excused' } })
                ]);

                const attendanceRate = totalRecords > 0
                    ? Number((((present + late + excused) / totalRecords) * 100).toFixed(1))
                    : 0;

                return {
                    date: todayIso,
                    total_records: totalRecords,
                    present,
                    late,
                    absent,
                    excused,
                    attendance_rate: attendanceRate
                };
            },
            {
                date: todayIso,
                total_records: 0,
                present: 0,
                late: 0,
                absent: 0,
                excused: 0,
                attendance_rate: 0
            },
            'attendance_today'
            )
            : {
                date: todayIso,
                total_records: 0,
                present: 0,
                late: 0,
                absent: 0,
                excused: 0,
                attendance_rate: 0
            };

        const transfersSummary = await safeQuery(
            async () => {
                const statuses = ['pending', 'approved', 'rejected', 'completed'];
                const counts = await Promise.all(
                    statuses.map((status) => StudentTransfer.count({ where: { status } }))
                );

                const summary = statuses.reduce((acc, status, index) => {
                    acc[status] = counts[index];
                    return acc;
                }, {});

                summary.total = counts.reduce((sum, count) => sum + count, 0);

                return summary;
            },
            {
                pending: 0,
                approved: 0,
                rejected: 0,
                completed: 0,
                total: 0
            },
            'transfers_summary'
        );

        const enrollmentSummary = await safeQuery(
            async () => {
                const [activeClasses, totalFacilities, totalClassEnrollment, newStudentsLast30Days] = await Promise.all([
                    Class.count({ where: { is_active: true } }),
                    Facility.count({ where: { is_active: true } }),
                    Class.sum('current_enrollment', { where: { is_active: true } }),
                    studentCreatedField
                        ? Student.count({
                            where: {
                                is_active: true,
                                [studentCreatedField]: { [Op.gte]: sinceLast30Days }
                            }
                        })
                        : Promise.resolve(0)
                ]);

                const totalEnrollment = Number(totalClassEnrollment || 0);

                return {
                    active_classes: activeClasses,
                    total_facilities: totalFacilities,
                    total_class_enrollment: totalEnrollment,
                    new_students_last_30_days: newStudentsLast30Days,
                    average_class_size: activeClasses > 0
                        ? Number((totalEnrollment / activeClasses).toFixed(1))
                        : 0
                };
            },
            {
                active_classes: 0,
                total_facilities: 0,
                total_class_enrollment: 0,
                new_students_last_30_days: 0,
                average_class_size: 0
            },
            'enrollment_summary'
        );

        const attendanceTrend = attendanceDateField
            ? await safeQuery(
                async () => {
                    const windowDays = 7;
                    const window = buildDateWindow(windowDays);
                    const startKey = toDateKey(window[0]);

                    const rows = await AttendanceRecord.findAll({
                        attributes: [
                            [AttendanceRecord.sequelize.fn('DATE', AttendanceRecord.sequelize.col(attendanceDateField)), 'day'],
                            [AttendanceRecord.sequelize.fn('COUNT', AttendanceRecord.sequelize.col('id')), 'total_records'],
                            [
                                AttendanceRecord.sequelize.fn(
                                    'SUM',
                                    AttendanceRecord.sequelize.literal("CASE WHEN status IN ('present', 'late', 'excused') THEN 1 ELSE 0 END")
                                ),
                                'attending_records'
                            ]
                        ],
                        where: {
                            [attendanceDateField]: {
                                [Op.gte]: startKey,
                                [Op.lte]: todayIso
                            }
                        },
                        group: [AttendanceRecord.sequelize.fn('DATE', AttendanceRecord.sequelize.col(attendanceDateField))],
                        order: [[AttendanceRecord.sequelize.fn('DATE', AttendanceRecord.sequelize.col(attendanceDateField)), 'ASC']],
                        raw: true
                    });

                    const dailyMap = rows.reduce((acc, row) => {
                        const key = toDateKey(row.day);
                        if (!key) {
                            return acc;
                        }

                        acc[key] = {
                            total_records: Number(row.total_records || 0),
                            attending_records: Number(row.attending_records || 0)
                        };
                        return acc;
                    }, {});

                    const points = window.map((date) => {
                        const key = toDateKey(date);
                        const row = dailyMap[key] || { total_records: 0, attending_records: 0 };
                        const attendanceRate = row.total_records > 0
                            ? Number(((row.attending_records / row.total_records) * 100).toFixed(1))
                            : 0;

                        return {
                            date: key,
                            label: formatDateLabel(date),
                            total_records: row.total_records,
                            attending_records: row.attending_records,
                            attendance_rate: attendanceRate
                        };
                    });

                    return { window_days: windowDays, points };
                },
                {
                    window_days: 7,
                    points: buildEmptyTrend(7, () => ({
                        total_records: 0,
                        attending_records: 0,
                        attendance_rate: 0
                    }))
                },
                'attendance_trend'
            )
            : {
                window_days: 7,
                points: buildEmptyTrend(7, () => ({
                    total_records: 0,
                    attending_records: 0,
                    attendance_rate: 0
                }))
            };

        const enrollmentTrend = studentCreatedField
            ? await safeQuery(
                async () => {
                    const windowDays = 30;
                    const window = buildDateWindow(windowDays);
                    const startKey = toDateKey(window[0]);

                    const rows = await Student.findAll({
                        attributes: [
                            [Student.sequelize.fn('DATE', Student.sequelize.col(studentCreatedField)), 'day'],
                            [Student.sequelize.fn('COUNT', Student.sequelize.col('id')), 'new_students']
                        ],
                        where: {
                            is_active: true,
                            [studentCreatedField]: {
                                [Op.gte]: startKey
                            }
                        },
                        group: [Student.sequelize.fn('DATE', Student.sequelize.col(studentCreatedField))],
                        order: [[Student.sequelize.fn('DATE', Student.sequelize.col(studentCreatedField)), 'ASC']],
                        raw: true
                    });

                    const dailyMap = rows.reduce((acc, row) => {
                        const key = toDateKey(row.day);
                        if (!key) {
                            return acc;
                        }

                        acc[key] = Number(row.new_students || 0);
                        return acc;
                    }, {});

                    let rollingTotal = 0;
                    const points = window.map((date) => {
                        const key = toDateKey(date);
                        const value = Number(dailyMap[key] || 0);
                        rollingTotal += value;

                        return {
                            date: key,
                            label: formatDateLabel(date),
                            new_students: value,
                            rolling_total: rollingTotal
                        };
                    });

                    return { window_days: windowDays, points };
                },
                {
                    window_days: 30,
                    points: buildEmptyTrend(30, () => ({
                        new_students: 0,
                        rolling_total: 0
                    }))
                },
                'enrollment_trend'
            )
            : {
                window_days: 30,
                points: buildEmptyTrend(30, () => ({
                    new_students: 0,
                    rolling_total: 0
                }))
            };

        const transferTrend = transferCreatedField
            ? await safeQuery(
                async () => {
                    const windowDays = 30;
                    const window = buildDateWindow(windowDays);
                    const startKey = toDateKey(window[0]);

                    const rows = await StudentTransfer.findAll({
                        attributes: [
                            [StudentTransfer.sequelize.fn('DATE', StudentTransfer.sequelize.col(transferCreatedField)), 'day'],
                            [StudentTransfer.sequelize.fn('COUNT', StudentTransfer.sequelize.col('id')), 'total'],
                            [StudentTransfer.sequelize.fn('SUM', StudentTransfer.sequelize.literal("CASE WHEN status = 'pending' THEN 1 ELSE 0 END")), 'pending'],
                            [StudentTransfer.sequelize.fn('SUM', StudentTransfer.sequelize.literal("CASE WHEN status = 'approved' THEN 1 ELSE 0 END")), 'approved'],
                            [StudentTransfer.sequelize.fn('SUM', StudentTransfer.sequelize.literal("CASE WHEN status = 'rejected' THEN 1 ELSE 0 END")), 'rejected'],
                            [StudentTransfer.sequelize.fn('SUM', StudentTransfer.sequelize.literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed']
                        ],
                        where: {
                            [transferCreatedField]: {
                                [Op.gte]: startKey
                            }
                        },
                        group: [StudentTransfer.sequelize.fn('DATE', StudentTransfer.sequelize.col(transferCreatedField))],
                        order: [[StudentTransfer.sequelize.fn('DATE', StudentTransfer.sequelize.col(transferCreatedField)), 'ASC']],
                        raw: true
                    });

                    const dailyMap = rows.reduce((acc, row) => {
                        const key = toDateKey(row.day);
                        if (!key) {
                            return acc;
                        }

                        acc[key] = {
                            total: Number(row.total || 0),
                            pending: Number(row.pending || 0),
                            approved: Number(row.approved || 0),
                            rejected: Number(row.rejected || 0),
                            completed: Number(row.completed || 0)
                        };
                        return acc;
                    }, {});

                    const points = window.map((date) => {
                        const key = toDateKey(date);
                        const row = dailyMap[key] || {
                            total: 0,
                            pending: 0,
                            approved: 0,
                            rejected: 0,
                            completed: 0
                        };

                        return {
                            date: key,
                            label: formatDateLabel(date),
                            ...row
                        };
                    });

                    return { window_days: windowDays, points };
                },
                {
                    window_days: 30,
                    points: buildEmptyTrend(30, () => ({
                        total: 0,
                        pending: 0,
                        approved: 0,
                        rejected: 0,
                        completed: 0
                    }))
                },
                'transfer_trend'
            )
            : {
                window_days: 30,
                points: buildEmptyTrend(30, () => ({
                    total: 0,
                    pending: 0,
                    approved: 0,
                    rejected: 0,
                    completed: 0
                }))
            };

        const breakdowns = await safeQuery(
            async () => {
                const [studentsByGenderRows, schoolsByCategoryRows, studentsByGradeRows] = await Promise.all([
                    Student.findAll({
                        attributes: [
                            'gender',
                            [Student.sequelize.fn('COUNT', Student.sequelize.col('id')), 'count']
                        ],
                        where: { is_active: true },
                        group: ['gender'],
                        raw: true
                    }),
                    School.findAll({
                        attributes: [
                            'school_category',
                            [School.sequelize.fn('COUNT', School.sequelize.col('id')), 'count']
                        ],
                        where: { is_active: true },
                        group: ['school_category'],
                        raw: true
                    }),
                    Student.findAll({
                        attributes: [
                            'grade_level',
                            [Student.sequelize.fn('COUNT', Student.sequelize.col('id')), 'count']
                        ],
                        where: { is_active: true },
                        group: ['grade_level'],
                        raw: true
                    })
                ]);

                const normalizeRows = (rows, keyName) => rows
                    .map((row) => ({
                        label: row[keyName] || 'unspecified',
                        count: Number(row.count || 0)
                    }))
                    .sort((a, b) => b.count - a.count);

                return {
                    students_by_gender: normalizeRows(studentsByGenderRows, 'gender'),
                    schools_by_category: normalizeRows(schoolsByCategoryRows, 'school_category'),
                    students_by_grade: normalizeRows(studentsByGradeRows, 'grade_level').slice(0, 8)
                };
            },
            {
                students_by_gender: [],
                schools_by_category: [],
                students_by_grade: []
            },
            'breakdowns'
        );

        const dataQuality = await safeQuery(
            async () => {
                const [activeSchools, activeClasses, activeStudents, gradeRows] = await Promise.all([
                    School.findAll({
                        where: { is_active: true },
                        attributes: ['id', 'name', 'school_type', 'offers_sixth_form'],
                        raw: true
                    }),
                    Class.findAll({
                        where: { is_active: true },
                        attributes: [
                            'id',
                            'school_id',
                            'name',
                            'grade_level',
                            'section',
                            'capacity',
                            'current_enrollment',
                            'class_teacher_id'
                        ],
                        include: [
                            {
                                model: School,
                                attributes: ['id', 'name', 'school_type', 'offers_sixth_form'],
                                required: false
                            }
                        ]
                    }),
                    Student.findAll({
                        where: { is_active: true },
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
                                attributes: ['id', 'student_id', 'first_name', 'last_name', 'class_id'],
                                required: false
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

                const classEnrollmentCounts = activeStudents.reduce((acc, student) => {
                    if (!student.class_id) {
                        return acc;
                    }
                    const key = String(student.class_id);
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {});

                const checks = [];
                const registerCheck = (payload) => checks.push(buildQualityCheck(payload));

                let ageGradeMismatches = 0;
                const ageGradeSamples = [];
                for (const student of activeStudents) {
                    const normalizedGrade = normalizeGradeLevelToken(student.grade_level);
                    const expected = EXPECTED_AGE_BY_GRADE[normalizedGrade];
                    if (!expected) {
                        continue;
                    }

                    const age = calculateAge(student.date_of_birth);
                    if (age === null) {
                        continue;
                    }

                    if (age < expected.min_age || age > expected.max_age) {
                        ageGradeMismatches += 1;
                        if (ageGradeSamples.length < 5) {
                            ageGradeSamples.push(
                                `${formatStudentLabel(student)} is age ${age} in ${student.grade_level}; expected ${expected.min_age}-${expected.max_age}.`
                            );
                        }
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
                    if (!school) {
                        continue;
                    }

                    const allowedGrades = getAllowedClassLevelsForSchool(school)
                        .map((gradeLevel) => normalizeGradeLevelToken(gradeLevel));
                    const gradeToken = normalizeGradeLevelToken(student.grade_level);

                    if (!gradeToken || !allowedGrades.includes(gradeToken)) {
                        schoolGradeMismatches += 1;
                        if (schoolGradeSamples.length < 5) {
                            schoolGradeSamples.push(
                                `${formatStudentLabel(student)} has grade ${student.grade_level || 'Unknown'} at ${school.name} (${school.school_type}).`
                            );
                        }
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
                    if (!student.class_id) {
                        continue;
                    }

                    const classRow = classesById[String(student.class_id)];
                    if (!classRow) {
                        orphanClassRefs += 1;
                        if (orphanClassSamples.length < 5) {
                            orphanClassSamples.push(
                                `${formatStudentLabel(student)} is linked to a missing/inactive class (${student.class_id}).`
                            );
                        }
                        continue;
                    }

                    if (String(classRow.school_id) !== String(student.school_id)) {
                        classSchoolMismatches += 1;
                        if (classSchoolSamples.length < 5) {
                            classSchoolSamples.push(
                                `${formatStudentLabel(student)} is assigned to ${classRow.name} (${classRow.section}) in another school.`
                            );
                        }
                    }

                    if (normalizeGradeLevelToken(classRow.grade_level) !== normalizeGradeLevelToken(student.grade_level)) {
                        classGradeMismatches += 1;
                        if (classGradeSamples.length < 5) {
                            classGradeSamples.push(
                                `${formatStudentLabel(student)} grade ${student.grade_level} differs from class grade ${classRow.grade_level}.`
                            );
                        }
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
                    const actualEnrollment = Number(classEnrollmentCounts[classId] || 0);
                    const configuredCapacity = Number(classRow.capacity || 0);
                    const currentEnrollment = Number(classRow.current_enrollment || 0);

                    if (configuredCapacity > 0 && actualEnrollment > configuredCapacity) {
                        overCapacityClasses += 1;
                        if (capacitySamples.length < 5) {
                            capacitySamples.push(
                                `${classRow.name} (${classRow.section}) has ${actualEnrollment}/${configuredCapacity} students.`
                            );
                        }
                    }

                    if (actualEnrollment !== currentEnrollment) {
                        enrollmentDriftClasses += 1;
                        if (enrollmentDriftSamples.length < 5) {
                            enrollmentDriftSamples.push(
                                `${classRow.name} (${classRow.section}) tracks ${currentEnrollment} but has ${actualEnrollment} assigned students.`
                            );
                        }
                    }

                    if (!classRow.class_teacher_id) {
                        classesWithoutTeacher += 1;
                        if (classesWithoutTeacherSamples.length < 5) {
                            classesWithoutTeacherSamples.push(
                                `${classRow.name} (${classRow.section}) does not have a class teacher assigned.`
                            );
                        }
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
                    if (!acc[dedupeKey]) {
                        acc[dedupeKey] = [];
                    }
                    acc[dedupeKey].push(student);
                    return acc;
                }, {});

                let duplicateProfiles = 0;
                const duplicateSamples = [];
                Object.values(duplicateBuckets).forEach((bucket) => {
                    if (bucket.length <= 1) {
                        return;
                    }
                    duplicateProfiles += bucket.length - 1;
                    if (duplicateSamples.length < 5) {
                        const first = bucket[0];
                        duplicateSamples.push(
                            `${formatStudentLabel(first)} has ${bucket.length} active profiles with the same name and date of birth.`
                        );
                    }
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
                    if (Number.isFinite(numericScore)) {
                        const normalizedGrade = scoreToCaribbeanGrade(numericScore);
                        if (normalizedGrade && gradeRow.grade_value !== normalizedGrade) {
                            gradeBandMismatches += 1;
                            if (gradeBandSamples.length < 5) {
                                const studentLabel = gradeRow.Student
                                    ? formatStudentLabel(gradeRow.Student)
                                    : `Student ${gradeRow.student_id}`;
                                gradeBandSamples.push(
                                    `${studentLabel} scored ${numericScore} but grade is ${gradeRow.grade_value} (expected ${normalizedGrade}).`
                                );
                            }
                        }
                    }

                    if (!gradeRow.Student) {
                        orphanGradeRows += 1;
                        if (orphanGradeSamples.length < 5) {
                            orphanGradeSamples.push(
                                `Grade ${gradeRow.id} references missing student ${gradeRow.student_id}.`
                            );
                        }
                        continue;
                    }

                    if (gradeRow.Student.class_id && String(gradeRow.Student.class_id) !== String(gradeRow.class_id)) {
                        gradeClassMismatches += 1;
                        if (gradeClassSamples.length < 5) {
                            gradeClassSamples.push(
                                `${formatStudentLabel(gradeRow.Student)} has grade in class ${gradeRow.class_id} but is enrolled in ${gradeRow.Student.class_id}.`
                            );
                        }
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
                const totalIssueCount = checks.reduce((sum, check) => sum + check.issue_count, 0);

                const severityTotals = checksWithIssues.reduce((acc, check) => {
                    acc[check.severity] = (acc[check.severity] || 0) + check.issue_count;
                    return acc;
                }, { critical: 0, warning: 0, info: 0 });

                const criticalChecks = checksWithIssues.filter((check) => check.severity === 'critical').length;
                const warningChecks = checksWithIssues.filter((check) => check.severity === 'warning').length;
                const infoChecks = checksWithIssues.filter((check) => check.severity === 'info').length;

                const populationBase = Math.max(activeStudents.length + activeClasses.length, 1);
                const issueImpact = Math.min(1, totalIssueCount / populationBase);
                const rawScore = 100
                    - Math.round(issueImpact * 55)
                    - (criticalChecks * 8)
                    - (warningChecks * 4)
                    - (infoChecks * 2);
                const overallScore = Math.max(0, Math.min(100, rawScore));
                const status = overallScore >= 90 ? 'healthy' : overallScore >= 75 ? 'watch' : 'critical';

                const sortedTopIssues = checksWithIssues
                    .slice()
                    .sort((a, b) =>
                        (CHECK_SEVERITY_ORDER[a.severity] - CHECK_SEVERITY_ORDER[b.severity]) ||
                        (b.issue_count - a.issue_count)
                    )
                    .slice(0, 5);

                return {
                    generated_at: new Date().toISOString(),
                    overall_score: overallScore,
                    status,
                    totals: {
                        checks_run: checks.length,
                        checks_with_issues: checksWithIssues.length,
                        issue_count: totalIssueCount,
                        critical_issues: Number(severityTotals.critical || 0),
                        warning_issues: Number(severityTotals.warning || 0),
                        info_issues: Number(severityTotals.info || 0)
                    },
                    top_issues: sortedTopIssues,
                    checks
                };
            },
            {
                generated_at: new Date().toISOString(),
                overall_score: 0,
                status: 'critical',
                totals: {
                    checks_run: 0,
                    checks_with_issues: 0,
                    issue_count: 0,
                    critical_issues: 0,
                    warning_issues: 0,
                    info_issues: 0
                },
                top_issues: [],
                checks: []
            },
            'data_quality'
        );

        const barbadosReadiness = await safeQuery(
            async () => {
                const [readinessSchools, readinessClasses, readinessStudents, readinessTerms, readinessStaff, superAdminCount] = await Promise.all([
                    School.findAll({
                        where: { is_active: true },
                        attributes: ['id', 'name', 'school_type', 'offers_sixth_form'],
                        raw: true
                    }),
                    Class.findAll({
                        where: { is_active: true },
                        attributes: ['id', 'school_id', 'name', 'grade_level', 'section'],
                        include: [
                            {
                                model: School,
                                required: false,
                                attributes: ['id', 'name', 'school_type', 'offers_sixth_form']
                            }
                        ]
                    }),
                    Student.findAll({
                        where: { is_active: true },
                        attributes: ['id', 'school_id', 'grade_level'],
                        raw: true
                    }),
                    Term.findAll({
                        where: { is_active: true },
                        attributes: ['id', 'name', 'school_year', 'term_number', 'is_current', 'start_date', 'end_date'],
                        order: [['school_year', 'DESC'], ['term_number', 'ASC']],
                        raw: true
                    }),
                    Staff.findAll({
                        where: { is_active: true },
                        attributes: ['id', 'school_id', 'role_level'],
                        raw: true
                    }),
                    User.count({
                        where: {
                            is_active: true,
                            role: 'super_admin'
                        }
                    })
                ]);

                const schoolsById = readinessSchools.reduce((acc, school) => {
                    acc[String(school.id)] = school;
                    return acc;
                }, {});

                const classesBySchool = {};
                const invalidClassRows = [];
                for (const classRow of readinessClasses) {
                    const school = classRow.School || schoolsById[String(classRow.school_id)];
                    if (!school) continue;

                    const schoolId = String(school.id || classRow.school_id || '');
                    if (!classesBySchool[schoolId]) {
                        classesBySchool[schoolId] = [];
                    }
                    classesBySchool[schoolId].push(classRow);

                    const allowed = getAllowedClassLevelsForSchool(school)
                        .map((level) => normalizeGradeLevelToken(level));
                    const classToken = normalizeGradeLevelToken(classRow.grade_level);
                    if (classToken && !allowed.includes(classToken)) {
                        invalidClassRows.push({
                            school_name: school.name || 'Unknown school',
                            class_name: classRow.name || 'Unknown class',
                            grade_level: classRow.grade_level || 'Unknown'
                        });
                    }
                }

                const currentTerms = readinessTerms.filter((term) => Boolean(term.is_current));
                const currentSchoolYear = currentTerms[0]?.school_year || readinessTerms[0]?.school_year || null;
                const termsInCurrentYear = currentSchoolYear
                    ? readinessTerms.filter((term) => String(term.school_year) === String(currentSchoolYear))
                    : [];

                const calendarBlockers = [];
                if (currentTerms.length === 0) {
                    calendarBlockers.push('No term is marked as current.');
                } else if (currentTerms.length > 1) {
                    calendarBlockers.push(`${currentTerms.length} terms are marked current; expected exactly one.`);
                }
                if (termsInCurrentYear.length < 3) {
                    calendarBlockers.push(`Only ${termsInCurrentYear.length} terms configured for school year ${currentSchoolYear || 'current'}.`);
                }

                const calendarScore = clampScore(
                    (currentTerms.length === 1 ? 45 : currentTerms.length > 0 ? 25 : 0)
                    + Math.min(35, termsInCurrentYear.length * 12)
                    + (readinessTerms.length >= 3 ? 20 : readinessTerms.length * 6)
                );

                const policyComplianceRatio = readinessClasses.length > 0
                    ? Math.max(0, 1 - (invalidClassRows.length / readinessClasses.length))
                    : 1;
                const policyScore = clampScore(policyComplianceRatio * 100);
                const policyBlockers = invalidClassRows
                    .slice(0, 3)
                    .map((row) => `${row.school_name}: ${row.class_name} (${row.grade_level}) is outside allowed levels.`);

                const primaryClass4Students = readinessStudents.filter(
                    (student) => normalizeGradeLevelToken(student.grade_level) === 'class 4'
                ).length;
                const secondaryFirstFormStudents = readinessStudents.filter(
                    (student) => normalizeGradeLevelToken(student.grade_level) === 'first form'
                ).length;
                const transitionMatchRatio = primaryClass4Students > 0
                    ? Math.min(1, secondaryFirstFormStudents / primaryClass4Students)
                    : 1;
                const pendingTransferRatio = primaryClass4Students > 0
                    ? Math.min(1, Number(pendingTransfers || 0) / primaryClass4Students)
                    : Number(pendingTransfers || 0) > 0 ? 1 : 0;
                const transitionScore = clampScore((transitionMatchRatio * 70) + ((1 - pendingTransferRatio) * 30));
                const transitionBlockers = [];
                if (Number(pendingTransfers || 0) > 0) {
                    transitionBlockers.push(`${pendingTransfers} student transfer cases remain pending.`);
                }
                if (primaryClass4Students > 0 && transitionMatchRatio < 0.8) {
                    transitionBlockers.push('Class 4 to First Form pipeline appears undersized against current enrolment.');
                }

                const secondarySchools = readinessSchools.filter(
                    (school) => String(school.school_type || '').toLowerCase() === 'secondary'
                );
                const requiredSecondaryTokens = ['first form', 'second form', 'third form', 'fourth form', 'fifth form'];
                let secondaryFormsReady = 0;
                let sixthFormReady = 0;
                const sixthFormRequiredSchools = [];
                const examBlockers = [];

                for (const school of secondarySchools) {
                    const schoolClasses = classesBySchool[String(school.id)] || [];
                    const tokens = new Set(
                        schoolClasses.map((row) => normalizeGradeLevelToken(row.grade_level))
                    );
                    const hasAllForms = requiredSecondaryTokens.every((token) => tokens.has(token));
                    if (hasAllForms) {
                        secondaryFormsReady += 1;
                    } else if (examBlockers.length < 3) {
                        const missing = requiredSecondaryTokens.filter((token) => !tokens.has(token));
                        examBlockers.push(`${school.name} is missing: ${missing.join(', ')}.`);
                    }

                    const requiresSixthForm = Boolean(school.offers_sixth_form) || isVerifiedSixthFormSchool(school);
                    if (requiresSixthForm) {
                        sixthFormRequiredSchools.push(school);
                        if (tokens.has('lower sixth') && tokens.has('upper sixth')) {
                            sixthFormReady += 1;
                        } else if (examBlockers.length < 3) {
                            examBlockers.push(`${school.name} requires both Lower Sixth and Upper Sixth classes.`);
                        }
                    }
                }

                const formsCoverageRatio = secondarySchools.length > 0
                    ? secondaryFormsReady / secondarySchools.length
                    : 1;
                const sixthCoverageRatio = sixthFormRequiredSchools.length > 0
                    ? sixthFormReady / sixthFormRequiredSchools.length
                    : 1;
                const examPathwayScore = clampScore((formsCoverageRatio * 70) + (sixthCoverageRatio * 30));

                const principalSchoolIds = new Set(
                    readinessStaff
                        .filter((staff) => {
                            const roleLevel = String(staff.role_level || '').trim().toLowerCase();
                            return roleLevel === 'principal' || roleLevel === 'acting principal';
                        })
                        .map((staff) => String(staff.school_id || ''))
                        .filter(Boolean)
                );
                const schoolLeadershipCoverage = readinessSchools.length > 0
                    ? principalSchoolIds.size / readinessSchools.length
                    : 1;
                const superAdminCoverageScore = superAdminCount >= 2 ? 100 : superAdminCount === 1 ? 60 : 0;
                const governanceScore = clampScore((schoolLeadershipCoverage * 70) + (superAdminCoverageScore * 0.3));
                const governanceBlockers = [];
                if (superAdminCount < 2) {
                    governanceBlockers.push(`Only ${superAdminCount} active super admin account(s); minimum recommended is 2.`);
                }
                if (schoolLeadershipCoverage < 0.9) {
                    const uncoveredSchools = Math.max(0, readinessSchools.length - principalSchoolIds.size);
                    governanceBlockers.push(`${uncoveredSchools} active school(s) do not have a principal-level staff record.`);
                }

                const dataQualityScore = clampScore(dataQuality?.overall_score || 0);
                const criticalQualityIssues = Number(dataQuality?.totals?.critical_issues || 0);
                const qualityBlockers = criticalQualityIssues > 0
                    ? [`${criticalQualityIssues} critical data-quality issue(s) are still open.`]
                    : [];

                const pillars = [
                    {
                        key: 'calendar_governance',
                        label: 'National Calendar Governance',
                        score: calendarScore,
                        status: resolveScoreStatus(calendarScore),
                        summary: 'Term setup is aligned to the school year and supports operational lock windows.',
                        metrics: [
                            `Active terms: ${readinessTerms.length}`,
                            `Current terms: ${currentTerms.length}`,
                            `Terms in ${currentSchoolYear || 'current year'}: ${termsInCurrentYear.length}`
                        ],
                        blockers: calendarBlockers,
                        next_actions: [
                            { label: 'Review Terms', path: '/reports' }
                        ]
                    },
                    {
                        key: 'school_stage_policy',
                        label: 'School Stage Policy Compliance',
                        score: policyScore,
                        status: resolveScoreStatus(policyScore),
                        summary: 'Class grade levels must follow Barbados school-type progression rules.',
                        metrics: [
                            `Active classes checked: ${readinessClasses.length}`,
                            `Policy violations: ${invalidClassRows.length}`
                        ],
                        blockers: policyBlockers,
                        next_actions: [
                            { label: 'Review School Setup', path: '/schools' }
                        ]
                    },
                    {
                        key: 'transition_operations',
                        label: 'Primary to Secondary Transition Ops',
                        score: transitionScore,
                        status: resolveScoreStatus(transitionScore),
                        summary: 'Tracks readiness for Class 4 to First Form movement and transfer queue pressure.',
                        metrics: [
                            `Class 4 enrolment: ${primaryClass4Students}`,
                            `First Form enrolment: ${secondaryFirstFormStudents}`,
                            `Pending transfers: ${pendingTransfers}`
                        ],
                        blockers: transitionBlockers,
                        next_actions: [
                            { label: 'Open Transfer Queue', path: '/students' }
                        ]
                    },
                    {
                        key: 'exam_pathway_readiness',
                        label: 'CSEC/CAPE Pathway Readiness',
                        score: examPathwayScore,
                        status: resolveScoreStatus(examPathwayScore),
                        summary: 'Secondary structures support form progression and sixth-form pathways where required.',
                        metrics: [
                            `Secondary schools: ${secondarySchools.length}`,
                            `Schools with Forms 1-5: ${secondaryFormsReady}/${secondarySchools.length || 0}`,
                            `Sixth-form ready schools: ${sixthFormReady}/${sixthFormRequiredSchools.length || 0}`
                        ],
                        blockers: examBlockers,
                        next_actions: [
                            { label: 'Review Classes', path: '/reports' }
                        ]
                    },
                    {
                        key: 'access_governance',
                        label: 'Access and Governance Controls',
                        score: governanceScore,
                        status: resolveScoreStatus(governanceScore),
                        summary: 'Critical role coverage and leadership assignments are in place for national operations.',
                        metrics: [
                            `Active super admins: ${superAdminCount}`,
                            `Principal coverage: ${principalSchoolIds.size}/${readinessSchools.length || 0} schools`
                        ],
                        blockers: governanceBlockers,
                        next_actions: [
                            { label: 'Open Access Control', path: '/access-control' }
                        ]
                    },
                    {
                        key: 'data_quality_foundation',
                        label: 'Data Quality Foundation',
                        score: dataQualityScore,
                        status: resolveScoreStatus(dataQualityScore),
                        summary: 'Master records, grades, and enrolment data are validated through quality rules.',
                        metrics: [
                            `Quality score: ${dataQualityScore}%`,
                            `Total issues: ${Number(dataQuality?.totals?.issue_count || 0)}`,
                            `Critical issues: ${criticalQualityIssues}`
                        ],
                        blockers: qualityBlockers,
                        next_actions: [
                            { label: 'Open Dashboard Action Center', path: '/' }
                        ]
                    }
                ];

                const checklistStatus = (isComplete, isPartial = false) => {
                    if (isComplete) return 'complete';
                    if (isPartial) return 'in_progress';
                    return 'todo';
                };

                const checklist = [
                    {
                        key: 'single_current_term',
                        label: 'Exactly one current active term',
                        status: checklistStatus(currentTerms.length === 1, currentTerms.length > 1),
                        detail: `${currentTerms.length} term(s) currently flagged as active current term.`
                    },
                    {
                        key: 'grade_policy_compliance',
                        label: 'Class levels follow school-type policy',
                        status: checklistStatus(invalidClassRows.length === 0, invalidClassRows.length > 0 && invalidClassRows.length < 6),
                        detail: `${invalidClassRows.length} class configuration issue(s) detected.`
                    },
                    {
                        key: 'transition_queue_control',
                        label: 'Transition queue under control',
                        status: checklistStatus(Number(pendingTransfers || 0) === 0, Number(pendingTransfers || 0) > 0 && Number(pendingTransfers || 0) <= 10),
                        detail: `${pendingTransfers} pending transfer case(s).`
                    },
                    {
                        key: 'exam_pathway_structure',
                        label: 'CSEC/CAPE pathway class structures complete',
                        status: checklistStatus(formsCoverageRatio >= 0.9 && sixthCoverageRatio >= 0.9, formsCoverageRatio >= 0.75 || sixthCoverageRatio >= 0.75),
                        detail: `Forms coverage ${Math.round(formsCoverageRatio * 100)}%, sixth-form coverage ${Math.round(sixthCoverageRatio * 100)}%.`
                    },
                    {
                        key: 'access_redundancy',
                        label: 'Super admin and principal-level access redundancy',
                        status: checklistStatus(superAdminCount >= 2 && schoolLeadershipCoverage >= 0.9, superAdminCount >= 1 || schoolLeadershipCoverage >= 0.75),
                        detail: `${superAdminCount} super admin(s), leadership coverage ${Math.round(schoolLeadershipCoverage * 100)}%.`
                    },
                    {
                        key: 'critical_data_quality',
                        label: 'No critical data-quality issues',
                        status: checklistStatus(criticalQualityIssues === 0, criticalQualityIssues > 0 && criticalQualityIssues <= 5),
                        detail: `${criticalQualityIssues} critical issue(s) currently open.`
                    }
                ];

                const overallScore = clampScore(
                    pillars.reduce((sum, pillar) => sum + Number(pillar.score || 0), 0) / Math.max(pillars.length, 1)
                );

                return {
                    generated_at: new Date().toISOString(),
                    overall_score: overallScore,
                    status: resolveScoreStatus(overallScore),
                    pillars,
                    checklist
                };
            },
            {
                generated_at: new Date().toISOString(),
                overall_score: 0,
                status: 'critical',
                pillars: [],
                checklist: []
            },
            'barbados_readiness'
        );

        res.json({
            overview: {
                total_schools: totalSchools,
                total_students: totalStudents,
                total_staff: totalStaff,
                recent_activity: recentActivity,
                pending_transfers: pendingTransfers
            },
            attendance_today: attendanceToday,
            transfers_summary: transfersSummary,
            enrollment_summary: enrollmentSummary,
            trends: {
                attendance: attendanceTrend,
                enrollment: enrollmentTrend,
                transfers: transferTrend
            },
            barbados_readiness: barbadosReadiness,
            data_quality: dataQuality,
            activity_24h: {
                total: Number(recentActivity || 0),
                window_start: sinceLast24Hours.toISOString(),
                window_end: new Date().toISOString(),
                by_action: (activityByAction || []).map((row) => ({
                    action: row.action || 'unknown',
                    count: Number(row.count || 0)
                })),
                by_table: (activityByTable || []).map((row) => ({
                    table_name: row.table_name || 'system',
                    count: Number(row.count || 0)
                }))
            },
            breakdowns,
            recent_audits: recentAudits
        });

    } catch (error) {
        next(error);
    }
});

router.post('/readiness/report/pdf', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const readiness = normalizeReadinessPayload(req.body?.readiness);
        if (!readiness) {
            return res.status(400).json({
                error: 'A valid readiness payload is required.'
            });
        }

        const signature = signReadinessPayload({
            readiness,
            userId: req.user.id
        });

        const reportDate = String(signature.signed_at || new Date().toISOString()).slice(0, 10);
        const filename = `barbados-readiness-signed-${reportDate}.pdf`;

        try {
            await AuditLog.create({
                user_id: req.user.id,
                action: 'barbados_readiness_pdf_generated',
                table_name: 'reports',
                record_id: signature.report_id,
                old_values: null,
                new_values: {
                    report_type: 'barbados_readiness_signed_pdf',
                    readiness_status: readiness.status,
                    readiness_score: readiness.overall_score,
                    signature_algorithm: signature.algorithm
                },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });
        } catch (auditError) {
            logger.warn('Failed to write readiness PDF audit log', {
                error: auditError.message
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Readiness-Report-Id', signature.report_id);
        res.setHeader('X-Readiness-Signature', signature.digest);

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 48, left: 44, right: 44, bottom: 48 }
        });

        doc.on('error', (error) => {
            logger.error('Readiness PDF generation failed', {
                error: error.message
            });
            if (!res.headersSent) {
                next(error);
            }
        });

        doc.pipe(res);
        writeReadinessPdf({
            doc,
            readiness,
            signature,
            generatedBy: req.user.email || req.user.username || req.user.id
        });
        doc.end();
    } catch (error) {
        next(error);
    }
});

router.get('/zones/performance', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const scopedSchoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const schoolTypeFilter = req.query.school_type ? String(req.query.school_type).trim().toLowerCase() : null;
        const today = new Date().toISOString().slice(0, 10);
        const attendanceDateField = resolveModelField(AttendanceRecord, ['attendance_date', 'attendanceDate'], null);

        const schoolWhere = {
            is_active: true,
            ...(scopedSchoolId ? { id: scopedSchoolId } : {}),
            ...(schoolTypeFilter ? { school_type: schoolTypeFilter } : {})
        };

        const schools = await School.findAll({
            where: schoolWhere,
            attributes: ['id', 'name', 'school_type', 'school_category', 'parish', 'zone_id'],
            include: [
                { model: Parish, attributes: ['id', 'name', 'code'], required: false },
                { model: Zone, attributes: ['id', 'name'], required: false }
            ]
        });

        const schoolIds = schools.map((school) => school.id);
        if (schoolIds.length === 0) {
            return res.json({
                generated_at: new Date().toISOString(),
                zones: BARBADOS_ZONE_DEFINITIONS.map((zone) => ({
                    ...zone,
                    schools_count: 0,
                    student_count: 0,
                    attendance_rate: 0,
                    quality_score: 100,
                    pending_transfers: 0,
                    overall_score: 100,
                    status: 'healthy'
                })),
                school_points: []
            });
        }

        const [studentRows, attendanceRows, qualityRows, transferRows] = await Promise.all([
            Student.findAll({
                where: {
                    is_active: true,
                    school_id: { [Op.in]: schoolIds }
                },
                attributes: [
                    'school_id',
                    [Student.sequelize.fn('COUNT', Student.sequelize.col('id')), 'count']
                ],
                group: ['school_id'],
                raw: true
            }),
            attendanceDateField
                ? AttendanceRecord.findAll({
                    where: {
                        school_id: { [Op.in]: schoolIds },
                        [attendanceDateField]: today
                    },
                    attributes: [
                        'school_id',
                        [AttendanceRecord.sequelize.fn('COUNT', AttendanceRecord.sequelize.col('id')), 'total_records'],
                        [AttendanceRecord.sequelize.fn('SUM', AttendanceRecord.sequelize.literal("CASE WHEN status IN ('present', 'late', 'excused') THEN 1 ELSE 0 END")), 'attending_records']
                    ],
                    group: ['school_id'],
                    raw: true
                })
                : [],
            DataQualityIssue.findAll({
                where: {
                    scope_level: 'school',
                    school_id: { [Op.in]: schoolIds },
                    status: { [Op.in]: ['open', 'in_progress'] }
                },
                attributes: [
                    'school_id',
                    'severity',
                    [DataQualityIssue.sequelize.fn('COUNT', DataQualityIssue.sequelize.col('id')), 'issue_rows'],
                    [DataQualityIssue.sequelize.fn('SUM', DataQualityIssue.sequelize.col('issue_count')), 'issue_count']
                ],
                group: ['school_id', 'severity'],
                raw: true
            }),
            StudentTransfer.findAll({
                where: {
                    status: 'pending',
                    [Op.or]: [
                        { from_school_id: { [Op.in]: schoolIds } },
                        { to_school_id: { [Op.in]: schoolIds } }
                    ]
                },
                attributes: ['from_school_id', 'to_school_id'],
                raw: true
            })
        ]);

        const studentMap = studentRows.reduce((acc, row) => {
            acc[String(row.school_id)] = Number(row.count || 0);
            return acc;
        }, {});

        const attendanceMap = attendanceRows.reduce((acc, row) => {
            const total = Number(row.total_records || 0);
            const attending = Number(row.attending_records || 0);
            acc[String(row.school_id)] = {
                total_records: total,
                attendance_rate: total > 0 ? Number(((attending / total) * 100).toFixed(1)) : 0
            };
            return acc;
        }, {});

        const qualityMap = qualityRows.reduce((acc, row) => {
            const schoolId = String(row.school_id);
            if (!acc[schoolId]) {
                acc[schoolId] = { critical: 0, warning: 0, info: 0, issue_count: 0 };
            }
            const severity = String(row.severity || 'info');
            const issueCount = Number(row.issue_count || row.issue_rows || 0);
            acc[schoolId][severity] = issueCount;
            acc[schoolId].issue_count += issueCount;
            return acc;
        }, {});

        const transferMap = transferRows.reduce((acc, row) => {
            const fromSchool = String(row.from_school_id || '');
            const toSchool = String(row.to_school_id || '');
            if (fromSchool) acc[fromSchool] = (acc[fromSchool] || 0) + 1;
            if (toSchool) acc[toSchool] = (acc[toSchool] || 0) + 1;
            return acc;
        }, {});

        const zoneAccumulator = BARBADOS_ZONE_DEFINITIONS.reduce((acc, zone) => {
            acc[zone.key] = {
                ...zone,
                schools_count: 0,
                student_count: 0,
                attendance_total_records: 0,
                attendance_attending_records: 0,
                quality_critical: 0,
                quality_warning: 0,
                quality_info: 0,
                quality_issue_count: 0,
                pending_transfers: 0
            };
            return acc;
        }, {});

        const schoolPoints = schools.map((school) => {
            const schoolId = String(school.id);
            const zoneKey = resolveBarbadosZoneKeyForSchool({
                schoolName: school.name,
                schoolType: school.school_type || school.school_category,
                parishCode: school?.Parish?.code || null,
                parishName: school?.Parish?.name || null,
                schoolParish: school.parish || null
            });
            const zoneMeta = getZoneDefinitionByKey(zoneKey);
            const attendance = attendanceMap[schoolId] || { total_records: 0, attendance_rate: 0 };
            const quality = qualityMap[schoolId] || { critical: 0, warning: 0, info: 0, issue_count: 0 };
            const pendingTransfers = Number(transferMap[schoolId] || 0);
            const qualityScore = clampScore(100 - (quality.critical * 10) - (quality.warning * 4) - (quality.info * 1));
            const transferScore = clampScore(100 - (pendingTransfers * 8));
            const performanceScore = clampScore(
                (Number(attendance.attendance_rate || 0) * 0.45) +
                (qualityScore * 0.4) +
                (transferScore * 0.15)
            );

            if (zoneKey && zoneAccumulator[zoneKey]) {
                const bucket = zoneAccumulator[zoneKey];
                bucket.schools_count += 1;
                bucket.student_count += Number(studentMap[schoolId] || 0);
                bucket.attendance_total_records += Number(attendance.total_records || 0);
                bucket.attendance_attending_records += Math.round(
                    (Number(attendance.total_records || 0) * Number(attendance.attendance_rate || 0)) / 100
                );
                bucket.quality_critical += Number(quality.critical || 0);
                bucket.quality_warning += Number(quality.warning || 0);
                bucket.quality_info += Number(quality.info || 0);
                bucket.quality_issue_count += Number(quality.issue_count || 0);
                bucket.pending_transfers += pendingTransfers;
            }

            return {
                school_id: school.id,
                school_name: school.name,
                school_type: school.school_type || school.school_category || null,
                parish: school?.Parish?.name || school.parish || null,
                zone_key: zoneKey || null,
                zone_name: zoneMeta?.name || null,
                student_count: Number(studentMap[schoolId] || 0),
                attendance_rate: Number(attendance.attendance_rate || 0),
                quality_critical: Number(quality.critical || 0),
                quality_warning: Number(quality.warning || 0),
                quality_info: Number(quality.info || 0),
                pending_transfers: pendingTransfers,
                performance_score: performanceScore,
                status: resolveScoreStatus(performanceScore)
            };
        });

        const zones = BARBADOS_ZONE_DEFINITIONS.map((zone) => {
            const bucket = zoneAccumulator[zone.key];
            const attendanceRate = bucket.attendance_total_records > 0
                ? Number(((bucket.attendance_attending_records / bucket.attendance_total_records) * 100).toFixed(1))
                : 0;
            const qualityScore = clampScore(
                100 - (bucket.quality_critical * 10) - (bucket.quality_warning * 4) - (bucket.quality_info * 1)
            );
            const transferScore = clampScore(100 - (bucket.pending_transfers * 6));
            const overallScore = clampScore(
                (attendanceRate * 0.45) +
                (qualityScore * 0.4) +
                (transferScore * 0.15)
            );
            return {
                key: zone.key,
                name: zone.name,
                description: zone.description,
                schools_count: bucket.schools_count,
                student_count: bucket.student_count,
                attendance_rate: attendanceRate,
                quality_score: qualityScore,
                pending_transfers: bucket.pending_transfers,
                overall_score: overallScore,
                status: resolveScoreStatus(overallScore)
            };
        });

        res.json({
            generated_at: new Date().toISOString(),
            zones,
            school_points: schoolPoints.sort((a, b) => b.performance_score - a.performance_score)
        });
    } catch (error) {
        next(error);
    }
});

router.get('/data-quality', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const refresh = parseBoolean(req.query.refresh, true);
        const hardFailWarnings = parseBoolean(req.query.hard_fail_warnings, false);

        const overview = await generateDataQualityOverview({
            schoolId,
            refreshTracking: refresh
        });
        const releaseGate = await evaluateReleaseGate({
            schoolId,
            hardFailOnWarnings: hardFailWarnings
        });

        res.json({
            ...overview,
            release_gate: releaseGate
        });
    } catch (error) {
        next(error);
    }
});

router.get('/data-quality/issues', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const status = req.query.status || null;
        const limit = Number(req.query.limit || 30);

        const issues = await listTrackedIssues({
            schoolId,
            status,
            limit
        });

        res.json({
            issues,
            total_count: issues.length
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/data-quality/issues/:issueId', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { issueId } = req.params;
        const requestedSchoolId = req.body?.school_id || req.query?.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const updates = {};
        const updateKeys = ['status', 'assigned_to', 'assigned_by', 'due_date', 'ignored_reason', 'resolution_notes'];
        updateKeys.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
                updates[key] = req.body[key];
            }
        });
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No update fields were provided.' });
        }

        const updatedIssue = await updateTrackedIssue({
            issueId,
            updates,
            schoolId,
            actingUser: req.user,
            requestContext: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        res.json({
            message: 'Data-quality issue updated successfully.',
            issue: updatedIssue
        });
    } catch (error) {
        if (/not found/i.test(error.message)) {
            return res.status(404).json({ error: error.message });
        }
        if (/invalid|required|belongs to another school/i.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        return next(error);
    }
});

router.post('/data-quality/fix', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const checkKey = req.body?.check_key;
        if (!checkKey) {
            return res.status(400).json({ error: 'check_key is required.' });
        }

        const requestedSchoolId = req.body?.school_id || req.query?.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const result = await applySafeAutoFix({
            checkKey,
            schoolId,
            actingUser: req.user,
            requestContext: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        return res.json({
            message: `Safe auto-fix completed for ${checkKey}.`,
            ...result
        });
    } catch (error) {
        if (/no safe auto-fix|required|invalid/i.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        return next(error);
    }
});

router.get('/data-quality/assignable-users', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const users = await getAssignableUserOptions({ schoolId });
        res.json({ users });
    } catch (error) {
        next(error);
    }
});

router.get('/data-quality/release-gate', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const hardFailOnWarnings = parseBoolean(req.query.hard_fail_warnings, false);
        const gate = await evaluateReleaseGate({
            schoolId,
            hardFailOnWarnings
        });
        res.json(gate);
    } catch (error) {
        next(error);
    }
});

router.get('/data-quality/playbooks', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const whereClause = {
            check_key: { [Op.in]: DATA_QUALITY_PLAYBOOKS.map((playbook) => playbook.key) },
            status: { [Op.in]: ['open', 'in_progress'] },
            ...(schoolId ? {
                [Op.or]: [
                    { scope_level: 'national' },
                    { scope_level: 'school', school_id: schoolId }
                ]
            } : {})
        };

        const grouped = await DataQualityIssue.findAll({
            where: whereClause,
            attributes: [
                'check_key',
                [DataQualityIssue.sequelize.fn('COUNT', DataQualityIssue.sequelize.col('id')), 'issue_rows'],
                [DataQualityIssue.sequelize.fn('SUM', DataQualityIssue.sequelize.col('issue_count')), 'issue_count']
            ],
            group: ['check_key'],
            raw: true
        });
        const groupedMap = grouped.reduce((acc, row) => {
            acc[String(row.check_key)] = {
                issue_rows: Number(row.issue_rows || 0),
                issue_count: Number(row.issue_count || 0)
            };
            return acc;
        }, {});

        res.json({
            generated_at: new Date().toISOString(),
            school_id: schoolId || null,
            playbooks: DATA_QUALITY_PLAYBOOKS.map((playbook) => ({
                ...playbook,
                open_issue_rows: Number(groupedMap[playbook.key]?.issue_rows || 0),
                open_issue_count: Number(groupedMap[playbook.key]?.issue_count || 0)
            }))
        });
    } catch (error) {
        next(error);
    }
});

router.get('/data-quality/playbooks/:checkKey/preview', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const checkKey = String(req.params.checkKey || '').trim();
        const playbook = DATA_QUALITY_PLAYBOOKS.find((item) => item.key === checkKey);
        if (!playbook) {
            return res.status(404).json({ error: 'Playbook not found.' });
        }

        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const issues = await listTrackedIssues({
            schoolId,
            status: null,
            limit: 200
        });
        const matchingIssues = issues.filter((issue) => issue.check_key === checkKey);
        const totalImpact = matchingIssues.reduce((sum, issue) => sum + Number(issue.issue_count || 0), 0);

        res.json({
            generated_at: new Date().toISOString(),
            school_id: schoolId || null,
            playbook: {
                ...playbook,
                scope: schoolId ? 'school' : 'national'
            },
            estimate: {
                issue_rows: matchingIssues.length,
                issue_count: totalImpact,
                schools_affected: new Set(matchingIssues.map((issue) => issue.school_id).filter(Boolean)).size
            },
            samples: matchingIssues
                .slice(0, 5)
                .map((issue) => ({
                    issue_id: issue.id,
                    label: issue.label,
                    severity: issue.severity,
                    school_name: issue.school_name || null,
                    sample_details: issue.sample_details || []
                }))
        });
    } catch (error) {
        next(error);
    }
});

router.post('/data-quality/playbooks/:checkKey/apply', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const checkKey = String(req.params.checkKey || '').trim();
        const playbook = DATA_QUALITY_PLAYBOOKS.find((item) => item.key === checkKey);
        if (!playbook) {
            return res.status(404).json({ error: 'Playbook not found.' });
        }

        const requestedSchoolId = req.body?.school_id || req.query?.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const result = await applySafeAutoFix({
            checkKey,
            schoolId,
            actingUser: req.user,
            requestContext: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        return res.json({
            message: `Playbook "${playbook.title}" applied successfully.`,
            playbook,
            ...result
        });
    } catch (error) {
        if (/no safe auto-fix|required|invalid/i.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        return next(error);
    }
});

router.get('/rollover/preview', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const fromYear = normalizeSchoolYear(req.query.from_year) || await resolveCurrentSchoolYear();
        const toYear = normalizeSchoolYear(req.query.to_year) || deriveNextSchoolYear(fromYear);

        if (!fromYear || !toYear) {
            return res.status(400).json({
                error: 'Unable to resolve from_year and to_year. Provide valid YYYY-YYYY values.'
            });
        }

        const classWhere = {
            is_active: true,
            school_year: fromYear,
            ...(schoolId ? { school_id: schoolId } : {})
        };
        const targetClassWhere = {
            is_active: true,
            school_year: toYear,
            ...(schoolId ? { school_id: schoolId } : {})
        };

        const [sourceClasses, targetClasses, scopedStudents, scopedSchools, targetTerms, pendingTransfers] = await Promise.all([
            Class.findAll({
                where: classWhere,
                attributes: ['id', 'school_id', 'name', 'grade_level', 'section', 'capacity', 'class_teacher_id'],
                order: [['grade_level', 'ASC'], ['section', 'ASC']]
            }),
            Class.findAll({
                where: targetClassWhere,
                attributes: ['id', 'school_id', 'grade_level', 'section'],
                raw: true
            }),
            Student.findAll({
                where: {
                    is_active: true,
                    ...(schoolId ? { school_id: schoolId } : {})
                },
                attributes: ['id', 'school_id', 'grade_level', 'year_end_status', 'class_id'],
                raw: true
            }),
            School.findAll({
                where: {
                    is_active: true,
                    ...(schoolId ? { id: schoolId } : {})
                },
                attributes: ['id', 'name', 'school_type', 'school_category', 'offers_sixth_form'],
                raw: true
            }),
            Term.findAll({
                where: { is_active: true, school_year: toYear },
                attributes: ['id', 'name', 'term_number', 'is_current'],
                order: [['term_number', 'ASC']],
                raw: true
            }),
            StudentTransfer.count({
                where: {
                    status: 'pending',
                    ...(schoolId ? { [Op.or]: [{ from_school_id: schoolId }, { to_school_id: schoolId }] } : {})
                }
            })
        ]);

        const targetClassKeySet = new Set(
            targetClasses.map((row) => `${row.school_id}|${normalizeGradeLevelToken(row.grade_level)}|${String(row.section || '').trim().toUpperCase()}`)
        );

        const classTemplates = sourceClasses.map((classRow) => {
            const key = `${classRow.school_id}|${normalizeGradeLevelToken(classRow.grade_level)}|${String(classRow.section || '').trim().toUpperCase()}`;
            return {
                school_id: classRow.school_id,
                class_name: classRow.name,
                grade_level: classRow.grade_level,
                section: classRow.section,
                exists_in_target_year: targetClassKeySet.has(key)
            };
        });

        const statusBreakdown = scopedStudents.reduce((acc, student) => {
            const status = String(student.year_end_status || 'unassigned');
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        const promoteCandidates = scopedStudents.filter((student) => student.year_end_status === 'promoted').length;
        const retainCandidates = scopedStudents.filter((student) => student.year_end_status === 'stop_down').length;
        const graduateCandidates = scopedStudents.filter((student) => student.year_end_status === 'graduated').length;
        const unresolvedStatuses = scopedStudents.filter((student) => !student.year_end_status).length;

        const promotionReadinessWarnings = [];
        if (targetTerms.length === 0) {
            promotionReadinessWarnings.push(`No active terms are configured for ${toYear}.`);
        }
        if (pendingTransfers > 0) {
            promotionReadinessWarnings.push(`${pendingTransfers} pending transfer case(s) should be resolved before rollover.`);
        }
        if (unresolvedStatuses > 0) {
            promotionReadinessWarnings.push(`${unresolvedStatuses} student(s) are missing year-end status decisions.`);
        }
        if (classTemplates.filter((item) => !item.exists_in_target_year).length > 0) {
            promotionReadinessWarnings.push('Some target-year classes are missing and should be cloned before promotion.');
        }

        res.json({
            generated_at: new Date().toISOString(),
            school_id: schoolId || null,
            from_year: fromYear,
            to_year: toYear,
            schools: scopedSchools,
            summary: {
                source_classes: sourceClasses.length,
                target_classes: targetClasses.length,
                total_students: scopedStudents.length,
                promote_candidates: promoteCandidates,
                retain_candidates: retainCandidates,
                graduate_candidates: graduateCandidates,
                unresolved_statuses: unresolvedStatuses,
                pending_transfers: pendingTransfers,
                target_terms: targetTerms.length
            },
            status_breakdown: statusBreakdown,
            class_templates: classTemplates.slice(0, 300),
            warnings: promotionReadinessWarnings
        });
    } catch (error) {
        next(error);
    }
});

router.post('/rollover/execute', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.body?.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const fromYear = normalizeSchoolYear(req.body?.from_year);
        const toYear = normalizeSchoolYear(req.body?.to_year);
        const options = req.body?.options || {};

        if (!fromYear || !toYear) {
            return res.status(400).json({
                error: 'from_year and to_year are required and must use YYYY-YYYY format.'
            });
        }
        if (fromYear === toYear) {
            return res.status(400).json({
                error: 'from_year and to_year must be different.'
            });
        }

        const runOptions = {
            create_terms: parseBoolean(options.create_terms, true),
            clone_classes: parseBoolean(options.clone_classes, true),
            promote_students: parseBoolean(options.promote_students, false),
            deactivate_source_classes: parseBoolean(options.deactivate_source_classes, false)
        };

        const summary = await sequelize.transaction(async (transaction) => {
            const scopedSchools = await School.findAll({
                where: {
                    is_active: true,
                    ...(schoolId ? { id: schoolId } : {})
                },
                attributes: ['id', 'name', 'school_type', 'school_category', 'offers_sixth_form'],
                transaction
            });
            const schoolMap = scopedSchools.reduce((acc, school) => {
                acc[String(school.id)] = school;
                return acc;
            }, {});

            const sourceClassWhere = {
                is_active: true,
                school_year: fromYear,
                ...(schoolId ? { school_id: schoolId } : {})
            };
            const sourceClasses = await Class.findAll({
                where: sourceClassWhere,
                transaction
            });

            const existingTargetClasses = await Class.findAll({
                where: {
                    is_active: true,
                    school_year: toYear,
                    ...(schoolId ? { school_id: schoolId } : {})
                },
                transaction
            });
            const targetClassKeyMap = new Map(
                existingTargetClasses.map((classRow) => ([
                    `${classRow.school_id}|${normalizeGradeLevelToken(classRow.grade_level)}|${String(classRow.section || '').trim().toUpperCase()}`,
                    classRow
                ]))
            );

            let createdTerms = 0;
            if (runOptions.create_terms) {
                const existingTerms = await Term.count({
                    where: { is_active: true, school_year: toYear },
                    transaction
                });
                if (existingTerms === 0) {
                    const [startYear, endYear] = toYear.split('-').map((value) => Number(value));
                    const termSeed = [
                        { name: 'Term 1', term_number: 1, start_date: `${startYear}-09-01`, end_date: `${startYear}-12-15`, is_current: false },
                        { name: 'Term 2', term_number: 2, start_date: `${endYear}-01-08`, end_date: `${endYear}-03-28`, is_current: false },
                        { name: 'Term 3', term_number: 3, start_date: `${endYear}-04-15`, end_date: `${endYear}-07-05`, is_current: false }
                    ];
                    await Term.bulkCreate(termSeed.map((term) => ({
                        ...term,
                        school_year: toYear,
                        is_active: true
                    })), { transaction });
                    createdTerms = termSeed.length;
                }
            }

            let clonedClasses = 0;
            if (runOptions.clone_classes) {
                for (const sourceClass of sourceClasses) {
                    const normalizedSection = String(sourceClass.section || '').trim().toUpperCase();
                    const key = `${sourceClass.school_id}|${normalizeGradeLevelToken(sourceClass.grade_level)}|${normalizedSection}`;
                    if (targetClassKeyMap.has(key)) {
                        continue;
                    }

                    const school = schoolMap[String(sourceClass.school_id)];
                    const allowedLevels = getAllowedClassLevelsForSchool(school).map((value) => normalizeGradeLevelToken(value));
                    if (!allowedLevels.includes(normalizeGradeLevelToken(sourceClass.grade_level))) {
                        continue;
                    }

                    const created = await Class.create({
                        school_id: sourceClass.school_id,
                        name: sourceClass.name,
                        grade_level: sourceClass.grade_level,
                        section: sourceClass.section,
                        class_teacher_id: sourceClass.class_teacher_id || null,
                        school_year: toYear,
                        capacity: sourceClass.capacity || 25,
                        current_enrollment: 0,
                        is_active: true
                    }, { transaction });
                    targetClassKeyMap.set(key, created);
                    clonedClasses += 1;
                }
            }

            let studentsPromoted = 0;
            let studentsRetained = 0;
            let studentsGraduated = 0;
            let studentsUnassigned = 0;
            if (runOptions.promote_students) {
                const scopedStudents = await Student.findAll({
                    where: {
                        is_active: true,
                        year_end_status: { [Op.in]: ['promoted', 'stop_down', 'graduated'] },
                        ...(schoolId ? { school_id: schoolId } : {})
                    },
                    transaction
                });

                const targetEnrollmentMap = {};
                const targetClassValues = Array.from(targetClassKeyMap.values());
                targetClassValues.forEach((classRow) => {
                    targetEnrollmentMap[String(classRow.id)] = Number(classRow.current_enrollment || 0);
                });

                const assignToClass = ({ schoolIdValue, gradeLevel }) => {
                    const targetCandidates = targetClassValues.filter((classRow) =>
                        String(classRow.school_id) === String(schoolIdValue) &&
                        normalizeGradeLevelToken(classRow.grade_level) === normalizeGradeLevelToken(gradeLevel)
                    );
                    if (targetCandidates.length === 0) return null;
                    targetCandidates.sort((left, right) =>
                        Number(targetEnrollmentMap[left.id] || 0) - Number(targetEnrollmentMap[right.id] || 0)
                    );
                    const selected = targetCandidates[0];
                    targetEnrollmentMap[selected.id] = Number(targetEnrollmentMap[selected.id] || 0) + 1;
                    return selected;
                };

                for (const student of scopedStudents) {
                    const school = schoolMap[String(student.school_id)];
                    const status = String(student.year_end_status || '');
                    if (status === 'graduated') {
                        await student.update({
                            is_active: false,
                            class_id: null,
                            year_end_notes: appendAdminNotes(student.year_end_notes, `Rollover ${fromYear} -> ${toYear}: marked graduated.`),
                            year_end_status_date: new Date(),
                            year_end_status_set_by: req.user.id,
                            year_end_status: null
                        }, { transaction });
                        studentsGraduated += 1;
                        continue;
                    }

                    let targetGrade = status === 'promoted'
                        ? resolvePromotedGradeLevel(student.grade_level)
                        : student.grade_level;
                    if (!targetGrade) {
                        targetGrade = student.grade_level;
                    }

                    const allowedLevels = getAllowedClassLevelsForSchool(school).map((value) => normalizeGradeLevelToken(value));
                    if (!allowedLevels.includes(normalizeGradeLevelToken(targetGrade))) {
                        await student.update({
                            class_id: null,
                            year_end_notes: appendAdminNotes(
                                student.year_end_notes,
                                `Rollover ${fromYear} -> ${toYear}: target grade ${targetGrade} is outside school stage policy; class not assigned.`
                            ),
                            year_end_status_date: new Date(),
                            year_end_status_set_by: req.user.id,
                            year_end_status: null
                        }, { transaction });
                        studentsUnassigned += 1;
                        continue;
                    }

                    const assignedClass = assignToClass({
                        schoolIdValue: student.school_id,
                        gradeLevel: targetGrade
                    });
                    await student.update({
                        grade_level: targetGrade,
                        class_id: assignedClass ? assignedClass.id : null,
                        year_end_notes: appendAdminNotes(
                            student.year_end_notes,
                            `Rollover ${fromYear} -> ${toYear}: ${status} to ${targetGrade}${assignedClass ? ` (${assignedClass.name})` : ', class pending assignment'}.`
                        ),
                        year_end_status_date: new Date(),
                        year_end_status_set_by: req.user.id,
                        year_end_status: null
                    }, { transaction });

                    if (status === 'promoted') studentsPromoted += 1;
                    if (status === 'stop_down') studentsRetained += 1;
                    if (!assignedClass) studentsUnassigned += 1;
                }

                for (const classRow of targetClassValues) {
                    const updatedEnrollment = Number(targetEnrollmentMap[String(classRow.id)] || 0);
                    if (Number(classRow.current_enrollment || 0) !== updatedEnrollment) {
                        await classRow.update({ current_enrollment: updatedEnrollment }, { transaction });
                    }
                }
            }

            let deactivatedClasses = 0;
            if (runOptions.deactivate_source_classes) {
                const [affectedCount] = await Class.update(
                    { is_active: false },
                    {
                        where: sourceClassWhere,
                        transaction
                    }
                );
                deactivatedClasses = Number(affectedCount || 0);
            }

            return {
                from_year: fromYear,
                to_year: toYear,
                school_scope_count: scopedSchools.length,
                options: runOptions,
                created_terms: createdTerms,
                source_classes: sourceClasses.length,
                cloned_classes: clonedClasses,
                students_promoted: studentsPromoted,
                students_retained: studentsRetained,
                students_graduated: studentsGraduated,
                students_unassigned: studentsUnassigned,
                deactivated_source_classes: deactivatedClasses
            };
        });

        await AuditLog.create({
            user_id: req.user.id,
            action: 'academic_year_rollover_executed',
            table_name: 'classes',
            record_id: null,
            old_values: null,
            new_values: summary,
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        res.json({
            message: 'Academic year rollover executed successfully.',
            summary
        });
    } catch (error) {
        next(error);
    }
});

// Access-control matrix and current access profile
router.get('/access-control/matrix', authMiddleware, requireRole(['super_admin']), async (req, res, next) => {
    try {
        res.json(getAccessControlMatrix());
    } catch (error) {
        next(error);
    }
});

router.get('/access-control/my-access', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const access = await resolveAccessContextForUser(req.user);
        res.json({
            access: access ? {
                user_id: access.user_id,
                user_role: access.user_role,
                access_role: access.access_role,
                scope: access.scope,
                school_id: access.school_id,
                staff_id: access.staff_id,
                staff_role_level: access.staff_role_level,
                permissions: access.permissions
            } : null
        });
    } catch (error) {
        next(error);
    }
});

// Super Admin: create user account with optional generated password
router.post('/access-control/users', authMiddleware, requireRole(['super_admin']), async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
        const username = String(req.body?.username || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        const targetAccessRole = String(req.body?.target_access_role || '').trim();
        const requestedPassword = String(req.body?.password || '').trim();
        const schoolId = req.body?.school_id || null;
        const requestedFirstName = req.body?.first_name || null;
        const requestedLastName = req.body?.last_name || null;
        const requestedIsActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : true;

        if (!USERNAME_PATTERN.test(username)) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Username must be 3-50 chars and can only include letters, numbers, dot, underscore, and dash.'
            });
        }

        if (!EMAIL_PATTERN.test(email)) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Valid email is required.'
            });
        }

        const mutation = ACCESS_ROLE_MUTATION_MAP[targetAccessRole];
        if (!mutation) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Invalid target_access_role.',
                valid_roles: Object.keys(ACCESS_ROLE_MUTATION_MAP)
            });
        }

        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ username }, { email }]
            },
            attributes: ['id'],
            transaction
        });
        if (existingUser) {
            await transaction.rollback();
            return res.status(409).json({
                error: 'A user with this username or email already exists.'
            });
        }

        let school = null;
        if (mutation.requires_school) {
            school = await School.findByPk(schoolId, {
                attributes: ['id', 'name', 'is_active'],
                transaction
            });
            if (!school || !school.is_active) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Valid active school is required for this role.' });
            }
        }

        const generatedPassword = !requestedPassword;
        const plainPassword = generatedPassword ? generateSystemPassword('User') : requestedPassword;
        if (String(plainPassword).length < 8) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Password must be at least 8 characters.'
            });
        }

        const passwordHash = await bcrypt.hash(plainPassword, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);

        const createdUser = await User.create({
            username,
            email,
            password_hash: passwordHash,
            role: mutation.user_role,
            is_active: requestedIsActive
        }, { transaction });

        let createdStaff = null;
        if (mutation.requires_staff) {
            const splitName = username.split(/[._-]+/).filter(Boolean);
            const fallbackFirst = splitName[0] ? splitName[0].charAt(0).toUpperCase() + splitName[0].slice(1) : 'Staff';
            const fallbackLast = splitName[1] ? splitName[1].charAt(0).toUpperCase() + splitName[1].slice(1) : 'User';
            const firstName = sanitizeNameValue(requestedFirstName, fallbackFirst);
            const lastName = sanitizeNameValue(requestedLastName, fallbackLast);

            let employeeId = generateEmployeeId(targetAccessRole);
            for (let attempt = 0; attempt < 5; attempt += 1) {
                const duplicate = await Staff.findOne({
                    where: { employee_id: employeeId },
                    attributes: ['id'],
                    transaction
                });
                if (!duplicate) break;
                employeeId = generateEmployeeId(targetAccessRole);
            }

            const roleSpecificPosition = targetAccessRole === 'teacher'
                ? 'Teacher'
                : (targetAccessRole === 'school_admin' ? 'Principal' : 'Data Clerk');
            const department = targetAccessRole === 'teacher' ? 'Teaching' : 'Administration';

            createdStaff = await Staff.create({
                user_id: createdUser.id,
                school_id: school.id,
                employee_id: employeeId,
                first_name: firstName,
                last_name: lastName,
                position: roleSpecificPosition,
                role_level: mutation.staff_role_level,
                department,
                hire_date: new Date().toISOString().slice(0, 10),
                is_active: Boolean(requestedIsActive)
            }, { transaction });
        }

        await AuditLog.create({
            user_id: req.user.id,
            action: 'USER_ACCOUNT_CREATED_BY_SUPER_ADMIN',
            table_name: 'users',
            record_id: createdUser.id,
            old_values: null,
            new_values: {
                username: createdUser.username,
                email: createdUser.email,
                role: createdUser.role,
                target_access_role: targetAccessRole,
                school_id: createdStaff?.school_id || null,
                staff_id: createdStaff?.id || null,
                is_active: Boolean(createdUser.is_active),
                password_generated: generatedPassword
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        }, { transaction });

        await transaction.commit();

        return res.status(201).json({
            message: 'User created successfully.',
            user: {
                id: createdUser.id,
                username: createdUser.username,
                email: createdUser.email,
                role: createdUser.role,
                access_role: targetAccessRole,
                school_id: createdStaff?.school_id || null,
                school_name: school?.name || null,
                is_active: Boolean(createdUser.is_active)
            },
            credentials: {
                password: plainPassword,
                generated: generatedPassword
            }
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
});

// Super Admin: reset user password for forgotten password support
router.post('/access-control/users/:userId/reset-password', authMiddleware, requireRole(['super_admin']), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const requestedPassword = String(req.body?.password || '').trim();
        const shouldGenerate = parseBoolean(req.body?.generate_password, true);

        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'email', 'role', 'is_active']
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const generatedPassword = shouldGenerate || !requestedPassword;
        const plainPassword = generatedPassword ? generateSystemPassword('Reset') : requestedPassword;
        if (String(plainPassword).length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters.' });
        }

        const passwordHash = await bcrypt.hash(plainPassword, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);
        await user.update({ password_hash: passwordHash });

        await AuditLog.create({
            user_id: req.user.id,
            action: 'USER_PASSWORD_RESET',
            table_name: 'users',
            record_id: user.id,
            old_values: null,
            new_values: {
                username: user.username,
                target_user_role: user.role,
                password_generated: generatedPassword
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        return res.json({
            message: 'Password reset successfully.',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            credentials: {
                password: plainPassword,
                generated: generatedPassword
            }
        });
    } catch (error) {
        next(error);
    }
});

// Super Admin: list users and current access assignments
router.get('/access-control/users', authMiddleware, requireRole(['super_admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 25, search, role, access_role, school_id, is_active } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { username: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }
        if (role) {
            whereClause.role = role;
        }
        if (is_active !== undefined) {
            const normalized = String(is_active).trim().toLowerCase();
            whereClause.is_active = normalized === 'true' || normalized === '1' || normalized === 'active';
        }

        const includeClause = [
            {
                model: Staff,
                required: false,
                attributes: ['id', 'school_id', 'role_level', 'employee_id', 'first_name', 'last_name'],
                include: [
                    {
                        model: School,
                        required: false,
                        attributes: ['id', 'name', 'school_code']
                    }
                ]
            },
            {
                model: Student,
                required: false,
                attributes: ['id', 'school_id', 'student_id', 'first_name', 'last_name'],
                include: [
                    {
                        model: School,
                        required: false,
                        attributes: ['id', 'name', 'school_code']
                    }
                ]
            }
        ];

        if (school_id) {
            includeClause[0].where = { school_id };
            includeClause[0].required = true;
        }

        const users = await User.findAndCountAll({
            where: whereClause,
            include: includeClause,
            attributes: ['id', 'username', 'email', 'role', 'is_active', 'last_login', 'created_at'],
            limit: parseInt(limit, 10),
            offset,
            order: [['created_at', 'DESC']]
        });

        const scopeByAccessRole = {
            super_admin: 'national',
            ministry_admin: 'national',
            school_admin: 'school',
            data_clerk: 'school',
            teacher: 'school',
            parent: 'children',
            student: 'self'
        };

        const userRows = users.rows
            .map((user) => {
                const staff = user.Staff || null;
                const student = user.Student || null;
                const resolvedAccessRole = resolveAccessRoleKey({
                    userRole: user.role,
                    staffRoleLevel: staff?.role_level
                });
                const school = staff?.School || student?.School || null;
                return {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    is_active: Boolean(user.is_active),
                    last_login: user.last_login,
                    created_at: user.created_at,
                    access_role: resolvedAccessRole,
                    scope: scopeByAccessRole[resolvedAccessRole] || 'self',
                    school_id: staff?.school_id || student?.school_id || null,
                    school_name: school?.name || null,
                    staff_profile: staff
                        ? {
                            id: staff.id,
                            employee_id: staff.employee_id,
                            first_name: staff.first_name,
                            last_name: staff.last_name,
                            role_level: staff.role_level
                        }
                        : null,
                    student_profile: student
                        ? {
                            id: student.id,
                            student_id: student.student_id,
                            first_name: student.first_name,
                            last_name: student.last_name
                        }
                        : null
                };
            })
            .filter((row) => {
                if (!access_role) return true;
                return String(row.access_role) === String(access_role);
            });

        res.json({
            users: userRows,
            access_role_options: [
                { value: 'super_admin', label: 'Super Admin' },
                { value: 'ministry_admin', label: 'Ministry Admin' },
                { value: 'school_admin', label: 'School Admin (Principal)' },
                { value: 'data_clerk', label: 'Registrar / Data Clerk' },
                { value: 'teacher', label: 'Teacher' },
                { value: 'parent', label: 'Parent' },
                { value: 'student', label: 'Student' }
            ],
            pagination: {
                current_page: parseInt(page, 10),
                total_pages: Math.ceil(users.count / parseInt(limit, 10)),
                total_count: users.count,
                per_page: parseInt(limit, 10)
            }
        });
    } catch (error) {
        next(error);
    }
});

// Super Admin: get access-related audit history for a specific user
router.get('/access-control/users/:userId/history', authMiddleware, requireRole(['super_admin']), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20, include_all = false } = req.query;
        const numericPage = Number(page) > 0 ? Number(page) : 1;
        const numericLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;
        const offset = (numericPage - 1) * numericLimit;
        const includeAll = String(include_all).trim().toLowerCase() === 'true';

        const targetUser = await User.findByPk(userId, {
            attributes: ['id', 'username', 'email', 'role', 'is_active'],
            include: [
                {
                    model: Staff,
                    required: false,
                    attributes: ['id', 'school_id', 'role_level', 'first_name', 'last_name'],
                    include: [
                        {
                            model: School,
                            required: false,
                            attributes: ['id', 'name', 'school_code']
                        }
                    ]
                }
            ]
        });

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userAuditCondition = {
            table_name: 'users',
            record_id: targetUser.id
        };
        const staffAuditCondition = targetUser.Staff
            ? {
                table_name: 'staff',
                record_id: targetUser.Staff.id
            }
            : null;

        const whereClause = {
            [Op.or]: staffAuditCondition
                ? [userAuditCondition, staffAuditCondition]
                : [userAuditCondition]
        };

        if (!includeAll) {
            whereClause.action = {
                [Op.in]: [
                    'user_access_assignment_updated',
                    'staff_role_change',
                    'USER_REGISTERED',
                    'PASSWORD_CHANGED',
                    'USER_ACCOUNT_CREATED_BY_SUPER_ADMIN',
                    'USER_PASSWORD_RESET'
                ]
            };
        }

        const auditTimestampField = resolveModelField(AuditLog, ['createdAt', 'created_at'], 'createdAt');

        const historyRows = await AuditLog.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    required: false,
                    attributes: ['id', 'username', 'email', 'role']
                }
            ],
            attributes: ['id', 'user_id', 'action', 'table_name', 'record_id', 'old_values', 'new_values', auditTimestampField],
            order: [[auditTimestampField, 'DESC']],
            limit: numericLimit,
            offset
        });

        const rows = historyRows.rows.map((row) => {
            const timestamp = resolveAuditTimestampValue(row);
            return {
                id: row.id,
                action: row.action,
                table_name: row.table_name,
                record_id: row.record_id,
                changed_at: timestamp,
                actor: row.User
                    ? {
                        id: row.User.id,
                        username: row.User.username,
                        email: row.User.email,
                        role: row.User.role
                    }
                    : (row.user_id ? { id: row.user_id } : null),
                old_values: row.old_values || null,
                new_values: row.new_values || null,
                summary: formatAuditHistorySummary(row)
            };
        });

        res.json({
            user: {
                id: targetUser.id,
                username: targetUser.username,
                email: targetUser.email,
                role: targetUser.role,
                is_active: targetUser.is_active,
                school_name: targetUser?.Staff?.School?.name || null,
                staff_role_level: targetUser?.Staff?.role_level || null
            },
            history: rows,
            pagination: {
                current_page: numericPage,
                total_pages: Math.ceil(historyRows.count / numericLimit),
                total_count: historyRows.count,
                per_page: numericLimit
            }
        });
    } catch (error) {
        next(error);
    }
});

// Super Admin: update user access assignment
router.patch('/access-control/users/:userId', authMiddleware, requireRole(['super_admin']), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { target_access_role, school_id, is_active } = req.body;
        const requestedUsername = req.body?.username !== undefined
            ? String(req.body.username || '').trim()
            : null;

        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Staff,
                    required: false,
                    attributes: ['id', 'school_id', 'role_level', 'employee_id', 'first_name', 'last_name']
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!target_access_role && typeof is_active !== 'boolean' && requestedUsername === null) {
            return res.status(400).json({
                error: 'Provide at least one mutable field: target_access_role, is_active, or username.'
            });
        }

        if (requestedUsername !== null) {
            if (!USERNAME_PATTERN.test(requestedUsername)) {
                return res.status(400).json({
                    error: 'Username must be 3-50 chars and can only include letters, numbers, dot, underscore, and dash.'
                });
            }

            const duplicateUser = await User.findOne({
                where: {
                    username: requestedUsername,
                    id: { [Op.ne]: user.id }
                },
                attributes: ['id']
            });
            if (duplicateUser) {
                return res.status(409).json({
                    error: 'Username is already in use by another account.'
                });
            }
        }

        const mutation = target_access_role ? ACCESS_ROLE_MUTATION_MAP[target_access_role] : null;
        if (target_access_role && !mutation) {
            return res.status(400).json({
                error: 'Invalid target_access_role.',
                valid_roles: Object.keys(ACCESS_ROLE_MUTATION_MAP)
            });
        }

        let targetSchoolId = school_id || user?.Staff?.school_id || null;
        if (school_id) {
            const school = await School.findByPk(school_id, {
                attributes: ['id', 'name', 'is_active']
            });
            if (!school || !school.is_active) {
                return res.status(400).json({ error: 'Selected school is invalid or inactive.' });
            }
            targetSchoolId = school.id;
        }

        if (mutation?.requires_staff && !user.Staff) {
            return res.status(400).json({
                error: 'This user does not have a linked staff profile. Create/link staff profile first.'
            });
        }

        if (mutation?.requires_school && !targetSchoolId) {
            return res.status(400).json({
                error: 'A school assignment is required for this access role.'
            });
        }

        const beforeState = {
            username: user.username,
            role: user.role,
            is_active: user.is_active,
            staff_role_level: user?.Staff?.role_level || null,
            school_id: user?.Staff?.school_id || null
        };

        const userPatch = {};
        if (requestedUsername !== null && requestedUsername !== user.username) {
            userPatch.username = requestedUsername;
        }
        if (mutation && user.role !== mutation.user_role) {
            userPatch.role = mutation.user_role;
        }
        if (typeof is_active === 'boolean') {
            userPatch.is_active = is_active;
        }

        if (Object.keys(userPatch).length > 0) {
            await user.update(userPatch);
        }

        if (user.Staff) {
            const staffPatch = {};
            if (mutation?.staff_role_level && user.Staff.role_level !== mutation.staff_role_level) {
                staffPatch.role_level = mutation.staff_role_level;
            }

            if (
                mutation?.user_role === 'admin' &&
                target_access_role === 'ministry_admin' &&
                ['principal', 'support'].includes(String(user.Staff.role_level || '').toLowerCase())
            ) {
                staffPatch.role_level = 'department_head';
            }

            if (mutation?.requires_school && targetSchoolId && String(user.Staff.school_id) !== String(targetSchoolId)) {
                staffPatch.school_id = targetSchoolId;
            }

            if (Object.keys(staffPatch).length > 0) {
                await user.Staff.update(staffPatch);
            }
        }

        const refreshedUser = await User.findByPk(userId, {
            attributes: { exclude: ['password_hash'] },
            include: [
                {
                    model: Staff,
                    required: false,
                    attributes: ['id', 'school_id', 'role_level', 'employee_id', 'first_name', 'last_name'],
                    include: [
                        {
                            model: School,
                            required: false,
                            attributes: ['id', 'name', 'school_code']
                        }
                    ]
                }
            ]
        });

        const access = await resolveAccessContextForUser(refreshedUser);

        await AuditLog.create({
            user_id: req.user.id,
            action: 'user_access_assignment_updated',
            table_name: 'users',
            record_id: refreshedUser.id,
            old_values: beforeState,
            new_values: {
                username: refreshedUser.username,
                target_access_role: target_access_role || null,
                role: refreshedUser.role,
                is_active: refreshedUser.is_active,
                staff_role_level: refreshedUser?.Staff?.role_level || null,
                school_id: refreshedUser?.Staff?.school_id || null
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        res.json({
            message: 'User access assignment updated successfully.',
            user: {
                id: refreshedUser.id,
                username: refreshedUser.username,
                email: refreshedUser.email,
                role: refreshedUser.role,
                is_active: refreshedUser.is_active,
                access_role: access?.access_role || null,
                scope: access?.scope || null,
                school_id: access?.school_id || null,
                school_name: refreshedUser?.Staff?.School?.name || null,
                staff_role_level: refreshedUser?.Staff?.role_level || null
            }
        });
    } catch (error) {
        next(error);
    }
});

// BSSEE admissions and placement workflows
router.get('/bssee/overview', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const requestedExamYear = normalizeExamYear(req.query.exam_year);

        const [latestYearRow] = await BsseeApplication.findAll({
            where: { is_active: true, ...(schoolId ? { primary_school_id: schoolId } : {}) },
            attributes: ['exam_year'],
            order: [['exam_year', 'DESC']],
            limit: 1,
            raw: true
        });

        const examYear = requestedExamYear || Number(latestYearRow?.exam_year || new Date().getFullYear());
        const baseWhere = {
            is_active: true,
            exam_year: examYear,
            ...(schoolId ? { primary_school_id: schoolId } : {})
        };

        const queueStatuses = ['submitted', 'under_review', 'placement_pending', 'appeal_pending'];

        const [totalApplications, placedCount, completedCount, rejectedCount, accommodationCount, missingPreferencesCount, scoreCapturedCount, queueRows] = await Promise.all([
            BsseeApplication.count({ where: baseWhere }),
            BsseeApplication.count({ where: { ...baseWhere, status: 'placed' } }),
            BsseeApplication.count({ where: { ...baseWhere, status: 'completed' } }),
            BsseeApplication.count({ where: { ...baseWhere, status: 'rejected' } }),
            BsseeApplication.count({ where: { ...baseWhere, accommodation_required: true } }),
            BsseeApplication.count({ where: { ...baseWhere, preferred_school_1_id: null } }),
            BsseeApplication.count({
                where: {
                    ...baseWhere,
                    exam_score: { [Op.not]: null }
                }
            }),
            BsseeApplication.findAll({
                where: {
                    ...baseWhere,
                    status: { [Op.in]: queueStatuses }
                },
                include: [
                    {
                        model: Student,
                        attributes: ['id', 'student_id', 'first_name', 'last_name'],
                        required: false
                    },
                    {
                        model: School,
                        as: 'primarySchool',
                        attributes: ['id', 'name', 'school_code'],
                        required: false
                    }
                ],
                order: [['submitted_at', 'ASC'], ['created_at', 'ASC']],
                limit: 8
            })
        ]);

        const statusCounts = {};
        await Promise.all(
            BSSEE_STATUSES.map(async (status) => {
                const count = await BsseeApplication.count({ where: { ...baseWhere, status } });
                statusCounts[status] = count;
            })
        );

        const readinessScore = clampScore(
            totalApplications === 0
                ? 100
                : (
                    (placedCount / totalApplications) * 55 +
                    (scoreCapturedCount / totalApplications) * 25 +
                    ((1 - (missingPreferencesCount / totalApplications)) * 20)
                ) * 100 / 100
        );

        res.json({
            generated_at: new Date().toISOString(),
            exam_year: examYear,
            school_id: schoolId || null,
            totals: {
                applications: totalApplications,
                queue: queueStatuses.reduce((sum, key) => sum + Number(statusCounts[key] || 0), 0),
                placed: placedCount,
                completed: completedCount,
                rejected: rejectedCount,
                accommodation_required: accommodationCount,
                missing_preferences: missingPreferencesCount,
                score_captured: scoreCapturedCount
            },
            status_breakdown: statusCounts,
            readiness: {
                score: readinessScore,
                status: resolveScoreStatus(readinessScore)
            },
            queue_preview: queueRows.map((row) => ({
                id: row.id,
                student_name: row?.Student
                    ? `${row.Student.first_name || ''} ${row.Student.last_name || ''}`.trim()
                    : 'Unknown student',
                student_code: row?.Student?.student_id || null,
                primary_school_name: row?.primarySchool?.name || null,
                status: row.status,
                submitted_at: row.submitted_at || row.created_at
            }))
        });
    } catch (error) {
        next(error);
    }
});

router.get('/bssee/applications', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, status, exam_year, school_id } = req.query;
        const numericPage = Number(page) > 0 ? Number(page) : 1;
        const numericLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;
        const offset = (numericPage - 1) * numericLimit;
        const scopedSchoolId = resolveScopedSchoolId(req, school_id || null);
        const normalizedStatus = status ? normalizeBsseeStatus(status, null) : null;
        const normalizedExamYear = exam_year ? normalizeExamYear(exam_year) : null;

        if (status && !normalizedStatus) {
            return res.status(400).json({
                error: 'Invalid status filter.',
                valid_statuses: BSSEE_STATUSES
            });
        }

        if (exam_year && !normalizedExamYear) {
            return res.status(400).json({
                error: 'Invalid exam_year filter. Expected YYYY.'
            });
        }

        const whereClause = {
            is_active: true,
            ...(scopedSchoolId ? { primary_school_id: scopedSchoolId } : {}),
            ...(normalizedStatus ? { status: normalizedStatus } : {}),
            ...(normalizedExamYear ? { exam_year: normalizedExamYear } : {})
        };

        const include = [
            {
                model: Student,
                attributes: ['id', 'student_id', 'first_name', 'last_name', 'grade_level'],
                required: false
            },
            {
                model: School,
                as: 'primarySchool',
                attributes: ['id', 'name', 'school_code', 'school_type'],
                required: false
            },
            {
                model: School,
                as: 'preferredSchool1',
                attributes: ['id', 'name', 'school_code'],
                required: false
            },
            {
                model: School,
                as: 'preferredSchool2',
                attributes: ['id', 'name', 'school_code'],
                required: false
            },
            {
                model: School,
                as: 'preferredSchool3',
                attributes: ['id', 'name', 'school_code'],
                required: false
            },
            {
                model: School,
                as: 'placementSchool',
                attributes: ['id', 'name', 'school_code'],
                required: false
            }
        ];

        if (search && String(search).trim()) {
            const searchTerm = String(search).trim();
            whereClause[Op.or] = [
                { exam_candidate_number: { [Op.iLike]: `%${searchTerm}%` } },
                { notes: { [Op.iLike]: `%${searchTerm}%` } },
                { '$Student.first_name$': { [Op.iLike]: `%${searchTerm}%` } },
                { '$Student.last_name$': { [Op.iLike]: `%${searchTerm}%` } },
                { '$Student.student_id$': { [Op.iLike]: `%${searchTerm}%` } }
            ];
        }

        const rows = await BsseeApplication.findAndCountAll({
            where: whereClause,
            include,
            order: [['exam_year', 'DESC'], ['submitted_at', 'DESC'], ['created_at', 'DESC']],
            limit: numericLimit,
            offset,
            distinct: true
        });

        res.json({
            applications: rows.rows.map(formatBsseeApplication),
            statuses: BSSEE_STATUSES,
            pagination: {
                current_page: numericPage,
                total_pages: Math.ceil(Number(rows.count || 0) / numericLimit),
                total_count: Number(rows.count || 0),
                per_page: numericLimit
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/bssee/applications', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const {
            student_id,
            exam_year,
            exam_candidate_number,
            exam_score,
            english_score,
            math_score,
            preferred_school_1_id,
            preferred_school_2_id,
            preferred_school_3_id,
            accommodation_required,
            deferral_requested,
            citizenship_status,
            notes
        } = req.body || {};

        const normalizedExamYear = normalizeExamYear(exam_year);
        if (!student_id || !normalizedExamYear) {
            return res.status(400).json({
                error: 'student_id and valid exam_year are required.'
            });
        }

        const student = await Student.findByPk(student_id, {
            attributes: ['id', 'student_id', 'first_name', 'last_name', 'school_id', 'is_active']
        });
        if (!student || !student.is_active) {
            return res.status(404).json({ error: 'Student not found or inactive.' });
        }

        const scopedSchoolId = resolveScopedSchoolId(req, null);
        if (scopedSchoolId && String(student.school_id) !== String(scopedSchoolId)) {
            return res.status(403).json({
                error: 'You can only create BSSEE applications for students in your assigned school.'
            });
        }

        const duplicate = await BsseeApplication.findOne({
            where: {
                student_id: student.id,
                exam_year: normalizedExamYear,
                is_active: true
            }
        });
        if (duplicate) {
            return res.status(409).json({
                error: `An active BSSEE application already exists for this student in ${normalizedExamYear}.`
            });
        }

        const preferredIds = [
            preferred_school_1_id || null,
            preferred_school_2_id || null,
            preferred_school_3_id || null
        ].filter(Boolean);

        const uniquePreferredIds = new Set(preferredIds.map((value) => String(value)));
        if (uniquePreferredIds.size !== preferredIds.length) {
            return res.status(400).json({ error: 'Preferred schools must be unique.' });
        }

        if (preferredIds.length > 0) {
            const preferredSchools = await School.findAll({
                where: {
                    id: { [Op.in]: preferredIds },
                    is_active: true
                },
                attributes: ['id', 'name', 'school_type'],
                raw: true
            });
            if (preferredSchools.length !== preferredIds.length) {
                return res.status(400).json({ error: 'One or more preferred schools are invalid.' });
            }
            const nonSecondary = preferredSchools.find((school) => school.school_type !== 'secondary');
            if (nonSecondary) {
                return res.status(400).json({
                    error: `Preferred school "${nonSecondary.name}" is not a secondary school.`
                });
            }
        }

        const created = await BsseeApplication.create({
            student_id: student.id,
            primary_school_id: student.school_id,
            exam_year: normalizedExamYear,
            exam_candidate_number: exam_candidate_number || null,
            exam_score: toNullableNumber(exam_score),
            english_score: toNullableNumber(english_score),
            math_score: toNullableNumber(math_score),
            status: 'submitted',
            preferred_school_1_id: preferred_school_1_id || null,
            preferred_school_2_id: preferred_school_2_id || null,
            preferred_school_3_id: preferred_school_3_id || null,
            accommodation_required: parseBoolean(accommodation_required, false),
            deferral_requested: parseBoolean(deferral_requested, false),
            citizenship_status: ['national', 'resident', 'non_national'].includes(String(citizenship_status || '').toLowerCase())
                ? String(citizenship_status).toLowerCase()
                : 'national',
            notes: notes ? String(notes).trim() : null,
            submitted_by: req.user.id,
            submitted_at: new Date()
        });

        const application = await BsseeApplication.findByPk(created.id, {
            include: [
                { model: Student, attributes: ['id', 'student_id', 'first_name', 'last_name'], required: false },
                { model: School, as: 'primarySchool', attributes: ['id', 'name', 'school_code'], required: false },
                { model: School, as: 'preferredSchool1', attributes: ['id', 'name', 'school_code'], required: false },
                { model: School, as: 'preferredSchool2', attributes: ['id', 'name', 'school_code'], required: false },
                { model: School, as: 'preferredSchool3', attributes: ['id', 'name', 'school_code'], required: false },
                { model: School, as: 'placementSchool', attributes: ['id', 'name', 'school_code'], required: false }
            ]
        });

        await AuditLog.create({
            user_id: req.user.id,
            action: 'bssee_application_created',
            table_name: 'bssee_applications',
            record_id: application.id,
            old_values: null,
            new_values: {
                student_id: application.student_id,
                exam_year: application.exam_year,
                status: application.status
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        res.status(201).json({
            message: 'BSSEE application created successfully.',
            application: formatBsseeApplication(application)
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/bssee/applications/:id', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const application = await BsseeApplication.findByPk(req.params.id, {
            include: [
                { model: Student, attributes: ['id', 'student_id', 'first_name', 'last_name'], required: false },
                { model: School, as: 'primarySchool', attributes: ['id', 'name', 'school_code'], required: false }
            ]
        });

        if (!application || !application.is_active) {
            return res.status(404).json({ error: 'BSSEE application not found.' });
        }

        const scopedSchoolId = resolveScopedSchoolId(req, null);
        if (scopedSchoolId && String(application.primary_school_id) !== String(scopedSchoolId)) {
            return res.status(403).json({
                error: 'You can only update BSSEE applications for your assigned school.'
            });
        }

        const {
            status,
            review_notes,
            notes,
            preferred_school_1_id,
            preferred_school_2_id,
            preferred_school_3_id,
            placement_school_id,
            accommodation_required,
            deferral_requested,
            exam_candidate_number,
            exam_score,
            english_score,
            math_score,
            citizenship_status
        } = req.body || {};

        const updates = {};
        const normalizedStatus = status !== undefined ? normalizeBsseeStatus(status, null) : null;
        if (status !== undefined && !normalizedStatus) {
            return res.status(400).json({
                error: 'Invalid status value.',
                valid_statuses: BSSEE_STATUSES
            });
        }

        if (normalizedStatus) {
            updates.status = normalizedStatus;
        }

        if (review_notes !== undefined) {
            updates.review_notes = review_notes ? String(review_notes).trim() : null;
        }
        if (notes !== undefined) {
            updates.notes = notes ? String(notes).trim() : null;
        }
        if (exam_candidate_number !== undefined) {
            updates.exam_candidate_number = exam_candidate_number ? String(exam_candidate_number).trim() : null;
        }
        if (exam_score !== undefined) {
            updates.exam_score = toNullableNumber(exam_score);
        }
        if (english_score !== undefined) {
            updates.english_score = toNullableNumber(english_score);
        }
        if (math_score !== undefined) {
            updates.math_score = toNullableNumber(math_score);
        }
        if (accommodation_required !== undefined) {
            updates.accommodation_required = parseBoolean(accommodation_required, Boolean(application.accommodation_required));
        }
        if (deferral_requested !== undefined) {
            updates.deferral_requested = parseBoolean(deferral_requested, Boolean(application.deferral_requested));
        }
        if (citizenship_status !== undefined) {
            const normalizedCitizenship = String(citizenship_status || '').trim().toLowerCase();
            if (!['national', 'resident', 'non_national'].includes(normalizedCitizenship)) {
                return res.status(400).json({
                    error: 'Invalid citizenship_status value.'
                });
            }
            updates.citizenship_status = normalizedCitizenship;
        }

        const preferredPayloadProvided = (
            preferred_school_1_id !== undefined ||
            preferred_school_2_id !== undefined ||
            preferred_school_3_id !== undefined
        );
        if (preferredPayloadProvided) {
            const pref1 = preferred_school_1_id !== undefined ? (preferred_school_1_id || null) : application.preferred_school_1_id;
            const pref2 = preferred_school_2_id !== undefined ? (preferred_school_2_id || null) : application.preferred_school_2_id;
            const pref3 = preferred_school_3_id !== undefined ? (preferred_school_3_id || null) : application.preferred_school_3_id;
            const preferredIds = [pref1, pref2, pref3].filter(Boolean);
            const uniquePreferredIds = new Set(preferredIds.map((value) => String(value)));
            if (uniquePreferredIds.size !== preferredIds.length) {
                return res.status(400).json({ error: 'Preferred schools must be unique.' });
            }
            if (preferredIds.length > 0) {
                const preferredSchools = await School.findAll({
                    where: {
                        id: { [Op.in]: preferredIds },
                        is_active: true
                    },
                    attributes: ['id', 'name', 'school_type'],
                    raw: true
                });
                if (preferredSchools.length !== preferredIds.length) {
                    return res.status(400).json({ error: 'One or more preferred schools are invalid.' });
                }
                const nonSecondary = preferredSchools.find((school) => school.school_type !== 'secondary');
                if (nonSecondary) {
                    return res.status(400).json({
                        error: `Preferred school "${nonSecondary.name}" is not a secondary school.`
                    });
                }
            }
            updates.preferred_school_1_id = pref1;
            updates.preferred_school_2_id = pref2;
            updates.preferred_school_3_id = pref3;
        }

        if (placement_school_id !== undefined) {
            const placementSchoolId = placement_school_id || null;
            if (placementSchoolId) {
                const placementSchool = await School.findByPk(placementSchoolId, {
                    attributes: ['id', 'name', 'school_type', 'is_active']
                });
                if (!placementSchool || !placementSchool.is_active || placementSchool.school_type !== 'secondary') {
                    return res.status(400).json({
                        error: 'Placement school must be an active secondary school.'
                    });
                }
            }
            updates.placement_school_id = placementSchoolId;
        }

        const effectiveStatus = updates.status || application.status;
        const effectivePlacement = updates.placement_school_id !== undefined
            ? updates.placement_school_id
            : application.placement_school_id;
        if (effectiveStatus === 'placed' && !effectivePlacement) {
            return res.status(400).json({
                error: 'placement_school_id is required when status is set to placed.'
            });
        }

        const beforeState = {
            status: application.status,
            placement_school_id: application.placement_school_id,
            review_notes: application.review_notes,
            preferred_school_1_id: application.preferred_school_1_id,
            preferred_school_2_id: application.preferred_school_2_id,
            preferred_school_3_id: application.preferred_school_3_id
        };

        if (
            updates.status ||
            updates.review_notes !== undefined ||
            updates.placement_school_id !== undefined
        ) {
            updates.reviewed_by = req.user.id;
            updates.reviewed_at = new Date();
        }

        if (effectiveStatus === 'placed') {
            updates.placed_at = application.placed_at || new Date();
        } else if (updates.status && effectiveStatus !== 'placed') {
            updates.placed_at = null;
        }

        await application.update(updates);

        const refreshed = await BsseeApplication.findByPk(application.id, {
            include: [
                { model: Student, attributes: ['id', 'student_id', 'first_name', 'last_name'], required: false },
                { model: School, as: 'primarySchool', attributes: ['id', 'name', 'school_code'], required: false },
                { model: School, as: 'preferredSchool1', attributes: ['id', 'name', 'school_code'], required: false },
                { model: School, as: 'preferredSchool2', attributes: ['id', 'name', 'school_code'], required: false },
                { model: School, as: 'preferredSchool3', attributes: ['id', 'name', 'school_code'], required: false },
                { model: School, as: 'placementSchool', attributes: ['id', 'name', 'school_code'], required: false }
            ]
        });

        await AuditLog.create({
            user_id: req.user.id,
            action: 'bssee_application_updated',
            table_name: 'bssee_applications',
            record_id: refreshed.id,
            old_values: beforeState,
            new_values: {
                status: refreshed.status,
                placement_school_id: refreshed.placement_school_id,
                review_notes: refreshed.review_notes,
                preferred_school_1_id: refreshed.preferred_school_1_id,
                preferred_school_2_id: refreshed.preferred_school_2_id,
                preferred_school_3_id: refreshed.preferred_school_3_id
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        res.json({
            message: 'BSSEE application updated successfully.',
            application: formatBsseeApplication(refreshed)
        });
    } catch (error) {
        next(error);
    }
});

// Grading policy configuration (global + school overrides)
router.get('/grading-policies', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const requestedSchoolId = req.query.school_id || null;
        const scopedSchoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const schoolType = req.query.school_type || null;

        await ensureDefaultGradingPolicies(req.user?.id || null);
        const payload = await listGradingPolicies({
            schoolId: scopedSchoolId,
            schoolType
        });

        res.json({
            message: 'Grading policies loaded successfully.',
            grade_bands: GRADE_BANDS,
            scoped_school_id: scopedSchoolId || null,
            ...payload
        });
    } catch (error) {
        next(error);
    }
});

router.post('/grading-policies', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const {
            policy_name,
            grade_band,
            school_id,
            school_type,
            continuous_assessment_weight,
            end_term_exam_weight,
            pass_mark,
            notes,
            is_active = true
        } = req.body || {};

        const scopeSchoolId = resolveScopedSchoolId(req, school_id || null);
        const resolvedBand = GRADE_BANDS.includes(String(grade_band || '').trim().toLowerCase())
            ? String(grade_band).trim().toLowerCase()
            : resolveGradeBandFromLevel(null, school_type);

        const normalizedWeights = normalizePolicyWeights(
            continuous_assessment_weight,
            end_term_exam_weight
        );
        const passMarkValue = Number(pass_mark);
        const safePassMark = Number.isFinite(passMarkValue)
            ? Math.max(0, Math.min(100, passMarkValue))
            : 50;

        const existing = await GradingPolicy.findOne({
            where: {
                school_id: scopeSchoolId || null,
                grade_band: resolvedBand,
                is_active: true
            },
            order: [['updated_at', 'DESC']]
        });

        let policy;
        if (existing) {
            policy = await existing.update({
                policy_name: String(policy_name || existing.policy_name || `${resolvedBand} grading policy`).trim(),
                school_type: String(school_type || existing.school_type || '').trim().toLowerCase() || null,
                continuous_assessment_weight: normalizedWeights.continuous_assessment_weight,
                end_term_exam_weight: normalizedWeights.end_term_exam_weight,
                pass_mark: safePassMark,
                notes: notes ?? existing.notes,
                is_active: Boolean(is_active),
                updated_by: req.user.id
            });
        } else {
            policy = await GradingPolicy.create({
                school_id: scopeSchoolId || null,
                policy_name: String(policy_name || `${resolvedBand} grading policy`).trim(),
                grade_band: resolvedBand,
                school_type: String(school_type || '').trim().toLowerCase() || null,
                continuous_assessment_weight: normalizedWeights.continuous_assessment_weight,
                end_term_exam_weight: normalizedWeights.end_term_exam_weight,
                pass_mark: safePassMark,
                notes: notes || null,
                is_active: Boolean(is_active),
                created_by: req.user.id,
                updated_by: req.user.id
            });
        }

        const refreshed = await listGradingPolicies({
            schoolId: scopeSchoolId || null,
            schoolType: school_type || null
        });

        res.status(existing ? 200 : 201).json({
            message: existing
                ? 'Grading policy updated successfully.'
                : 'Grading policy created successfully.',
            policy,
            ...refreshed
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/grading-policies/:policyId', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { policyId } = req.params;
        const policy = await GradingPolicy.findByPk(policyId);
        if (!policy) {
            return res.status(404).json({ error: 'Grading policy not found.' });
        }

        const scopedSchoolId = resolveScopedSchoolId(req, policy.school_id || null);
        if (policy.school_id && scopedSchoolId && String(policy.school_id) !== String(scopedSchoolId)) {
            return res.status(403).json({ error: 'Cannot modify grading policy outside your school scope.' });
        }

        const nextContinuous = req.body?.continuous_assessment_weight ?? policy.continuous_assessment_weight;
        const nextExam = req.body?.end_term_exam_weight ?? policy.end_term_exam_weight;
        const normalizedWeights = normalizePolicyWeights(nextContinuous, nextExam);
        const passMarkValue = Number(req.body?.pass_mark ?? policy.pass_mark);
        const safePassMark = Number.isFinite(passMarkValue)
            ? Math.max(0, Math.min(100, passMarkValue))
            : Number(policy.pass_mark || 50);

        await policy.update({
            policy_name: req.body?.policy_name ?? policy.policy_name,
            school_type: req.body?.school_type !== undefined
                ? (String(req.body.school_type || '').trim().toLowerCase() || null)
                : policy.school_type,
            continuous_assessment_weight: normalizedWeights.continuous_assessment_weight,
            end_term_exam_weight: normalizedWeights.end_term_exam_weight,
            pass_mark: safePassMark,
            notes: req.body?.notes !== undefined ? req.body.notes : policy.notes,
            is_active: req.body?.is_active !== undefined ? Boolean(req.body.is_active) : policy.is_active,
            updated_by: req.user.id
        });

        const refreshed = await listGradingPolicies({
            schoolId: scopedSchoolId || null,
            schoolType: req.body?.school_type || policy.school_type || null
        });

        res.json({
            message: 'Grading policy updated successfully.',
            policy,
            ...refreshed
        });
    } catch (error) {
        next(error);
    }
});

// Get all schools with detailed information
router.get('/schools/directory', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, parish, category, school_id } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = { is_active: true };
        
        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }
        
        if (parish) {
            whereClause.parish = parish;
        }
        
        if (category) {
            whereClause.school_category = category;
        }

        if (school_id) {
            whereClause.id = school_id;
        }

        const schools = await School.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Staff,
                    where: { role_level: 'principal', is_active: true },
                    required: false,
                    attributes: ['first_name', 'last_name', 'phone', 'email']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']]
        });

        res.json({
            schools: schools.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(schools.count / limit),
                total_count: schools.count,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get all staff with role management
router.get('/staff/directory', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, school_id, role_level } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = { is_active: true };
        
        if (search) {
            whereClause[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } },
                { employee_id: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        if (school_id) {
            whereClause.school_id = school_id;
        }
        
        if (role_level) {
            whereClause.role_level = role_level;
        }

        const staff = await Staff.findAndCountAll({
            where: whereClause,
            include: [
                { model: School, attributes: ['name', 'school_code'] },
                { model: User, attributes: ['email', 'role'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['last_name', 'ASC'], ['first_name', 'ASC']]
        });

        res.json({
            staff: staff.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(staff.count / limit),
                total_count: staff.count,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Change staff role
router.patch('/staff/:id/role', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { new_role, reason } = req.body;
        
        const staff = await Staff.findByPk(id);
        if (!staff) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        const oldRole = staff.role_level;
        
        await staff.update({
            previous_role: oldRole,
            role_level: new_role,
            role_change_date: new Date(),
            role_changed_by: req.user.id
        });

        // Create audit log
        await AuditLog.create({
            user_id: req.user.id,
            action: 'staff_role_change',
            table_name: 'staff',
            record_id: staff.id,
            old_values: { role_level: oldRole },
            new_values: { role_level: new_role, reason },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        logger.info(`Staff role changed: ${staff.employee_id} from ${oldRole} to ${new_role} by ${req.user.email}`);

        res.json({
            message: 'Staff role updated successfully',
            staff: await Staff.findByPk(id, {
                include: [
                    { model: School, attributes: ['name'] },
                    { model: User, attributes: ['email'] }
                ]
            })
        });

    } catch (error) {
        next(error);
    }
});

// Get all students for transfer management
router.get('/students/directory', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, school_id, grade } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = { is_active: true };
        
        if (search) {
            whereClause[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } },
                { student_id: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        if (school_id) {
            whereClause.school_id = school_id;
        }
        
        if (grade) {
            whereClause.current_grade = grade;
        }

        const students = await Student.findAndCountAll({
            where: whereClause,
            include: [{ model: School, attributes: ['name', 'school_code', 'parish'] }],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['last_name', 'ASC'], ['first_name', 'ASC']]
        });

        res.json({
            students: students.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(students.count / limit),
                total_count: students.count,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Initiate student transfer
// Supports legacy and current paths to avoid client/backend route drift.
router.post(['/transfers/initiate', '/transfers'], authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const {
            student_id,
            to_school_id,
            transfer_reason,
            academic_year,
            target_grade,
            effective_date,
            admin_notes
        } = req.body;

        const student = await Student.findByPk(student_id, {
            include: [{ model: School, attributes: ['id', 'name'] }]
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const toSchool = await School.findByPk(to_school_id);
        if (!toSchool) {
            return res.status(404).json({ error: 'Target school not found' });
        }

        const transfer = await StudentTransfer.create({
            student_id,
            from_school_id: student.school_id,
            to_school_id,
            initiated_by: req.user.id,
            transfer_reason,
            academic_year,
            current_grade: student.current_grade,
            target_grade,
            effective_date,
            admin_notes,
            status: 'pending'
        });

        // Create audit log
        await AuditLog.create({
            user_id: req.user.id,
            action: 'student_transfer_initiated',
            table_name: 'student_transfers',
            record_id: transfer.id,
            new_values: { 
                student_id, 
                from_school: student.School.name,
                to_school: toSchool.name,
                reason: transfer_reason
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        logger.info(`Student transfer initiated: ${student.student_id} from ${student.School.name} to ${toSchool.name}`);

        res.json({
            message: 'Student transfer initiated successfully',
            transfer: await StudentTransfer.findByPk(transfer.id, {
                include: [
                    { model: Student, attributes: ['student_id', 'first_name', 'last_name'] },
                    { model: School, as: 'FromSchool', attributes: ['name'] },
                    { model: School, as: 'ToSchool', attributes: ['name'] }
                ]
            })
        });

    } catch (error) {
        next(error);
    }
});

// Initiate teacher transfer
// Supports legacy and current paths to avoid client/backend route drift.
router.post(
    ['/transfers/teachers/initiate', '/transfers/teachers', '/teacher-transfers/initiate'],
    authMiddleware,
    requireRole(['super_admin', 'admin']),
    async (req, res, next) => {
    try {
        const {
            teacher_id,
            to_school_id,
            transfer_reason,
            effective_date,
            admin_notes
        } = req.body;

        if (!teacher_id || !to_school_id || !transfer_reason) {
            return res.status(400).json({
                error: 'teacher_id, to_school_id, and transfer_reason are required.'
            });
        }

        const requestedSchoolId = req.body?.school_id || null;
        const scopedSchoolId = resolveScopedSchoolId(req, requestedSchoolId);

        const teacher = await Staff.findByPk(teacher_id, {
            include: [{ model: School, attributes: ['id', 'name'] }]
        });
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found.' });
        }
        if (!teacher.is_active) {
            return res.status(400).json({ error: 'Teacher is inactive and cannot be transferred.' });
        }
        if (scopedSchoolId && String(teacher.school_id) !== String(scopedSchoolId)) {
            return res.status(403).json({
                error: 'This teacher is outside your school scope.'
            });
        }
        if (String(teacher.school_id) === String(to_school_id)) {
            return res.status(400).json({ error: 'Teacher is already assigned to this school.' });
        }

        const toSchool = await School.findByPk(to_school_id, {
            attributes: ['id', 'name']
        });
        if (!toSchool) {
            return res.status(404).json({ error: 'Target school not found.' });
        }

        const openTransfer = await TeacherTransfer.findOne({
            where: {
                teacher_id,
                status: { [Op.in]: ['pending', 'approved'] }
            }
        });
        if (openTransfer) {
            return res.status(409).json({
                error: 'This teacher already has an active transfer request.'
            });
        }

        const transfer = await TeacherTransfer.create({
            teacher_id,
            from_school_id: teacher.school_id,
            to_school_id,
            initiated_by: req.user.id,
            transfer_reason,
            effective_date: effective_date || null,
            admin_notes: admin_notes || null,
            status: 'pending'
        });

        await AuditLog.create({
            user_id: req.user.id,
            action: 'teacher_transfer_initiated',
            table_name: 'teacher_transfers',
            record_id: transfer.id,
            new_values: {
                teacher_id,
                teacher_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.employee_id,
                from_school: teacher?.School?.name || null,
                to_school: toSchool.name,
                reason: transfer_reason
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        res.json({
            message: 'Teacher transfer initiated successfully.',
            transfer: await TeacherTransfer.findByPk(transfer.id, {
                include: [
                    { model: Staff, as: 'Teacher', attributes: ['id', 'employee_id', 'first_name', 'last_name', 'position'] },
                    { model: School, as: 'FromSchool', attributes: ['id', 'name'] },
                    { model: School, as: 'ToSchool', attributes: ['id', 'name'] }
                ]
            })
        });
    } catch (error) {
        next(error);
    }
});

router.get(
    ['/transfers/teachers/workflow', '/transfers/teachers', '/teacher-transfers/workflow'],
    authMiddleware,
    requireRole(['super_admin', 'admin']),
    async (req, res, next) => {
    try {
        const { page = 1, limit = 25, status, priority, teacher_search } = req.query;
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const numericPage = Number(page) > 0 ? Number(page) : 1;
        const numericLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 25;
        const offset = (numericPage - 1) * numericLimit;
        const whereClause = {};

        if (status) {
            whereClause.status = String(status).trim().toLowerCase();
        }
        if (schoolId) {
            whereClause[Op.or] = [
                { from_school_id: schoolId },
                { to_school_id: schoolId }
            ];
        }

        const transferCreatedField = resolveModelField(TeacherTransfer, ['createdAt', 'created_at'], 'createdAt');
        const includeClause = [
            {
                model: Staff,
                as: 'Teacher',
                attributes: ['id', 'employee_id', 'first_name', 'last_name', 'position'],
                where: teacher_search
                    ? {
                        [Op.or]: [
                            { first_name: { [Op.iLike]: `%${teacher_search}%` } },
                            { last_name: { [Op.iLike]: `%${teacher_search}%` } },
                            { employee_id: { [Op.iLike]: `%${teacher_search}%` } }
                        ]
                    }
                    : undefined
            },
            { model: School, as: 'FromSchool', attributes: ['id', 'name', 'school_code'], required: false },
            { model: School, as: 'ToSchool', attributes: ['id', 'name', 'school_code'], required: false }
        ];

        const rows = await TeacherTransfer.findAndCountAll({
            where: whereClause,
            include: includeClause,
            order: [[transferCreatedField, 'DESC']],
            limit: numericLimit,
            offset,
            distinct: true
        });

        const now = Date.now();
        const mappedRows = rows.rows.map((transfer) => {
            const createdAt = transfer[transferCreatedField] || transfer.createdAt || transfer.created_at;
            const createdMs = createdAt ? new Date(createdAt).getTime() : now;
            const ageHours = Math.max(0, (now - createdMs) / (1000 * 60 * 60));
            const isPending = transfer.status === 'pending';
            const isApproved = transfer.status === 'approved';
            const slaHours = isPending ? 72 : isApproved ? 48 : 0;
            const dueAt = slaHours > 0 ? new Date(createdMs + (slaHours * 60 * 60 * 1000)) : null;
            const overdue = Boolean(dueAt && dueAt.getTime() < now);
            const handoverDone = Boolean(transfer.class_handover_completed);
            const documentsDone = Boolean(transfer.documents_verified);

            let stage = 'queue';
            if (transfer.status === 'pending') {
                stage = 'awaiting_approval';
            } else if (transfer.status === 'approved') {
                stage = handoverDone && documentsDone ? 'ready_to_complete' : 'handover';
            } else if (transfer.status === 'completed') {
                stage = 'closed';
            } else if (transfer.status === 'rejected') {
                stage = 'rejected';
            }

            let priorityBand = 'normal';
            if (overdue) {
                priorityBand = 'critical';
            } else if (isPending && ageHours >= 48) {
                priorityBand = 'high';
            } else if (isPending && ageHours >= 24) {
                priorityBand = 'medium';
            }

            return {
                id: transfer.id,
                teacher_id: transfer.teacher_id,
                teacher_name: transfer?.Teacher
                    ? `${transfer.Teacher.first_name || ''} ${transfer.Teacher.last_name || ''}`.trim()
                    : null,
                teacher_code: transfer?.Teacher?.employee_id || null,
                teacher_position: transfer?.Teacher?.position || null,
                from_school_id: transfer.from_school_id,
                from_school_name: transfer?.FromSchool?.name || null,
                to_school_id: transfer.to_school_id,
                to_school_name: transfer?.ToSchool?.name || null,
                transfer_reason: transfer.transfer_reason,
                status: transfer.status,
                stage,
                priority: priorityBand,
                age_hours: Number(ageHours.toFixed(1)),
                sla_due_at: dueAt ? dueAt.toISOString() : null,
                is_overdue: overdue,
                effective_date: transfer.effective_date || null,
                class_handover_completed: handoverDone,
                documents_verified: documentsDone,
                admin_notes: transfer.admin_notes || null,
                initiated_by: transfer.initiated_by || null,
                approved_by: transfer.approved_by || null,
                created_at: createdAt || null,
                updated_at: transfer.updatedAt || transfer.updated_at || null
            };
        });

        const filteredRows = priority
            ? mappedRows.filter((row) => row.priority === String(priority).trim().toLowerCase())
            : mappedRows;

        res.json({
            transfers: filteredRows,
            pagination: {
                current_page: numericPage,
                total_pages: Math.ceil(Number(rows.count || 0) / numericLimit),
                total_count: Number(rows.count || 0),
                per_page: numericLimit
            }
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/transfers/teachers/:transferId/workflow', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const transfer = await TeacherTransfer.findByPk(req.params.transferId);
        if (!transfer) {
            return res.status(404).json({ error: 'Teacher transfer record not found.' });
        }

        const requestedSchoolId = req.body?.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        if (schoolId && ![String(transfer.from_school_id), String(transfer.to_school_id)].includes(String(schoolId))) {
            return res.status(403).json({
                error: 'This transfer is outside your school scope.'
            });
        }

        const action = String(req.body?.action || '').trim().toLowerCase();
        const note = String(req.body?.notes || '').trim();
        if (!action) {
            return res.status(400).json({ error: 'action is required.' });
        }

        const beforeState = {
            status: transfer.status,
            class_handover_completed: transfer.class_handover_completed,
            documents_verified: transfer.documents_verified,
            effective_date: transfer.effective_date,
            admin_notes: transfer.admin_notes
        };

        const updates = {};
        let completionMeta = null;
        if (action === 'start_review') {
            if (transfer.status !== 'pending') {
                return res.status(400).json({ error: 'Only pending transfers can start review.' });
            }
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Review started by ${req.user.email || req.user.username || req.user.id} on ${new Date().toISOString().slice(0, 10)}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'approve') {
            if (transfer.status !== 'pending') {
                return res.status(400).json({ error: 'Only pending transfers can be approved.' });
            }
            updates.status = 'approved';
            updates.approved_by = req.user.id;
            updates.transfer_date = new Date().toISOString().slice(0, 10);
            if (req.body?.effective_date) {
                updates.effective_date = new Date(req.body.effective_date).toISOString().slice(0, 10);
            }
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Approved by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'reject') {
            if (!['pending', 'approved'].includes(transfer.status)) {
                return res.status(400).json({ error: 'Only pending or approved transfers can be rejected.' });
            }
            updates.status = 'rejected';
            updates.approved_by = req.user.id;
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Rejected by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'mark_handover') {
            if (transfer.status !== 'approved') {
                return res.status(400).json({ error: 'Transfer must be approved before handover can be marked.' });
            }
            updates.class_handover_completed = parseBoolean(
                req.body?.class_handover_completed,
                Boolean(transfer.class_handover_completed)
            );
            updates.documents_verified = parseBoolean(
                req.body?.documents_verified,
                Boolean(transfer.documents_verified)
            );
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Handover checklist updated by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'complete') {
            if (transfer.status !== 'approved') {
                return res.status(400).json({ error: 'Only approved transfers can be completed.' });
            }
            const effectiveHandover = parseBoolean(
                req.body?.class_handover_completed,
                Boolean(transfer.class_handover_completed)
            );
            const effectiveDocuments = parseBoolean(
                req.body?.documents_verified,
                Boolean(transfer.documents_verified)
            );
            if (!effectiveHandover || !effectiveDocuments) {
                return res.status(400).json({
                    error: 'Class handover and document verification are required before completion.'
                });
            }

            updates.class_handover_completed = effectiveHandover;
            updates.documents_verified = effectiveDocuments;
            updates.status = 'completed';
            updates.approved_by = req.user.id;
            updates.transfer_date = new Date().toISOString().slice(0, 10);
            if (req.body?.effective_date) {
                updates.effective_date = new Date(req.body.effective_date).toISOString().slice(0, 10);
            }
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Marked completed by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );

            await sequelize.transaction(async (transaction) => {
                await transfer.update(updates, { transaction });
                const [updatedTeachers] = await Staff.update(
                    { school_id: transfer.to_school_id },
                    {
                        where: { id: transfer.teacher_id, is_active: true },
                        transaction
                    }
                );
                const [releasedClasses] = await Class.update(
                    { class_teacher_id: null },
                    {
                        where: {
                            class_teacher_id: transfer.teacher_id,
                            school_id: transfer.from_school_id,
                            is_active: true
                        },
                        transaction
                    }
                );
                completionMeta = {
                    teacher_records_updated: Number(updatedTeachers || 0),
                    source_classes_released: Number(releasedClasses || 0)
                };
            });
        } else if (action === 'reopen') {
            if (transfer.status !== 'rejected') {
                return res.status(400).json({ error: 'Only rejected transfers can be reopened.' });
            }
            updates.status = 'pending';
            updates.approved_by = null;
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Reopened by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else {
            return res.status(400).json({
                error: 'Unsupported workflow action.'
            });
        }

        if (action !== 'complete') {
            await transfer.update(updates);
        }

        await AuditLog.create({
            user_id: req.user.id,
            action: 'teacher_transfer_workflow_updated',
            table_name: 'teacher_transfers',
            record_id: transfer.id,
            old_values: beforeState,
            new_values: {
                action,
                status: transfer.status,
                class_handover_completed: transfer.class_handover_completed,
                documents_verified: transfer.documents_verified,
                effective_date: transfer.effective_date,
                admin_notes: transfer.admin_notes,
                ...(completionMeta || {})
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        res.json({
            message: 'Teacher transfer workflow updated successfully.',
            transfer,
            ...(completionMeta ? { completion: completionMeta } : {})
        });
    } catch (error) {
        next(error);
    }
});

router.get('/transfers/workflow', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 25, status, priority, student_search } = req.query;
        const requestedSchoolId = req.query.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        const numericPage = Number(page) > 0 ? Number(page) : 1;
        const numericLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 25;
        const offset = (numericPage - 1) * numericLimit;
        const whereClause = {};

        if (status) {
            whereClause.status = String(status).trim().toLowerCase();
        }
        if (schoolId) {
            whereClause[Op.or] = [
                { from_school_id: schoolId },
                { to_school_id: schoolId }
            ];
        }

        const transferCreatedField = resolveModelField(StudentTransfer, ['createdAt', 'created_at'], 'createdAt');
        const includeClause = [
            {
                model: Student,
                attributes: ['id', 'student_id', 'first_name', 'last_name'],
                where: student_search
                    ? {
                        [Op.or]: [
                            { first_name: { [Op.iLike]: `%${student_search}%` } },
                            { last_name: { [Op.iLike]: `%${student_search}%` } },
                            { student_id: { [Op.iLike]: `%${student_search}%` } }
                        ]
                    }
                    : undefined
            },
            {
                association: StudentTransfer.associations.FromSchool,
                attributes: ['id', 'name', 'school_code'],
                required: false
            },
            {
                association: StudentTransfer.associations.ToSchool,
                attributes: ['id', 'name', 'school_code'],
                required: false
            }
        ];

        const rows = await StudentTransfer.findAndCountAll({
            where: whereClause,
            include: includeClause,
            order: [[transferCreatedField, 'DESC']],
            limit: numericLimit,
            offset,
            distinct: true
        });

        const now = Date.now();
        const mappedRows = rows.rows.map((transfer) => {
            const createdAt = transfer[transferCreatedField] || transfer.createdAt || transfer.created_at;
            const createdMs = createdAt ? new Date(createdAt).getTime() : now;
            const ageHours = Math.max(0, (now - createdMs) / (1000 * 60 * 60));
            const isPending = transfer.status === 'pending';
            const isApproved = transfer.status === 'approved';
            const slaHours = isPending ? 96 : isApproved ? 72 : 0;
            const dueAt = slaHours > 0 ? new Date(createdMs + (slaHours * 60 * 60 * 1000)) : null;
            const overdue = Boolean(dueAt && dueAt.getTime() < now);

            let stage = 'queue';
            if (transfer.status === 'pending') {
                stage = 'awaiting_approval';
            } else if (transfer.status === 'approved') {
                stage = (transfer.academic_records_transferred && transfer.medical_records_transferred)
                    ? 'ready_to_complete'
                    : 'records_sync';
            } else if (transfer.status === 'completed') {
                stage = 'closed';
            } else if (transfer.status === 'rejected') {
                stage = 'rejected';
            }

            let priorityBand = 'normal';
            if (overdue) {
                priorityBand = 'critical';
            } else if (isPending && ageHours >= 72) {
                priorityBand = 'high';
            } else if (isPending && ageHours >= 36) {
                priorityBand = 'medium';
            }

            return {
                id: transfer.id,
                student_id: transfer.student_id,
                student_name: transfer?.Student
                    ? `${transfer.Student.first_name || ''} ${transfer.Student.last_name || ''}`.trim()
                    : null,
                student_code: transfer?.Student?.student_id || null,
                from_school_id: transfer.from_school_id,
                from_school_name: transfer?.FromSchool?.name || null,
                to_school_id: transfer.to_school_id,
                to_school_name: transfer?.ToSchool?.name || null,
                transfer_reason: transfer.transfer_reason,
                academic_year: transfer.academic_year,
                current_grade: transfer.current_grade,
                target_grade: transfer.target_grade,
                status: transfer.status,
                stage,
                priority: priorityBand,
                age_hours: Number(ageHours.toFixed(1)),
                sla_due_at: dueAt ? dueAt.toISOString() : null,
                is_overdue: overdue,
                effective_date: transfer.effective_date || null,
                parent_consent: Boolean(transfer.parent_consent),
                academic_records_transferred: Boolean(transfer.academic_records_transferred),
                medical_records_transferred: Boolean(transfer.medical_records_transferred),
                admin_notes: transfer.admin_notes || null,
                initiated_by: transfer.initiated_by || null,
                approved_by: transfer.approved_by || null,
                created_at: createdAt || null,
                updated_at: transfer.updatedAt || transfer.updated_at || null
            };
        });

        const filteredRows = priority
            ? mappedRows.filter((row) => row.priority === String(priority).trim().toLowerCase())
            : mappedRows;

        res.json({
            transfers: filteredRows,
            pagination: {
                current_page: numericPage,
                total_pages: Math.ceil(Number(rows.count || 0) / numericLimit),
                total_count: Number(rows.count || 0),
                per_page: numericLimit
            }
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/transfers/:transferId/workflow', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const transfer = await StudentTransfer.findByPk(req.params.transferId);
        if (!transfer) {
            return res.status(404).json({ error: 'Transfer record not found.' });
        }

        const requestedSchoolId = req.body?.school_id || null;
        const schoolId = resolveScopedSchoolId(req, requestedSchoolId);
        if (schoolId && ![String(transfer.from_school_id), String(transfer.to_school_id)].includes(String(schoolId))) {
            return res.status(403).json({
                error: 'This transfer is outside your school scope.'
            });
        }

        const action = String(req.body?.action || '').trim().toLowerCase();
        const note = String(req.body?.notes || '').trim();
        if (!action) {
            return res.status(400).json({ error: 'action is required.' });
        }

        const updates = {};
        if (action === 'start_review') {
            if (transfer.status !== 'pending') {
                return res.status(400).json({ error: 'Only pending transfers can start review.' });
            }
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Review started by ${req.user.email || req.user.username || req.user.id} on ${new Date().toISOString().slice(0, 10)}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'approve') {
            if (transfer.status !== 'pending') {
                return res.status(400).json({ error: 'Only pending transfers can be approved.' });
            }
            updates.status = 'approved';
            updates.approved_by = req.user.id;
            updates.transfer_date = new Date().toISOString().slice(0, 10);
            if (req.body?.effective_date) {
                updates.effective_date = new Date(req.body.effective_date).toISOString().slice(0, 10);
            }
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Approved by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'reject') {
            if (!['pending', 'approved'].includes(transfer.status)) {
                return res.status(400).json({ error: 'Only pending or approved transfers can be rejected.' });
            }
            updates.status = 'rejected';
            updates.approved_by = req.user.id;
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Rejected by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'mark_records_transferred') {
            if (transfer.status !== 'approved') {
                return res.status(400).json({ error: 'Transfer must be approved before records are marked.' });
            }
            updates.academic_records_transferred = parseBoolean(
                req.body?.academic_records_transferred,
                Boolean(transfer.academic_records_transferred)
            );
            updates.medical_records_transferred = parseBoolean(
                req.body?.medical_records_transferred,
                Boolean(transfer.medical_records_transferred)
            );
            updates.parent_consent = parseBoolean(req.body?.parent_consent, Boolean(transfer.parent_consent));
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Records sync updated by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'complete') {
            if (transfer.status !== 'approved') {
                return res.status(400).json({ error: 'Only approved transfers can be completed.' });
            }
            const effectiveAcademic = parseBoolean(
                req.body?.academic_records_transferred,
                Boolean(transfer.academic_records_transferred)
            );
            const effectiveMedical = parseBoolean(
                req.body?.medical_records_transferred,
                Boolean(transfer.medical_records_transferred)
            );
            if (!effectiveAcademic || !effectiveMedical) {
                return res.status(400).json({
                    error: 'Academic and medical records must be transferred before completion.'
                });
            }
            updates.academic_records_transferred = effectiveAcademic;
            updates.medical_records_transferred = effectiveMedical;
            updates.parent_consent = parseBoolean(req.body?.parent_consent, Boolean(transfer.parent_consent));
            updates.status = 'completed';
            updates.transfer_date = new Date().toISOString().slice(0, 10);
            if (req.body?.effective_date) {
                updates.effective_date = new Date(req.body.effective_date).toISOString().slice(0, 10);
            }
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Marked completed by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else if (action === 'reopen') {
            if (!['rejected', 'completed'].includes(transfer.status)) {
                return res.status(400).json({ error: 'Only rejected or completed transfers can be reopened.' });
            }
            updates.status = 'pending';
            updates.approved_by = null;
            updates.admin_notes = appendAdminNotes(
                transfer.admin_notes,
                `Reopened by ${req.user.email || req.user.username || req.user.id}.${note ? ` ${note}` : ''}`
            );
        } else {
            return res.status(400).json({
                error: 'Unsupported workflow action.'
            });
        }

        const beforeState = {
            status: transfer.status,
            parent_consent: transfer.parent_consent,
            academic_records_transferred: transfer.academic_records_transferred,
            medical_records_transferred: transfer.medical_records_transferred,
            effective_date: transfer.effective_date,
            admin_notes: transfer.admin_notes
        };

        await transfer.update(updates);

        await AuditLog.create({
            user_id: req.user.id,
            action: 'student_transfer_workflow_updated',
            table_name: 'student_transfers',
            record_id: transfer.id,
            old_values: beforeState,
            new_values: {
                action,
                status: transfer.status,
                parent_consent: transfer.parent_consent,
                academic_records_transferred: transfer.academic_records_transferred,
                medical_records_transferred: transfer.medical_records_transferred,
                effective_date: transfer.effective_date,
                admin_notes: transfer.admin_notes
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        res.json({
            message: 'Transfer workflow updated successfully.',
            transfer
        });
    } catch (error) {
        next(error);
    }
});

// Get all transfers with status
router.get('/transfers', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, student_search, school_id } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = {};
        if (status) {
            whereClause.status = status;
        }

        if (school_id) {
            whereClause[Op.or] = [
                { from_school_id: school_id },
                { to_school_id: school_id }
            ];
        }

        const includeClause = [
            { 
                model: Student, 
                attributes: ['student_id', 'first_name', 'last_name'],
                where: student_search ? {
                    [Op.or]: [
                        { first_name: { [Op.iLike]: `%${student_search}%` } },
                        { last_name: { [Op.iLike]: `%${student_search}%` } },
                        { student_id: { [Op.iLike]: `%${student_search}%` } }
                    ]
                } : undefined
            },
            {
                association: StudentTransfer.associations.FromSchool,
                attributes: ['name', 'parish']
            },
            {
                association: StudentTransfer.associations.ToSchool,
                attributes: ['name', 'parish']
            }
        ];

        const transfers = await StudentTransfer.findAndCountAll({
            where: whereClause,
            include: includeClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            transfers: transfers.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(transfers.count / limit),
                total_count: transfers.count,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get audit logs
router.get('/audit-logs', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 50,
            action,
            user_id,
            table_name,
            date_from,
            date_to,
            actor_query,
            school_id,
            event_type,
            path_query
        } = req.query;

        const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 500);
        const offset = (parsedPage - 1) * parsedLimit;
        const normalizedActorQuery = String(actor_query || '').trim();
        const normalizedSchoolId = String(school_id || '').trim();
        const normalizedPathQuery = String(path_query || '').trim().toLowerCase();
        const normalizedEventType = String(event_type || '').trim().toLowerCase();
        
        const whereClause = {};
        const andClauses = [];
        
        if (action) {
            whereClause.action = action;
        }
        
        if (user_id) {
            whereClause.user_id = user_id;
        }
        
        if (table_name) {
            whereClause.table_name = table_name;
        }
        
        if (date_from || date_to) {
            whereClause.created_at = {};
            if (date_from) {
                const parsedDateFrom = new Date(date_from);
                if (Number.isNaN(parsedDateFrom.getTime())) {
                    return res.status(400).json({ error: 'Invalid date_from value.' });
                }
                whereClause.created_at[Op.gte] = parsedDateFrom;
            }
            if (date_to) {
                const parsedDateTo = new Date(date_to);
                if (Number.isNaN(parsedDateTo.getTime())) {
                    return res.status(400).json({ error: 'Invalid date_to value.' });
                }
                whereClause.created_at[Op.lte] = parsedDateTo;
            }
        }

        if (normalizedSchoolId) {
            andClauses.push(
                sequelize.where(
                    sequelize.literal(`COALESCE("AuditLog"."new_values"->'audit_context'->>'school_id', '')`),
                    normalizedSchoolId
                )
            );
        }

        if (normalizedPathQuery) {
            andClauses.push(
                sequelize.where(
                    sequelize.literal(`LOWER(COALESCE("AuditLog"."new_values"->'audit_context'->>'path', ''))`),
                    { [Op.like]: `%${normalizedPathQuery}%` }
                )
            );
        }

        if (normalizedEventType === 'read') {
            andClauses.push(
                sequelize.where(
                    sequelize.literal(`UPPER(COALESCE("AuditLog"."new_values"->'audit_context'->>'method', ''))`),
                    'GET'
                )
            );
        } else if (normalizedEventType === 'write') {
            andClauses.push(
                sequelize.where(
                    sequelize.literal(`UPPER(COALESCE("AuditLog"."new_values"->'audit_context'->>'method', ''))`),
                    {
                        [Op.in]: ['POST', 'PUT', 'PATCH', 'DELETE']
                    }
                )
            );
        }

        if (andClauses.length > 0) {
            whereClause[Op.and] = andClauses;
        }

        const userInclude = {
            model: User,
            attributes: ['id', 'username', 'email', 'role'],
            required: Boolean(normalizedActorQuery),
            include: [
                {
                    model: Staff,
                    attributes: ['id', 'school_id'],
                    required: false,
                    include: [
                        {
                            model: School,
                            attributes: ['id', 'name'],
                            required: false
                        }
                    ]
                }
            ]
        };

        if (normalizedActorQuery) {
            userInclude.where = {
                [Op.or]: [
                    { username: { [Op.iLike]: `%${normalizedActorQuery}%` } },
                    { email: { [Op.iLike]: `%${normalizedActorQuery}%` } }
                ]
            };
        }

        const auditLogs = await AuditLog.findAndCountAll({
            where: whereClause,
            include: [userInclude],
            limit: parsedLimit,
            offset: parseInt(offset, 10),
            order: [['created_at', 'DESC']]
        });

        const actorOptionsMap = new Map();
        const schoolOptionsMap = new Map();
        const actionOptionsSet = new Set();

        for (const row of auditLogs.rows) {
            const actor = row?.User || null;
            const context = row?.new_values?.audit_context || {};
            const actorKey = actor?.id ? String(actor.id) : '';
            const actorLabel = actor?.username || actor?.email || null;
            const schoolFromContext = context?.school_id ? String(context.school_id) : '';
            const staffSchool = actor?.Staff?.School || null;
            const schoolIdValue = schoolFromContext || (staffSchool?.id ? String(staffSchool.id) : '');
            const schoolNameValue = staffSchool?.name || null;

            if (actorKey && actorLabel && !actorOptionsMap.has(actorKey)) {
                actorOptionsMap.set(actorKey, {
                    id: actor.id,
                    username: actor.username || null,
                    email: actor.email || null,
                    role: actor.role || null
                });
            }

            if (schoolIdValue && !schoolOptionsMap.has(schoolIdValue)) {
                schoolOptionsMap.set(schoolIdValue, {
                    id: schoolIdValue,
                    name: schoolNameValue
                });
            }

            if (row?.action) {
                actionOptionsSet.add(String(row.action));
            }
        }

        res.json({
            audit_logs: auditLogs.rows,
            pagination: {
                current_page: parsedPage,
                total_pages: Math.ceil(auditLogs.count / parsedLimit),
                total_count: auditLogs.count,
                per_page: parsedLimit
            },
            filters: {
                action_options: Array.from(actionOptionsSet).sort((a, b) => a.localeCompare(b)),
                actor_options: Array.from(actorOptionsMap.values()),
                school_options: Array.from(schoolOptionsMap.values())
            }
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
