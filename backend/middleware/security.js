const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * Enhanced Security Middleware for NiEMIS
 * Provides comprehensive security headers and CSP configuration
 */

const isProduction = process.env.NODE_ENV === 'production';
const isRender = process.env.RENDER === 'true';

/**
 * Content Security Policy Configuration
 */
const getCSPDirectives = () => {
    const baseDirectives = {
        defaultSrc: ["'self'"],
        scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for some React components
            "'unsafe-eval'", // Required for development tools
            "https://cdn.jsdelivr.net",
            "https://unpkg.com",
            "https://cdnjs.cloudflare.com"
        ],
        styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Material-UI
            "https://fonts.googleapis.com",
            "https://cdn.jsdelivr.net",
            "https://unpkg.com"
        ],
        fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdn.jsdelivr.net",
            "data:"
        ],
        imgSrc: [
            "'self'",
            "data:",
            "https:",
            "blob:",
            "https://via.placeholder.com" // For placeholder images
        ],
        connectSrc: [
            "'self'",
            "https:",
            "wss:", // WebSocket connections
            process.env.FRONTEND_URL,
            process.env.APP_URL
        ].filter(Boolean),
        mediaSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"]
    };

    // Development-specific additions
    if (!isProduction) {
        baseDirectives.scriptSrc.push("'unsafe-eval'");
        baseDirectives.connectSrc.push("ws:", "http:");
    }

    return baseDirectives;
};

/**
 * CSP Violation Report Handler
 */
const handleCSPViolation = (req, res, next) => {
    if (req.path === '/api/security/csp-report') {
        const violation = req.body;
        
        logger.logSecurity('csp_violation', {
            blockedUri: violation['blocked-uri'],
            documentUri: violation['document-uri'],
            violatedDirective: violation['violated-directive'],
            originalPolicy: violation['original-policy'],
            disposition: violation.disposition,
            statusCode: violation['status-code'],
            userAgent: req.get('User-Agent'),
            ip: req.ip
        }, req);

        return res.status(204).send();
    }
    next();
};

/**
 * Enhanced Helmet Configuration
 */
