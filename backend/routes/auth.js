const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, Staff, Student, Parent, AuditLog } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { authMiddleware } = require('../middleware/auth');
const { resolveAccessContextForUser, getAccessControlMatrix } = require('../middleware/accessControl');

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
            try {
                await AuditLog.create({
                    user_id: user?.id || null,
                    action: 'USER_LOGIN_FAILED',
                    table_name: 'users',
                    record_id: user?.id || null,
                    new_values: {
                        reason: !user ? 'user_not_found' : 'user_inactive',
                        login_identifier: String(login || '').slice(0, 120)
                    },
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });
            } catch (auditError) {
                logger.warn('Failed to log USER_LOGIN_FAILED (missing/inactive user)', {
                    error: auditError.message
                });
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            try {
                await AuditLog.create({
                    user_id: user.id,
                    action: 'USER_LOGIN_FAILED',
                    table_name: 'users',
                    record_id: user.id,
                    new_values: {
                        reason: 'invalid_password',
                        login_identifier: String(login || '').slice(0, 120)
                    },
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });
            } catch (auditError) {
                logger.warn('Failed to log USER_LOGIN_FAILED (invalid password)', {
                    error: auditError.message
                });
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await user.update({ last_login: new Date() });

        // Generate JWT token using JWT manager
        const { jwtManager } = require('../config/jwt');
        const tokenResult = jwtManager.generateAccessToken({
            id: user.id, 
            username: user.username, 
            role: user.role 
        });
        const token = tokenResult.token;

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

        const access = await resolveAccessContextForUser(user);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                last_login: user.last_login
            },
            access: access ? {
                access_role: access.access_role,
                scope: access.scope,
                school_id: access.school_id,
                permissions: access.permissions
            } : null
        });

    } catch (error) {
        next(error);
    }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password_hash'] }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const access = await resolveAccessContextForUser(user);

        res.json({
            user,
            access: access ? {
                access_role: access.access_role,
                scope: access.scope,
                school_id: access.school_id,
                permissions: access.permissions
            } : null
        });

    } catch (error) {
        next(error);
    }
});

// Access profile for current user
router.get('/access', authMiddleware, async (req, res, next) => {
    try {
        const access = await resolveAccessContextForUser(req.user);
        res.json({
            access: access ? {
                access_role: access.access_role,
                scope: access.scope,
                school_id: access.school_id,
                staff_id: access.staff_id,
                student_id: access.student_id,
                parent_id: access.parent_id,
                child_student_ids: access.child_student_ids,
                permissions: access.permissions
            } : null
        });
    } catch (error) {
        next(error);
    }
});

// Access matrix (Super Admin only)
router.get('/access-matrix', authMiddleware, async (req, res, next) => {
    try {
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({
                error: 'Only Super Admin can view the full access-control matrix.',
                code: 'ACCESS_MATRIX_FORBIDDEN'
            });
        }

        res.json(getAccessControlMatrix());
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
