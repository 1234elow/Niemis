const ACCESS_PERMISSIONS = {
    DASHBOARD_VIEW: 'dashboard.view',
    DATA_QUALITY_VIEW: 'data_quality.view',
    DATA_QUALITY_MANAGE: 'data_quality.manage',
    BSSEE_VIEW: 'bssee.view',
    BSSEE_MANAGE: 'bssee.manage',
    SCHOOLS_VIEW: 'schools.view',
    SCHOOLS_CREATE: 'schools.create',
    SCHOOLS_EDIT: 'schools.edit',
    SCHOOLS_DELETE: 'schools.delete',
    SCHOOLS_IMPORT: 'schools.import',
    STUDENTS_VIEW: 'students.view',
    STUDENTS_CREATE: 'students.create',
    STUDENTS_EDIT: 'students.edit',
    STUDENTS_DELETE: 'students.delete',
    STUDENTS_VIEW_SELF: 'students.view.self',
    TEACHERS_VIEW: 'teachers.view',
    TEACHERS_CREATE: 'teachers.create',
    TEACHERS_EDIT: 'teachers.edit',
    TEACHERS_DELETE: 'teachers.delete',
    CLASSES_VIEW: 'classes.view',
    CLASSES_MANAGE: 'classes.manage',
    TIMETABLE_MANAGE: 'timetable.manage',
    ATTENDANCE_VIEW: 'attendance.view',
    ATTENDANCE_MARK: 'attendance.mark',
    ATTENDANCE_VIEW_SELF: 'attendance.view.self',
    FACILITIES_VIEW: 'facilities.view',
    FACILITIES_MANAGE: 'facilities.manage',
    REPORTS_VIEW: 'reports.view',
    REPORTS_EXPORT: 'reports.export',
    REPORTS_FINALIZE: 'reports.finalize',
    REPORTS_VIEW_SELF: 'reports.view.self',
    GRADES_ENTER: 'grades.enter',
    GRADES_FINALIZE: 'grades.finalize',
    TRANSFERS_VIEW: 'transfers.view',
    TRANSFERS_MANAGE: 'transfers.manage',
    USERS_VIEW: 'users.view',
    USERS_MANAGE_ROLES: 'users.manage_roles',
    USERS_MANAGE_ACCOUNTS: 'users.manage_accounts',
    AUDIT_VIEW: 'audit.view',
    RFID_MANAGE: 'rfid.manage',
    SYSTEM_CONFIG: 'system.config',
    ACCESS_MATRIX_VIEW: 'access.matrix.view'
};

const ACCESS_SCOPES = {
    NATIONAL: 'national',
    SCHOOL: 'school',
    SELF: 'self',
    CHILDREN: 'children'
};

const PRINCIPAL_ROLE_LEVELS = new Set(['principal', 'administrator']);
const CLERICAL_ROLE_LEVELS = new Set(['support']);

