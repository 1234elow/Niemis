const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * SSL/TLS Configuration for NiEMIS Backend
 * Handles HTTPS certificates and security settings
 */

const isProduction = process.env.NODE_ENV === 'production';
const isRender = process.env.RENDER === 'true';

// SSL Certificate paths
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/cert.pem');
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/key.pem');
const SSL_CA_PATH = process.env.SSL_CA_PATH || path.join(__dirname, '../certs/ca.pem');

/**
 * HTTPS Server Options
 */
const getHttpsOptions = () => {
    // Render.com handles SSL termination, so we don't need HTTPS server locally
    if (isRender) {
        logger.info('Running on Render.com - SSL termination handled by platform');
        return null;
    }

    if (!isProduction) {
        logger.info('Development mode - HTTPS not required');
        return null;
    }

    // Self-hosted production environment
    try {
        const httpsOptions = {};

        if (fs.existsSync(SSL_CERT_PATH)) {
            httpsOptions.cert = fs.readFileSync(SSL_CERT_PATH);
            logger.info('SSL certificate loaded');
        } else {
            logger.warn('SSL certificate not found at:', SSL_CERT_PATH);
        }

        if (fs.existsSync(SSL_KEY_PATH)) {
            httpsOptions.key = fs.readFileSync(SSL_KEY_PATH);
            logger.info('SSL private key loaded');
        } else {
            logger.warn('SSL private key not found at:', SSL_KEY_PATH);
        }

        if (fs.existsSync(SSL_CA_PATH)) {
            httpsOptions.ca = fs.readFileSync(SSL_CA_PATH);
            logger.info('SSL CA certificate loaded');
        }

        // Additional HTTPS options for security
        httpsOptions.secureProtocol = 'TLS_method';
        httpsOptions.secureOptions = require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1;
        httpsOptions.ciphers = [
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-SHA256',
            'ECDHE-RSA-AES256-SHA384'
        ].join(':');
        httpsOptions.honorCipherOrder = true;

        return httpsOptions;
    } catch (error) {
        logger.error('Failed to load SSL certificates:', error);
        return null;
    }
};

/**
 * HTTPS Redirect Middleware
 * Redirects HTTP requests to HTTPS in production
 */
const httpsRedirect = (req, res, next) => {
    if (isProduction && !isRender) {
        // For self-hosted production, redirect HTTP to HTTPS
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
    }
    
    if (isRender) {
        // On Render.com, check for forwarded protocol
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
    }
    
    next();
};

/**
 * Security Headers Middleware
 * Adds security headers for HTTPS enforcement
 */
const securityHeaders = (req, res, next) => {
    if (isProduction) {
        // Strict Transport Security
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        
        // Content Security Policy
        res.setHeader('Content-Security-Policy', [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https:",
            "media-src 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; '));
        
        // Other security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    }
    
    next();
};

/**
 * Certificate Validation
 * Validates SSL certificates before server startup
 */
const validateCertificates = () => {
    if (!isProduction || isRender) {
        return { valid: true, message: 'Certificate validation skipped' };
    }

    const results = {
        valid: true,
        errors: [],
        warnings: []
    };

    if (!fs.existsSync(SSL_CERT_PATH)) {
        results.errors.push('SSL certificate file not found');
        results.valid = false;
    } else {
        try {
            const cert = fs.readFileSync(SSL_CERT_PATH, 'utf8');
            if (!cert.includes('BEGIN CERTIFICATE')) {
                results.errors.push('Invalid SSL certificate format');
                results.valid = false;
            }
        } catch (error) {
            results.errors.push(`Failed to read SSL certificate: ${error.message}`);
            results.valid = false;
        }
    }

    if (!fs.existsSync(SSL_KEY_PATH)) {
        results.errors.push('SSL private key file not found');
        results.valid = false;
    } else {
        try {
            const key = fs.readFileSync(SSL_KEY_PATH, 'utf8');
            if (!key.includes('BEGIN PRIVATE KEY') && !key.includes('BEGIN RSA PRIVATE KEY')) {
                results.errors.push('Invalid SSL private key format');
                results.valid = false;
            }
        } catch (error) {
            results.errors.push(`Failed to read SSL private key: ${error.message}`);
            results.valid = false;
        }
    }

    if (!fs.existsSync(SSL_CA_PATH)) {
        results.warnings.push('SSL CA certificate not found (optional)');
    }

    return results;
};

/**
 * Generate Self-Signed Certificate (Development Only)
 */
const generateSelfSignedCert = () => {
    if (isProduction) {
        logger.error('Cannot generate self-signed certificate in production');
        return false;
    }

    const { execSync } = require('child_process');
    const certDir = path.join(__dirname, '../certs');

    try {
        // Create certs directory
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }

        // Generate self-signed certificate
        const command = `openssl req -newkey rsa:2048 -nodes -keyout ${SSL_KEY_PATH} -x509 -days 365 -out ${SSL_CERT_PATH} -subj "/C=BB/ST=Barbados/L=Bridgetown/O=NiEMIS/CN=localhost"`;
        
        execSync(command, { stdio: 'inherit' });
        logger.info('Self-signed certificate generated for development');
        return true;
    } catch (error) {
        logger.error('Failed to generate self-signed certificate:', error);
        return false;
    }
};

module.exports = {
    getHttpsOptions,
    httpsRedirect,
    securityHeaders,
    validateCertificates,
    generateSelfSignedCert,
    SSL_CERT_PATH,
    SSL_KEY_PATH,
    SSL_CA_PATH
};