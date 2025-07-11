const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('../utils/logger');

/**
 * Enhanced HTTPS Configuration for NiEMIS
 * Provides comprehensive SSL/TLS setup with security best practices
 */

const isProduction = process.env.NODE_ENV === 'production';
const isRender = process.env.RENDER === 'true';

// SSL Configuration Constants
const SSL_CONFIG = {
    // Modern TLS configuration
    secureProtocol: 'TLSv1_2_method',
    secureOptions: require('constants').SSL_OP_NO_SSLv2 | 
                   require('constants').SSL_OP_NO_SSLv3 | 
                   require('constants').SSL_OP_NO_TLSv1 | 
                   require('constants').SSL_OP_NO_TLSv1_1,
    
    // Secure cipher suites (PCI DSS compliant)
    ciphers: [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA',
        'ECDHE-RSA-AES128-SHA',
        'DHE-RSA-AES256-GCM-SHA384',
        'DHE-RSA-AES128-GCM-SHA256',
        'DHE-RSA-AES256-SHA256',
        'DHE-RSA-AES128-SHA256',
        'DHE-RSA-AES256-SHA',
        'DHE-RSA-AES128-SHA',
        'AES256-GCM-SHA384',
        'AES128-GCM-SHA256',
        'AES256-SHA256',
        'AES128-SHA256',
        'AES256-SHA',
        'AES128-SHA'
    ].join(':'),
    
    // Honor cipher order for security
    honorCipherOrder: true,
    
    // Enable session resumption for performance
    sessionTimeout: 300, // 5 minutes
    sessionIdContext: 'niemis-backend'
};

/**
 * Certificate Management Class
 */
class CertificateManager {
    constructor() {
        this.certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/cert.pem');
        this.keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/key.pem');
        this.caPath = process.env.SSL_CA_PATH || path.join(__dirname, '../certs/ca.pem');
        this.dhParamPath = process.env.SSL_DH_PARAM_PATH || path.join(__dirname, '../certs/dhparam.pem');
        this.certsDir = path.dirname(this.certPath);
        this.certificates = null;
        this.lastLoad = null;
    }

    /**
     * Initialize certificate directory
     */
    initializeCertDirectory() {
        if (!fs.existsSync(this.certsDir)) {
            fs.mkdirSync(this.certsDir, { recursive: true, mode: 0o700 });
            logger.info('Created certificates directory');
        }
    }

    /**
     * Load SSL certificates
     */
    loadCertificates() {
        try {
            this.initializeCertDirectory();
            
            const certificates = { ...SSL_CONFIG };
            
            // Load certificate
            if (fs.existsSync(this.certPath)) {
                certificates.cert = fs.readFileSync(this.certPath, 'utf8');
                logger.info('SSL certificate loaded successfully');
            } else {
                logger.warn('SSL certificate not found:', this.certPath);
                if (isProduction && !isRender) {
                    throw new Error('SSL certificate required in production');
                }
            }

            // Load private key
            if (fs.existsSync(this.keyPath)) {
                certificates.key = fs.readFileSync(this.keyPath, 'utf8');
                logger.info('SSL private key loaded successfully');
            } else {
                logger.warn('SSL private key not found:', this.keyPath);
                if (isProduction && !isRender) {
                    throw new Error('SSL private key required in production');
                }
            }

            // Load CA certificate (optional)
            if (fs.existsSync(this.caPath)) {
                certificates.ca = fs.readFileSync(this.caPath, 'utf8');
                logger.info('SSL CA certificate loaded successfully');
            }

            // Load DH parameters (optional but recommended)
            if (fs.existsSync(this.dhParamPath)) {
                certificates.dhparam = fs.readFileSync(this.dhParamPath, 'utf8');
                logger.info('DH parameters loaded successfully');
            }

            this.certificates = certificates;
            this.lastLoad = new Date();
            
            return certificates;
        } catch (error) {
            logger.error('Failed to load SSL certificates:', error);
            throw error;
        }
    }

    /**
     * Validate certificate files
     */
    validateCertificates() {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
            certificate: null,
            key: null,
            ca: null
        };

