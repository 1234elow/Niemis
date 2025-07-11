const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');
const { jwtManager } = require('../config/jwt');

// Token generation utility (enhanced)
const generateTokens = (userId, role, school_id, options = {}) => {
    const payload = {
        id: userId,
        role,
        school_id
    };

    // Generate different token types based on role
    if (role === 'student') {
        return jwtManager.generateStudentToken(payload);
    }

    return jwtManager.generateTokenPair(payload, options);
};

// Enhanced authentication middleware
const authMiddleware = async (req, res, next) => {
    try {
        const token = jwtManager.extractTokenFromRequest(req);
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.',
                code: 'NO_TOKEN'
            });
        }

        let decoded;
        try {
            decoded = jwtManager.verifyAccessToken(token);
        } catch (jwtError) {
            // Enhanced error handling
            let errorCode = 'INVALID_TOKEN';
            let errorMessage = 'Invalid token.';
            
            if (jwtError.message === 'jwt expired') {
                errorCode = 'TOKEN_EXPIRED';
                errorMessage = 'Token expired. Please refresh your token.';
            } else if (jwtError.message === 'Token has been revoked') {
                errorCode = 'TOKEN_REVOKED';
                errorMessage = 'Token has been revoked. Please login again.';
            } else if (jwtError.message === 'Invalid token type') {
                errorCode = 'INVALID_TOKEN_TYPE';
                errorMessage = 'Invalid token type.';
            }
            
            // Log authentication failure
            logger.logSecurity('auth_token_invalid', {
                error: jwtError.message,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path
            }, req);
            
            return res.status(401).json({ 
                error: errorMessage,
                code: errorCode
            });
        }

        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] }
        });

        if (!user) {
            return res.status(401).json({ 
                error: 'User not found.',
                code: 'USER_NOT_FOUND'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({ 
                error: 'User account is inactive.',
                code: 'USER_INACTIVE'
            });
        }

        // Validate role consistency
        if (user.role !== decoded.role) {
            logger.warn('Role mismatch in token', {
                userId: user.id,
                userRole: user.role,
                tokenRole: decoded.role,
                ip: req.ip
            });
            return res.status(401).json({ 
                error: 'Token role mismatch.',
                code: 'ROLE_MISMATCH'
            });
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        req.tokenPayload = decoded;

        // Log successful authentication
        logger.info('User authenticated successfully', {
            userId: user.id,
            role: user.role,
            email: user.email,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });

        next();
    } catch (error) {
        logger.error('Auth middleware error:', {
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });
        
        res.status(401).json({ 
            error: 'Authentication failed.',
            code: 'AUTH_FAILED'
        });
    }
};

// Role-based authorization middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required.',
                code: 'AUTH_REQUIRED'
            });
        }

        const userRole = req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(userRole)) {
            logger.warn('Access denied - insufficient permissions', {
                userId: req.user.id,
                userRole,
                requiredRoles: allowedRoles,
                path: req.path,
                ip: req.ip
            });

            return res.status(403).json({ 
                error: 'Insufficient permissions.',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: allowedRoles,
                current: userRole
            });
        }

        next();
    };
};

// School-based authorization middleware
const requireSchoolAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Authentication required.',
            code: 'AUTH_REQUIRED'
        });
    }

    const userRole = req.user.role;
    const userSchoolId = req.user.school_id;

    // Super admin has access to all schools
    if (userRole === 'super_admin') {
        return next();
    }

    // Extract school ID from request (params, query, or body)
    const requestedSchoolId = req.params.school_id || req.query.school_id || req.body.school_id;

    if (requestedSchoolId && userSchoolId && parseInt(requestedSchoolId) !== parseInt(userSchoolId)) {
        logger.warn('Access denied - school access violation', {
            userId: req.user.id,
            userRole,
            userSchoolId,
            requestedSchoolId,
            path: req.path,
            ip: req.ip
        });

        return res.status(403).json({ 
            error: 'Access denied. You can only access data from your assigned school.',
            code: 'SCHOOL_ACCESS_DENIED'
        });
    }

    next();
};

// Student data protection middleware
const requireStudentDataAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Authentication required.',
            code: 'AUTH_REQUIRED'
        });
    }

    const userRole = req.user.role;
    const userId = req.user.id;

    // Students can only access their own data
    if (userRole === 'student') {
        const requestedStudentId = req.params.student_id || req.params.id;
        
        if (requestedStudentId && parseInt(requestedStudentId) !== parseInt(userId)) {
            logger.warn('Student data access violation', {
                userId,
                requestedStudentId,
                path: req.path,
                ip: req.ip
            });

            return res.status(403).json({ 
                error: 'Students can only access their own data.',
                code: 'STUDENT_DATA_ACCESS_DENIED'
            });
        }
    }

    next();
};

