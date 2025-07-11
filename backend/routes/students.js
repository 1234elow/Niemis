const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { 
    Student, 
    School, 
    Parent, 
    StudentHealth, 
    FamilySocialAssessment,
    AttendanceRecord,
    AcademicRecord,
    User
} = require('../models');
const { requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get current student's profile (for student role)
router.get('/profile', async (req, res, next) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ error: 'Access denied: Student role required' });
        }

        const student = await Student.findOne({
            where: { user_id: req.user.id },
            include: [
                { 
                    model: School, 
                    attributes: ['id', 'name', 'school_type', 'parish', 'student_population', 'description'] 
                },
                {
                    model: User,
                    attributes: ['id', 'username', 'email', 'role']
                }
            ]
        });

        if (!student) {
            return res.status(404).json({ error: 'Student profile not found' });
        }

        res.json({ 
            student: student,
            message: 'Student profile retrieved successfully'
        });

    } catch (error) {
        next(error);
    }
});

// Get all students with filtering and pagination
router.get('/', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('school_id').optional().isUUID(),
    query('grade_level').optional(),
    query('is_active').optional().isBoolean()
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { 
            page = 1, 
            limit = 20, 
            school_id, 
            grade_level, 
            is_active = true,
            search 
        } = req.query;

        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = { is_active };
        if (school_id) whereClause.school_id = school_id;
        if (grade_level) whereClause.grade_level = grade_level;
        if (search) {
            whereClause[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } },
                { student_id: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Role-based filtering
        if (req.user.role === 'teacher') {
            // Teachers can only see students from their school
            const teacherStaff = await Staff.findOne({
                where: { user_id: req.user.id }
            });
            if (teacherStaff) {
                whereClause.school_id = teacherStaff.school_id;
            }
        }

        const students = await Student.findAndCountAll({
            where: whereClause,
            include: [
                { 
                    model: School, 
                    attributes: ['id', 'name', 'school_type'] 
                }
            ],
            attributes: { exclude: ['created_at', 'updated_at'] },
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

// Get student by ID with detailed information
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const student = await Student.findByPk(id, {
            include: [
                { 
                    model: School, 
                    attributes: ['id', 'name', 'school_type'] 
                },
                {
                    model: Parent,
                    through: { attributes: ['relationship_type', 'is_primary'] },
                    attributes: ['id', 'first_name', 'last_name', 'phone', 'email']
                },
                {
                    model: StudentHealth,
                    attributes: { exclude: ['created_at', 'updated_at'] }
                },
                {
                    model: FamilySocialAssessment,
                    attributes: { exclude: ['created_at', 'updated_at'] }
                }
            ]
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Check permissions
        if (req.user.role === 'parent') {
            const parentAccess = student.Parents?.some(parent => 
                parent.user_id === req.user.id
            );
            if (!parentAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        res.json({ student });

    } catch (error) {
        next(error);
    }
});

// Create new student
router.post('/', requireRole(['super_admin', 'admin', 'teacher']), [
    body('student_id').isLength({ min: 1, max: 20 }),
    body('first_name').isLength({ min: 1, max: 50 }),
    body('last_name').isLength({ min: 1, max: 50 }),
    body('date_of_birth').isISO8601(),
    body('gender').isIn(['male', 'female', 'other']),
    body('school_id').isUUID(),
    body('grade_level').isLength({ min: 1, max: 10 }),
    body('email').optional().isEmail()
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const student = await Student.create(req.body);

        logger.info(`New student created: ${student.first_name} ${student.last_name} by user ${req.user.id}`);

        res.status(201).json({
            message: 'Student created successfully',
            student
        });

    } catch (error) {
        next(error);
    }
});

// Update student
router.put('/:id', requireRole(['super_admin', 'admin', 'teacher']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const student = await Student.findByPk(id);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        await student.update(req.body);

        logger.info(`Student updated: ${student.first_name} ${student.last_name} by user ${req.user.id}`);

        res.json({
            message: 'Student updated successfully',
            student
        });

    } catch (error) {
        next(error);
    }
});

// Get student attendance summary
router.get('/:id/attendance', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { start_date, end_date } = req.query;

        const student = await Student.findByPk(id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const whereClause = { student_id: id };
        if (start_date) whereClause.attendance_date = { [Op.gte]: start_date };
        if (end_date) whereClause.attendance_date = { [Op.lte]: end_date };

        const attendance = await AttendanceRecord.findAll({
            where: whereClause,
            order: [['attendance_date', 'DESC']],
            limit: 30
        });

        const summary = {
            total_days: attendance.length,
            present_days: attendance.filter(a => a.status === 'present').length,
            absent_days: attendance.filter(a => a.status === 'absent').length,
            late_days: attendance.filter(a => a.status === 'late').length,
            excused_days: attendance.filter(a => a.status === 'excused').length
        };

        summary.attendance_rate = summary.total_days > 0 ? 
            Math.round((summary.present_days / summary.total_days) * 100) : 0;

        res.json({
            attendance_summary: summary,
            recent_attendance: attendance
        });

    } catch (error) {
        next(error);
    }
});

// Get student academic records
router.get('/:id/academics', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { school_year, term } = req.query;

        const student = await Student.findByPk(id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const whereClause = { student_id: id };
        if (school_year) whereClause.school_year = school_year;
        if (term) whereClause.term = term;

        const academics = await AcademicRecord.findAll({
            where: whereClause,
            include: [
                {
                    model: Staff,
                    as: 'teacher',
                    attributes: ['first_name', 'last_name']
                }
            ],
            order: [['school_year', 'DESC'], ['term', 'DESC'], ['subject', 'ASC']]
        });

        res.json({ academic_records: academics });

    } catch (error) {
        next(error);
    }
});

// Update student profile information (public demo access)
router.patch('/:id/profile', [
    body('first_name').optional().isLength({ min: 1, max: 50 }),
    body('last_name').optional().isLength({ min: 1, max: 50 }),
    body('date_of_birth').optional().isDate(),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('current_grade').optional().isLength({ min: 1, max: 20 }),
    body('address').optional(),
    body('phone').optional().matches(/^[\+]?[0-9\s\-\(\)]+$/),
    body('email').optional().isEmail()
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { id } = req.params;
        const updateData = req.body;

        const student = await Student.findByPk(id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Store old values for audit
        const oldValues = {
            first_name: student.first_name,
            last_name: student.last_name,
            date_of_birth: student.date_of_birth,
            gender: student.gender,
            current_grade: student.current_grade,
            address: student.address,
            phone: student.phone,
            email: student.email
        };

        await student.update(updateData);

        // Create audit log (demo mode)
        const { AuditLog } = require('../models');
        try {
            await AuditLog.create({
                user_id: 'demo-user',
                action: 'student_profile_update',
                table_name: 'students',
                record_id: student.id,
                old_values: oldValues,
                new_values: updateData,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });
        } catch (auditError) {
            logger.warn('Audit log failed (demo mode):', auditError.message);
        }

        logger.info(`Student profile updated: ${student.student_id || id} (demo mode)`);

        res.json({
            message: 'Student profile updated successfully',
            student
        });

    } catch (error) {
        next(error);
    }
});

// Update student health information (public demo access)
router.patch('/:id/health', async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const student = await Student.findByPk(id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        let healthRecord = await StudentHealth.findOne({ where: { student_id: id } });
        
        if (healthRecord) {
            await healthRecord.update(updateData);
        } else {
            healthRecord = await StudentHealth.create({
                student_id: id,
                ...updateData
            });
        }

        // Create audit log (demo mode)
        const { AuditLog } = require('../models');
        try {
            await AuditLog.create({
                user_id: 'demo-user',
                action: 'student_health_update',
                table_name: 'student_health',
                record_id: healthRecord.id,
                new_values: updateData,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });
        } catch (auditError) {
            logger.warn('Audit log failed (demo mode):', auditError.message);
        }

        logger.info(`Student health updated: ${student.student_id || id} (demo mode)`);

        res.json({
            message: 'Student health information updated successfully',
            health: healthRecord
        });

    } catch (error) {
        next(error);
    }
});

// Update student family information (public demo access)
router.patch('/:id/family', async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const student = await Student.findByPk(id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        let familyRecord = await FamilySocialAssessment.findOne({ where: { student_id: id } });
        
        if (familyRecord) {
            await familyRecord.update(updateData);
        } else {
            familyRecord = await FamilySocialAssessment.create({
                student_id: id,
                ...updateData
            });
        }

        // Create audit log (demo mode)
        const { AuditLog } = require('../models');
        try {
            await AuditLog.create({
                user_id: 'demo-user',
                action: 'student_family_update',
                table_name: 'family_social_assessments',
                record_id: familyRecord.id,
                new_values: updateData,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });
        } catch (auditError) {
            logger.warn('Audit log failed (demo mode):', auditError.message);
        }

        logger.info(`Student family info updated: ${student.student_id || id} (demo mode)`);

        res.json({
            message: 'Student family information updated successfully',
            family: familyRecord
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;