        try {
            // Validate certificate file
            if (fs.existsSync(this.certPath)) {
                const certContent = fs.readFileSync(this.certPath, 'utf8');
                if (!certContent.includes('-----BEGIN CERTIFICATE-----')) {
                    validation.errors.push('Invalid certificate format');
                    validation.valid = false;
                } else {
                    validation.certificate = this.parseCertificate(certContent);
                }
            } else if (isProduction && !isRender) {
                validation.errors.push('Certificate file not found');
                validation.valid = false;
            }

            // Validate private key file
            if (fs.existsSync(this.keyPath)) {
                const keyContent = fs.readFileSync(this.keyPath, 'utf8');
                if (!keyContent.includes('-----BEGIN PRIVATE KEY-----') && 
                    !keyContent.includes('-----BEGIN RSA PRIVATE KEY-----')) {
                    validation.errors.push('Invalid private key format');
                    validation.valid = false;
                } else {
                    validation.key = { loaded: true };
                }
            } else if (isProduction && !isRender) {
                validation.errors.push('Private key file not found');
                validation.valid = false;
            }

            // Validate CA certificate (optional)
            if (fs.existsSync(this.caPath)) {
                const caContent = fs.readFileSync(this.caPath, 'utf8');
                if (!caContent.includes('-----BEGIN CERTIFICATE-----')) {
                    validation.warnings.push('Invalid CA certificate format');
                } else {
                    validation.ca = { loaded: true };
                }
            }

            // Check certificate expiration
            if (validation.certificate && validation.certificate.notAfter) {
                const expiryDate = new Date(validation.certificate.notAfter);
                const now = new Date();
                const daysUntilExpiry = (expiryDate - now) / (1000 * 60 * 60 * 24);
                
                if (daysUntilExpiry < 0) {
                    validation.errors.push('Certificate has expired');
                    validation.valid = false;
                } else if (daysUntilExpiry < 30) {
                    validation.warnings.push(`Certificate expires in ${Math.floor(daysUntilExpiry)} days`);
                }
            }

        } catch (error) {
            validation.errors.push(`Certificate validation failed: ${error.message}`);
            validation.valid = false;
        }

        return validation;
    }

    /**
     * Parse certificate information
     */
    parseCertificate(certContent) {
        try {
            const crypto = require('crypto');
            const cert = crypto.createX509Certificate ? 
                crypto.createX509Certificate(certContent) : 
                null;
            
            if (cert) {
                return {
                    subject: cert.subject,
                    issuer: cert.issuer,
                    notBefore: cert.validFrom,
                    notAfter: cert.validTo,
                    serialNumber: cert.serialNumber,
                    fingerprint: cert.fingerprint
                };
            }
            
            return { loaded: true };
        } catch (error) {
            logger.error('Failed to parse certificate:', error);
            return { loaded: true, error: error.message };
        }
    }

    /**
     * Generate self-signed certificate for development
     */
    generateSelfSignedCertificate() {
        if (isProduction) {
            throw new Error('Cannot generate self-signed certificate in production');
        }

        const { execSync } = require('child_process');
        
        try {
            this.initializeCertDirectory();

            // Generate self-signed certificate with SAN
            const opensslCmd = [
                'openssl req -x509 -newkey rsa:4096 -keyout',
                this.keyPath,
                '-out',
                this.certPath,
                '-days 365 -nodes',
                '-subj "/C=BB/ST=Barbados/L=Bridgetown/O=NiEMIS Development/CN=localhost"',
                '-reqexts SAN -extensions SAN',
                '-config <(cat /etc/ssl/openssl.cnf <(printf "[SAN]\\nsubjectAltName=DNS:localhost,IP:127.0.0.1"))'
            ].join(' ');

            execSync(opensslCmd, { stdio: 'inherit', shell: '/bin/bash' });

            // Generate DH parameters
            const dhCmd = `openssl dhparam -out ${this.dhParamPath} 2048`;
            execSync(dhCmd, { stdio: 'inherit' });

            logger.info('Self-signed certificate generated successfully');
            return true;
        } catch (error) {
            logger.error('Failed to generate self-signed certificate:', error);
            return false;
        }
    }

    /**
     * Refresh certificates if needed
     */
    refreshCertificates() {
        const certStats = fs.existsSync(this.certPath) ? fs.statSync(this.certPath) : null;
        const keyStats = fs.existsSync(this.keyPath) ? fs.statSync(this.keyPath) : null;
        
        if (!this.certificates || !this.lastLoad ||
            (certStats && certStats.mtime > this.lastLoad) ||
            (keyStats && keyStats.mtime > this.lastLoad)) {
            
            logger.info('Refreshing SSL certificates...');
            return this.loadCertificates();
        }
        
        return this.certificates;
    }
}

// Singleton instance
const certificateManager = new CertificateManager();

/**
 * HTTPS Server Creation
 */