// Enhanced token refresh middleware
const refreshToken = async (req, res, next) => {
    try {
        const refreshTokenValue = req.body.refreshToken || req.header('X-Refresh-Token');
        
        if (!refreshTokenValue) {
            return res.status(401).json({ 
                error: 'Refresh token required.',
                code: 'REFRESH_TOKEN_REQUIRED'
            });
        }

        let decoded;
        try {
            decoded = jwtManager.verifyRefreshToken(refreshTokenValue);
        } catch (jwtError) {
            let errorCode = 'INVALID_REFRESH_TOKEN';
            let errorMessage = 'Invalid refresh token.';
            
            if (jwtError.message === 'jwt expired') {
                errorCode = 'REFRESH_TOKEN_EXPIRED';
                errorMessage = 'Refresh token expired. Please login again.';
            } else if (jwtError.message === 'Token has been revoked') {
                errorCode = 'REFRESH_TOKEN_REVOKED';
                errorMessage = 'Refresh token has been revoked. Please login again.';
            }
            
            // Log refresh token failure
            logger.logSecurity('auth_refresh_failed', {
                error: jwtError.message,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }, req);
            
            return res.status(401).json({ 
                error: errorMessage,
                code: errorCode
            });
        }

        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] }
        });

        if (!user || !user.is_active) {
            logger.logSecurity('auth_refresh_invalid_user', {
                userId: decoded.id,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }, req);
            
            return res.status(401).json({ 
                error: 'Invalid refresh token or user inactive.',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }

        // Generate new access token (keep refresh token)
        const newTokens = jwtManager.refreshAccessToken(refreshTokenValue);
        
        // Log successful token refresh
        logger.logSecurity('auth_token_refreshed', {
            userId: user.id,
            role: user.role,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, req);
        
        res.json({
            message: 'Token refreshed successfully',
            accessToken: newTokens.accessToken,
            expiresIn: newTokens.expiresIn,
            tokenType: 'Bearer'
        });

    } catch (error) {
        logger.error('Token refresh error:', error);
        
        res.status(500).json({ 
            error: 'Internal server error during token refresh.',
            code: 'REFRESH_ERROR'
        });
    }
};

// Optional authentication middleware (for public/demo endpoints)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(); // No token provided, continue without authentication
        }

        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            return next(); // Empty token, continue without authentication
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] }
        });

        if (user && user.is_active) {
            req.user = user;
            req.token = token;
            req.tokenPayload = decoded;
        }

        next();
    } catch (error) {
        // Token verification failed, but continue without authentication
        logger.debug('Optional auth failed (continuing without auth):', error.message);
        next();
    }
};

// Token revocation middleware
const revokeToken = async (req, res, next) => {
    try {
        const { tokenJti, reason } = req.body;
        
        if (!tokenJti) {
            return res.status(400).json({
                error: 'Token JTI required for revocation',
                code: 'TOKEN_JTI_REQUIRED'
            });
        }
        
        jwtManager.revokeToken(tokenJti, reason || 'manual_revocation');
        
        logger.logSecurity('auth_token_revoked', {
            jti: tokenJti,
            reason: reason || 'manual_revocation',
            userId: req.user?.id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }, req);
        
        res.json({
            message: 'Token revoked successfully',
            jti: tokenJti
        });
        
    } catch (error) {
        logger.error('Token revocation error:', error);
        res.status(500).json({
            error: 'Failed to revoke token',
            code: 'REVOCATION_ERROR'
        });
    }
};

// Permission-based authorization middleware
const requirePermissions = (permissions = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required.',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!jwtManager.validateTokenPermissions(req.tokenPayload, permissions)) {
            logger.logSecurity('auth_insufficient_permissions', {
                userId: req.user.id,
                requiredPermissions: permissions,
                userPermissions: req.tokenPayload?.permissions || [],
                path: req.path,
                ip: req.ip
            }, req);

            return res.status(403).json({ 
                error: 'Insufficient permissions.',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: permissions,
                current: req.tokenPayload?.permissions || []
            });
        }

        next();
    };
};

// JWT health check endpoint
const jwtHealthCheck = (req, res) => {
    try {
        const health = jwtManager.healthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// JWT metrics endpoint
const jwtMetrics = (req, res) => {
    try {
        const metrics = jwtManager.getMetrics();
        res.json(metrics);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get JWT metrics',
            message: error.message
        });
    }
};

module.exports = { 
    authMiddleware, 
    requireRole, 
    requireSchoolAccess,
    requireStudentDataAccess,
    requirePermissions,
    refreshToken,
    revokeToken,
    optionalAuth,
    generateTokens,
    jwtHealthCheck,
    jwtMetrics,
    jwtManager
};