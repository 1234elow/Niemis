const logger = require('../utils/logger');

/**
 * Enhanced DDoS Protection and Advanced Rate Limiting for NiEMIS
 * Provides comprehensive protection against various attack patterns
 */

class DDoSProtectionManager {
    constructor() {
        this.suspiciousIPs = new Map();
        this.blockedIPs = new Set();
        this.requestPatterns = new Map();
        this.connectionCounts = new Map();
        this.rateLimitViolations = new Map();
        
        // Configuration
        this.config = {
            // DDoS thresholds
            maxRequestsPerMinute: parseInt(process.env.DDOS_MAX_REQUESTS_PER_MINUTE) || 300,
            maxRequestsPerSecond: parseInt(process.env.DDOS_MAX_REQUESTS_PER_SECOND) || 10,
            maxConcurrentConnections: parseInt(process.env.DDOS_MAX_CONCURRENT_CONNECTIONS) || 50,
            
            // Pattern detection
            maxIdenticalRequests: parseInt(process.env.DDOS_MAX_IDENTICAL_REQUESTS) || 20,
            maxPathVariations: parseInt(process.env.DDOS_MAX_PATH_VARIATIONS) || 100,
            
            // Block duration (in milliseconds)
            blockDuration: parseInt(process.env.DDOS_BLOCK_DURATION) || 3600000, // 1 hour
            suspicionDuration: parseInt(process.env.DDOS_SUSPICION_DURATION) || 300000, // 5 minutes
            
            // Cleanup intervals
            cleanupInterval: parseInt(process.env.DDOS_CLEANUP_INTERVAL) || 60000, // 1 minute
            
            // Whitelist
            whitelistedIPs: (process.env.DDOS_WHITELIST || '').split(',').filter(Boolean),
            whitelistedUserAgents: [
                'niemis-mobile-app',
                'niemis-desktop-client',
                'uptime-robot',
                'health-check'
            ],
            
            // Patterns to detect
            suspiciousPatterns: [
                /bot|crawler|spider|scraper/i,
                /attack|hack|exploit|injection/i,
                /automated|script|tool/i
            ],
            
            // Rate limit escalation
            rateLimitEscalation: {
                warning: 0.7,    // 70% of limit
                strict: 0.9,     // 90% of limit
                block: 1.0       // 100% of limit
            }
        };
        
        // Start cleanup interval
        this.startCleanupInterval();
        
        logger.info('DDoS Protection Manager initialized', {
            maxRequestsPerMinute: this.config.maxRequestsPerMinute,
            maxConcurrentConnections: this.config.maxConcurrentConnections,
            blockDuration: this.config.blockDuration
        });
    }

    /**
     * Check if IP is whitelisted
     */
    isWhitelisted(ip, userAgent = '') {
        // Check IP whitelist
        if (this.config.whitelistedIPs.includes(ip)) {
            return true;
        }
        
        // Check localhost/private networks
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
            return true;
        }
        
        // Check user agent whitelist
        if (userAgent && this.config.whitelistedUserAgents.some(ua => 
            userAgent.toLowerCase().includes(ua.toLowerCase())
        )) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if IP is blocked
     */
    isBlocked(ip) {
        return this.blockedIPs.has(ip);
    }

    /**
     * Block IP address
     */
    blockIP(ip, reason, duration = null) {
        if (this.isWhitelisted(ip)) {
            logger.warn('Attempted to block whitelisted IP', { ip, reason });
            return false;
        }
        
        this.blockedIPs.add(ip);
        const blockDuration = duration || this.config.blockDuration;
        
        // Auto-unblock after duration
        setTimeout(() => {
            this.blockedIPs.delete(ip);
            logger.info('IP automatically unblocked', { ip, reason: 'timeout' });
        }, blockDuration);
        
        logger.logSecurity('ddos_ip_blocked', {
            ip,
            reason,
            duration: blockDuration,
            timestamp: new Date().toISOString()
        });
        
        return true;
    }

    /**
     * Unblock IP address
     */
    unblockIP(ip, reason = 'manual') {
        const wasBlocked = this.blockedIPs.has(ip);
        this.blockedIPs.delete(ip);
        this.suspiciousIPs.delete(ip);
        this.rateLimitViolations.delete(ip);
        
        if (wasBlocked) {
            logger.logSecurity('ddos_ip_unblocked', {
                ip,
                reason,
                timestamp: new Date().toISOString()
            });
        }
        
        return wasBlocked;
    }

