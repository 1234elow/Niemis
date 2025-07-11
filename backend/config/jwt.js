const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Enhanced JWT Security Configuration for NiEMIS
 * Provides comprehensive JWT token management with security best practices
 */

class JWTManager {
    constructor() {
        this.secret = process.env.JWT_SECRET;
        this.refreshSecret = process.env.JWT_REFRESH_SECRET;
        this.issuer = process.env.JWT_ISSUER || 'niemis-backend';
        this.audience = process.env.JWT_AUDIENCE || 'niemis-clients';
        this.algorithm = 'HS256';
        this.accessTokenExpiry = process.env.JWT_EXPIRES_IN || '15m';
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        this.blacklistedTokens = new Set();
        this.tokenMetrics = {
            issued: 0,
            refreshed: 0,
            revoked: 0,
            failed: 0
        };
        
        this.validateConfiguration();
    }

    /**
     * Validate JWT configuration
     */
    validateConfiguration() {
        if (!this.secret || this.secret.length < 32) {
            throw new Error('JWT_SECRET must be at least 32 characters long');
        }
        
        if (!this.refreshSecret || this.refreshSecret.length < 32) {
            throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
        }
        
        if (this.secret === this.refreshSecret) {
            throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
        }
    }

    /**
     * Generate secure JWT token
     */
    generateAccessToken(payload, options = {}) {
        try {
            const tokenPayload = {
                ...payload,
                iat: Math.floor(Date.now() / 1000),
                jti: crypto.randomBytes(16).toString('hex'), // JWT ID for tracking
                type: 'access'
            };

            const tokenOptions = {
                issuer: this.issuer,
                audience: this.audience,
                expiresIn: options.expiresIn || this.accessTokenExpiry,
                algorithm: this.algorithm,
                ...options
            };

            const token = jwt.sign(tokenPayload, this.secret, tokenOptions);
            this.tokenMetrics.issued++;
            
            logger.info('Access token generated', {
                userId: payload.id,
                jti: tokenPayload.jti,
                expiresIn: tokenOptions.expiresIn
            });

            return {
                token,
                jti: tokenPayload.jti,
                expiresIn: tokenOptions.expiresIn
            };
        } catch (error) {
            this.tokenMetrics.failed++;
            logger.error('Access token generation failed:', error);
            throw new Error('Failed to generate access token');
        }
    }

    /**
     * Generate secure refresh token
     */
    generateRefreshToken(payload, options = {}) {
        try {
            const tokenPayload = {
                id: payload.id,
                role: payload.role,
                school_id: payload.school_id,
                iat: Math.floor(Date.now() / 1000),
                jti: crypto.randomBytes(16).toString('hex'),
                type: 'refresh'
            };

            const tokenOptions = {
                issuer: this.issuer,
                audience: this.audience,
                expiresIn: options.expiresIn || this.refreshTokenExpiry,
                algorithm: this.algorithm,
                ...options
            };

            const token = jwt.sign(tokenPayload, this.refreshSecret, tokenOptions);
            
            logger.info('Refresh token generated', {
                userId: payload.id,
                jti: tokenPayload.jti,
                expiresIn: tokenOptions.expiresIn
            });

            return {
                token,
                jti: tokenPayload.jti,
                expiresIn: tokenOptions.expiresIn
            };
        } catch (error) {
            this.tokenMetrics.failed++;
            logger.error('Refresh token generation failed:', error);
            throw new Error('Failed to generate refresh token');
        }
    }

    /**
     * Generate token pair
     */
    generateTokenPair(payload, options = {}) {
        const accessToken = this.generateAccessToken(payload, options.access);
        const refreshToken = this.generateRefreshToken(payload, options.refresh);

        return {
            accessToken: accessToken.token,
            refreshToken: refreshToken.token,
            accessTokenJti: accessToken.jti,
            refreshTokenJti: refreshToken.jti,
            expiresIn: accessToken.expiresIn
        };
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token, options = {}) {
        try {
            const decoded = jwt.verify(token, this.secret, {
                issuer: this.issuer,
                audience: this.audience,
                algorithms: [this.algorithm],
                ...options
            });

            // Check if token is blacklisted
            if (this.isTokenBlacklisted(decoded.jti)) {
                throw new Error('Token has been revoked');
            }

            // Verify token type
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            this.tokenMetrics.failed++;
            logger.warn('Access token verification failed', {
                error: error.message,
                token: token.substring(0, 20) + '...'
            });
            throw error;
        }
    }

