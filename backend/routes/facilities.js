const express = require('express');
const { Facility, School, InventoryItem } = require('../models');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all facilities
router.get('/', async (req, res, next) => {
    try {
        const { school_id } = req.query;
        const whereClause = { is_active: true };
        if (school_id) whereClause.school_id = school_id;

        const facilities = await Facility.findAll({
            where: whereClause,
            include: [{ model: School, attributes: ['name'] }]
        });
        
        res.json({ facilities });
    } catch (error) {
        next(error);
    }
});

// Create facility
router.post('/', requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const facility = await Facility.create(req.body);
        res.status(201).json({ facility });
    } catch (error) {
        next(error);
    }
});

module.exports = router;