    /**
     * Analyze request pattern
     */
    analyzeRequestPattern(req) {
        const ip = req.ip;
        const userAgent = req.get('User-Agent') || '';
        const path = req.path;
        const method = req.method;
        const now = Date.now();
        
        // Skip whitelisted IPs
        if (this.isWhitelisted(ip, userAgent)) {
            return { allowed: true, reason: 'whitelisted' };
        }
        
        // Check if already blocked
        if (this.isBlocked(ip)) {
            return { allowed: false, reason: 'blocked' };
        }
        
        // Initialize tracking for this IP
        if (!this.requestPatterns.has(ip)) {
            this.requestPatterns.set(ip, {
                requests: [],
                paths: new Set(),
                userAgents: new Set(),
                methods: new Set(),
                firstSeen: now,
                lastSeen: now,
                totalRequests: 0
            });
        }
        
        const pattern = this.requestPatterns.get(ip);
        pattern.lastSeen = now;
        pattern.totalRequests++;
        pattern.paths.add(path);
        pattern.userAgents.add(userAgent);
        pattern.methods.add(method);
        
        // Add current request
        pattern.requests.push({
            timestamp: now,
            path,
            method,
            userAgent
        });
        
        // Keep only recent requests (last minute)
        pattern.requests = pattern.requests.filter(req => 
            now - req.timestamp < 60000
        );
        
        // Analyze patterns
        return this.detectSuspiciousPattern(ip, pattern, req);
    }

    /**
     * Detect suspicious patterns
     */
    detectSuspiciousPattern(ip, pattern, req) {
        const now = Date.now();
        const recentRequests = pattern.requests.filter(r => 
            now - r.timestamp < 60000
        );
        
        // Rate-based detection
        const requestsPerMinute = recentRequests.length;
        const requestsPerSecond = recentRequests.filter(r => 
            now - r.timestamp < 1000
        ).length;
        
        // Check requests per minute
        if (requestsPerMinute > this.config.maxRequestsPerMinute) {
            this.blockIP(ip, 'excessive_requests_per_minute');
            return { 
                allowed: false, 
                reason: 'rate_limit_exceeded',
                details: { requestsPerMinute }
            };
        }
        
        // Check requests per second
        if (requestsPerSecond > this.config.maxRequestsPerSecond) {
            this.blockIP(ip, 'excessive_requests_per_second');
            return { 
                allowed: false, 
                reason: 'burst_rate_exceeded',
                details: { requestsPerSecond }
            };
        }
        
        // Pattern-based detection
        const uniquePaths = pattern.paths.size;
        const uniqueUserAgents = pattern.userAgents.size;
        
        // Check for scanning behavior
        if (uniquePaths > this.config.maxPathVariations) {
            this.blockIP(ip, 'path_scanning_detected');
            return { 
                allowed: false, 
                reason: 'scanning_detected',
                details: { uniquePaths }
            };
        }
        
        // Check for identical requests (possible replay attack)
        const identicalRequests = this.countIdenticalRequests(recentRequests);
        if (identicalRequests > this.config.maxIdenticalRequests) {
            this.blockIP(ip, 'identical_requests_detected');
            return { 
                allowed: false, 
                reason: 'replay_attack_suspected',
                details: { identicalRequests }
            };
        }
        
        // Check user agent patterns
        const userAgent = req.get('User-Agent') || '';
        if (this.isSuspiciousUserAgent(userAgent)) {
            this.markSuspicious(ip, 'suspicious_user_agent');
            return { 
                allowed: true, 
                reason: 'suspicious_but_allowed',
                warning: 'suspicious_user_agent'
            };
        }
        
        // Check for unusual method patterns
        if (pattern.methods.has('TRACE') || pattern.methods.has('TRACK')) {
            this.markSuspicious(ip, 'unusual_http_methods');
            return { 
                allowed: false, 
                reason: 'unusual_methods',
                details: { methods: Array.from(pattern.methods) }
            };
        }
        
        return { allowed: true, reason: 'pattern_ok' };
    }

    /**
     * Count identical requests
     */
    countIdenticalRequests(requests) {
        const requestSignatures = new Map();
        
        requests.forEach(req => {
            const signature = `${req.method}:${req.path}:${req.userAgent}`;
            requestSignatures.set(signature, (requestSignatures.get(signature) || 0) + 1);
        });
        
        return Math.max(...requestSignatures.values());
    }

