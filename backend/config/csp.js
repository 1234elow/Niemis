const logger = require('../utils/logger');

/**
 * Enhanced Content Security Policy Configuration for NiEMIS
 * Provides comprehensive CSP protection against XSS, injection attacks, and data exfiltration
 */

const isProduction = process.env.NODE_ENV === 'production';
const isRender = process.env.RENDER === 'true';

/**
 * CSP Configuration Builder
 */
class CSPConfigBuilder {
    constructor() {
        this.config = this.getBaseConfig();
        this.reportingEnabled = process.env.CSP_REPORTING_ENABLED === 'true';
        this.reportUri = process.env.CSP_REPORT_URI || '/api/security/csp-report';
        this.enforcementMode = process.env.CSP_ENFORCEMENT_MODE || (isProduction ? 'enforce' : 'report-only');
    }

    /**
     * Get base CSP configuration
     */
    getBaseConfig() {
        return {
            'default-src': ["'self'"],
            
            // Script sources - Strict for security
            'script-src': [
                "'self'",
                // Production: No unsafe-inline or unsafe-eval
                ...(isProduction ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
                // Trusted CDNs for educational resources
                'https://cdn.jsdelivr.net',
                'https://unpkg.com',
                'https://cdnjs.cloudflare.com',
                // Government CDNs
                'https://cdn.gov.bb',
                // Ministry of Education resources
                'https://resources.moe.gov.bb'
            ],
            
            // Style sources - Allow necessary styling
            'style-src': [
                "'self'",
                "'unsafe-inline'", // Required for Material-UI and dynamic styles
                // Google Fonts
                'https://fonts.googleapis.com',
                // Trusted CDNs
                'https://cdn.jsdelivr.net',
                'https://unpkg.com',
                'https://cdnjs.cloudflare.com',
                // Government styling
                'https://styles.gov.bb'
            ],
            
            // Font sources
            'font-src': [
                "'self'",
                'data:', // Data URLs for embedded fonts
                'https://fonts.gstatic.com',
                'https://cdn.jsdelivr.net',
                'https://fonts.gov.bb'
            ],
            
            // Image sources - Education system needs
            'img-src': [
                "'self'",
                'data:', // Data URLs for charts and generated images
                'blob:', // Blob URLs for dynamic images
                'https:', // Allow all HTTPS images for educational content
                // Specific educational image sources
                'https://images.moe.gov.bb',
                'https://photos.schools.bb',
                // Placeholder services for development
                ...(isProduction ? [] : ['https://via.placeholder.com', 'https://picsum.photos'])
            ],
            
            // Connect sources - API and external services
            'connect-src': [
                "'self'",
                // Production API
                ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
                ...(process.env.APP_URL ? [process.env.APP_URL] : []),
                // Development servers
                ...(isProduction ? [] : ['http://localhost:3000', 'http://localhost:5000', 'ws://localhost:*']),
                // Government APIs
                'https://api.gov.bb',
                'https://api.moe.gov.bb',
                'https://api.cec.edu.bb',
                // WebSocket connections for real-time features
                'wss://niemis.gov.bb',
                ...(isRender ? ['wss://*.onrender.com'] : [])
            ],
            
            // Media sources
            'media-src': [
                "'self'",
                'data:',
                'blob:',
                'https://media.moe.gov.bb',
                'https://educational-videos.gov.bb'
            ],
            
            // Object sources - Disabled for security
            'object-src': ["'none'"],
            
            // Embed sources - Restricted
            'embed-src': [
                "'self'",
                // Educational video platforms
                'https://www.youtube.com',
                'https://player.vimeo.com',
                // Government educational content
                'https://education.gov.bb'
            ],
            
            // Base URI - Restrict to same origin
            'base-uri': ["'self'"],
            
            // Form actions - Restrict to same origin and trusted endpoints
            'form-action': [
                "'self'",
                // Government authentication
                'https://auth.gov.bb',
                // Payment gateways (if needed)
                'https://secure-payments.gov.bb'
            ],
            
            // Frame ancestors - Prevent clickjacking
            'frame-ancestors': ["'none'"],
            
            // Frame sources - Educational content only
            'frame-src': [
                "'self'",
                // Educational platforms
                'https://educational-tools.moe.gov.bb',
                'https://www.youtube.com',
                // Maps for school locations
                'https://maps.google.com',
                'https://www.openstreetmap.org'
            ],
            
            // Manifest source
            'manifest-src': ["'self'"],
            
            // Worker sources
            'worker-src': [
                "'self'",
                'blob:' // For service workers and web workers
            ],
            
            // Child sources (legacy)
            'child-src': [
                "'self'",
                'blob:'
            ]
        };
    }

    /**
     * Add development-specific directives
     */
    addDevelopmentDirectives() {
        if (!isProduction) {
            // Add development servers
            this.config['connect-src'].push(
                'ws://localhost:*',
                'http://localhost:*',
                'https://localhost:*'
            );
            
            // Allow eval for development tools
            if (!this.config['script-src'].includes("'unsafe-eval'")) {
                this.config['script-src'].push("'unsafe-eval'");
            }
            
            // Development tools
            this.config['connect-src'].push(
                'https://vitejs.dev',
                'https://webpack.js.org'
            );
        }
        
        return this;
    }

    /**
     * Add Barbados government-specific directives
     */
    addGovernmentDirectives() {
        // Government-specific domains
        const govDomains = [
            'https://*.gov.bb',
            'https://*.barbados.gov.bb',
            'https://*.moe.gov.bb'
        ];
        
        // Add to appropriate directives
        this.config['connect-src'].push(...govDomains);
        this.config['img-src'].push(...govDomains);
        this.config['style-src'].push(...govDomains);
        
        return this;
    }

    /**
     * Add Caribbean education integration directives
     */
    addCaribbeanEducationDirectives() {
        const caribbeanEducationDomains = [
            'https://www.cec.edu.bb',
            'https://api.cec.edu.bb',
            'https://resources.caribbean-education.org'
        ];
        
        this.config['connect-src'].push(...caribbeanEducationDomains);
        this.config['img-src'].push(...caribbeanEducationDomains);
        
        return this;
    }

    /**
     * Add RFID integration directives
     */
    addRFIDDirectives() {
        // RFID device integration
        this.config['connect-src'].push(
            'https://rfid-gateway.niemis.internal',
            'wss://rfid-gateway.niemis.internal'
        );
        
        return this;
    }

    /**
     * Add reporting directives
     */
    addReportingDirectives() {
        if (this.reportingEnabled) {
            this.config['report-uri'] = [this.reportUri];
            this.config['report-to'] = ['csp-endpoint'];
        }
        
        return this;
    }

    /**
     * Add upgrade insecure requests (production only)
     */
    addUpgradeInsecureRequests() {
        if (isProduction) {
            this.config['upgrade-insecure-requests'] = true;
        }
        
        return this;
    }

    /**
     * Build final CSP configuration
     */
    build() {
        return this
            .addDevelopmentDirectives()
            .addGovernmentDirectives()
            .addCaribbeanEducationDirectives()
            .addRFIDDirectives()
            .addReportingDirectives()
            .addUpgradeInsecureRequests();
    }

    /**
     * Get CSP header string
     */
    toString() {
        const directives = [];
        
        for (const [directive, values] of Object.entries(this.config)) {
            if (directive === 'upgrade-insecure-requests' && values) {
                directives.push(directive);
            } else if (Array.isArray(values)) {
                directives.push(`${directive} ${values.join(' ')}`);
            }
        }
        
        return directives.join('; ');
    }

    /**
     * Get CSP configuration object for Helmet
     */
    toHelmetConfig() {
        const helmetConfig = {
            directives: {},
            reportOnly: this.enforcementMode === 'report-only'
        };
        
        for (const [directive, values] of Object.entries(this.config)) {
            if (directive === 'upgrade-insecure-requests') {
                helmetConfig.upgradeInsecureRequests = values;
            } else if (directive === 'report-uri') {
                helmetConfig.reportUri = values[0];
            } else if (directive === 'report-to') {
                // Handle report-to separately if needed
                continue;
            } else {
                helmetConfig.directives[directive.replace('-', '')] = values;
            }
        }
        
        return helmetConfig;
    }
}

/**
 * CSP Violation Reporter
 */
class CSPViolationReporter {
    constructor() {
        this.violations = [];
        this.maxViolations = parseInt(process.env.CSP_MAX_VIOLATIONS) || 1000;
        this.reportThreshold = parseInt(process.env.CSP_REPORT_THRESHOLD) || 10;
    }

