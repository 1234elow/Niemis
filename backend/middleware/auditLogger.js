const logger = require('../utils/logger');
const { AuditLog } = require('../models');

/**
 * Enhanced Audit Logging System for NiEMIS
 * Provides comprehensive audit trail for security and compliance
 */

/**
 * Audit Event Types
 */
const AuditEventTypes = {
    // Authentication Events
    AUTH_LOGIN_SUCCESS: 'auth.login.success',
    AUTH_LOGIN_FAILURE: 'auth.login.failure',
    AUTH_LOGOUT: 'auth.logout',
    AUTH_TOKEN_REFRESH: 'auth.token.refresh',
    AUTH_TOKEN_REVOKED: 'auth.token.revoked',
    AUTH_PASSWORD_CHANGE: 'auth.password.change',
    AUTH_PASSWORD_RESET: 'auth.password.reset',
    
    // User Management Events
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_DELETED: 'user.deleted',
    USER_ACTIVATED: 'user.activated',
    USER_DEACTIVATED: 'user.deactivated',
    USER_ROLE_CHANGED: 'user.role.changed',
    
    // Student Data Events
    STUDENT_CREATED: 'student.created',
    STUDENT_UPDATED: 'student.updated',
    STUDENT_DELETED: 'student.deleted',
    STUDENT_PROFILE_VIEWED: 'student.profile.viewed',
    STUDENT_HEALTH_ACCESSED: 'student.health.accessed',
    STUDENT_FAMILY_ACCESSED: 'student.family.accessed',
    STUDENT_GRADES_ACCESSED: 'student.grades.accessed',
    STUDENT_ATTENDANCE_ACCESSED: 'student.attendance.accessed',
    
    // School Management Events
    SCHOOL_CREATED: 'school.created',
    SCHOOL_UPDATED: 'school.updated',
    SCHOOL_DELETED: 'school.deleted',
    SCHOOL_ACCESSED: 'school.accessed',
    
    // Staff Management Events
    STAFF_CREATED: 'staff.created',
    STAFF_UPDATED: 'staff.updated',
    STAFF_DELETED: 'staff.deleted',
    STAFF_EVALUATION_CREATED: 'staff.evaluation.created',
    STAFF_EVALUATION_UPDATED: 'staff.evaluation.updated',
    
    // Attendance Events
    ATTENDANCE_RECORDED: 'attendance.recorded',
    ATTENDANCE_UPDATED: 'attendance.updated',
    ATTENDANCE_DELETED: 'attendance.deleted',
    ATTENDANCE_REPORT_GENERATED: 'attendance.report.generated',
    
    // RFID Events
    RFID_SCAN: 'rfid.scan',
    RFID_DEVICE_REGISTERED: 'rfid.device.registered',
    RFID_DEVICE_UPDATED: 'rfid.device.updated',
    RFID_DEVICE_DELETED: 'rfid.device.deleted',
    
    // Academic Events
    GRADE_CREATED: 'grade.created',
    GRADE_UPDATED: 'grade.updated',
    GRADE_DELETED: 'grade.deleted',
    REPORT_CARD_GENERATED: 'report_card.generated',
    
    // Administrative Events
    ADMIN_SETTINGS_CHANGED: 'admin.settings.changed',
    ADMIN_BACKUP_CREATED: 'admin.backup.created',
    ADMIN_BACKUP_RESTORED: 'admin.backup.restored',
    ADMIN_SYSTEM_MAINTENANCE: 'admin.system.maintenance',
    
    // Security Events
    SECURITY_BREACH_DETECTED: 'security.breach.detected',
    SECURITY_POLICY_VIOLATION: 'security.policy.violation',
    SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspicious.activity',
    SECURITY_UNAUTHORIZED_ACCESS: 'security.unauthorized.access',
    SECURITY_DATA_EXPORT: 'security.data.export',
    SECURITY_BULK_OPERATION: 'security.bulk.operation',
    
    // File Events
    FILE_UPLOADED: 'file.uploaded',
    FILE_DOWNLOADED: 'file.downloaded',
    FILE_DELETED: 'file.deleted',
    FILE_SHARED: 'file.shared',
    
    // Report Events
    REPORT_GENERATED: 'report.generated',
    REPORT_EXPORTED: 'report.exported',
    REPORT_SHARED: 'report.shared',
    
    // System Events
    SYSTEM_STARTUP: 'system.startup',
    SYSTEM_SHUTDOWN: 'system.shutdown',
    SYSTEM_ERROR: 'system.error',
    SYSTEM_MAINTENANCE_MODE: 'system.maintenance.mode'
};