    /**
     * Check for suspicious user agent
     */
    isSuspiciousUserAgent(userAgent) {
        if (!userAgent || userAgent.length < 10) {
            return true;
        }
        
        return this.config.suspiciousPatterns.some(pattern => 
            pattern.test(userAgent)
        );
    }

    /**
     * Mark IP as suspicious
     */
    markSuspicious(ip, reason) {
        if (!this.suspiciousIPs.has(ip)) {
            this.suspiciousIPs.set(ip, {
                reasons: [],
                firstMarked: Date.now(),
                count: 0
            });
        }
        
        const suspicious = this.suspiciousIPs.get(ip);
        suspicious.reasons.push(reason);
        suspicious.count++;
        suspicious.lastMarked = Date.now();
        
        // Auto-remove after suspicion duration
        setTimeout(() => {
            this.suspiciousIPs.delete(ip);
        }, this.config.suspicionDuration);
        
        logger.logSecurity('ddos_ip_suspicious', {
            ip,
            reason,
            count: suspicious.count,
            timestamp: new Date().toISOString()
        });
        
        // Block if too many suspicious activities
        if (suspicious.count >= 5) {
            this.blockIP(ip, 'multiple_suspicious_activities');
        }
    }

    /**
     * Track connection count
     */
    trackConnection(ip, connected = true) {
        if (!this.connectionCounts.has(ip)) {
            this.connectionCounts.set(ip, 0);
        }
        
        const currentCount = this.connectionCounts.get(ip);
        const newCount = connected ? currentCount + 1 : Math.max(0, currentCount - 1);
        this.connectionCounts.set(ip, newCount);
        
        // Check concurrent connection limit
        if (newCount > this.config.maxConcurrentConnections) {
            this.blockIP(ip, 'excessive_concurrent_connections');
            return false;
        }
        
        return true;
    }