    /**
     * Report CSP violation
     */
    reportViolation(violation, req) {
        const violationReport = {
            timestamp: new Date().toISOString(),
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            url: req.url,
            referer: req.get('Referer'),
            userId: req.user?.id,
            schoolId: req.user?.school_id,
            violation: {
                documentUri: violation['document-uri'],
                blockedUri: violation['blocked-uri'],
                violatedDirective: violation['violated-directive'],
                originalPolicy: violation['original-policy'],
                disposition: violation.disposition,
                statusCode: violation['status-code'],
                effectiveDirective: violation['effective-directive'],
                sourceFile: violation['source-file'],
                lineNumber: violation['line-number'],
                columnNumber: violation['column-number']
            }
        };

        // Add to violations list
        this.violations.push(violationReport);
        
        // Trim violations if too many
        if (this.violations.length > this.maxViolations) {
            this.violations = this.violations.slice(-this.maxViolations);
        }

        // Log violation
        logger.logSecurity('csp_violation', violationReport, req);

        // Check for repeated violations
        this.checkForRepeatedViolations(violationReport);

        return violationReport;
    }

    /**
     * Check for repeated violations from same source
     */
    checkForRepeatedViolations(violationReport) {
        const recentViolations = this.violations.filter(v => 
            Date.now() - new Date(v.timestamp).getTime() < 3600000 && // Last hour
            v.ip === violationReport.ip &&
            v.violation.violatedDirective === violationReport.violation.violatedDirective
        );

        if (recentViolations.length >= this.reportThreshold) {
            logger.logSecurity('csp_repeated_violations', {
                ip: violationReport.ip,
                directive: violationReport.violation.violatedDirective,
                count: recentViolations.length,
                timeframe: '1 hour'
            });
        }
    }

