const express = require('express');
const { RFIDDevice, Student, AttendanceRecord } = require('../models');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// RFID device registration
router.post('/devices', requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const device = await RFIDDevice.create(req.body);
        res.status(201).json({ device });
    } catch (error) {
        next(error);
    }
});

// RFID scan endpoint
router.post('/scan', async (req, res, next) => {
    try {
        const { rfid_tag, device_id } = req.body;
        
        const student = await Student.findOne({ where: { rfid_tag } });
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Record attendance
        const attendance = await AttendanceRecord.findOrCreate({
            where: {
                student_id: student.id,
                attendance_date: new Date().toISOString().split('T')[0]
            },
            defaults: {
                student_id: student.id,
                school_id: student.school_id,
                attendance_date: new Date().toISOString().split('T')[0],
                status: 'present',
                rfid_entry_time: new Date()
            }
        });

        res.json({ 
            message: 'RFID scan processed',
            student: {
                name: `${student.first_name} ${student.last_name}`,
                grade: student.grade_level
            },
            attendance: attendance[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;