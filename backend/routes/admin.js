const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { School, Student, Staff, User, AuditLog, StudentTransfer } = require('../models');
const logger = require('../utils/logger');

// Admin dashboard statistics
router.get('/dashboard', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const stats = await Promise.all([
            School.count({ where: { is_active: true } }),
            Student.count({ where: { is_active: true } }),
            Staff.count({ where: { is_active: true } }),
            AuditLog.count({
                where: {
                    createdAt: {
                        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                    }
                }
            })
        ]);

        const recentAudits = await AuditLog.findAll({
            include: [{ model: User, attributes: ['first_name', 'last_name'] }],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        const pendingTransfers = await StudentTransfer.count({
            where: { status: 'pending' }
        });

        res.json({
            overview: {
                total_schools: stats[0],
                total_students: stats[1],
                total_staff: stats[2],
                recent_activity: stats[3],
                pending_transfers: pendingTransfers
            },
            recent_audits: recentAudits
        });

    } catch (error) {
        next(error);
    }
});

// Get all schools with detailed information
router.get('/schools/directory', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, parish, category } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = { is_active: true };
        
        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }
        
        if (parish) {
            whereClause.parish = parish;
        }
        
        if (category) {
            whereClause.school_category = category;
        }

        const schools = await School.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Staff,
                    where: { role_level: 'principal', is_active: true },
                    required: false,
                    attributes: ['first_name', 'last_name', 'phone', 'email']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']]
        });

        res.json({
            schools: schools.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(schools.count / limit),
                total_count: schools.count,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get all staff with role management
router.get('/staff/directory', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, school_id, role_level } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = { is_active: true };
        
        if (search) {
            whereClause[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } },
                { employee_id: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        if (school_id) {
            whereClause.school_id = school_id;
        }
        
        if (role_level) {
            whereClause.role_level = role_level;
        }

        const staff = await Staff.findAndCountAll({
            where: whereClause,
            include: [
                { model: School, attributes: ['name', 'school_code'] },
                { model: User, attributes: ['email', 'role'] }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['last_name', 'ASC'], ['first_name', 'ASC']]
        });

        res.json({
            staff: staff.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(staff.count / limit),
                total_count: staff.count,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Change staff role
router.patch('/staff/:id/role', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { new_role, reason } = req.body;
        
        const staff = await Staff.findByPk(id);
        if (!staff) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        const oldRole = staff.role_level;
        
        await staff.update({
            previous_role: oldRole,
            role_level: new_role,
            role_change_date: new Date(),
            role_changed_by: req.user.id
        });

        // Create audit log
        await AuditLog.create({
            user_id: req.user.id,
            action: 'staff_role_change',
            table_name: 'staff',
            record_id: staff.id,
            old_values: { role_level: oldRole },
            new_values: { role_level: new_role, reason },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        logger.info(`Staff role changed: ${staff.employee_id} from ${oldRole} to ${new_role} by ${req.user.email}`);

        res.json({
            message: 'Staff role updated successfully',
            staff: await Staff.findByPk(id, {
                include: [
                    { model: School, attributes: ['name'] },
                    { model: User, attributes: ['email'] }
                ]
            })
        });

    } catch (error) {
        next(error);
    }
});

// Get all students for transfer management
router.get('/students/directory', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, school_id, grade } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = { is_active: true };
        
        if (search) {
            whereClause[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } },
                { student_id: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        if (school_id) {
            whereClause.school_id = school_id;
        }
        
        if (grade) {
            whereClause.current_grade = grade;
        }

        const students = await Student.findAndCountAll({
            where: whereClause,
            include: [{ model: School, attributes: ['name', 'school_code', 'parish'] }],
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

// Initiate student transfer
router.post('/transfers/initiate', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const {
            student_id,
            to_school_id,
            transfer_reason,
            academic_year,
            target_grade,
            effective_date,
            admin_notes
        } = req.body;

        const student = await Student.findByPk(student_id, {
            include: [{ model: School, attributes: ['id', 'name'] }]
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const toSchool = await School.findByPk(to_school_id);
        if (!toSchool) {
            return res.status(404).json({ error: 'Target school not found' });
        }

        const transfer = await StudentTransfer.create({
            student_id,
            from_school_id: student.school_id,
            to_school_id,
            initiated_by: req.user.id,
            transfer_reason,
            academic_year,
            current_grade: student.current_grade,
            target_grade,
            effective_date,
            admin_notes,
            status: 'pending'
        });

        // Create audit log
        await AuditLog.create({
            user_id: req.user.id,
            action: 'student_transfer_initiated',
            table_name: 'student_transfers',
            record_id: transfer.id,
            new_values: { 
                student_id, 
                from_school: student.School.name,
                to_school: toSchool.name,
                reason: transfer_reason
            },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        logger.info(`Student transfer initiated: ${student.student_id} from ${student.School.name} to ${toSchool.name}`);

        res.json({
            message: 'Student transfer initiated successfully',
            transfer: await StudentTransfer.findByPk(transfer.id, {
                include: [
                    { model: Student, attributes: ['student_id', 'first_name', 'last_name'] },
                    { model: School, as: 'FromSchool', attributes: ['name'] },
                    { model: School, as: 'ToSchool', attributes: ['name'] }
                ]
            })
        });

    } catch (error) {
        next(error);
    }
});

// Get all transfers with status
router.get('/transfers', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, student_search } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = {};
        if (status) {
            whereClause.status = status;
        }

        const includeClause = [
            { 
                model: Student, 
                attributes: ['student_id', 'first_name', 'last_name'],
                where: student_search ? {
                    [Op.or]: [
                        { first_name: { [Op.iLike]: `%${student_search}%` } },
                        { last_name: { [Op.iLike]: `%${student_search}%` } },
                        { student_id: { [Op.iLike]: `%${student_search}%` } }
                    ]
                } : undefined
            },
            { model: School, as: 'FromSchool', attributes: ['name', 'parish'] },
            { model: School, as: 'ToSchool', attributes: ['name', 'parish'] },
            { model: User, as: 'InitiatedBy', attributes: ['first_name', 'last_name'] },
            { model: User, as: 'ApprovedBy', attributes: ['first_name', 'last_name'], required: false }
        ];

        const transfers = await StudentTransfer.findAndCountAll({
            where: whereClause,
            include: includeClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            transfers: transfers.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(transfers.count / limit),
                total_count: transfers.count,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get audit logs
router.get('/audit-logs', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 50, action, user_id, table_name, date_from, date_to } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = {};
        
        if (action) {
            whereClause.action = action;
        }
        
        if (user_id) {
            whereClause.user_id = user_id;
        }
        
        if (table_name) {
            whereClause.table_name = table_name;
        }
        
        if (date_from || date_to) {
            whereClause.createdAt = {};
            if (date_from) {
                whereClause.createdAt[Op.gte] = new Date(date_from);
            }
            if (date_to) {
                whereClause.createdAt[Op.lte] = new Date(date_to);
            }
        }

        const auditLogs = await AuditLog.findAndCountAll({
            where: whereClause,
            include: [{ model: User, attributes: ['first_name', 'last_name', 'email'] }],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            audit_logs: auditLogs.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(auditLogs.count / limit),
                total_count: auditLogs.count,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;