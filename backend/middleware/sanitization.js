const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');
const logger = require('../utils/logger');

/**
 * Advanced Input Sanitization Middleware for NiEMIS
 * Provides comprehensive data sanitization and XSS prevention
 */

/**
 * HTML Sanitization Options
 */
const sanitizeOptions = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SANITIZE_DOM: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'applet', 'meta', 'link'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur']
};

/**
 * SQL Injection Pattern Detection
 */
const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\b.*=.*)/i,
    /('|(\\')|(--|;|\||(\*|\%)))/i,
    /(\b(sleep|benchmark|waitfor)\b)/i,
    /(\b(char|ascii|substring|length|user|database|version)\b)/i,
    /(\b(0x[0-9a-f]+)\b)/i
];

/**
 * XSS Pattern Detection
 */
const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload=/gi,
    /onclick=/gi,
    /onerror=/gi,
    /onmouseover=/gi,
    /onfocus=/gi,
    /onblur=/gi,
    /onsubmit=/gi,
    /onchange=/gi,
    /onkeyup=/gi,
    /onkeydown=/gi,
    /onkeypress=/gi
];

/**
 * Path Traversal Pattern Detection
 */
const pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e\\\/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
    /%2e%2e%5c/gi
];

/**
 * Command Injection Pattern Detection
 */