const createHttpsServer = (app) => {
    // Skip HTTPS server creation on Render.com (uses load balancer)
    if (isRender) {
        logger.info('Skipping HTTPS server creation on Render.com');
        return null;
    }

    try {
        const certificates = certificateManager.loadCertificates();
        
        if (!certificates.cert || !certificates.key) {
            if (isProduction) {
                throw new Error('SSL certificates required for production HTTPS server');
            } else {
                logger.warn('SSL certificates not found, attempting to generate self-signed certificates');
                if (certificateManager.generateSelfSignedCertificate()) {
                    return createHttpsServer(app);
                }
                return null;
            }
        }

        const server = https.createServer(certificates, app);
        
        // Configure server security
        server.setTimeout(30000); // 30 second timeout
        server.keepAliveTimeout = 65000; // 65 second keep-alive
        server.headersTimeout = 66000; // 66 second headers timeout
        
        logger.info('HTTPS server created successfully');
        return server;
        
    } catch (error) {
        logger.error('Failed to create HTTPS server:', error);
        if (isProduction) {
            throw error;
        }
        return null;
    }
};

/**
 * HTTPS Redirect Middleware
 */
const httpsRedirectMiddleware = (req, res, next) => {
    // Skip redirect in development
    if (!isProduction) {
        return next();
    }

    // Check if request is already HTTPS
    const isSecure = req.secure || 
                    req.headers['x-forwarded-proto'] === 'https' ||
                    req.headers['x-forwarded-ssl'] === 'on';

    if (!isSecure) {
        const redirectUrl = `https://${req.get('host')}${req.url}`;
        logger.info(`Redirecting HTTP to HTTPS: ${req.url} -> ${redirectUrl}`);
        return res.redirect(301, redirectUrl);
    }

    next();
};

/**
 * HTTPS Security Headers Middleware
 */
const httpsSecurityMiddleware = (req, res, next) => {
    if (isProduction) {
        // Strict Transport Security (2 years)
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
        
        // Only send secure cookies
        res.setHeader('Set-Cookie', res.getHeaders()['set-cookie']?.map(cookie => 
            cookie.includes('Secure') ? cookie : `${cookie}; Secure`
        ) || []);
    }
    
    next();
};

/**
 * Certificate Health Check
 */
const certificateHealthCheck = () => {
    try {
        const validation = certificateManager.validateCertificates();
        
        return {
            status: validation.valid ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            validation,
            lastLoad: certificateManager.lastLoad,
            environment: isProduction ? 'production' : 'development',
            renderDeployment: isRender
        };
    } catch (error) {
        return {
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
            environment: isProduction ? 'production' : 'development',
            renderDeployment: isRender
        };
    }
};

/**
 * SSL/TLS Information Endpoint
 */
const sslInfoEndpoint = (req, res) => {
    const healthCheck = certificateHealthCheck();
    
    // Remove sensitive information
    const sanitizedInfo = {
        status: healthCheck.status,
        timestamp: healthCheck.timestamp,
        environment: healthCheck.environment,
        renderDeployment: healthCheck.renderDeployment,
        certificate: healthCheck.validation?.certificate ? {
            subject: healthCheck.validation.certificate.subject,
            issuer: healthCheck.validation.certificate.issuer,
            notBefore: healthCheck.validation.certificate.notBefore,
            notAfter: healthCheck.validation.certificate.notAfter,
            serialNumber: healthCheck.validation.certificate.serialNumber?.slice(-8) // Last 8 chars only
        } : null,
        warnings: healthCheck.validation?.warnings || [],
        errors: healthCheck.validation?.errors || []
    };
    
    res.json(sanitizedInfo);
};

/**
 * TLS Configuration Tester
 */
const testTlsConfiguration = async (host, port = 443) => {
    return new Promise((resolve, reject) => {
        const tls = require('tls');
        
        const options = {
            host,
            port,
            servername: host,
            rejectUnauthorized: false // For testing purposes
        };
        
        const socket = tls.connect(options, () => {
            const cert = socket.getPeerCertificate();
            const cipher = socket.getCipher();
            const protocol = socket.getProtocol();
            
            resolve({
                connected: true,
                certificate: {
                    subject: cert.subject,
                    issuer: cert.issuer,
                    valid_from: cert.valid_from,
                    valid_to: cert.valid_to,
                    fingerprint: cert.fingerprint
                },
                cipher: cipher,
                protocol: protocol,
                authorized: socket.authorized
            });
            
            socket.end();
        });
        
        socket.on('error', (error) => {
            reject(error);
        });
        
        socket.setTimeout(10000, () => {
            socket.destroy();
            reject(new Error('Connection timeout'));
        });
    });
};

module.exports = {
    certificateManager,
    createHttpsServer,
    httpsRedirectMiddleware,
    httpsSecurityMiddleware,
    certificateHealthCheck,
    sslInfoEndpoint,
    testTlsConfiguration,
    SSL_CONFIG
};