    /**
     * Get violation statistics
     */
    getViolationStats() {
        const now = Date.now();
        const last24h = this.violations.filter(v => now - new Date(v.timestamp).getTime() < 86400000);
        const lastHour = this.violations.filter(v => now - new Date(v.timestamp).getTime() < 3600000);

        // Group by directive
        const byDirective = {};
        last24h.forEach(v => {
            const directive = v.violation.violatedDirective;
            byDirective[directive] = (byDirective[directive] || 0) + 1;
        });

        // Group by blocked URI
        const byBlockedUri = {};
        last24h.forEach(v => {
            const uri = v.violation.blockedUri;
            byBlockedUri[uri] = (byBlockedUri[uri] || 0) + 1;
        });

        return {
            total: this.violations.length,
            last24Hours: last24h.length,
            lastHour: lastHour.length,
            byDirective,
            byBlockedUri,
            timestamp: new Date().toISOString()
        };
    }
}

// Singleton instances
const cspBuilder = new CSPConfigBuilder();
const violationReporter = new CSPViolationReporter();

/**
 * CSP Middleware Factory
 */
const createCSPMiddleware = () => {
    const cspConfig = cspBuilder.build();
    
    return (req, res, next) => {
        // Set CSP header
        const cspHeader = cspConfig.enforcementMode === 'report-only' ? 
            'Content-Security-Policy-Report-Only' : 
            'Content-Security-Policy';
        
        res.setHeader(cspHeader, cspConfig.toString());
        
        // Set Report-To header if reporting is enabled
        if (cspConfig.reportingEnabled) {
            res.setHeader('Report-To', JSON.stringify({
                group: 'csp-endpoint',
                max_age: 86400,
                endpoints: [{ url: cspConfig.reportUri }]
            }));
        }
        
        next();
    };
};

/**
 * CSP Violation Handling Middleware
 */
const cspViolationHandler = (req, res, next) => {
    if (req.path === '/api/security/csp-report' && req.method === 'POST') {
        try {
            const violation = req.body;
            const report = violationReporter.reportViolation(violation, req);
            
            // Log for monitoring
            logger.warn('CSP Violation Reported', {
                blockedUri: violation['blocked-uri'],
                violatedDirective: violation['violated-directive'],
                documentUri: violation['document-uri'],
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            
            return res.status(204).send();
        } catch (error) {
            logger.error('CSP violation handling error:', error);
            return res.status(400).json({ error: 'Invalid violation report' });
        }
    }
    
    next();
};

/**
 * CSP Statistics Endpoint
 */
const cspStatsEndpoint = (req, res) => {
    try {
        const stats = violationReporter.getViolationStats();
        res.json({
            csp: {
                enforcement: cspBuilder.enforcementMode,
                reporting: cspBuilder.reportingEnabled,
                environment: isProduction ? 'production' : 'development'
            },
            violations: stats
        });
    } catch (error) {
        logger.error('CSP stats endpoint error:', error);
        res.status(500).json({ error: 'Failed to get CSP statistics' });
    }
};

/**
 * Get CSP configuration for Helmet
 */
const getCSPConfig = () => {
    return cspBuilder.build().toHelmetConfig();
};

module.exports = {
    CSPConfigBuilder,
    CSPViolationReporter,
    createCSPMiddleware,
    cspViolationHandler,
    cspStatsEndpoint,
    getCSPConfig,
    cspBuilder,
    violationReporter
};