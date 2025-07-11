const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { School, Zone, Parish, Staff, Student, Facility, Op } = require('../models');
const { requireRole } = require('../middleware/auth');
const BarbadosSchoolImporter = require('../services/barbadosSchoolImporter');
const logger = require('../utils/logger');

const router = express.Router();

// Get all schools with filtering and pagination
router.get('/', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('school_type').optional().isIn(['pre_primary', 'primary', 'secondary']),
    query('zone_id').optional().isUUID(),
    query('parish_id').optional().isUUID()
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
            school_type, 
            zone_id, 
            parish_id, 
            search 
        } = req.query;

        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = { is_active: true };
        if (school_type) whereClause.school_type = school_type;
        if (zone_id) whereClause.zone_id = zone_id;
        if (parish_id) whereClause.parish_id = parish_id;
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { principal_name: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const schools = await School.findAndCountAll({
            where: whereClause,
            include: [
                { model: Zone, attributes: ['id', 'name'] },
                { model: Parish, attributes: ['id', 'name', 'code'] }
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

// Get school by ID with detailed information
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const school = await School.findByPk(id, {
            include: [
                { model: Zone, attributes: ['id', 'name', 'description'] },
                { model: Parish, attributes: ['id', 'name', 'code'] },
                { 
                    model: Staff, 
                    attributes: ['id', 'first_name', 'last_name', 'position', 'is_active'],
                    where: { is_active: true },
                    required: false
                },
                {
                    model: Student,
                    attributes: ['id', 'grade_level'],
                    where: { is_active: true },
                    required: false
                },
                {
                    model: Facility,
                    attributes: ['id', 'facility_name', 'facility_type', 'condition_status'],
                    where: { is_active: true },
                    required: false
                }
            ]
        });

        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        // Calculate statistics
        const stats = {
            total_staff: school.Staff ? school.Staff.length : 0,
            total_students: school.Students ? school.Students.length : 0,
            total_facilities: school.Facilities ? school.Facilities.length : 0,
            students_by_grade: school.Students ? 
                school.Students.reduce((acc, student) => {
                    acc[student.grade_level] = (acc[student.grade_level] || 0) + 1;
                    return acc;
                }, {}) : {}
        };

        res.json({
            school: {
                ...school.toJSON(),
                statistics: stats
            }
        });

    } catch (error) {
        next(error);
    }
});

// Create new school (Super Admin/Admin only)
router.post('/', requireRole(['super_admin', 'admin']), [
    body('name').isLength({ min: 2, max: 200 }),
    body('school_type').isIn(['pre_primary', 'primary', 'secondary']),
    body('zone_id').isUUID(),
    body('parish_id').isUUID(),
    body('email').optional().isEmail(),
    body('phone').optional().matches(/^[\+]?[0-9\s\-\(\)]+$/),
    body('capacity').optional().isInt({ min: 1 })
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const school = await School.create(req.body);

        logger.info(`New school created: ${school.name} by user ${req.user.id}`);

        res.status(201).json({
            message: 'School created successfully',
            school
        });

    } catch (error) {
        next(error);
    }
});

// Update school (Super Admin/Admin only)
router.put('/:id', requireRole(['super_admin', 'admin']), [
    body('name').optional().isLength({ min: 2, max: 200 }),
    body('school_type').optional().isIn(['pre_primary', 'primary', 'secondary']),
    body('zone_id').optional().isUUID(),
    body('parish_id').optional().isUUID(),
    body('email').optional().isEmail(),
    body('phone').optional().matches(/^[\+]?[0-9\s\-\(\)]+$/),
    body('capacity').optional().isInt({ min: 1 })
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
        const school = await School.findByPk(id);

        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        await school.update(req.body);

        logger.info(`School updated: ${school.name} by user ${req.user.id}`);

        res.json({
            message: 'School updated successfully',
            school
        });

    } catch (error) {
        next(error);
    }
});

// Get school statistics
router.get('/:id/statistics', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { year, month } = req.query;

        const school = await School.findByPk(id);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        // Get current enrollment
        const enrollment = await Student.count({
            where: { school_id: id, is_active: true }
        });

        // Get staff count
        const staffCount = await Staff.count({
            where: { school_id: id, is_active: true }
        });

        // Get facilities count
        const facilitiesCount = await Facility.count({
            where: { school_id: id, is_active: true }
        });

        const statistics = {
            enrollment,
            staff_count: staffCount,
            facilities_count: facilitiesCount,
            capacity_utilization: school.capacity ? 
                Math.round((enrollment / school.capacity) * 100) : null
        };

        res.json({ statistics });

    } catch (error) {
        next(error);
    }
});

// Soft delete school (Super Admin only)
router.delete('/:id', requireRole(['super_admin']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const school = await School.findByPk(id);

        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        await school.update({ is_active: false });

        logger.info(`School deactivated: ${school.name} by user ${req.user.id}`);

        res.json({ message: 'School deactivated successfully' });

    } catch (error) {
        next(error);
    }
});

// ==================== BARBADOS SPECIFIC ROUTES ====================

