const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, Staff, Student, Parent, AuditLog } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// Register new user
router.post('/register', [
    body('username').isLength({ min: 3, max: 50 }).isAlphanumeric(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['super_admin', 'admin', 'teacher', 'parent', 'student'])
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { username, email, password, role, profile_data } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ email }, { username }]
            }
        });

        if (existingUser) {
            return res.status(409).json({ 
                error: 'User already exists with this email or username' 
            });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Create user
        const user = await User.create({
            username,
            email,
            password_hash,
            role
        });

        // Create profile based on role
        if (role === 'teacher' && profile_data) {
            await Staff.create({
                user_id: user.id,
                ...profile_data
            });
        } else if (role === 'student' && profile_data) {
            await Student.create({
                user_id: user.id,
                ...profile_data
            });
        } else if (role === 'parent' && profile_data) {
            await Parent.create({
                user_id: user.id,
                ...profile_data
            });
        }

        // Log registration
        await AuditLog.create({
            user_id: user.id,
            action: 'USER_REGISTERED',
            table_name: 'users',
            record_id: user.id,
            new_values: { username, email, role },
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        logger.info(`New user registered: ${username} (${role})`);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        next(error);
    }
});

// Login
router.post('/login', [
    body('login').notEmpty(),
    body('password').notEmpty()
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { login, password } = req.body;

        // Find user by email or username
        const user = await User.findOne({
            where: {
                [Op.or]: [{ email: login }, { username: login }]
            }
        });

        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await user.update({ last_login: new Date() });

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Log login
        await AuditLog.create({
            user_id: user.id,
            action: 'USER_LOGIN',
            table_name: 'users',
            record_id: user.id,
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        logger.info(`User logged in: ${user.username}`);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                last_login: user.last_login
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get current user profile
router.get('/profile', async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });

    } catch (error) {
        next(error);
    }
});

// Change password
router.put('/change-password', [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 6 })
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { current_password, new_password } = req.body;

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const new_password_hash = await bcrypt.hash(new_password, saltRounds);

        // Update password
        await user.update({ password_hash: new_password_hash });

        // Log password change
        await AuditLog.create({
            user_id: user.id,
            action: 'PASSWORD_CHANGED',
            table_name: 'users',
            record_id: user.id,
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });

        logger.info(`Password changed for user: ${user.username}`);

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        next(error);
    }
});

module.exports = router;