const ACCESS_ROLE_DEFINITIONS = {
    super_admin: {
        label: 'Super Admin',
        scope: ACCESS_SCOPES.NATIONAL,
        permissions: ['*']
    },
    ministry_admin: {
        label: 'Ministry Admin',
        scope: ACCESS_SCOPES.NATIONAL,
        permissions: [
            ACCESS_PERMISSIONS.DASHBOARD_VIEW,
            ACCESS_PERMISSIONS.DATA_QUALITY_VIEW,
            ACCESS_PERMISSIONS.DATA_QUALITY_MANAGE,
            ACCESS_PERMISSIONS.BSSEE_VIEW,
            ACCESS_PERMISSIONS.BSSEE_MANAGE,
            ACCESS_PERMISSIONS.SCHOOLS_VIEW,
            ACCESS_PERMISSIONS.SCHOOLS_CREATE,
            ACCESS_PERMISSIONS.SCHOOLS_EDIT,
            ACCESS_PERMISSIONS.SCHOOLS_IMPORT,
            ACCESS_PERMISSIONS.STUDENTS_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_CREATE,
            ACCESS_PERMISSIONS.STUDENTS_EDIT,
            ACCESS_PERMISSIONS.STUDENTS_DELETE,
            ACCESS_PERMISSIONS.TEACHERS_VIEW,
            ACCESS_PERMISSIONS.TEACHERS_CREATE,
            ACCESS_PERMISSIONS.TEACHERS_EDIT,
            ACCESS_PERMISSIONS.TEACHERS_DELETE,
            ACCESS_PERMISSIONS.ATTENDANCE_VIEW,
            ACCESS_PERMISSIONS.ATTENDANCE_MARK,
            ACCESS_PERMISSIONS.FACILITIES_VIEW,
            ACCESS_PERMISSIONS.FACILITIES_MANAGE,
            ACCESS_PERMISSIONS.REPORTS_VIEW,
            ACCESS_PERMISSIONS.REPORTS_EXPORT,
            ACCESS_PERMISSIONS.REPORTS_FINALIZE,
            ACCESS_PERMISSIONS.GRADES_FINALIZE,
            ACCESS_PERMISSIONS.TRANSFERS_VIEW,
            ACCESS_PERMISSIONS.TRANSFERS_MANAGE,
            ACCESS_PERMISSIONS.USERS_VIEW,
            ACCESS_PERMISSIONS.USERS_MANAGE_ACCOUNTS,
            ACCESS_PERMISSIONS.AUDIT_VIEW,
            ACCESS_PERMISSIONS.RFID_MANAGE,
            ACCESS_PERMISSIONS.ACCESS_MATRIX_VIEW
        ]
    },
    school_admin: {
        label: 'School Admin',
        scope: ACCESS_SCOPES.SCHOOL,
        permissions: [
            ACCESS_PERMISSIONS.DASHBOARD_VIEW,
            ACCESS_PERMISSIONS.DATA_QUALITY_VIEW,
            ACCESS_PERMISSIONS.DATA_QUALITY_MANAGE,
            ACCESS_PERMISSIONS.BSSEE_VIEW,
            ACCESS_PERMISSIONS.BSSEE_MANAGE,
            ACCESS_PERMISSIONS.SCHOOLS_VIEW,
            ACCESS_PERMISSIONS.SCHOOLS_EDIT,
            ACCESS_PERMISSIONS.STUDENTS_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_CREATE,
            ACCESS_PERMISSIONS.STUDENTS_EDIT,
            ACCESS_PERMISSIONS.STUDENTS_DELETE,
            ACCESS_PERMISSIONS.TEACHERS_VIEW,
            ACCESS_PERMISSIONS.TEACHERS_EDIT,
            ACCESS_PERMISSIONS.CLASSES_VIEW,
            ACCESS_PERMISSIONS.CLASSES_MANAGE,
            ACCESS_PERMISSIONS.TIMETABLE_MANAGE,
            ACCESS_PERMISSIONS.ATTENDANCE_VIEW,
            ACCESS_PERMISSIONS.ATTENDANCE_MARK,
            ACCESS_PERMISSIONS.FACILITIES_VIEW,
            ACCESS_PERMISSIONS.FACILITIES_MANAGE,
            ACCESS_PERMISSIONS.REPORTS_VIEW,
            ACCESS_PERMISSIONS.REPORTS_EXPORT,
            ACCESS_PERMISSIONS.REPORTS_FINALIZE,
            ACCESS_PERMISSIONS.GRADES_FINALIZE,
            ACCESS_PERMISSIONS.TRANSFERS_VIEW,
            ACCESS_PERMISSIONS.TRANSFERS_MANAGE,
            ACCESS_PERMISSIONS.USERS_VIEW
        ]
    },
    data_clerk: {
        label: 'Registrar / Data Clerk',
        scope: ACCESS_SCOPES.SCHOOL,
        permissions: [
            ACCESS_PERMISSIONS.DASHBOARD_VIEW,
            ACCESS_PERMISSIONS.BSSEE_VIEW,
            ACCESS_PERMISSIONS.BSSEE_MANAGE,
            ACCESS_PERMISSIONS.SCHOOLS_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_CREATE,
            ACCESS_PERMISSIONS.STUDENTS_EDIT,
            ACCESS_PERMISSIONS.ATTENDANCE_VIEW,
            ACCESS_PERMISSIONS.REPORTS_VIEW,
            ACCESS_PERMISSIONS.TRANSFERS_VIEW,
            ACCESS_PERMISSIONS.TRANSFERS_MANAGE
        ]
    },
    teacher: {
        label: 'Teacher',
        scope: ACCESS_SCOPES.SCHOOL,
        permissions: [
            ACCESS_PERMISSIONS.DASHBOARD_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_VIEW,
            ACCESS_PERMISSIONS.CLASSES_VIEW,
            ACCESS_PERMISSIONS.CLASSES_MANAGE,
            ACCESS_PERMISSIONS.TIMETABLE_MANAGE,
            ACCESS_PERMISSIONS.ATTENDANCE_VIEW,
            ACCESS_PERMISSIONS.ATTENDANCE_MARK,
            ACCESS_PERMISSIONS.GRADES_ENTER,
            ACCESS_PERMISSIONS.REPORTS_VIEW,
            ACCESS_PERMISSIONS.REPORTS_EXPORT
        ]
    },
    parent: {
        label: 'Parent',
        scope: ACCESS_SCOPES.CHILDREN,
        permissions: [
            ACCESS_PERMISSIONS.DASHBOARD_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_VIEW_SELF,
            ACCESS_PERMISSIONS.ATTENDANCE_VIEW,
            ACCESS_PERMISSIONS.ATTENDANCE_VIEW_SELF,
            ACCESS_PERMISSIONS.REPORTS_VIEW,
            ACCESS_PERMISSIONS.REPORTS_VIEW_SELF
        ]
    },
    student: {
        label: 'Student',
        scope: ACCESS_SCOPES.SELF,
        permissions: [
            ACCESS_PERMISSIONS.DASHBOARD_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_VIEW,
            ACCESS_PERMISSIONS.STUDENTS_VIEW_SELF,
            ACCESS_PERMISSIONS.ATTENDANCE_VIEW,
            ACCESS_PERMISSIONS.ATTENDANCE_VIEW_SELF,
            ACCESS_PERMISSIONS.REPORTS_VIEW,
            ACCESS_PERMISSIONS.REPORTS_VIEW_SELF
        ]
    }
};