// Import all Barbados schools from government data (public endpoint for demo)
router.post('/import-barbados', async (req, res, next) => {
    try {
        const importer = new BarbadosSchoolImporter();
        const result = await importer.importSchools();
        
        logger.info('Barbados schools import completed', result);
        res.json({
            message: 'Barbados schools imported successfully',
            ...result
        });
        
    } catch (error) {
        logger.error('Barbados schools import failed:', error);
        next(error);
    }
});

// Get schools by Barbados parish
router.get('/by-parish/:parish', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res, next) => {
    try {
        const { parish } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        const validParishes = ['st_michael', 'christ_church', 'st_philip', 'st_james', 'st_john', 'st_andrew', 'st_george', 'st_peter', 'st_lucy'];
        if (!validParishes.includes(parish)) {
            return res.status(400).json({ 
                error: 'Invalid parish', 
                valid_parishes: validParishes 
            });
        }
        
        const schools = await School.findAndCountAll({
            where: { 
                parish,
                is_active: true 
            },
            attributes: [
                'id', 'name', 'school_code', 'school_category', 'parish', 
                'student_population', 'principal_name', 'phone', 'email'
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']]
        });
        
        res.json({
            parish,
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

// Get schools by category (primary, secondary, nursery, special, tertiary)
router.get('/by-category/:category', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res, next) => {
    try {
        const { category } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        const validCategories = ['primary', 'secondary', 'nursery', 'special', 'tertiary'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ 
                error: 'Invalid category', 
                valid_categories: validCategories 
            });
        }
        
        const schools = await School.findAndCountAll({
            where: { 
                school_category: category,
                is_active: true 
            },
            attributes: [
                'id', 'name', 'school_code', 'school_category', 'parish', 
                'student_population', 'principal_name', 'phone', 'email'
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']]
        });
        
        res.json({
            category,
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

// Get comprehensive school dashboard data
router.get('/:id/dashboard', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const school = await School.findByPk(id, {
            attributes: [
                'id', 'name', 'school_code', 'school_category', 'parish',
                'student_population', 'principal_name', 'phone', 'email',
                'address', 'description', 'last_enrollment_update'
            ]
        });
        
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }
        
        // Get current enrollment from actual student records
        const actualEnrollment = await Student.count({
            where: { school_id: id, is_active: true }
        });
        
        // Get staff count
        const staffCount = await Staff.count({
            where: { school_id: id, is_active: true }
        });
        
        // Get grade level distribution
        const gradeDistribution = await Student.findAll({
            where: { school_id: id, is_active: true },
            attributes: [
                'grade_level',
                [Student.sequelize.fn('COUNT', '*'), 'count']
            ],
            group: ['grade_level'],
            raw: true
        });
        
        const dashboard = {
            school: school.toJSON(),
            statistics: {
                reported_population: school.student_population,
                actual_enrollment: actualEnrollment,
                staff_count: staffCount,
                student_teacher_ratio: staffCount > 0 ? (actualEnrollment / staffCount).toFixed(1) : null,
                grade_distribution: gradeDistribution
            }
        };
        
        res.json(dashboard);
        
    } catch (error) {
        next(error);
    }
});

// Get Barbados education system statistics
router.get('/statistics/barbados', async (req, res, next) => {
    try {
        // Overall statistics
        const totalSchools = await School.count({ where: { is_active: true } });
        const totalPopulation = await School.sum('student_population', {
            where: { 
                is_active: true,
                student_population: { [Op.not]: null }
            }
        });
        
        // By category
        const categoryStats = await School.findAll({
            attributes: [
                'school_category',
                [School.sequelize.fn('COUNT', '*'), 'count'],
                [School.sequelize.fn('SUM', School.sequelize.col('student_population')), 'total_students']
            ],
            where: { is_active: true },
            group: ['school_category'],
            raw: true
        });
        
        // By parish
        const parishStats = await School.findAll({
            attributes: [
                'parish',
                [School.sequelize.fn('COUNT', '*'), 'count'],
                [School.sequelize.fn('SUM', School.sequelize.col('student_population')), 'total_students']
            ],
            where: { is_active: true },
            group: ['parish'],
            raw: true
        });
        
        res.json({
            overview: {
                total_schools: totalSchools,
                total_students: totalPopulation || 0,
                last_updated: new Date().toISOString()
            },
            by_category: categoryStats,
            by_parish: parishStats
        });
        
    } catch (error) {
        next(error);
    }
});

// Update school enrollment population
router.put('/:id/enrollment', [
    body('student_population').isInt({ min: 0 }).withMessage('Student population must be a non-negative integer')
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
        const { student_population } = req.body;
        
        const school = await School.findByPk(id);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }
        
        await school.update({
            student_population,
            last_enrollment_update: new Date().toISOString().split('T')[0]
        });
        
        logger.info(`School enrollment updated: ${school.name} to ${student_population} students`);
        
        res.json({
            message: 'Enrollment updated successfully',
            school_name: school.name,
            new_population: student_population,
            updated_at: school.last_enrollment_update
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;