    /**
     * Verify refresh token
     */
    verifyRefreshToken(token, options = {}) {
        try {
            const decoded = jwt.verify(token, this.refreshSecret, {
                issuer: this.issuer,
                audience: this.audience,
                algorithms: [this.algorithm],
                ...options
            });

            // Check if token is blacklisted
            if (this.isTokenBlacklisted(decoded.jti)) {
                throw new Error('Token has been revoked');
            }

            // Verify token type
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            this.tokenMetrics.failed++;
            logger.warn('Refresh token verification failed', {
                error: error.message,
                token: token.substring(0, 20) + '...'
            });
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    refreshAccessToken(refreshToken) {
        try {
            const decoded = this.verifyRefreshToken(refreshToken);
            
            // Generate new access token
            const newAccessToken = this.generateAccessToken({
                id: decoded.id,
                role: decoded.role,
                school_id: decoded.school_id
            });

            this.tokenMetrics.refreshed++;
            
            logger.info('Access token refreshed', {
                userId: decoded.id,
                oldJti: decoded.jti,
                newJti: newAccessToken.jti
            });

            return {
                accessToken: newAccessToken.token,
                accessTokenJti: newAccessToken.jti,
                expiresIn: newAccessToken.expiresIn
            };
        } catch (error) {
            this.tokenMetrics.failed++;
            logger.error('Token refresh failed:', error);
            throw error;
        }
    }

    /**
     * Revoke token (add to blacklist)
     */
    revokeToken(jti, reason = 'manual_revocation') {
        this.blacklistedTokens.add(jti);
        this.tokenMetrics.revoked++;
        
        logger.info('Token revoked', { jti, reason });
        
        // Clean up old blacklisted tokens periodically
        if (this.blacklistedTokens.size > 10000) {
            this.cleanupBlacklist();
        }
    }

    /**
     * Check if token is blacklisted
     */
    isTokenBlacklisted(jti) {
        return this.blacklistedTokens.has(jti);
    }

    /**
     * Clean up expired tokens from blacklist
     */
    cleanupBlacklist() {
        // Note: In production, this should be handled by a persistent store
        // For now, we'll clear old entries periodically
        if (this.blacklistedTokens.size > 5000) {
            const tokensToKeep = Array.from(this.blacklistedTokens).slice(-5000);
            this.blacklistedTokens.clear();
            tokensToKeep.forEach(jti => this.blacklistedTokens.add(jti));
            
            logger.info('Blacklist cleaned up', {
                tokensRemoved: this.blacklistedTokens.size - 5000,
                tokensRemaining: 5000
            });
        }
    }

    /**
     * Extract token from request
     */
    extractTokenFromRequest(req) {
        // Check Authorization header
        const authHeader = req.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Check query parameter (not recommended for production)
        if (req.query.token && process.env.NODE_ENV !== 'production') {
            return req.query.token;
        }

        // Check cookies
        if (req.cookies && req.cookies.access_token) {
            return req.cookies.access_token;
        }

        return null;
    }

    /**
     * Generate token for student with restricted permissions
     */
    generateStudentToken(studentPayload) {
        const restrictedPayload = {
            id: studentPayload.id,
            role: 'student',
            school_id: studentPayload.school_id,
            permissions: ['read:own_profile', 'read:own_grades', 'read:own_attendance'],
            scope: 'student_dashboard'
        };

        return this.generateTokenPair(restrictedPayload, {
            access: { expiresIn: '30m' }, // Shorter expiry for students
            refresh: { expiresIn: '1d' }
        });
    }

    /**
     * Validate token permissions
     */
    validateTokenPermissions(decoded, requiredPermissions = []) {
        if (!requiredPermissions.length) {
            return true;
        }

        const tokenPermissions = decoded.permissions || [];
        return requiredPermissions.every(permission => 
            tokenPermissions.includes(permission) || 
            tokenPermissions.includes('*')
        );
    }

    /**
     * Get token metrics
     */
    getMetrics() {
        return {
            ...this.tokenMetrics,
            blacklistedTokens: this.blacklistedTokens.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Health check for JWT manager
     */
    healthCheck() {
        try {
            // Test token generation and verification
            const testPayload = { id: 'test', role: 'test' };
            const testToken = this.generateAccessToken(testPayload);
            this.verifyAccessToken(testToken.token);
            
            return {
                status: 'healthy',
                configuration: {
                    algorithm: this.algorithm,
                    issuer: this.issuer,
                    audience: this.audience,
                    accessTokenExpiry: this.accessTokenExpiry,
                    refreshTokenExpiry: this.refreshTokenExpiry
                },
                metrics: this.getMetrics(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Rotate JWT secrets (for security)
     */
    rotateSecrets(newSecret, newRefreshSecret) {
        if (!newSecret || newSecret.length < 32) {
            throw new Error('New JWT secret must be at least 32 characters long');
        }
        
        if (!newRefreshSecret || newRefreshSecret.length < 32) {
            throw new Error('New JWT refresh secret must be at least 32 characters long');
        }
        
        if (newSecret === newRefreshSecret) {
            throw new Error('New secrets must be different');
        }

        const oldSecret = this.secret;
        const oldRefreshSecret = this.refreshSecret;
        
        this.secret = newSecret;
        this.refreshSecret = newRefreshSecret;
        
        logger.info('JWT secrets rotated', {
            timestamp: new Date().toISOString(),
            reason: 'manual_rotation'
        });
        
        return {
            success: true,
            rotatedAt: new Date().toISOString(),
            oldSecretHash: crypto.createHash('sha256').update(oldSecret).digest('hex').substring(0, 8),
            newSecretHash: crypto.createHash('sha256').update(newSecret).digest('hex').substring(0, 8)
        };
    }
}

// Singleton instance
const jwtManager = new JWTManager();

module.exports = {
    JWTManager,
    jwtManager
};