const normalizeRoleLevel = (value) => String(value || '').trim().toLowerCase();

const resolveAccessRoleKey = ({ userRole, staffRoleLevel = null }) => {
    const normalizedRole = String(userRole || '').trim().toLowerCase();
    if (normalizedRole === 'super_admin') {
        return 'super_admin';
    }
    if (normalizedRole === 'admin') {
        const normalizedRoleLevel = normalizeRoleLevel(staffRoleLevel);
        if (PRINCIPAL_ROLE_LEVELS.has(normalizedRoleLevel)) {
            return 'school_admin';
        }
        if (CLERICAL_ROLE_LEVELS.has(normalizedRoleLevel)) {
            return 'data_clerk';
        }
        return 'ministry_admin';
    }
    if (normalizedRole === 'teacher') {
        return 'teacher';
    }
    if (normalizedRole === 'parent') {
        return 'parent';
    }
    return 'student';
};

const permissionMatches = (grantedPermission, requestedPermission) => {
    if (grantedPermission === '*') {
        return true;
    }
    if (grantedPermission === requestedPermission) {
        return true;
    }
    if (grantedPermission.endsWith('.*')) {
        const prefix = grantedPermission.slice(0, -1);
        return requestedPermission.startsWith(prefix);
    }
    return false;
};

const getPermissionsForAccessRole = (accessRoleKey) => {
    const definition = ACCESS_ROLE_DEFINITIONS[accessRoleKey] || ACCESS_ROLE_DEFINITIONS.student;
    return definition.permissions.slice();
};

const getScopeForAccessRole = (accessRoleKey) => {
    const definition = ACCESS_ROLE_DEFINITIONS[accessRoleKey] || ACCESS_ROLE_DEFINITIONS.student;
    return definition.scope;
};

const hasPermission = (accessRoleKey, permission) => {
    if (!permission) {
        return true;
    }
    const grantedPermissions = getPermissionsForAccessRole(accessRoleKey);
    return grantedPermissions.some((granted) => permissionMatches(granted, permission));
};

