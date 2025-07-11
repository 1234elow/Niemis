const { validationResult, body, param, query } = require('express-validator');
const logger = require('../utils/logger');

// Generic validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value,
            location: error.location
        }));

        logger.warn('Validation errors:', {
            errors: formattedErrors,
            path: req.path,
            method: req.method,
            ip: req.ip,
            userId: req.user?.id
        });

        return res.status(400).json({
            error: 'Validation failed',
            details: formattedErrors
        });
    }
    
    next();
};

// Common validation rules
const validationRules = {
    // User validation
    userLogin: [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Must be a valid email address'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    ],

    userRegistration: [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Must be a valid email address'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
        body('first_name')
            .isLength({ min: 2, max: 50 })
            .trim()
            .withMessage('First name must be between 2 and 50 characters'),
        body('last_name')
            .isLength({ min: 2, max: 50 })
            .trim()
            .withMessage('Last name must be between 2 and 50 characters'),
        body('role')
            .isIn(['student', 'parent', 'teacher', 'admin', 'super_admin'])
            .withMessage('Role must be one of: student, parent, teacher, admin, super_admin'),
        body('school_id')
            .optional()
            .isInt({ min: 1 })
            .withMessage('School ID must be a positive integer')
    ],

    changePassword: [
        body('currentPassword')
            .isLength({ min: 1 })
            .withMessage('Current password is required'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('New password must be at least 8 characters long')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
    ],

    // Student validation
    studentCreation: [
        body('student_id')
            .isLength({ min: 1, max: 20 })
            .trim()
            .withMessage('Student ID is required and must be less than 20 characters'),
        body('first_name')
            .isLength({ min: 2, max: 50 })
            .trim()
            .withMessage('First name must be between 2 and 50 characters'),
        body('last_name')
            .isLength({ min: 2, max: 50 })
            .trim()
            .withMessage('Last name must be between 2 and 50 characters'),
        body('date_of_birth')
            .isISO8601()
            .withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),
        body('gender')
            .isIn(['Male', 'Female', 'Other'])
            .withMessage('Gender must be Male, Female, or Other'),
        body('grade_level')
            .isLength({ min: 1, max: 10 })
            .trim()
            .withMessage('Grade level is required'),
        body('school_id')
            .isInt({ min: 1 })
            .withMessage('School ID must be a positive integer'),
        body('email')
            .optional()
            .isEmail()
            .normalizeEmail()
            .withMessage('Must be a valid email address'),
        body('phone')
            .optional()
            .matches(/^[\d\s\-\+\(\)]+$/)
            .withMessage('Phone number must contain only digits, spaces, dashes, plus signs, and parentheses')
    ],

    studentUpdate: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('Student ID must be a positive integer'),
        body('first_name')
            .optional()
            .isLength({ min: 2, max: 50 })
            .trim()
            .withMessage('First name must be between 2 and 50 characters'),
        body('last_name')
            .optional()
            .isLength({ min: 2, max: 50 })
            .trim()
            .withMessage('Last name must be between 2 and 50 characters'),
        body('email')
            .optional()
            .isEmail()
            .normalizeEmail()
            .withMessage('Must be a valid email address'),
        body('phone')
            .optional()
            .matches(/^[\d\s\-\+\(\)]+$/)
            .withMessage('Phone number must contain only digits, spaces, dashes, plus signs, and parentheses'),
        body('grade_level')
            .optional()
            .isLength({ min: 1, max: 10 })
            .trim()
            .withMessage('Grade level must be between 1 and 10 characters')
    ],

    // School validation
    schoolCreation: [
        body('name')
            .isLength({ min: 2, max: 100 })
            .trim()
            .withMessage('School name must be between 2 and 100 characters'),
        body('school_code')
            .isLength({ min: 1, max: 20 })
            .trim()
            .withMessage('School code is required and must be less than 20 characters'),
        body('school_category')
            .isIn(['primary', 'secondary', 'nursery', 'special', 'tertiary'])
            .withMessage('School category must be one of: primary, secondary, nursery, special, tertiary'),
        body('parish')
            .isLength({ min: 2, max: 50 })
            .trim()
            .withMessage('Parish is required'),
        body('address')
            .optional()
            .isLength({ max: 200 })
            .trim()
            .withMessage('Address must be less than 200 characters'),
        body('phone')
            .optional()
            .matches(/^[\d\s\-\+\(\)]+$/)
            .withMessage('Phone number must contain only digits, spaces, dashes, plus signs, and parentheses'),
        body('email')
            .optional()
            .isEmail()
            .normalizeEmail()
            .withMessage('Must be a valid email address'),
        body('principal_name')
            .optional()
            .isLength({ max: 100 })
            .trim()
            .withMessage('Principal name must be less than 100 characters')
    ],

    // Attendance validation
    attendanceRecord: [
        body('student_id')
            .isInt({ min: 1 })
            .withMessage('Student ID must be a positive integer'),
        body('date')
            .isISO8601()
            .withMessage('Date must be a valid date (YYYY-MM-DD)'),
        body('status')
            .isIn(['Present', 'Absent', 'Late', 'Excused'])
            .withMessage('Status must be Present, Absent, Late, or Excused'),
        body('check_in_time')
            .optional()
            .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage('Check in time must be in HH:MM format'),
        body('check_out_time')
            .optional()
            .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage('Check out time must be in HH:MM format')
    ],

    // RFID validation
    rfidScan: [
        body('device_id')
            .isLength({ min: 1, max: 50 })
            .trim()
            .withMessage('Device ID is required and must be less than 50 characters'),
        body('rfid_tag')
            .isLength({ min: 1, max: 50 })
            .trim()
            .withMessage('RFID tag is required and must be less than 50 characters'),
        body('scan_time')
            .optional()
            .isISO8601()
            .withMessage('Scan time must be a valid ISO 8601 date')
    ],

    // Pagination validation
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('sort_by')
            .optional()
            .isLength({ max: 50 })
            .withMessage('Sort by field must be less than 50 characters'),
        query('sort_order')
            .optional()
            .isIn(['asc', 'desc'])
            .withMessage('Sort order must be asc or desc')
    ],

    // ID parameter validation
    idParam: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('ID must be a positive integer')
    ],

    // Search validation
    search: [
        query('q')
            .optional()
            .isLength({ min: 1, max: 100 })
            .trim()
            .withMessage('Search query must be between 1 and 100 characters'),
        query('field')
            .optional()
            .isLength({ max: 50 })
            .withMessage('Search field must be less than 50 characters')
    ],

    // Date range validation
    dateRange: [
        query('start_date')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid date (YYYY-MM-DD)'),
        query('end_date')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid date (YYYY-MM-DD)')
    ],

    // File upload validation
    fileUpload: [
        body('file_type')
            .optional()
            .isIn(['image', 'document', 'report'])
            .withMessage('File type must be image, document, or report'),
        body('description')
            .optional()
            .isLength({ max: 200 })
            .trim()
            .withMessage('Description must be less than 200 characters')
    ]
};