    /**
     * Rate limit violation tracking
     */
    trackRateLimitViolation(ip, violationType = 'general') {
        if (!this.rateLimitViolations.has(ip)) {
            this.rateLimitViolations.set(ip, {
                violations: [],
                totalCount: 0
            });
        }
        
        const violations = this.rateLimitViolations.get(ip);
        violations.violations.push({
            type: violationType,
            timestamp: Date.now()
        });
        violations.totalCount++;
        
        // Clean old violations
        violations.violations = violations.violations.filter(v => 
            Date.now() - v.timestamp < 3600000 // Last hour
        );
        
        // Block after too many violations
        if (violations.violations.length >= 10) {
            this.blockIP(ip, 'repeated_rate_limit_violations');
        }
        
        logger.logSecurity('ddos_rate_limit_violation', {
            ip,
            violationType,
            totalViolations: violations.violations.length,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Cleanup old data
     */
    cleanup() {
        const now = Date.now();
        const cleanupThreshold = 3600000; // 1 hour
        
        // Clean request patterns
        for (const [ip, pattern] of this.requestPatterns.entries()) {
            if (now - pattern.lastSeen > cleanupThreshold) {
                this.requestPatterns.delete(ip);
            }
        }
        
        // Clean connection counts
        for (const [ip, count] of this.connectionCounts.entries()) {
            if (count === 0) {
                this.connectionCounts.delete(ip);
            }
        }
        
        // Clean old violations
        for (const [ip, data] of this.rateLimitViolations.entries()) {
            data.violations = data.violations.filter(v => 
                now - v.timestamp < cleanupThreshold
            );
            
            if (data.violations.length === 0) {
                this.rateLimitViolations.delete(ip);
            }
        }
        
        logger.debug('DDoS protection cleanup completed', {
            requestPatterns: this.requestPatterns.size,
            connectionCounts: this.connectionCounts.size,
            blockedIPs: this.blockedIPs.size,
            suspiciousIPs: this.suspiciousIPs.size
        });
    }

    /**
     * Start cleanup interval
     */
    startCleanupInterval() {
        setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const now = Date.now();
        
        return {
            blocked: {
                count: this.blockedIPs.size,
                ips: Array.from(this.blockedIPs)
            },
            suspicious: {
                count: this.suspiciousIPs.size,
                ips: Array.from(this.suspiciousIPs.keys())
            },
            patterns: {
                tracked: this.requestPatterns.size,
                active: Array.from(this.requestPatterns.entries()).filter(([ip, pattern]) => 
                    now - pattern.lastSeen < 300000 // Last 5 minutes
                ).length
            },
            connections: {
                tracked: this.connectionCounts.size,
                total: Array.from(this.connectionCounts.values()).reduce((sum, count) => sum + count, 0)
            },
            violations: {
                tracked: this.rateLimitViolations.size,
                total: Array.from(this.rateLimitViolations.values()).reduce((sum, data) => 
                    sum + data.totalCount, 0
                )
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Export blocked IPs for external systems
     */
    exportBlockedIPs() {
        return {
            blocked_ips: Array.from(this.blockedIPs),
            suspicious_ips: Array.from(this.suspiciousIPs.keys()),
            exported_at: new Date().toISOString(),
            expires_in: this.config.blockDuration
        };
    }

    /**
     * Import blocked IPs from external systems
     */
    importBlockedIPs(blockedList, reason = 'external_import') {
        let imported = 0;
        
        blockedList.forEach(ip => {
            if (this.blockIP(ip, reason)) {
                imported++;
            }
        });
        
        logger.info('Imported blocked IPs', {
            imported,
            total: blockedList.length,
            reason
        });
        
        return imported;
    }
}

// Singleton instance
const ddosProtection = new DDoSProtectionManager();

/**
 * DDoS Protection Middleware
 */
const ddosProtectionMiddleware = (req, res, next) => {
    try {
        const analysis = ddosProtection.analyzeRequestPattern(req);
        
        if (!analysis.allowed) {
            logger.logSecurity('ddos_request_blocked', {
                ip: req.ip,
                reason: analysis.reason,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                details: analysis.details
            }, req);
            
            return res.status(429).json({
                error: 'Too Many Requests',
                message: 'Your request has been blocked due to suspicious activity',
                code: 'DDOS_PROTECTION_TRIGGERED',
                retryAfter: Math.ceil(ddosProtection.config.blockDuration / 1000)
            });
        }
        
        if (analysis.warning) {
            // Add warning header for suspicious but allowed requests
            res.setHeader('X-Security-Warning', analysis.warning);
        }
        
        next();
    } catch (error) {
        logger.error('DDoS protection middleware error:', error);
        // Continue processing on error to prevent DoS of the protection system itself
        next();
    }
};

/**
 * Connection tracking middleware
 */
const connectionTrackingMiddleware = (req, res, next) => {
    const ip = req.ip;
    
    // Track connection start
    ddosProtection.trackConnection(ip, true);
    
    // Track connection end
    res.on('finish', () => {
        ddosProtection.trackConnection(ip, false);
    });
    
    res.on('close', () => {
        ddosProtection.trackConnection(ip, false);
    });
    
    next();
};

/**
 * DDoS statistics endpoint
 */
const ddosStatsEndpoint = (req, res) => {
    try {
        const stats = ddosProtection.getStatistics();
        res.json(stats);
    } catch (error) {
        logger.error('DDoS stats endpoint error:', error);
        res.status(500).json({
            error: 'Failed to get DDoS protection statistics'
        });
    }
};

/**
 * IP management endpoints
 */
const blockIPEndpoint = (req, res) => {
    try {
        const { ip, reason, duration } = req.body;
        
        if (!ip) {
            return res.status(400).json({
                error: 'IP address required'
            });
        }
        
        const blocked = ddosProtection.blockIP(ip, reason || 'manual_block', duration);
        
        res.json({
            success: blocked,
            ip,
            reason: reason || 'manual_block',
            message: blocked ? 'IP blocked successfully' : 'IP is whitelisted and cannot be blocked'
        });
    } catch (error) {
        logger.error('Block IP endpoint error:', error);
        res.status(500).json({
            error: 'Failed to block IP'
        });
    }
};

const unblockIPEndpoint = (req, res) => {
    try {
        const { ip, reason } = req.body;
        
        if (!ip) {
            return res.status(400).json({
                error: 'IP address required'
            });
        }
        
        const unblocked = ddosProtection.unblockIP(ip, reason || 'manual_unblock');
        
        res.json({
            success: true,
            ip,
            wasBlocked: unblocked,
            message: unblocked ? 'IP unblocked successfully' : 'IP was not blocked'
        });
    } catch (error) {
        logger.error('Unblock IP endpoint error:', error);
        res.status(500).json({
            error: 'Failed to unblock IP'
        });
    }
};

module.exports = {
    DDoSProtectionManager,
    ddosProtection,
    ddosProtectionMiddleware,
    connectionTrackingMiddleware,
    ddosStatsEndpoint,
    blockIPEndpoint,
    unblockIPEndpoint
};