const getHelmetConfig = () => {
    const config = {
        contentSecurityPolicy: {
            directives: getCSPDirectives(),
            reportOnly: !isProduction,
            reportUri: process.env.HELMET_CSP_REPORT_URI || '/api/security/csp-report'
        },
        hsts: {
            maxAge: parseInt(process.env.HELMET_HSTS_MAX_AGE) || 31536000, // 1 year
            includeSubDomains: process.env.HELMET_HSTS_INCLUDE_SUBDOMAINS !== 'false',
            preload: true
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { 
            policy: ['strict-origin-when-cross-origin'] 
        },
        hidePoweredBy: true,
        frameguard: { action: 'deny' },
        dnsPrefetchControl: { allow: false },
        ieNoOpen: true,
        permittedCrossDomainPolicies: false,
        crossOriginEmbedderPolicy: false, // Disabled for compatibility
        crossOriginOpenerPolicy: false, // Disabled for compatibility
        crossOriginResourcePolicy: { policy: 'cross-origin' }
    };

    // Production-specific configurations
    if (isProduction) {
        config.contentSecurityPolicy.reportOnly = false;
        config.expectCt = {
            maxAge: 86400, // 24 hours
            enforce: true
        };
    }

    return config;
};

/**
 * Additional Security Headers Middleware
 */
const additionalSecurityHeaders = (req, res, next) => {
    // Permissions Policy (Feature Policy)
    const permissionsPolicy = [
        'accelerometer=()',
        'camera=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'payment=()',
        'usb=()',
        'interest-cohort=()'
    ].join(', ');
    
    res.setHeader('Permissions-Policy', permissionsPolicy);
    
    // Security headers for API responses
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Cache control for sensitive endpoints
    if (req.path.includes('/api/students') || 
        req.path.includes('/api/admin') || 
        req.path.includes('/api/auth')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }
    
    // Anti-clickjacking for admin pages
    if (req.path.includes('/admin')) {
        res.setHeader('X-Frame-Options', 'DENY');
    }
    
    next();
};

/**
 * IP Filtering Middleware
 */
const ipFiltering = (req, res, next) => {
    const clientIp = req.ip;
    const blockedIPs = (process.env.BLOCKED_IPS || '').split(',').filter(Boolean);
    const allowedIPs = (process.env.ALLOWED_IPS || '').split(',').filter(Boolean);
    
    // Check if IP is blocked
    if (blockedIPs.includes(clientIp)) {
        logger.logSecurity('ip_blocked', { ip: clientIp }, req);
        return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if IP is in allowed list (if configured)
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIp)) {
        logger.logSecurity('ip_not_allowed', { ip: clientIp }, req);
        return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
};

/**
 * Request Size Limiting Middleware
 */
const requestSizeLimit = (req, res, next) => {
    const maxSize = parseInt(process.env.REQUEST_SIZE_LIMIT) || 10 * 1024 * 1024; // 10MB
    const contentLength = parseInt(req.get('content-length')) || 0;
    
    if (contentLength > maxSize) {
        logger.logSecurity('request_too_large', { 
            contentLength, 
            maxSize,
            path: req.path 
        }, req);
        return res.status(413).json({ error: 'Request too large' });
    }
    
    next();
};

/**
 * Suspicious Activity Detection
 */
const suspiciousActivityDetection = (req, res, next) => {
    const suspiciousPatterns = [
        /\.\.\//,  // Path traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /javascript:/i, // JS injection
        /eval\(/i, // Code injection
        /exec\(/i, // Command injection
        /system\(/i, // System commands
        /passthru\(/i, // PHP functions
        /shell_exec\(/i, // Shell execution
        /base64_decode\(/i, // Encoding attacks
        /file_get_contents\(/i, // File access
        /\%00/i, // Null byte injection
        /\%2e\%2e/i, // URL encoded path traversal
        /\%3c\%73\%63\%72\%69\%70\%74/i // URL encoded script
    ];
    
    const userAgent = req.get('User-Agent') || '';
    const requestData = JSON.stringify({
        query: req.query,
        body: req.body,
        params: req.params,
        userAgent
    });
    
    const suspicious = suspiciousPatterns.some(pattern => 
        pattern.test(requestData) || pattern.test(req.url)
    );
    
    if (suspicious) {
        logger.logSecurity('suspicious_request', {
            method: req.method,
            url: req.url,
            userAgent,
            body: req.body,
            query: req.query,
            params: req.params
        }, req);
        
        // In production, you might want to block suspicious requests
        if (isProduction && process.env.BLOCK_SUSPICIOUS_REQUESTS === 'true') {
            return res.status(400).json({ error: 'Bad request' });
        }
    }
    
    next();
};

/**
 * Security Middleware Factory
 */
const createSecurityMiddleware = () => {
    const middlewares = [];
    
    // IP filtering (if configured)
    if (process.env.ENABLE_IP_FILTERING === 'true') {
        middlewares.push(ipFiltering);
    }
    
    // Request size limiting
    middlewares.push(requestSizeLimit);
    
    // Suspicious activity detection
    if (process.env.ENABLE_SUSPICIOUS_ACTIVITY_DETECTION === 'true') {
        middlewares.push(suspiciousActivityDetection);
    }
    
    // Helmet security headers
    middlewares.push(helmet(getHelmetConfig()));
    
    // Additional security headers
    middlewares.push(additionalSecurityHeaders);
    
    // CSP violation reporting
    middlewares.push(handleCSPViolation);
    
    return middlewares;
};

module.exports = {
    createSecurityMiddleware,
    handleCSPViolation,
    additionalSecurityHeaders,
    ipFiltering,
    requestSizeLimit,
    suspiciousActivityDetection,
    getCSPDirectives,
    getHelmetConfig
};