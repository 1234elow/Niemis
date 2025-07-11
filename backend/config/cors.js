const logger = require('../utils/logger');

/**
 * Enhanced CORS Configuration for NiEMIS
 * Provides comprehensive Cross-Origin Resource Sharing policies for production security
 */

const isProduction = process.env.NODE_ENV === 'production';
const isRender = process.env.RENDER === 'true';

class CORSManager {
    constructor() {
        this.config = this.buildCORSConfig();
        this.corsViolations = [];
        this.maxViolations = 1000;
        this.trustedDomains = new Set(this.getTrustedDomains());
        this.tempAllowedOrigins = new Map(); // For development/testing
    }

    /**
     * Get trusted domains for the education system
     */
    getTrustedDomains() {
        const baseDomains = [
            // Primary application domains
            process.env.FRONTEND_URL,
            process.env.APP_URL,
            
            // Development domains
            ...(isProduction ? [] : [
                'http://localhost:3000',
                'https://localhost:3000',
                'http://127.0.0.1:3000',
                'https://127.0.0.1:3000'
            ]),
            
            // Production domains
            'https://niemis.gov.bb',
            'https://www.niemis.gov.bb',
            'https://api.niemis.gov.bb',
            'https://app.niemis.gov.bb',
            
            // Render.com domains
            ...(isRender ? [
                'https://niemis.onrender.com',
                'https://niemis-frontend.onrender.com'
            ] : []),
            
            // Government domains
            'https://*.gov.bb',
            'https://moe.gov.bb',
            'https://www.moe.gov.bb',
            'https://education.gov.bb',
            
            // Caribbean education integration
            'https://cec.edu.bb',
            'https://www.cec.edu.bb',
            'https://api.cec.edu.bb',
            
            // Mobile app domains (if applicable)
            'https://mobile.niemis.gov.bb',
            'file://', // For mobile apps
            'capacitor://', // For Capacitor apps
            'ionic://', // For Ionic apps
            
            // Testing domains
            ...(process.env.NODE_ENV === 'test' ? [
                'http://localhost:*',
                'https://localhost:*'
            ] : [])
        ].filter(Boolean);
        
        return baseDomains;
    }

    /**
     * Build comprehensive CORS configuration
     */
    buildCORSConfig() {
        return {
            origin: (origin, callback) => this.handleOriginValidation(origin, callback),
            methods: this.getAllowedMethods(),
            allowedHeaders: this.getAllowedHeaders(),
            exposedHeaders: this.getExposedHeaders(),
            credentials: this.shouldAllowCredentials(),
            maxAge: this.getCacheMaxAge(),
            preflightContinue: false,
            optionsSuccessStatus: 204
        };
    }

    /**
     * Handle origin validation with comprehensive security checks
     */
    handleOriginValidation(origin, callback) {
        const startTime = Date.now();
        
        try {
            // Allow requests with no origin (mobile apps, Postman, curl, etc.)
            if (!origin) {
                logger.debug('CORS: No origin header - allowing request');
                return callback(null, true);
            }

            // Parse origin URL for validation
            let originURL;
            try {
                originURL = new URL(origin);
            } catch (error) {
                this.logCORSViolation(origin, 'invalid_origin_format', null);
                return callback(new Error('Invalid origin format'), false);
            }

            // Check against trusted domains
            if (this.isTrustedOrigin(origin, originURL)) {
                logger.debug('CORS: Trusted origin allowed', { origin });
                return callback(null, true);
            }

            // Check temporary allowed origins (for development)
            if (this.tempAllowedOrigins.has(origin)) {
                const allowedUntil = this.tempAllowedOrigins.get(origin);
                if (Date.now() < allowedUntil) {
                    logger.debug('CORS: Temporary origin allowed', { origin });
                    return callback(null, true);
                } else {
                    this.tempAllowedOrigins.delete(origin);
                }
            }

            // Government domain wildcard matching (*.gov.bb)
            if (this.isGovernmentDomain(originURL)) {
                logger.info('CORS: Government domain allowed', { origin });
                return callback(null, true);
            }

            // Educational institution domain checking
            if (this.isEducationalDomain(originURL)) {
                logger.info('CORS: Educational domain allowed', { origin });
                return callback(null, true);
            }

            // Localhost development (non-production only)
            if (!isProduction && this.isLocalhost(originURL)) {
                logger.debug('CORS: Localhost allowed in development', { origin });
                return callback(null, true);
            }

            // Default: reject unknown origins
            this.logCORSViolation(origin, 'untrusted_origin', originURL);
            const error = new Error('Origin not allowed by CORS policy');
            error.statusCode = 403;
            return callback(error, false);

        } catch (error) {
            logger.error('CORS origin validation error:', error);
            return callback(new Error('CORS validation failed'), false);
        } finally {
            const duration = Date.now() - startTime;
            if (duration > 100) { // Log slow CORS checks
                logger.warn('Slow CORS validation', { origin, duration });
            }
        }
    }