// Validation middleware factory
const validate = (validationName) => {
    return [
        ...validationRules[validationName],
        handleValidationErrors
    ];
};

// Custom validation functions
const customValidations = {
    // Ensure end date is after start date
    validateDateRange: (req, res, next) => {
        const { start_date, end_date } = req.query;
        
        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: [{
                    field: 'date_range',
                    message: 'End date must be after start date',
                    value: { start_date, end_date }
                }]
            });
        }
        
        next();
    },

    // Ensure student belongs to user's school (for role-based access)
    validateSchoolAccess: (req, res, next) => {
        if (!req.user || req.user.role === 'super_admin') {
            return next();
        }

        const userSchoolId = req.user.school_id;
        const requestSchoolId = req.body.school_id || req.params.school_id;

        if (requestSchoolId && userSchoolId && parseInt(requestSchoolId) !== parseInt(userSchoolId)) {
            return res.status(403).json({
                error: 'Validation failed',
                details: [{
                    field: 'school_id',
                    message: 'You can only access data from your assigned school',
                    value: requestSchoolId
                }]
            });
        }

        next();
    },

    // Validate file size and type
    validateFileUpload: (req, res, next) => {
        if (!req.file) {
            return next();
        }

        const maxSize = parseInt(process.env.UPLOAD_MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
        const allowedTypes = (process.env.UPLOAD_ALLOWED_TYPES || '').split(',');

        if (req.file.size > maxSize) {
            return res.status(400).json({
                error: 'Validation failed',
                details: [{
                    field: 'file',
                    message: `File size must be less than ${maxSize / (1024 * 1024)}MB`,
                    value: req.file.size
                }]
            });
        }

        if (allowedTypes.length > 0 && !allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: [{
                    field: 'file',
                    message: `File type must be one of: ${allowedTypes.join(', ')}`,
                    value: req.file.mimetype
                }]
            });
        }

        next();
    }
};

module.exports = {
    validate,
    validationRules,
    customValidations,
    handleValidationErrors
};