const commandInjectionPatterns = [
    /(\||&|;|`|\$\(|\$\{|<|>)/g,
    /\b(cat|ls|pwd|id|whoami|uname|ps|netstat|wget|curl|nc|nmap|ping|traceroute)\b/gi,
    /\b(rm|rmdir|del|deltree|format|fdisk|mkfs|mount|umount|chmod|chown|kill|killall)\b/gi,
    /\b(exec|system|passthru|shell_exec|eval|assert|preg_replace|create_function)\b/gi
];

/**
 * NoSQL Injection Pattern Detection
 */
const noSQLInjectionPatterns = [
    /\$where/gi,
    /\$regex/gi,
    /\$ne/gi,
    /\$in/gi,
    /\$nin/gi,
    /\$or/gi,
    /\$and/gi,
    /\$not/gi,
    /\$nor/gi,
    /\$exists/gi,
    /\$type/gi,
    /\$mod/gi,
    /\$all/gi,
    /\$size/gi,
    /\$elemMatch/gi
];

/**
 * Detect malicious patterns in input
 */
const detectMaliciousPatterns = (input, patterns, patternType) => {
    if (typeof input !== 'string') {
        return false;
    }

    for (const pattern of patterns) {
        if (pattern.test(input)) {
            return {
                detected: true,
                type: patternType,
                pattern: pattern.source || pattern.toString(),
                input: input.substring(0, 100) // Limit logged input length
            };
        }
    }
    return false;
};

/**
 * Sanitize string input
 */
const sanitizeString = (input, options = {}) => {
    if (typeof input !== 'string') {
        return input;
    }

    let sanitized = input;

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // HTML sanitization
    if (options.allowHtml) {
        sanitized = DOMPurify.sanitize(sanitized, sanitizeOptions);
    } else {
        // Escape HTML entities
        sanitized = validator.escape(sanitized);
    }

    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize unicode
    sanitized = sanitized.normalize('NFC');

    // Trim whitespace
    if (options.trim !== false) {
        sanitized = sanitized.trim();
    }

    // Length limiting
    if (options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
};

/**
 * Sanitize object recursively
 */
const sanitizeObject = (obj, options = {}) => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return sanitizeString(obj, options);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, options));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                // Sanitize both key and value
                const sanitizedKey = sanitizeString(key, { trim: true, maxLength: 100 });
                sanitized[sanitizedKey] = sanitizeObject(obj[key], options);
            }
        }
        return sanitized;
    }

    return obj;
};

/**
 * Validate and sanitize email
 */
const sanitizeEmail = (email) => {
    if (typeof email !== 'string') {
        return email;
    }

    const sanitized = validator.normalizeEmail(email, {
        all_lowercase: true,
        gmail_lowercase: true,
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: true,
        outlookdotcom_lowercase: true,
        outlookdotcom_remove_subaddress: false,
        yahoo_lowercase: true,
        yahoo_remove_subaddress: false,
        icloud_lowercase: true,
        icloud_remove_subaddress: false
    });

    return sanitized || email;
};

/**
 * Validate and sanitize URL
 */
const sanitizeURL = (url) => {
    if (typeof url !== 'string') {
        return url;
    }

    // Remove any potential XSS attempts
    let sanitized = url.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');
    
    // Validate URL format
    if (validator.isURL(sanitized, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_host: true,
        require_valid_protocol: true,
        allow_underscores: false,
        allow_trailing_dot: false,
        allow_protocol_relative_urls: false
    })) {
        return sanitized;
    }

    return '';
};

/**
 * Validate and sanitize phone number
 */
const sanitizePhone = (phone) => {
    if (typeof phone !== 'string') {
        return phone;
    }

    // Remove all non-digit characters except +, -, (, ), and spaces
    let sanitized = phone.replace(/[^\d\s\-\+\(\)]/g, '');
    
    // Remove excessive spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Basic phone number validation
    if (sanitized.length >= 7 && sanitized.length <= 20) {
        return sanitized;
    }
    
    return '';
};

/**
 * Main sanitization middleware
 */
const sanitizationMiddleware = (options = {}) => {
    return (req, res, next) => {
        try {
            const startTime = Date.now();
            let maliciousDetected = false;
            const detections = [];

            // Check for malicious patterns in all input
            const checkAllInputs = (obj, location) => {
                if (typeof obj === 'string') {
                    // Check for SQL injection
                    const sqlCheck = detectMaliciousPatterns(obj, sqlInjectionPatterns, 'sql_injection');
                    if (sqlCheck) {
                        maliciousDetected = true;
                        detections.push({ ...sqlCheck, location });
                    }

                    // Check for XSS
                    const xssCheck = detectMaliciousPatterns(obj, xssPatterns, 'xss');
                    if (xssCheck) {
                        maliciousDetected = true;
                        detections.push({ ...xssCheck, location });
                    }

                    // Check for path traversal
                    const pathCheck = detectMaliciousPatterns(obj, pathTraversalPatterns, 'path_traversal');
                    if (pathCheck) {
                        maliciousDetected = true;
                        detections.push({ ...pathCheck, location });
                    }

                    // Check for command injection
                    const cmdCheck = detectMaliciousPatterns(obj, commandInjectionPatterns, 'command_injection');
                    if (cmdCheck) {
                        maliciousDetected = true;
                        detections.push({ ...cmdCheck, location });
                    }

                    // Check for NoSQL injection
                    const noSQLCheck = detectMaliciousPatterns(obj, noSQLInjectionPatterns, 'nosql_injection');
                    if (noSQLCheck) {
                        maliciousDetected = true;
                        detections.push({ ...noSQLCheck, location });
                    }
                } else if (typeof obj === 'object' && obj !== null) {
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            checkAllInputs(obj[key], `${location}.${key}`);
                        }
                    }
                }
            };

            // Check all input sources
            checkAllInputs(req.body, 'body');
            checkAllInputs(req.query, 'query');
            checkAllInputs(req.params, 'params');

            // Log and handle malicious input
            if (maliciousDetected) {
                logger.logSecurity('malicious_input_detected', {
                    detections,
                    method: req.method,
                    url: req.url,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip,
                    userId: req.user?.id
                }, req);

                // In production, block malicious requests
                if (process.env.NODE_ENV === 'production' && process.env.BLOCK_MALICIOUS_INPUT === 'true') {
                    return res.status(400).json({
                        error: 'Invalid input detected',
                        code: 'MALICIOUS_INPUT_DETECTED'
                    });
                }
            }

            // Sanitize inputs
            const sanitizeOptions = {
                allowHtml: options.allowHtml || false,
                trim: options.trim !== false,
                maxLength: options.maxLength
            };

            if (req.body) {
                req.body = sanitizeObject(req.body, sanitizeOptions);
            }

            if (req.query) {
                req.query = sanitizeObject(req.query, sanitizeOptions);
            }

            if (req.params) {
                req.params = sanitizeObject(req.params, sanitizeOptions);
            }

            // Special handling for specific fields
            if (req.body.email) {
                req.body.email = sanitizeEmail(req.body.email);
            }

            if (req.body.website || req.body.url) {
                const urlField = req.body.website || req.body.url;
                req.body.website = sanitizeURL(urlField);
                req.body.url = sanitizeURL(urlField);
            }

            if (req.body.phone) {
                req.body.phone = sanitizePhone(req.body.phone);
            }

            // Log sanitization performance
            const duration = Date.now() - startTime;
            if (duration > 100) { // Log if sanitization takes longer than 100ms
                logger.logPerformance('sanitization_slow', duration, {
                    method: req.method,
                    url: req.url,
                    bodySize: JSON.stringify(req.body).length,
                    userId: req.user?.id
                });
            }

            next();
        } catch (error) {
            logger.error('Sanitization middleware error:', error);
            
            // Continue with original request if sanitization fails
            // Better to have unsanitized data than break the application
            next();
        }
    };
};

/**
 * File upload sanitization
 */
const sanitizeFileUpload = (req, res, next) => {
    if (!req.file && !req.files) {
        return next();
    }

    try {
        const files = req.files || [req.file];
        
        for (const file of files) {
            if (file) {
                // Sanitize filename
                let sanitizedName = file.originalname;
                
                // Remove path traversal attempts
                sanitizedName = sanitizedName.replace(/\.\.\//g, '');
                sanitizedName = sanitizedName.replace(/\.\.\\/g, '');
                
                // Remove null bytes
                sanitizedName = sanitizedName.replace(/\0/g, '');
                
                // Remove control characters
                sanitizedName = sanitizedName.replace(/[\x00-\x1F\x7F]/g, '');
                
                // Limit filename length
                if (sanitizedName.length > 255) {
                    const ext = sanitizedName.split('.').pop();
                    sanitizedName = sanitizedName.substring(0, 200) + '.' + ext;
                }
                
                // Check for executable extensions
                const dangerousExtensions = [
                    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
                    '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.sh', '.bash'
                ];
                
                const hasExt = dangerousExtensions.some(ext => 
                    sanitizedName.toLowerCase().endsWith(ext)
                );
                
                if (hasExt) {
                    logger.logSecurity('dangerous_file_upload', {
                        filename: file.originalname,
                        mimetype: file.mimetype,
                        size: file.size,
                        userId: req.user?.id
                    }, req);
                    
                    return res.status(400).json({
                        error: 'File type not allowed',
                        code: 'DANGEROUS_FILE_TYPE'
                    });
                }
                
                file.originalname = sanitizedName;
            }
        }
        
        next();
    } catch (error) {
        logger.error('File sanitization error:', error);
        next();
    }
};

module.exports = {
    sanitizationMiddleware,
    sanitizeFileUpload,
    sanitizeString,
    sanitizeObject,
    sanitizeEmail,
    sanitizeURL,
    sanitizePhone,
    detectMaliciousPatterns
};