    /**
     * Check if origin is trusted
     */
    isTrustedOrigin(origin, originURL) {
        // Direct match
        if (this.trustedDomains.has(origin)) {
            return true;
        }

        // Protocol + hostname + port match
        const fullOrigin = `${originURL.protocol}//${originURL.host}`;
        if (this.trustedDomains.has(fullOrigin)) {
            return true;
        }

        // Check wildcards
        for (const trusted of this.trustedDomains) {
            if (trusted.includes('*')) {
                const pattern = trusted.replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                if (regex.test(origin)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if domain is a government domain
     */
    isGovernmentDomain(originURL) {
        const hostname = originURL.hostname.toLowerCase();
        
        // Barbados government domains
        if (hostname.endsWith('.gov.bb') || hostname === 'gov.bb') {
            return originURL.protocol === 'https:'; // Must be HTTPS
        }
        
        // Other Caribbean government domains
        const govPatterns = [
            /\.gov\.(bb|tt|jm|gy|sr|gd|lc|vc|dm|ag|kn|ms|ai|tc|vg|ky)$/,
            /\.government\.(bb|tt|jm)$/
        ];
        
        return govPatterns.some(pattern => pattern.test(hostname)) && 
               originURL.protocol === 'https:';
    }

    /**
     * Check if domain is an educational institution
     */
    isEducationalDomain(originURL) {
        const hostname = originURL.hostname.toLowerCase();
        
        // Educational domain patterns
        const eduPatterns = [
            /\.edu\.(bb|tt|jm|gy|sr|gd|lc|vc|dm|ag|kn|ms)$/,
            /\.ac\.(bb|tt|jm|gy|sr|gd|lc|vc|dm|ag|kn|ms)$/,
            /school.*\.gov\.bb$/,
            /education.*\.gov\.bb$/,
            /university.*\.(bb|tt|jm)$/,
            /college.*\.(bb|tt|jm)$/
        ];
        
        return eduPatterns.some(pattern => pattern.test(hostname)) && 
               originURL.protocol === 'https:';
    }

    /**
     * Check if origin is localhost
     */
    isLocalhost(originURL) {
        const hostname = originURL.hostname;
        return hostname === 'localhost' || 
               hostname === '127.0.0.1' || 
               hostname === '::1' ||
               hostname.endsWith('.localhost');
    }

    /**
     * Get allowed HTTP methods
     */
    getAllowedMethods() {
        const baseMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'];
        
        // Add PATCH for partial updates (if needed)
        if (process.env.CORS_ALLOW_PATCH === 'true') {
            baseMethods.push('PATCH');
        }
        
        return baseMethods;
    }

    /**
     * Get allowed request headers
     */
    getAllowedHeaders() {
        return [
            // Standard headers
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Accept-Language',
            'Accept-Encoding',
            
            // Custom headers for NiEMIS
            'X-Refresh-Token',
            'X-Client-Version',
            'X-Device-ID',
            'X-School-ID',
            'X-User-Role',
            
            // Security headers
            'X-CSRF-Token',
            'X-Request-ID',
            
            // Performance headers
            'X-Cache-Control',
            'If-None-Match',
            'If-Modified-Since',
            
            // Mobile app headers
            'X-Mobile-App',
            'X-App-Version',
            'X-Platform'
        ];
    }

    /**
     * Get headers to expose to client
     */
    getExposedHeaders() {
        return [
            // Pagination headers
            'X-Total-Count',
            'X-Page-Count',
            'X-Current-Page',
            
            // Rate limiting headers
            'X-Rate-Limit-Remaining',
            'X-Rate-Limit-Reset',
            'X-Rate-Limit-Limit',
            
            // Security headers
            'X-Security-Warning',
            'X-Session-Timeout',
            
            // API version
            'X-API-Version',
            
            // Performance headers
            'X-Response-Time',
            'X-Cache-Status'
        ];
    }

    /**
     * Determine if credentials should be allowed
     */
    shouldAllowCredentials() {
        // Always allow credentials for authentication
        return process.env.ENABLE_CORS_CREDENTIALS !== 'false';
    }

    /**
     * Get preflight cache duration
     */
    getCacheMaxAge() {
        // Production: 24 hours, Development: 5 minutes
        return isProduction ? 86400 : 300;
    }

    /**
     * Log CORS violations for security monitoring
     */
    logCORSViolation(origin, reason, originURL, req = null) {
        const violation = {
            timestamp: new Date().toISOString(),
            origin,
            reason,
            hostname: originURL?.hostname,
            protocol: originURL?.protocol,
            ip: req?.ip,
            userAgent: req?.get('User-Agent'),
            referer: req?.get('Referer'),
            method: req?.method,
            path: req?.path
        };

        this.corsViolations.push(violation);
        
        // Trim violations if too many
        if (this.corsViolations.length > this.maxViolations) {
            this.corsViolations = this.corsViolations.slice(-this.maxViolations);
        }

        logger.logSecurity('cors_violation', violation, req);
    }

    /**
     * Add temporary allowed origin (for development/testing)
     */
    addTempAllowedOrigin(origin, durationMs = 3600000) { // 1 hour default
        const allowedUntil = Date.now() + durationMs;
        this.tempAllowedOrigins.set(origin, allowedUntil);
        
        logger.info('Temporary CORS origin added', {
            origin,
            allowedUntil: new Date(allowedUntil).toISOString()
        });
    }

    /**
     * Remove temporary allowed origin
     */
    removeTempAllowedOrigin(origin) {
        const removed = this.tempAllowedOrigins.delete(origin);
        if (removed) {
            logger.info('Temporary CORS origin removed', { origin });
        }
        return removed;
    }

    /**
     * Get CORS statistics
     */
    getStatistics() {
        const now = Date.now();
        const last24h = this.corsViolations.filter(v => 
            now - new Date(v.timestamp).getTime() < 86400000
        );
        const lastHour = this.corsViolations.filter(v => 
            now - new Date(v.timestamp).getTime() < 3600000
        );

        // Group violations by reason
        const byReason = {};
        last24h.forEach(v => {
            byReason[v.reason] = (byReason[v.reason] || 0) + 1;
        });

        // Group violations by origin
        const byOrigin = {};
        last24h.forEach(v => {
            byOrigin[v.origin] = (byOrigin[v.origin] || 0) + 1;
        });

        return {
            violations: {
                total: this.corsViolations.length,
                last24Hours: last24h.length,
                lastHour: lastHour.length,
                byReason,
                byOrigin
            },
            trustedDomains: Array.from(this.trustedDomains),
            tempAllowedOrigins: Array.from(this.tempAllowedOrigins.keys()),
            configuration: {
                production: isProduction,
                credentialsAllowed: this.shouldAllowCredentials(),
                maxAge: this.getCacheMaxAge()
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Update trusted domains
     */
    updateTrustedDomains(domains) {
        this.trustedDomains.clear();
        domains.forEach(domain => this.trustedDomains.add(domain));
        
        logger.info('CORS trusted domains updated', {
            count: domains.length,
            domains: domains.slice(0, 5) // Log first 5 for security
        });
    }
}

// Singleton instance
const corsManager = new CORSManager();

/**
 * CORS Statistics Endpoint
 */
const corsStatsEndpoint = (req, res) => {
    try {
        const stats = corsManager.getStatistics();
        res.json(stats);
    } catch (error) {
        logger.error('CORS stats endpoint error:', error);
        res.status(500).json({
            error: 'Failed to get CORS statistics'
        });
    }
};

/**
 * Add Temporary CORS Origin Endpoint
 */
const addTempOriginEndpoint = (req, res) => {
    try {
        const { origin, duration } = req.body;
        
        if (!origin) {
            return res.status(400).json({
                error: 'Origin required'
            });
        }
        
        corsManager.addTempAllowedOrigin(origin, duration);
        
        res.json({
            success: true,
            origin,
            duration: duration || 3600000,
            message: 'Temporary CORS origin added successfully'
        });
    } catch (error) {
        logger.error('Add temp CORS origin error:', error);
        res.status(500).json({
            error: 'Failed to add temporary CORS origin'
        });
    }
};

/**
 * Remove Temporary CORS Origin Endpoint
 */
const removeTempOriginEndpoint = (req, res) => {
    try {
        const { origin } = req.body;
        
        if (!origin) {
            return res.status(400).json({
                error: 'Origin required'
            });
        }
        
        const removed = corsManager.removeTempAllowedOrigin(origin);
        
        res.json({
            success: true,
            origin,
            removed,
            message: removed ? 'Temporary CORS origin removed successfully' : 'Origin was not in temporary list'
        });
    } catch (error) {
        logger.error('Remove temp CORS origin error:', error);
        res.status(500).json({
            error: 'Failed to remove temporary CORS origin'
        });
    }
};

module.exports = {
    CORSManager,
    corsManager,
    corsStatsEndpoint,
    addTempOriginEndpoint,
    removeTempOriginEndpoint
};