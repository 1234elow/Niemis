const express = require('express');
const { Student, Staff, School, AttendanceRecord, AcademicRecord } = require('../models');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// School summary report
router.get('/school-summary/:school_id', async (req, res, next) => {
    try {
        const { school_id } = req.params;
        
        const school = await School.findByPk(school_id);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        const studentCount = await Student.count({ where: { school_id, is_active: true } });
        const staffCount = await Staff.count({ where: { school_id, is_active: true } });
        
        const report = {
            school_info: school,
            total_students: studentCount,
            total_staff: staffCount,
            capacity_utilization: school.capacity ? Math.round((studentCount / school.capacity) * 100) : null
        };
        
        res.json({ report });
    } catch (error) {
        next(error);
    }
});

// Attendance report
router.get('/attendance', async (req, res, next) => {
    try {
        const { school_id, start_date, end_date } = req.query;
        
        const whereClause = {};
        if (school_id) whereClause.school_id = school_id;
        if (start_date && end_date) {
            whereClause.attendance_date = {
                [Op.between]: [start_date, end_date]
            };
        }
        
        const attendance = await AttendanceRecord.findAll({
            where: whereClause,
            include: [{ model: Student }, { model: School }]
        });
        
        res.json({ attendance_data: attendance });
    } catch (error) {
        next(error);
    }
});

module.exports = router;