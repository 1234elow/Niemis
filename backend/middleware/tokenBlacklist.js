const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * JWT Token Blacklist Management
 * Provides token revocation and blacklisting capabilities
 */

class TokenBlacklist {
    constructor() {
        // In-memory blacklist for development
        // In production, use Redis or database for persistence
        this.blacklistedTokens = new Map();
        this.cleanupInterval = null;
        this.startCleanupTimer();
    }

    /**
     * Add token to blacklist
     */
    addToBlacklist(token, reason = 'revoked') {
        try {
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded) {
                logger.warn('Invalid token format for blacklisting');
                return false;
            }

            const payload = decoded.payload;
            const jti = payload.jti || this.generateJTI(token);
            const expirationTime = payload.exp * 1000; // Convert to milliseconds

            this.blacklistedTokens.set(jti, {
                token,
                userId: payload.id,
                reason,
                blacklistedAt: Date.now(),
                expiresAt: expirationTime
            });

            logger.logSecurity('token_blacklisted', {
                jti,
                userId: payload.id,
                reason,
                tokenType: payload.type
            });

            return true;
        } catch (error) {
            logger.error('Error adding token to blacklist:', error);
            return false;
        }
    }

    /**
     * Check if token is blacklisted
     */
    isBlacklisted(token) {
        try {
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded) {
                return false;
            }

            const payload = decoded.payload;
            const jti = payload.jti || this.generateJTI(token);
            
            return this.blacklistedTokens.has(jti);
        } catch (error) {
            logger.error('Error checking token blacklist:', error);
            return false;
        }
    }

    /**
     * Remove token from blacklist
     */
    removeFromBlacklist(token) {
        try {
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded) {
                return false;
            }

            const payload = decoded.payload;
            const jti = payload.jti || this.generateJTI(token);
            
            return this.blacklistedTokens.delete(jti);
        } catch (error) {
            logger.error('Error removing token from blacklist:', error);
            return false;
        }
    }

    /**
     * Blacklist all tokens for a user
     */
    blacklistUserTokens(userId, reason = 'user_logout') {
        let count = 0;
        
        for (const [jti, tokenData] of this.blacklistedTokens.entries()) {
            if (tokenData.userId === userId) {
                tokenData.reason = reason;
                tokenData.blacklistedAt = Date.now();
                count++;
            }
        }

        logger.logSecurity('user_tokens_blacklisted', {
            userId,
            reason,
            tokenCount: count
        });

        return count;
    }

    /**
     * Generate JTI (JWT ID) for tokens that don't have one
     */
    generateJTI(token) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
    }

    /**
     * Clean up expired tokens from blacklist
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [jti, tokenData] of this.blacklistedTokens.entries()) {
            if (tokenData.expiresAt < now) {
                this.blacklistedTokens.delete(jti);
                removed++;
            }
        }

        if (removed > 0) {
            logger.debug(`Cleaned up ${removed} expired tokens from blacklist`);
        }

        return removed;
    }

    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        // Clean up expired tokens every hour
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000);
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Get blacklist statistics
     */
    getStats() {
        const stats = {
            totalBlacklisted: this.blacklistedTokens.size,
            byReason: {},
            byUser: {}
        };

        for (const [jti, tokenData] of this.blacklistedTokens.entries()) {
            // Count by reason
            stats.byReason[tokenData.reason] = (stats.byReason[tokenData.reason] || 0) + 1;
            
            // Count by user
            stats.byUser[tokenData.userId] = (stats.byUser[tokenData.userId] || 0) + 1;
        }

        return stats;
    }
}

// Singleton instance
const tokenBlacklist = new TokenBlacklist();

/**
 * Enhanced JWT Authentication Middleware with Blacklist Check
 */
const enhancedAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ 
                error: 'Access denied. Invalid token format.',
                code: 'INVALID_TOKEN_FORMAT'
            });
        }

        // Check if token is blacklisted
        if (tokenBlacklist.isBlacklisted(token)) {
            logger.logSecurity('blacklisted_token_used', {
                token: token.substring(0, 20) + '...',
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path
            }, req);

            return res.status(401).json({ 
                error: 'Token has been revoked.',
                code: 'TOKEN_REVOKED'
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                // Add expired token to blacklist
                tokenBlacklist.addToBlacklist(token, 'expired');
                
                return res.status(401).json({ 
                    error: 'Token expired. Please refresh your token.',
                    code: 'TOKEN_EXPIRED'
                });
            } else if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    error: 'Invalid token.',
                    code: 'INVALID_TOKEN'
                });
            } else {
                throw jwtError;
            }
        }

        // Verify token type
        if (decoded.type && decoded.type !== 'access') {
            return res.status(401).json({ 
                error: 'Invalid token type.',
                code: 'INVALID_TOKEN_TYPE'
            });
        }

        // Find user
        const { User } = require('../models');
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] }
        });

        if (!user) {
            // Add token to blacklist if user not found
            tokenBlacklist.addToBlacklist(token, 'user_not_found');
            
            return res.status(401).json({ 
                error: 'User not found.',
                code: 'USER_NOT_FOUND'
            });
        }

        if (!user.is_active) {
            // Add token to blacklist if user is inactive
            tokenBlacklist.addToBlacklist(token, 'user_inactive');
            
            return res.status(401).json({ 
                error: 'User account is inactive.',
                code: 'USER_INACTIVE'
            });
        }

        // Validate role consistency
        if (user.role !== decoded.role) {
            logger.logSecurity('role_mismatch', {
                userId: user.id,
                userRole: user.role,
                tokenRole: decoded.role,
                ip: req.ip
            }, req);

            // Add token to blacklist due to role mismatch
            tokenBlacklist.addToBlacklist(token, 'role_mismatch');
            
            return res.status(401).json({ 
                error: 'Token role mismatch.',
                code: 'ROLE_MISMATCH'
            });
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        req.tokenPayload = decoded;

        next();
    } catch (error) {
        logger.error('Enhanced auth middleware error:', error);
        
        res.status(401).json({ 
            error: 'Authentication failed.',
            code: 'AUTH_FAILED'
        });
    }
};

