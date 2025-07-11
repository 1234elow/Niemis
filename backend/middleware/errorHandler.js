const logger = require('../utils/logger');

// Error classification
const classifyError = (error) => {
    // Database errors
    if (error.name?.includes('Sequelize')) {
        return 'database';
    }
    
    // Authentication errors
    if (error.name?.includes('JsonWebToken') || error.name?.includes('TokenExpired')) {
        return 'authentication';
    }
    
    // Validation errors
    if (error.name?.includes('Validation') || error.statusCode === 400) {
        return 'validation';
    }
    
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return 'network';
    }
    
    // File system errors
    if (error.code?.startsWith('E') && error.syscall) {
        return 'filesystem';
    }
    
    // Permission errors
    if (error.statusCode === 403) {
        return 'permission';
    }
    
    // Rate limiting errors
    if (error.statusCode === 429) {
        return 'ratelimit';
    }
    
    return 'application';
};

// Enhanced error handler
const errorHandler = (err, req, res, next) => {
    const errorType = classifyError(err);
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Log error with context
    logger.logError(err, {
        errorId,
        errorType,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        userRole: req.user?.role,
        body: req.body,
        params: req.params,
        query: req.query
    });

    // Sequelize validation errors
    if (err.name === 'SequelizeValidationError') {
        const errors = err.errors.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value
        }));
        
        logger.logSecurity('validation_error', {
            errorId,
            validationErrors: errors,
            attemptedData: req.body
        }, req);
        
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors,
            errorId
        });
    }

    // Sequelize unique constraint errors
    if (err.name === 'SequelizeUniqueConstraintError') {
        const field = err.errors[0]?.path;
        const value = err.errors[0]?.value;
        
        logger.logSecurity('unique_constraint_violation', {
            errorId,
            field,
            value,
            attemptedData: req.body
        }, req);
        
        return res.status(409).json({
            error: 'Resource already exists',
            code: 'DUPLICATE_RESOURCE',
            field,
            errorId
        });
    }

    // Database connection errors
    if (err.name === 'SequelizeConnectionError') {
        logger.logDatabase('connection_error', {
            errorId,
            error: err.message,
            connectionDetails: err.parent?.code
        });
        
        return res.status(503).json({
            error: 'Database connection failed',
            code: 'DATABASE_CONNECTION_ERROR',
            errorId
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        logger.logSecurity('invalid_token', {
            errorId,
            token: req.headers.authorization?.substring(0, 20) + '...',
            reason: err.message
        }, req);
        
        return res.status(401).json({
            error: 'Invalid token',
            code: 'INVALID_TOKEN',
            errorId
        });
    }

    if (err.name === 'TokenExpiredError') {
        logger.logAuth('token_expired', {
            errorId,
            expiredAt: err.expiredAt
        }, req);
        
        return res.status(401).json({
            error: 'Token expired',
            code: 'TOKEN_EXPIRED',
            errorId
        });
    }

    // File upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        logger.logSecurity('file_upload_size_exceeded', {
            errorId,
            limit: err.limit,
            field: err.field
        }, req);
        
        return res.status(413).json({
            error: 'File too large',
            code: 'FILE_TOO_LARGE',
            limit: err.limit,
            errorId
        });
    }

    // Rate limiting errors
    if (err.statusCode === 429) {
        logger.logSecurity('rate_limit_exceeded', {
            errorId,
            limit: err.limit,
            windowMs: err.windowMs
        }, req);
        
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: err.retryAfter,
            errorId
        });
    }

    // Permission errors
    if (err.statusCode === 403) {
        logger.logSecurity('permission_denied', {
            errorId,
            requiredPermission: err.requiredPermission,
            userRole: req.user?.role
        }, req);
        
        return res.status(403).json({
            error: 'Permission denied',
            code: 'PERMISSION_DENIED',
            errorId
        });
    }

    // Student data access violations
    if (err.code === 'STUDENT_DATA_ACCESS_DENIED') {
        logger.logSecurity('student_data_access_violation', {
            errorId,
            studentId: req.params.student_id,
            userId: req.user?.id,
            userRole: req.user?.role
        }, req);
        
        return res.status(403).json({
            error: 'Access denied to student data',
            code: 'STUDENT_DATA_ACCESS_DENIED',
            errorId
        });
    }

    // School access violations
    if (err.code === 'SCHOOL_ACCESS_DENIED') {
        logger.logSecurity('school_access_violation', {
            errorId,
            requestedSchoolId: req.params.school_id,
            userSchoolId: req.user?.school_id,
            userId: req.user?.id,
            userRole: req.user?.role
        }, req);
        
        return res.status(403).json({
            error: 'Access denied to school data',
            code: 'SCHOOL_ACCESS_DENIED',
            errorId
        });
    }

    // Network errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        logger.logDatabase('network_error', {
            errorId,
            code: err.code,
            address: err.address,
            port: err.port
        });
        
        return res.status(503).json({
            error: 'External service unavailable',
            code: 'SERVICE_UNAVAILABLE',
            errorId
        });
    }

    // Default error response
    const statusCode = err.statusCode || err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Security: don't expose sensitive information in production
    const message = isProduction 
        ? (statusCode === 500 ? 'Internal server error' : err.message)
        : err.message;

    // Log critical errors with high severity
    if (statusCode >= 500) {
        logger.logError(err, {
            errorId,
            errorType: 'critical',
            url: req.url,
            method: req.method,
            ip: req.ip,
            userId: req.user?.id,
            userRole: req.user?.role
        });
    }

    res.status(statusCode).json({
        error: message,
        code: err.code || 'INTERNAL_ERROR',
        errorId,
        ...(statusCode < 500 && !isProduction && { stack: err.stack })
    });
};

// 404 handler
const notFoundHandler = (req, res, next) => {
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    logger.logSecurity('route_not_found', {
        errorId,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id
    }, req);
    
    res.status(404).json({
        error: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        path: req.url,
        method: req.method,
        errorId
    });
};

// Async error wrapper
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Request timeout handler
const timeoutHandler = (timeout = 30000) => {
    return (req, res, next) => {
        res.setTimeout(timeout, () => {
            const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            
            logger.logPerformance('request_timeout', timeout, {
                errorId,
                url: req.url,
                method: req.method,
                ip: req.ip,
                userId: req.user?.id
            });
            
            if (!res.headersSent) {
                res.status(408).json({
                    error: 'Request timeout',
                    code: 'REQUEST_TIMEOUT',
                    timeout,
                    errorId
                });
            }
        });
        next();
    };
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncErrorHandler,
    timeoutHandler
};