/**
 * Audit Event Severity Levels
 */
const AuditSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Audit Log Entry Structure
 */
class AuditLogEntry {
    constructor(eventType, data = {}) {
        this.eventType = eventType;
        this.timestamp = new Date();
        this.severity = data.severity || AuditSeverity.MEDIUM;
        this.userId = data.userId || null;
        this.userRole = data.userRole || null;
        this.userEmail = data.userEmail || null;
        this.targetId = data.targetId || null;
        this.targetType = data.targetType || null;
        this.schoolId = data.schoolId || null;
        this.ipAddress = data.ipAddress || null;
        this.userAgent = data.userAgent || null;
        this.requestMethod = data.requestMethod || null;
        this.requestUrl = data.requestUrl || null;
        this.requestId = data.requestId || null;
        this.sessionId = data.sessionId || null;
        this.details = data.details || {};
        this.metadata = data.metadata || {};
        this.success = data.success !== false;
        this.errorMessage = data.errorMessage || null;
        this.duration = data.duration || null;
        this.dataChanged = data.dataChanged || null;
        this.oldValues = data.oldValues || null;
        this.newValues = data.newValues || null;
    }
}

/**
 * Audit Logger Class
 */
class AuditLogger {
    constructor() {
        this.enabled = process.env.FEATURE_AUDIT_LOGGING === 'true';
        this.bufferSize = parseInt(process.env.AUDIT_BUFFER_SIZE) || 100;
        this.flushInterval = parseInt(process.env.AUDIT_FLUSH_INTERVAL) || 10000; // 10 seconds
        this.buffer = [];
        this.flushTimer = null;
        this.sensitiveFields = new Set([
            'password', 'password_hash', 'token', 'secret', 'key', 'auth',
            'credit_card', 'ssn', 'national_id', 'medical_history'
        ]);
        
        if (this.enabled) {
            this.startFlushTimer();
        }
    }

    /**
     * Log audit event
     */
    async logEvent(eventType, data = {}) {
        if (!this.enabled) {
            return;
        }

        try {
            const entry = new AuditLogEntry(eventType, data);
            
            // Sanitize sensitive data
            entry.details = this.sanitizeData(entry.details);
            entry.metadata = this.sanitizeData(entry.metadata);
            entry.oldValues = this.sanitizeData(entry.oldValues);
            entry.newValues = this.sanitizeData(entry.newValues);

            // Add to buffer
            this.buffer.push(entry);

            // Log to application logger as well
            logger.info('Audit Event', {
                eventType,
                userId: entry.userId,
                severity: entry.severity,
                success: entry.success,
                ipAddress: entry.ipAddress,
                details: entry.details
            });

            // Flush buffer if it's full
            if (this.buffer.length >= this.bufferSize) {
                await this.flush();
            }

            // For critical events, flush immediately
            if (entry.severity === AuditSeverity.CRITICAL) {
                await this.flush();
            }
        } catch (error) {
            logger.error('Failed to log audit event:', error);
        }
    }

