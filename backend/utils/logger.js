const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Define log colors
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white'
};

winston.addColors(logColors);

// Custom format for production logs
const productionFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const logObject = {
            timestamp,
            level,
            message,
            service: 'niemis-backend',
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            ...(stack && { stack }),
            ...meta
        };
        return JSON.stringify(logObject);
    })
);

// Custom format for development logs
const developmentFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}${stack ? '\n' + stack : ''}`;
    })
);

// Create transports
const transports = [];

// File transports (always present)
transports.push(
    new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        handleExceptions: true,
        handleRejections: true
    }),
    new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        handleExceptions: true,
        handleRejections: true
    }),
    new winston.transports.File({
        filename: path.join(logDir, 'security.log'),
        level: 'warn',
        format: productionFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 3,
        handleExceptions: false,
        handleRejections: false
    })
);

// Console transport (development and production)
if (process.env.NODE_ENV !== 'production') {
    transports.push(
        new winston.transports.Console({
            format: developmentFormat,
            handleExceptions: true,
            handleRejections: true
        })
    );
} else {
    // In production, use structured logging for console
    transports.push(
        new winston.transports.Console({
            format: productionFormat,
            handleExceptions: true,
            handleRejections: true
        })
    );
}

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    format: productionFormat,
    transports,
    exitOnError: false
});

// Add request logging utility
logger.logRequest = (req, res, responseTime) => {
    const logData = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userId: req.user?.id,
        userRole: req.user?.role,
        timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
        logger.warn('HTTP Request Error', logData);
    } else {
        logger.http('HTTP Request', logData);
    }
};

// Add security logging utility
logger.logSecurity = (event, details, req) => {
    const logData = {
        event,
        severity: 'security',
        ip: req?.ip,
        userAgent: req?.get('User-Agent'),
        userId: req?.user?.id,
        userRole: req?.user?.role,
        timestamp: new Date().toISOString(),
        ...details
    };

    logger.warn('Security Event', logData);
};

// Add authentication logging
logger.logAuth = (event, details, req) => {
    const logData = {
        event,
        severity: 'auth',
        ip: req?.ip,
        userAgent: req?.get('User-Agent'),
        timestamp: new Date().toISOString(),
        ...details
    };

    if (event.includes('success')) {
        logger.info('Authentication Event', logData);
    } else {
        logger.warn('Authentication Event', logData);
    }
};

// Add database logging
logger.logDatabase = (operation, details) => {
    const logData = {
        operation,
        severity: 'database',
        timestamp: new Date().toISOString(),
        ...details
    };

    logger.info('Database Operation', logData);
};

// Add performance logging
logger.logPerformance = (operation, duration, details) => {
    const logData = {
        operation,
        duration: `${duration}ms`,
        severity: 'performance',
        timestamp: new Date().toISOString(),
        ...details
    };

    if (duration > 1000) {
        logger.warn('Slow Operation', logData);
    } else {
        logger.debug('Performance Metric', logData);
    }
};

// Error logging with context
logger.logError = (error, context = {}) => {
    const logData = {
        error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: error.code
        },
        severity: 'error',
        timestamp: new Date().toISOString(),
        ...context
    };

    logger.error('Application Error', logData);
};

// Graceful shutdown handler
const gracefulShutdown = () => {
    logger.info('Shutting down logger...');
    logger.end();
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = logger;