/**
 * Enhanced Token Refresh Middleware with Blacklist Support
 */
const enhancedRefreshToken = async (req, res, next) => {
    try {
        const refreshToken = req.body.refreshToken || req.header('X-Refresh-Token');
        
        if (!refreshToken) {
            return res.status(401).json({ 
                error: 'Refresh token required.',
                code: 'REFRESH_TOKEN_REQUIRED'
            });
        }

        // Check if refresh token is blacklisted
        if (tokenBlacklist.isBlacklisted(refreshToken)) {
            logger.logSecurity('blacklisted_refresh_token_used', {
                token: refreshToken.substring(0, 20) + '...',
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }, req);

            return res.status(401).json({ 
                error: 'Refresh token has been revoked.',
                code: 'REFRESH_TOKEN_REVOKED'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        
        if (decoded.type !== 'refresh') {
            return res.status(401).json({ 
                error: 'Invalid refresh token type.',
                code: 'INVALID_REFRESH_TOKEN_TYPE'
            });
        }

        // Find user
        const { User } = require('../models');
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] }
        });

        if (!user || !user.is_active) {
            // Add refresh token to blacklist if user not found or inactive
            tokenBlacklist.addToBlacklist(refreshToken, 'user_invalid');
            
            return res.status(401).json({ 
                error: 'Invalid refresh token or user inactive.',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }

        // Generate new tokens
        const { generateTokens } = require('./auth');
        const tokens = generateTokens(user.id, user.role, user.school_id);
        
        // Add old refresh token to blacklist
        tokenBlacklist.addToBlacklist(refreshToken, 'refreshed');
        
        logger.logSecurity('token_refreshed', {
            userId: user.id,
            userRole: user.role,
            ip: req.ip
        }, req);

        res.json({
            message: 'Token refreshed successfully',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });

    } catch (error) {
        logger.error('Enhanced token refresh error:', error);
        
        if (error.name === 'TokenExpiredError') {
            // Add expired refresh token to blacklist
            if (req.body.refreshToken) {
                tokenBlacklist.addToBlacklist(req.body.refreshToken, 'expired');
            }
            
            return res.status(401).json({ 
                error: 'Refresh token expired. Please login again.',
                code: 'REFRESH_TOKEN_EXPIRED'
            });
        }

        res.status(401).json({ 
            error: 'Invalid refresh token.',
            code: 'INVALID_REFRESH_TOKEN'
        });
    }
};

/**
 * Logout Endpoint with Token Blacklisting
 */
const enhancedLogout = async (req, res) => {
    try {
        const token = req.token;
        const refreshToken = req.body.refreshToken || req.header('X-Refresh-Token');
        
        // Add access token to blacklist
        if (token) {
            tokenBlacklist.addToBlacklist(token, 'logout');
        }
        
        // Add refresh token to blacklist
        if (refreshToken) {
            tokenBlacklist.addToBlacklist(refreshToken, 'logout');
        }

        logger.logSecurity('user_logout', {
            userId: req.user?.id,
            userRole: req.user?.role,
            ip: req.ip
        }, req);

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        logger.error('Enhanced logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
};

/**
 * Logout All Sessions Endpoint
 */
const logoutAllSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Blacklist all user tokens
        const count = tokenBlacklist.blacklistUserTokens(userId, 'logout_all');
        
        logger.logSecurity('user_logout_all', {
            userId,
            userRole: req.user?.role,
            tokensRevoked: count,
            ip: req.ip
        }, req);

        res.json({ 
            message: 'All sessions logged out successfully',
            tokensRevoked: count
        });
    } catch (error) {
        logger.error('Logout all sessions error:', error);
        res.status(500).json({ error: 'Logout all failed' });
    }
};

/**
 * Admin endpoint to get blacklist statistics
 */
const getBlacklistStats = (req, res) => {
    try {
        const stats = tokenBlacklist.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('Get blacklist stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
};

module.exports = {
    tokenBlacklist,
    enhancedAuthMiddleware,
    enhancedRefreshToken,
    enhancedLogout,
    logoutAllSessions,
    getBlacklistStats
};