    /**
     * Flush buffer to database
     */
    async flush() {
        if (this.buffer.length === 0) {
            return;
        }

        try {
            const entries = this.buffer.splice(0, this.bufferSize);
            
            // Batch insert to database
            await AuditLog.bulkCreate(entries.map(entry => ({
                event_type: entry.eventType,
                timestamp: entry.timestamp,
                severity: entry.severity,
                user_id: entry.userId,
                user_role: entry.userRole,
                user_email: entry.userEmail,
                target_id: entry.targetId,
                target_type: entry.targetType,
                school_id: entry.schoolId,
                ip_address: entry.ipAddress,
                user_agent: entry.userAgent,
                request_method: entry.requestMethod,
                request_url: entry.requestUrl,
                request_id: entry.requestId,
                session_id: entry.sessionId,
                details: entry.details,
                metadata: entry.metadata,
                success: entry.success,
                error_message: entry.errorMessage,
                duration: entry.duration,
                data_changed: entry.dataChanged,
                old_values: entry.oldValues,
                new_values: entry.newValues
            })));

            logger.debug(`Flushed ${entries.length} audit log entries`);
        } catch (error) {
            logger.error('Failed to flush audit log buffer:', error);
            
            // Put entries back in buffer if flush failed
            this.buffer = [...entries, ...this.buffer];
        }
    }

    /**
     * Sanitize sensitive data
     */
    sanitizeData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sanitized = { ...data };
        
        for (const key in sanitized) {
            if (this.sensitiveFields.has(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof sanitized[key] === 'object') {
                sanitized[key] = this.sanitizeData(sanitized[key]);
            }
        }

        return sanitized;
    }

    /**
     * Start flush timer
     */
    startFlushTimer() {
        this.flushTimer = setInterval(async () => {
            await this.flush();
        }, this.flushInterval);
    }

    /**
     * Stop flush timer
     */
    stopFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        this.stopFlushTimer();
        await this.flush();
    }
}

// Singleton instance
const auditLogger = new AuditLogger();

/**
 * Audit middleware to automatically log HTTP requests
 */
const auditMiddleware = (options = {}) => {
    return async (req, res, next) => {
        if (!auditLogger.enabled) {
            return next();
        }

        const startTime = Date.now();
        const requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
        
        // Store request start time
        req.auditStartTime = startTime;
        req.auditRequestId = requestId;

        // Override res.json to capture response data
        const originalJson = res.json;
        res.json = function(data) {
            res.responseData = data;
            return originalJson.call(this, data);
        };

        // Log request completion
        res.on('finish', async () => {
            const duration = Date.now() - startTime;
            const shouldLog = options.logAll || 
                             res.statusCode >= 400 || 
                             options.logPaths?.some(path => req.path.includes(path));

            if (shouldLog) {
                const eventType = res.statusCode >= 400 ? 
                    AuditEventTypes.SECURITY_UNAUTHORIZED_ACCESS : 
                    'http.request';

                await auditLogger.logEvent(eventType, {
                    userId: req.user?.id,
                    userRole: req.user?.role,
                    userEmail: req.user?.email,
                    schoolId: req.user?.school_id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    requestMethod: req.method,
                    requestUrl: req.originalUrl,
                    requestId,
                    sessionId: req.sessionID,
                    duration,
                    success: res.statusCode < 400,
                    errorMessage: res.statusCode >= 400 ? res.responseData?.error : null,
                    severity: res.statusCode >= 500 ? AuditSeverity.HIGH : 
                             res.statusCode >= 400 ? AuditSeverity.MEDIUM : 
                             AuditSeverity.LOW,
                    details: {
                        statusCode: res.statusCode,
                        requestSize: req.get('Content-Length'),
                        responseSize: res.get('Content-Length'),
                        query: req.query,
                        params: req.params
                    }
                });
            }
        });

        next();
    };
};

/**
 * Student data access audit middleware
 */
