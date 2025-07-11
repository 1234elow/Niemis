const express = require('express');
const { AttendanceRecord, Student, School } = require('../models');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Record attendance via RFID
router.post('/rfid', async (req, res, next) => {
    try {
        const { rfid_tag, device_id, timestamp } = req.body;
        
        const student = await Student.findOne({ where: { rfid_tag } });
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const attendance = await AttendanceRecord.create({
            student_id: student.id,
            school_id: student.school_id,
            attendance_date: new Date().toDateString(),
            rfid_entry_time: timestamp,
            status: 'present'
        });

        res.json({ message: 'Attendance recorded', attendance });
    } catch (error) {
        next(error);
    }
});

// Get attendance records
router.get('/', async (req, res, next) => {
    try {
        const { school_id, date } = req.query;
        const whereClause = {};
        if (school_id) whereClause.school_id = school_id;
        if (date) whereClause.attendance_date = date;

        const attendance = await AttendanceRecord.findAll({
            where: whereClause,
            include: [
                { model: Student, attributes: ['first_name', 'last_name', 'grade_level'] },
                { model: School, attributes: ['name'] }
            ]
        });
        
        res.json({ attendance });
    } catch (error) {
        next(error);
    }
});

module.exports = router;