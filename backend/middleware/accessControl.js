const { Op } = require('sequelize');
const {
    Staff,
    Student,
    Parent,
    Class,
    School,
    StudentParentRelationship
} = require('../models');
const logger = require('../utils/logger');
const {
    resolveAccessRoleKey,
    getPermissionsForAccessRole,
    getScopeForAccessRole,
    hasPermission,
    resolveRoutePermission,
    getAccessControlMatrix
} = require('../config/accessControl');

const toIdString = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    return String(value).trim();
};

const isLikelyResourceId = (value) => {
    const token = toIdString(value);
    if (!token) {
        return false;
    }
    if (/^\d+$/.test(token)) {
        return true;
    }
    return /^[0-9a-fA-F-]{8,}$/.test(token);
};

const idsMatch = (left, right) => {
    const a = toIdString(left);
    const b = toIdString(right);
    if (!a || !b) {
        return false;
    }
    return a === b;
};

const findStaffProfileForUser = async (user) => {
    const directMatch = await Staff.findOne({
        where: {
            user_id: user.id,
            is_active: true
        },
        attributes: ['id', 'user_id', 'school_id', 'role_level']
    });

    if (directMatch) {
        return directMatch;
    }

    if (user.role !== 'teacher') {
        return null;
    }

    const fallbackMatch = await Staff.findOne({
        where: {
            is_active: true,
            [Op.or]: [
                { employee_id: user.username },
                { employee_id: { [Op.iLike]: `%${user.username}%` } }
            ]
        },
        attributes: ['id', 'user_id', 'school_id', 'role_level']
    });

    return fallbackMatch;
};

const resolveAccessContextForUser = async (user) => {
    if (!user) {
        return null;
    }

    const context = {
        user_id: user.id,
        user_role: user.role,
        access_role: null,
        scope: null,
        permissions: [],
        school_id: null,
        staff_id: null,
        staff_role_level: null,
        student_id: null,
        parent_id: null,
        child_student_ids: []
    };

    let staffProfile = null;
    let studentProfile = null;
    let parentProfile = null;

    if (user.role === 'admin' || user.role === 'teacher') {
        staffProfile = await findStaffProfileForUser(user);
        if (staffProfile) {
            context.staff_id = staffProfile.id;
            context.school_id = staffProfile.school_id;
            context.staff_role_level = staffProfile.role_level;
        }
    }

    if (user.role === 'student') {
        studentProfile = await Student.findOne({
            where: { user_id: user.id, is_active: true },
            attributes: ['id', 'school_id']
        });
        if (studentProfile) {
            context.student_id = studentProfile.id;
            context.school_id = studentProfile.school_id;
        }
    }

    if (user.role === 'parent') {
        parentProfile = await Parent.findOne({
            where: { user_id: user.id },
            attributes: ['id']
        });

        if (parentProfile) {
            context.parent_id = parentProfile.id;
            const rows = await StudentParentRelationship.findAll({
                where: { parent_id: parentProfile.id },
                attributes: ['student_id']
            });
            context.child_student_ids = rows.map((row) => row.student_id);
        }
    }

    context.access_role = resolveAccessRoleKey({
        userRole: user.role,
        staffRoleLevel: context.staff_role_level
    });
    context.scope = getScopeForAccessRole(context.access_role);
    context.permissions = getPermissionsForAccessRole(context.access_role);

    return context;
};

const attachAccessContext = async (req, res, next) => {
    try {
        if (!req.user) {
            return next();
        }
        if (!req.accessContext) {
            req.accessContext = await resolveAccessContextForUser(req.user);
        }
        return next();
    } catch (error) {
        logger.error('Failed to resolve access context', {
            error: error.message,
            userId: req.user?.id,
            path: req.originalUrl
        });
        return res.status(500).json({
            error: 'Unable to resolve access policy for this request.',
            code: 'ACCESS_CONTEXT_ERROR'
        });
    }
};

const extractFirstPresentValue = (sources = [], options = {}) => {
    const { requireLikelyId = false } = options;
    for (const source of sources) {
        if (source === undefined || source === null) {
            continue;
        }
        const normalized = toIdString(source);
        if (normalized) {
            if (requireLikelyId && !isLikelyResourceId(normalized)) {
                continue;
            }
            return normalized;
        }
    }
    return null;
};

const findPathParamFromUrl = (urlPath, regex) => {
    const match = String(urlPath || '').match(regex);
    if (!match || !match[1]) {
        return null;
    }
    return toIdString(match[1]);
};

const resolveTargetStudentId = (req) => extractFirstPresentValue([
    req.params?.student_id,
    req.params?.studentId,
    req.params?.id,
    req.query?.student_id,
    req.query?.studentId,
    req.body?.student_id,
    req.body?.studentId,
    req.body?.id,
    findPathParamFromUrl(req.path, /^\/students\/([^/]+)/),
    findPathParamFromUrl(req.path, /^\/classes\/[^/]+\/students\/([^/]+)/),
    findPathParamFromUrl(req.path, /^\/([^/]+)\/(attendance|academics|health|family|year-end-status)$/),
    findPathParamFromUrl(req.path, /^\/student-report\/([^/]+)/),
    findPathParamFromUrl(req.path, /^\/([^/]+)$/)
], { requireLikelyId: true });

const resolveTargetSchoolId = (req) => extractFirstPresentValue([
    req.params?.school_id,
    req.params?.schoolId,
    req.query?.school_id,
    req.query?.schoolId,
    req.body?.school_id,
    req.body?.schoolId,
    req.body?.to_school_id,
    req.body?.from_school_id,
    findPathParamFromUrl(req.path, /^\/schools\/([^/]+)/),
    findPathParamFromUrl(req.path, /^\/([0-9a-fA-F-]{8,})$/)
], { requireLikelyId: true });