const studentDataAuditMiddleware = (req, res, next) => {
    if (!auditLogger.enabled) {
        return next();
    }

    // Override res.json to capture student data access
    const originalJson = res.json;
    res.json = function(data) {
        // Log student data access
        if (data && (data.student || data.students)) {
            const students = data.students || [data.student];
            students.forEach(student => {
                if (student?.id) {
                    auditLogger.logEvent(AuditEventTypes.STUDENT_PROFILE_VIEWED, {
                        userId: req.user?.id,
                        userRole: req.user?.role,
                        userEmail: req.user?.email,
                        schoolId: req.user?.school_id,
                        targetId: student.id,
                        targetType: 'student',
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent'),
                        requestMethod: req.method,
                        requestUrl: req.originalUrl,
                        requestId: req.auditRequestId,
                        severity: AuditSeverity.MEDIUM,
                        details: {
                            studentId: student.id,
                            accessType: 'profile_view',
                            fieldsAccessed: Object.keys(student)
                        }
                    });
                }
            });
        }
        
        return originalJson.call(this, data);
    };

    next();
};

/**
 * Data modification audit middleware
 */
const dataModificationAuditMiddleware = (eventType, targetType) => {
    return async (req, res, next) => {
        if (!auditLogger.enabled) {
            return next();
        }

        const originalJson = res.json;
        res.json = function(data) {
            // Log data modification
            if (res.statusCode >= 200 && res.statusCode < 300) {
                auditLogger.logEvent(eventType, {
                    userId: req.user?.id,
                    userRole: req.user?.role,
                    userEmail: req.user?.email,
                    schoolId: req.user?.school_id,
                    targetId: req.params.id || data?.id,
                    targetType,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    requestMethod: req.method,
                    requestUrl: req.originalUrl,
                    requestId: req.auditRequestId,
                    severity: AuditSeverity.MEDIUM,
                    dataChanged: true,
                    newValues: req.body,
                    details: {
                        operation: req.method,
                        targetId: req.params.id || data?.id,
                        fieldsChanged: Object.keys(req.body || {})
                    }
                });
            }
            
            return originalJson.call(this, data);
        };

        next();
    };
};

/**
 * Security event logging helpers
 */
const securityAudit = {
    logBreach: (details, req) => {
        auditLogger.logEvent(AuditEventTypes.SECURITY_BREACH_DETECTED, {
            userId: req?.user?.id,
            userRole: req?.user?.role,
            schoolId: req?.user?.school_id,
            ipAddress: req?.ip,
            userAgent: req?.get('User-Agent'),
            requestMethod: req?.method,
            requestUrl: req?.originalUrl,
            severity: AuditSeverity.CRITICAL,
            success: false,
            details
        });
    },

    logSuspiciousActivity: (details, req) => {
        auditLogger.logEvent(AuditEventTypes.SECURITY_SUSPICIOUS_ACTIVITY, {
            userId: req?.user?.id,
            userRole: req?.user?.role,
            schoolId: req?.user?.school_id,
            ipAddress: req?.ip,
            userAgent: req?.get('User-Agent'),
            requestMethod: req?.method,
            requestUrl: req?.originalUrl,
            severity: AuditSeverity.HIGH,
            success: false,
            details
        });
    },

    logUnauthorizedAccess: (details, req) => {
        auditLogger.logEvent(AuditEventTypes.SECURITY_UNAUTHORIZED_ACCESS, {
            userId: req?.user?.id,
            userRole: req?.user?.role,
            schoolId: req?.user?.school_id,
            ipAddress: req?.ip,
            userAgent: req?.get('User-Agent'),
            requestMethod: req?.method,
            requestUrl: req?.originalUrl,
            severity: AuditSeverity.HIGH,
            success: false,
            details
        });
    }
};

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    await auditLogger.shutdown();
});

process.on('SIGINT', async () => {
    await auditLogger.shutdown();
});

module.exports = {
    auditLogger,
    auditMiddleware,
    studentDataAuditMiddleware,
    dataModificationAuditMiddleware,
    securityAudit,
    AuditEventTypes,
    AuditSeverity
};