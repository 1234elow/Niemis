const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { ddosProtection } = require('../config/ddos-protection');

// General API rate limiting
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs: windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: max || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        message: message || {
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        skip: (req, res) => {
            // Skip rate limiting for health checks
            if (req.path === '/health' || req.path === '/api/health') {
                return true;
            }
            
            // Skip for successful requests if configured
            if (process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true') {
                return res.statusCode < 400;
            }
            
            return false;
        },
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise IP
            return req.user ? `user_${req.user.id}` : req.ip;
        },
        onLimitReached: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                userId: req.user?.id
            });
            
            // Track rate limit violation for DDoS protection
            ddosProtection.trackRateLimitViolation(req.ip, 'rate_limit_exceeded');
        }
    });
};

// Specific rate limiters for different endpoints
const generalLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per 15 minutes
    {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: 900 // 15 minutes
    }
);

const authLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 login attempts per 15 minutes
    {
        error: 'Too many login attempts from this IP, please try again later.',
        retryAfter: 900
    }
);

const strictLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    10, // 10 requests per 15 minutes
    {
        error: 'Too many requests to this endpoint, please try again later.',
        retryAfter: 900
    }
);

const passwordResetLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 password reset attempts per hour
    {
        error: 'Too many password reset requests from this IP, please try again later.',
        retryAfter: 3600
    }
);

const uploadLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    20, // 20 uploads per hour
    {
        error: 'Too many file uploads from this IP, please try again later.',
        retryAfter: 3600
    }
);

const rfidLimiter = createRateLimiter(
    60 * 1000, // 1 minute
    30, // 30 RFID scans per minute
    {
        error: 'Too many RFID scan requests, please try again later.',
        retryAfter: 60
    }
);

// Role-based rate limiting
const roleBasedLimiter = (req, res, next) => {
    if (!req.user) {
        return next();
    }

    const roleLimits = {
        student: { windowMs: 15 * 60 * 1000, max: 50 },
        parent: { windowMs: 15 * 60 * 1000, max: 75 },
        teacher: { windowMs: 15 * 60 * 1000, max: 150 },
        admin: { windowMs: 15 * 60 * 1000, max: 300 },
        super_admin: { windowMs: 15 * 60 * 1000, max: 500 }
    };

    const userRole = req.user.role;
    const limits = roleLimits[userRole] || roleLimits.student;

    const limiter = createRateLimiter(
        limits.windowMs,
        limits.max,
        {
            error: `Too many requests for your role (${userRole}), please try again later.`,
            retryAfter: Math.ceil(limits.windowMs / 1000)
        }
    );

    return limiter(req, res, next);
};

// Student data protection limiter (extra strict for student data access)
const studentDataLimiter = createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    20, // 20 requests per 5 minutes
    {
        error: 'Too many requests for student data, please try again later.',
        retryAfter: 300
    }
);

// Advanced rate limiters for security-critical endpoints
const adminActionsLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    50, // 50 admin actions per hour
    {
        error: 'Too many administrative actions from this IP, please try again later.',
        retryAfter: 3600
    }
);

const studentDataAccessLimiter = createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    30, // 30 student data requests per 5 minutes
    {
        error: 'Too many student data access requests, please try again later.',
        retryAfter: 300
    }
);

const reportGenerationLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 reports per 15 minutes
    {
        error: 'Too many report generation requests, please try again later.',
        retryAfter: 900
    }
);

const bulkOperationsLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    10, // 10 bulk operations per hour
    {
        error: 'Too many bulk operations from this IP, please try again later.',
        retryAfter: 3600
    }
);

// Emergency lockdown limiter (very restrictive)
const emergencyLimiter = createRateLimiter(
    60 * 1000, // 1 minute
    5, // 5 requests per minute
    {
        error: 'System is under high load. Access temporarily restricted.',
        retryAfter: 60
    }
);

// Public demo endpoints limiter
const demoLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    200, // 200 requests per 15 minutes for demo
    {
        error: 'Demo endpoint rate limit exceeded, please try again later.',
        retryAfter: 900
    }
);

// Dynamic rate limiter based on server load
const createDynamicRateLimiter = () => {
    return (req, res, next) => {
        // Get current server metrics
        const memoryUsage = process.memoryUsage();
        const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
        
        // Adjust rate limits based on server load
        let limitMultiplier = 1;
        
        if (memoryUsagePercent > 0.9) {
            limitMultiplier = 0.1; // Very restrictive
        } else if (memoryUsagePercent > 0.8) {
            limitMultiplier = 0.3; // Restrictive
        } else if (memoryUsagePercent > 0.7) {
            limitMultiplier = 0.6; // Somewhat restrictive
        }
        
        if (limitMultiplier < 1) {
            // Apply emergency rate limiting
            return emergencyLimiter(req, res, next);
        }
        
        next();
    };
};

// Adaptive rate limiter for students (more lenient)
const studentAdaptiveLimiter = (req, res, next) => {
    if (req.user && req.user.role === 'student') {
        // Students get more lenient rate limits
        const studentLimiter = createRateLimiter(
            15 * 60 * 1000, // 15 minutes
            100, // 100 requests per 15 minutes for students
            {
                error: 'Student access rate limit exceeded, please take a break.',
                retryAfter: 900
            }
        );
        return studentLimiter(req, res, next);
    }
    
    next();
};

module.exports = {
    generalLimiter,
    authLimiter,
    strictLimiter,
    passwordResetLimiter,
    uploadLimiter,
    rfidLimiter,
    roleBasedLimiter,
    studentDataLimiter,
    adminActionsLimiter,
    studentDataAccessLimiter,
    reportGenerationLimiter,
    bulkOperationsLimiter,
    emergencyLimiter,
    demoLimiter,
    createDynamicRateLimiter,
    studentAdaptiveLimiter,
    createRateLimiter
};