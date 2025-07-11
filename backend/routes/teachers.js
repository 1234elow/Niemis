const express = require('express');
const { Staff, School, TeacherEvaluation, ProfessionalDevelopment } = require('../models');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all teachers
router.get('/', async (req, res, next) => {
    try {
        const teachers = await Staff.findAll({
            where: { is_active: true },
            include: [{ model: School, attributes: ['name'] }]
        });
        res.json({ teachers });
    } catch (error) {
        next(error);
    }
});

// Get teacher by ID
router.get('/:id', async (req, res, next) => {
    try {
        const teacher = await Staff.findByPk(req.params.id, {
            include: [{ model: School, attributes: ['name'] }]
        });
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        res.json({ teacher });
    } catch (error) {
        next(error);
    }
});

module.exports = router;