const ACCESS_ROUTE_RULES = {
    admin: [
        { methods: ['GET'], pattern: /^\/dashboard$/, permission: ACCESS_PERMISSIONS.DASHBOARD_VIEW },
        { methods: ['POST'], pattern: /^\/readiness\/report\/pdf$/, permission: ACCESS_PERMISSIONS.REPORTS_EXPORT },
        { methods: ['GET'], pattern: /^\/zones\/performance$/, permission: ACCESS_PERMISSIONS.DASHBOARD_VIEW },
        { methods: ['GET'], pattern: /^\/data-quality$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_VIEW },
        { methods: ['GET'], pattern: /^\/data-quality\/issues$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_VIEW },
        { methods: ['GET'], pattern: /^\/data-quality\/assignable-users$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_MANAGE },
        { methods: ['PATCH'], pattern: /^\/data-quality\/issues\/[^/]+$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_MANAGE },
        { methods: ['POST'], pattern: /^\/data-quality\/fix$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_MANAGE },
        { methods: ['GET'], pattern: /^\/data-quality\/release-gate$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_VIEW },
        { methods: ['GET'], pattern: /^\/data-quality\/playbooks$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_VIEW },
        { methods: ['GET'], pattern: /^\/data-quality\/playbooks\/[^/]+\/preview$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_VIEW },
        { methods: ['POST'], pattern: /^\/data-quality\/playbooks\/[^/]+\/apply$/, permission: ACCESS_PERMISSIONS.DATA_QUALITY_MANAGE },
        { methods: ['GET'], pattern: /^\/rollover\/preview$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['POST'], pattern: /^\/rollover\/execute$/, permission: ACCESS_PERMISSIONS.REPORTS_FINALIZE },
        { methods: ['GET'], pattern: /^\/bssee\/overview$/, permission: ACCESS_PERMISSIONS.BSSEE_VIEW },
        { methods: ['GET'], pattern: /^\/bssee\/applications$/, permission: ACCESS_PERMISSIONS.BSSEE_VIEW },
        { methods: ['POST'], pattern: /^\/bssee\/applications$/, permission: ACCESS_PERMISSIONS.BSSEE_MANAGE },
        { methods: ['PATCH'], pattern: /^\/bssee\/applications\/[^/]+$/, permission: ACCESS_PERMISSIONS.BSSEE_MANAGE },
        { methods: ['GET'], pattern: /^\/transfers\/workflow$/, permission: ACCESS_PERMISSIONS.TRANSFERS_VIEW },
        { methods: ['GET'], pattern: /^\/transfers\/teachers\/workflow$/, permission: ACCESS_PERMISSIONS.TRANSFERS_VIEW },
        { methods: ['PATCH'], pattern: /^\/transfers\/[^/]+\/workflow$/, permission: ACCESS_PERMISSIONS.TRANSFERS_MANAGE },
        { methods: ['PATCH'], pattern: /^\/transfers\/teachers\/[^/]+\/workflow$/, permission: ACCESS_PERMISSIONS.TRANSFERS_MANAGE },
        { methods: ['GET'], pattern: /^\/audit-logs$/, permission: ACCESS_PERMISSIONS.AUDIT_VIEW },
        { methods: ['PATCH'], pattern: /^\/staff\/[^/]+\/role$/, permission: ACCESS_PERMISSIONS.USERS_MANAGE_ROLES },
        { methods: ['GET'], pattern: /^\/staff\/directory$/, permission: ACCESS_PERMISSIONS.USERS_VIEW },
        { methods: ['GET'], pattern: /^\/students\/directory$/, permission: ACCESS_PERMISSIONS.STUDENTS_VIEW },
        { methods: ['GET'], pattern: /^\/schools\/directory$/, permission: ACCESS_PERMISSIONS.SCHOOLS_VIEW },
        { methods: ['POST'], pattern: /^\/transfers\/initiate$/, permission: ACCESS_PERMISSIONS.TRANSFERS_MANAGE },
        { methods: ['POST'], pattern: /^\/transfers\/teachers\/initiate$/, permission: ACCESS_PERMISSIONS.TRANSFERS_MANAGE },
        { methods: ['GET'], pattern: /^\/transfers$/, permission: ACCESS_PERMISSIONS.TRANSFERS_VIEW },
        { methods: ['GET'], pattern: /^\/access-control\/matrix$/, permission: ACCESS_PERMISSIONS.ACCESS_MATRIX_VIEW },
        { methods: ['GET'], pattern: /^\/access-control\/my-access$/, permission: ACCESS_PERMISSIONS.USERS_VIEW },
        { methods: ['GET'], pattern: /^\/access-control\/users$/, permission: ACCESS_PERMISSIONS.USERS_VIEW },
        { methods: ['GET'], pattern: /^\/access-control\/users\/[^/]+\/history$/, permission: ACCESS_PERMISSIONS.AUDIT_VIEW },
        { methods: ['PATCH'], pattern: /^\/access-control\/users\/[^/]+$/, permission: ACCESS_PERMISSIONS.USERS_MANAGE_ROLES }
    ],
    schools: [
        { methods: ['GET'], pattern: /.*/, permission: ACCESS_PERMISSIONS.SCHOOLS_VIEW },
        { methods: ['POST'], pattern: /^\/import-barbados$/, permission: ACCESS_PERMISSIONS.SCHOOLS_IMPORT },
        { methods: ['POST'], pattern: /.*/, permission: ACCESS_PERMISSIONS.SCHOOLS_CREATE },
        { methods: ['PUT', 'PATCH'], pattern: /.*/, permission: ACCESS_PERMISSIONS.SCHOOLS_EDIT },
        { methods: ['DELETE'], pattern: /.*/, permission: ACCESS_PERMISSIONS.SCHOOLS_DELETE }
    ],
    students: [
        { methods: ['GET'], pattern: /^\/profile$/, permission: ACCESS_PERMISSIONS.STUDENTS_VIEW_SELF },
        { methods: ['GET'], pattern: /.*/, permission: ACCESS_PERMISSIONS.STUDENTS_VIEW },
        { methods: ['POST'], pattern: /.*/, permission: ACCESS_PERMISSIONS.STUDENTS_CREATE },
        { methods: ['PUT', 'PATCH'], pattern: /.*/, permission: ACCESS_PERMISSIONS.STUDENTS_EDIT },
        { methods: ['DELETE'], pattern: /.*/, permission: ACCESS_PERMISSIONS.STUDENTS_DELETE }
    ],
    teachers: [
        { methods: ['GET'], pattern: /^\/profile$/, permission: ACCESS_PERMISSIONS.CLASSES_VIEW },
        { methods: ['GET'], pattern: /^\/class-options$/, permission: ACCESS_PERMISSIONS.CLASSES_VIEW },
        { methods: ['PATCH'], pattern: /^\/class-options\/day-policy$/, permission: ACCESS_PERMISSIONS.TIMETABLE_MANAGE },
        { methods: ['GET'], pattern: /^\/classes$/, permission: ACCESS_PERMISSIONS.CLASSES_VIEW },
        { methods: ['POST'], pattern: /^\/classes$/, permission: ACCESS_PERMISSIONS.CLASSES_MANAGE },
        { methods: ['DELETE'], pattern: /^\/classes\/[^/]+$/, permission: ACCESS_PERMISSIONS.CLASSES_MANAGE },
        { methods: ['GET', 'POST', 'PATCH', 'DELETE'], pattern: /^\/classes\/[^/]+\/timetable/, permission: ACCESS_PERMISSIONS.TIMETABLE_MANAGE },
        { methods: ['GET'], pattern: /^\/classes\/[^/]+\/students$/, permission: ACCESS_PERMISSIONS.STUDENTS_VIEW },
        { methods: ['POST'], pattern: /^\/classes\/[^/]+\/attendance$/, permission: ACCESS_PERMISSIONS.ATTENDANCE_MARK },
        { methods: ['GET'], pattern: /^\/grade-queue$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['GET'], pattern: /^\/grade-analytics$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['GET'], pattern: /^\/grading-policy$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['GET'], pattern: /^\/comment-bank$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['POST'], pattern: /^\/comment-bank$/, permission: ACCESS_PERMISSIONS.CLASSES_MANAGE },
        { methods: ['DELETE'], pattern: /^\/comment-bank\/[^/]+$/, permission: ACCESS_PERMISSIONS.CLASSES_MANAGE },
        { methods: ['GET'], pattern: /^\/cover-requests$/, permission: ACCESS_PERMISSIONS.CLASSES_VIEW },
        { methods: ['POST'], pattern: /^\/cover-requests$/, permission: ACCESS_PERMISSIONS.CLASSES_MANAGE },
        { methods: ['PATCH'], pattern: /^\/cover-requests\/[^/]+$/, permission: ACCESS_PERMISSIONS.CLASSES_MANAGE },
        { methods: ['GET'], pattern: /^\/activity-timeline$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['POST'], pattern: /^\/classes\/[^/]+\/grades$/, permission: ACCESS_PERMISSIONS.GRADES_ENTER },
        { methods: ['GET'], pattern: /^\/classes\/[^/]+\/grades$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['GET'], pattern: /^\/classes\/[^/]+\/students\/[^/]+\/grades$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['GET'], pattern: /.*/, permission: ACCESS_PERMISSIONS.TEACHERS_VIEW },
        { methods: ['POST'], pattern: /.*/, permission: ACCESS_PERMISSIONS.TEACHERS_CREATE },
        { methods: ['PUT', 'PATCH'], pattern: /.*/, permission: ACCESS_PERMISSIONS.TEACHERS_EDIT },
        { methods: ['DELETE'], pattern: /.*/, permission: ACCESS_PERMISSIONS.TEACHERS_DELETE }
    ],
    attendance: [
        { methods: ['GET'], pattern: /.*/, permission: ACCESS_PERMISSIONS.ATTENDANCE_VIEW },
        { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: /.*/, permission: ACCESS_PERMISSIONS.ATTENDANCE_MARK }
    ],
    facilities: [
        { methods: ['GET'], pattern: /.*/, permission: ACCESS_PERMISSIONS.FACILITIES_VIEW },
        { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: /.*/, permission: ACCESS_PERMISSIONS.FACILITIES_MANAGE }
    ],
    reports: [
        { methods: ['GET'], pattern: /^\/csv-template$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['GET'], pattern: /^\/export\//, permission: ACCESS_PERMISSIONS.REPORTS_EXPORT },
        { methods: ['POST'], pattern: /^\/import-grades$/, permission: ACCESS_PERMISSIONS.GRADES_ENTER },
        { methods: ['POST'], pattern: /^\/bulk-year-end-status$/, permission: ACCESS_PERMISSIONS.REPORTS_FINALIZE },
        { methods: ['GET'], pattern: /^\/student-report\/[^/]+\/[^/]+$/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['GET'], pattern: /.*/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: /.*/, permission: ACCESS_PERMISSIONS.REPORTS_FINALIZE }
    ],
    rfid: [
        { methods: ['POST'], pattern: /^\/scan$/, permission: ACCESS_PERMISSIONS.ATTENDANCE_MARK },
        { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: /.*/, permission: ACCESS_PERMISSIONS.RFID_MANAGE },
        { methods: ['GET'], pattern: /.*/, permission: ACCESS_PERMISSIONS.RFID_MANAGE }
    ],
    grading: [
        { methods: ['GET'], pattern: /.*/, permission: ACCESS_PERMISSIONS.REPORTS_VIEW },
        { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: /.*/, permission: ACCESS_PERMISSIONS.GRADES_ENTER }
    ]
};

const resolveRoutePermission = (groupKey, method, path) => {
    const rules = ACCESS_ROUTE_RULES[groupKey] || [];
    const normalizedMethod = String(method || '').toUpperCase();
    const normalizedPath = String(path || '/');

    for (const rule of rules) {
        if (!rule.methods.includes(normalizedMethod)) {
            continue;
        }
        if (rule.pattern.test(normalizedPath)) {
            return rule.permission;
        }
    }
    return null;
};

const getAccessControlMatrix = () => ({
    generated_at: new Date().toISOString(),
    permissions: ACCESS_PERMISSIONS,
    scopes: ACCESS_SCOPES,
    roles: Object.entries(ACCESS_ROLE_DEFINITIONS).map(([key, definition]) => ({
        key,
        label: definition.label,
        scope: definition.scope,
        permissions: definition.permissions
    }))
});

module.exports = {
    ACCESS_PERMISSIONS,
    ACCESS_SCOPES,
    ACCESS_ROLE_DEFINITIONS,
    resolveAccessRoleKey,
    getPermissionsForAccessRole,
    getScopeForAccessRole,
    hasPermission,
    resolveRoutePermission,
    getAccessControlMatrix
};