const resolveTargetClassId = (req) => extractFirstPresentValue([
    req.params?.class_id,
    req.params?.classId,
    req.query?.class_id,
    req.query?.classId,
    req.body?.class_id,
    req.body?.classId,
    findPathParamFromUrl(req.path, /^\/classes\/([^/]+)/),
    findPathParamFromUrl(req.path, /^\/term-report\/([^/]+)/),
    findPathParamFromUrl(req.path, /^\/export\/term-report\/([^/]+)/)
], { requireLikelyId: true });

const buildForbiddenResponse = (req, res, payload) => {
    logger.warn('Access denied by access-control middleware', {
        userId: req.user?.id,
        role: req.user?.role,
        accessRole: req.accessContext?.access_role,
        path: req.originalUrl,
        method: req.method,
        code: payload?.code
    });

    return res.status(403).json(payload);
};

const enforceStudentScope = async (req, res, context) => {
    const targetStudentId = resolveTargetStudentId(req);
    if (!targetStudentId) {
        return true;
    }

    if (context.scope === 'self') {
        if (!idsMatch(targetStudentId, context.student_id)) {
            buildForbiddenResponse(req, res, {
                error: 'Students can only access their own profile and records.',
                code: 'SELF_SCOPE_DENIED'
            });
            return false;
        }
        return true;
    }

    if (context.scope === 'children') {
        const allowed = context.child_student_ids.some((id) => idsMatch(id, targetStudentId));
        if (!allowed) {
            buildForbiddenResponse(req, res, {
                error: 'Parents can only access linked child records.',
                code: 'CHILD_SCOPE_DENIED'
            });
            return false;
        }
        return true;
    }

    if (context.scope === 'school' && context.school_id) {
        const student = await Student.findByPk(targetStudentId, {
            attributes: ['id', 'school_id']
        });

        if (student && !idsMatch(student.school_id, context.school_id)) {
            buildForbiddenResponse(req, res, {
                error: 'This student belongs to another school.',
                code: 'SCHOOL_SCOPE_DENIED'
            });
            return false;
        }
    }

    return true;
};

const enforceSchoolScope = async (req, res, context, groupKey) => {
    if (context.scope !== 'school') {
        return true;
    }

    if (!context.school_id) {
        buildForbiddenResponse(req, res, {
            error: 'Your account is school-scoped but no school assignment is configured.',
            code: 'SCHOOL_SCOPE_UNRESOLVED'
        });
        return false;
    }

    const targetSchoolId = resolveTargetSchoolId(req);
    if (targetSchoolId && !idsMatch(targetSchoolId, context.school_id)) {
        buildForbiddenResponse(req, res, {
            error: 'You can only access records for your assigned school.',
            code: 'SCHOOL_SCOPE_DENIED'
        });
        return false;
    }

    const classId = resolveTargetClassId(req);
    if (classId) {
        const classRow = await Class.findByPk(classId, {
            attributes: ['id', 'school_id', 'class_teacher_id']
        });

        if (classRow && !idsMatch(classRow.school_id, context.school_id)) {
            buildForbiddenResponse(req, res, {
                error: 'This class belongs to another school.',
                code: 'CLASS_SCOPE_DENIED'
            });
            return false;
        }

        if (
            context.access_role === 'teacher' &&
            classRow &&
            context.staff_id &&
            !idsMatch(classRow.class_teacher_id, context.staff_id)
        ) {
            buildForbiddenResponse(req, res, {
                error: 'Teachers can only modify classes assigned to their profile.',
                code: 'CLASS_OWNERSHIP_DENIED'
            });
            return false;
        }
    }

    if (groupKey === 'admin') {
        if (req.path === '/students/directory' || req.path === '/staff/directory') {
            req.query.school_id = context.school_id;
        }

        if (req.path === '/schools/directory') {
            req.query.school_id = context.school_id;
        }
    }

    return true;
};

const requirePermission = (permission) => async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required.',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!req.accessContext) {
            req.accessContext = await resolveAccessContextForUser(req.user);
        }

        const context = req.accessContext;
        if (!hasPermission(context.access_role, permission)) {
            return buildForbiddenResponse(req, res, {
                error: 'Insufficient permissions for this action.',
                code: 'PERMISSION_DENIED',
                required_permission: permission,
                access_role: context.access_role
            });
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

const authorizeRouteGroup = (groupKey) => async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required.',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!req.accessContext) {
            req.accessContext = await resolveAccessContextForUser(req.user);
        }

        const context = req.accessContext;
        const requiredPermission = resolveRoutePermission(groupKey, req.method, req.path);

        if (requiredPermission && !hasPermission(context.access_role, requiredPermission)) {
            return buildForbiddenResponse(req, res, {
                error: 'You do not have permission to perform this action.',
                code: 'PERMISSION_DENIED',
                required_permission: requiredPermission,
                access_role: context.access_role
            });
        }

        const studentScopeAllowed = await enforceStudentScope(req, res, context);
        if (!studentScopeAllowed) {
            return undefined;
        }

        const schoolScopeAllowed = await enforceSchoolScope(req, res, context, groupKey);
        if (!schoolScopeAllowed) {
            return undefined;
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    resolveAccessContextForUser,
    attachAccessContext,
    requirePermission,
    authorizeRouteGroup,
    getAccessControlMatrix
};
