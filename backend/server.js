const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const {
    sequelize,
    SchoolDayPolicy,
    ClassTimetableSlot,
    GradingPolicy,
    DataQualityIssue,
    DataQualitySnapshot
} = require('./models');
const authRoutes = require('./routes/auth');
const schoolRoutes = require('./routes/schools');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teachers');
const attendanceRoutes = require('./routes/attendance');
const facilityRoutes = require('./routes/facilities');
const reportRoutes = require('./routes/reports');
const rfidRoutes = require('./routes/rfid');
const gradingRoutes = require('./routes/grading');
const adminRoutes = require('./routes/admin');
const setupRoutes = require('./routes/setup');

const logger = require('./utils/logger');
const { errorHandler, notFoundHandler, timeoutHandler } = require('./middleware/errorHandler');
const { authMiddleware, requireRole, refreshToken, jwtHealthCheck, jwtMetrics, revokeToken } = require('./middleware/auth');
const { attachAccessContext, authorizeRouteGroup } = require('./middleware/accessControl');
const { createApiActivityAuditMiddleware } = require('./middleware/apiActivityAudit');
const socketService = require('./services/socketService');
const redisManager = require('./config/redis');
const { 
    generalLimiter, 
    authLimiter, 
    roleBasedLimiter, 
    createDynamicRateLimiter,
    studentAdaptiveLimiter 
} = require('./middleware/rateLimiter');
const { 
    ddosProtectionMiddleware,
    connectionTrackingMiddleware,
    ddosStatsEndpoint,
    blockIPEndpoint,
    unblockIPEndpoint
} = require('./config/ddos-protection');
const { 
    createHttpsServer, 
    httpsRedirectMiddleware, 
    httpsSecurityMiddleware,
    certificateHealthCheck,
    sslInfoEndpoint
} = require('./config/https');
const { 
    getCSPConfig,
    cspViolationHandler,
    cspStatsEndpoint
} = require('./config/csp');
const { 
    corsManager,
    corsStatsEndpoint,
    addTempOriginEndpoint,
    removeTempOriginEndpoint
} = require('./config/cors');
const { 
    basicHealthCheck, 
    detailedHealthCheck, 
    livenessProbe, 
    readinessProbe, 
    databaseHealthCheck, 
    systemMetrics, 
    apiStatus 
} = require('./middleware/healthCheck');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for accurate IP addresses (important for Render.com)
app.set('trust proxy', 1);

// Connection tracking middleware (must be very early)
app.use(connectionTrackingMiddleware);

// DDoS protection middleware (must be early in the middleware stack)
app.use(ddosProtectionMiddleware);

// HTTPS redirect middleware (must be early in the middleware stack)
app.use(httpsRedirectMiddleware);

// HTTPS security middleware
app.use(httpsSecurityMiddleware);

// Request timeout (30 seconds)
app.use(timeoutHandler(30000));

// Compression middleware
app.use(compression());

// CSP violation handling middleware (must be before body parsing)
app.use(cspViolationHandler);

// Security middleware - Enhanced Helmet configuration with CSP
app.use(helmet({
    contentSecurityPolicy: getCSPConfig(),
    hsts: {
        maxAge: parseInt(process.env.HELMET_HSTS_MAX_AGE) || 31536000,
        includeSubDomains: process.env.HELMET_HSTS_INCLUDE_SUBDOMAINS !== 'false',
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' }
}));

// Enhanced CORS configuration
app.use(cors(corsManager.config));

// Body parsing middleware with security limits
app.use(express.json({ 
    limit: process.env.UPLOAD_MAX_FILE_SIZE || '10mb',
    verify: (req, res, buf) => {
        // Log large requests
        if (buf.length > 1024 * 1024) { // 1MB
            logger.logSecurity('large_request_body', {
                size: buf.length,
                contentType: req.get('Content-Type'),
                ip: req.ip
            }, req);
        }
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: process.env.UPLOAD_MAX_FILE_SIZE || '10mb' 
}));

// Dynamic rate limiting based on server load (disabled for development)
if (isProduction) {
    app.use(createDynamicRateLimiter());
}

// Rate limiting middleware (disabled for development)
if (process.env.ENABLE_RATE_LIMITING === 'true' && isProduction) {
    app.use(generalLimiter);
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
}

// Student adaptive rate limiting (disabled for development)
if (isProduction) {
    app.use(studentAdaptiveLimiter);
}

// Request logging middleware
if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
    const morganFormat = isProduction ? 'combined' : 'dev';
    app.use(morgan(morganFormat, {
        stream: {
            write: (message) => {
                logger.http(message.trim());
            }
        },
        skip: (req, res) => {
            // Skip logging for health check endpoints
            return req.path.startsWith('/health') || req.path.startsWith('/api/health');
        }
    }));
}

// Static files with security headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: isProduction ? '1d' : 0,
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Download-Options', 'noopen');
        res.set('X-Frame-Options', 'DENY');
    }
}));

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info('Created uploads directory');
}

// Performance monitoring middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.logRequest(req, res, duration);
        
        // Log slow requests
        if (duration > 1000) {
            logger.logPerformance('slow_request', duration, {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                userId: req.user?.id
            });
        }
    });
    
    next();
});

// Health check endpoints
app.get('/health', basicHealthCheck);
app.get('/health/detailed', detailedHealthCheck);
app.get('/health/liveness', livenessProbe);
app.get('/health/readiness', readinessProbe);
app.get('/health/database', databaseHealthCheck);
app.get('/health/ssl', (req, res) => {
    const sslHealth = certificateHealthCheck();
    res.status(sslHealth.status === 'healthy' ? 200 : 503).json(sslHealth);
});
app.get('/api/health', basicHealthCheck);
app.get('/api/health/detailed', detailedHealthCheck);
app.get('/api/health/metrics', systemMetrics);
app.get('/api/health/status', apiStatus);
app.get('/api/health/ssl', sslInfoEndpoint);
app.get('/api/health/jwt', jwtHealthCheck);
app.get('/api/security/csp-stats', cspStatsEndpoint);
app.get('/api/security/jwt-metrics', authMiddleware, jwtMetrics);
app.get('/api/security/ddos-stats', authMiddleware, ddosStatsEndpoint);
app.get('/api/security/cors-stats', authMiddleware, corsStatsEndpoint);

// IP management endpoints (super admin only)
app.post('/api/security/block-ip', authMiddleware, requireRole(['super_admin']), blockIPEndpoint);
app.post('/api/security/unblock-ip', authMiddleware, requireRole(['super_admin']), unblockIPEndpoint);

// CORS management endpoints (super admin only)
app.post('/api/security/cors/add-temp-origin', authMiddleware, requireRole(['super_admin']), addTempOriginEndpoint);
app.post('/api/security/cors/remove-temp-origin', authMiddleware, requireRole(['super_admin']), removeTempOriginEndpoint);


// Token refresh endpoint
app.post('/api/auth/refresh', refreshToken);

// Token revocation endpoint
app.post('/api/auth/revoke', authMiddleware, revokeToken);

// API Routes with middleware
app.use('/api/auth', authRoutes);

// Public Barbados school reference endpoints
app.post('/api/schools/import-barbados', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const BarbadosSchoolImporter = require('./services/barbadosSchoolImporter');
        const importer = new BarbadosSchoolImporter();
        const result = await importer.importSchools();
        
        logger.info('Barbados schools import completed', result);
        res.json({
            message: 'Barbados schools imported successfully',
            ...result
        });
        
    } catch (error) {
        logger.error('Barbados schools import failed:', error);
        next(error);
    }
});

app.get('/api/schools/statistics/barbados', authMiddleware, requireRole(['super_admin', 'admin']), async (req, res, next) => {
    try {
        const { School } = require('./models');
        const { Op } = require('sequelize');
        
        const totalSchools = await School.count({ where: { is_active: true } });
        const totalPopulation = await School.sum('student_population', {
            where: { 
                is_active: true,
                student_population: { [Op.not]: null }
            }
        });
        
        const categoryStats = await School.findAll({
            attributes: [
                'school_category',
                [School.sequelize.fn('COUNT', '*'), 'count'],
                [School.sequelize.fn('SUM', School.sequelize.col('student_population')), 'total_students']
            ],
            where: { is_active: true },
            group: ['school_category'],
            raw: true
        });
        
        const parishStats = await School.findAll({
            attributes: [
                'parish',
                [School.sequelize.fn('COUNT', '*'), 'count'],
                [School.sequelize.fn('SUM', School.sequelize.col('student_population')), 'total_students']
            ],
            where: { is_active: true },
            group: ['parish'],
            raw: true
        });
        
        res.json({
            overview: {
                total_schools: totalSchools,
                total_students: totalPopulation || 0,
                last_updated: new Date().toISOString()
            },
            by_category: categoryStats,
            by_parish: parishStats
        });
        
    } catch (error) {
        next(error);
    }
});

// Protected API routes with role-based rate limiting
const apiActivityAuditMiddleware = createApiActivityAuditMiddleware({
    skipPrefixes: ['/api/auth', '/api/health', '/api/admin/audit-logs'],
    auditReadRequests: true,
    readAuditCooldownMs: 15000
});

app.use('/api/students', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('students'), apiActivityAuditMiddleware, studentRoutes);
app.use('/api/admin', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('admin'), adminRoutes);
app.use('/api/admin/schools', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('schools'), schoolRoutes);
app.use('/api/teachers', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('teachers'), apiActivityAuditMiddleware, teacherRoutes);
app.use('/api/attendance', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('attendance'), apiActivityAuditMiddleware, attendanceRoutes);
app.use('/api/facilities', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('facilities'), apiActivityAuditMiddleware, facilityRoutes);
app.use('/api/reports', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('reports'), apiActivityAuditMiddleware, reportRoutes);
app.use('/api/rfid', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('rfid'), apiActivityAuditMiddleware, rfidRoutes);
app.use('/api/grading', authMiddleware, roleBasedLimiter, attachAccessContext, authorizeRouteGroup('grading'), apiActivityAuditMiddleware, gradingRoutes);
app.use('/api/setup', authMiddleware, requireRole(['super_admin']), setupRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

// Real-time services initialization
async function initializeRealTimeServices(server) {
    try {
        logger.info('Initializing real-time services...');
        
        // Connect to Redis
        await redisManager.connect();
        logger.info('Redis connection established');
        
        // Initialize WebSocket service
        await socketService.initialize(server);
        logger.info('WebSocket service initialized');
        
        // Add health check endpoint for real-time services
        app.get('/api/health/realtime', async (req, res) => {
            const redisHealth = await redisManager.healthCheck();
            const socketStats = {
                connectedUsers: socketService.getConnectedUserCount(),
                status: 'healthy'
            };
            
            res.json({
                redis: redisHealth,
                websocket: socketStats,
                timestamp: new Date().toISOString()
            });
        });
        
        logger.info('Real-time services initialized successfully');
        
    } catch (error) {
        logger.error('Failed to initialize real-time services:', error);
        logger.warn('Continuing without real-time features...');
    }
}

// Database connection and server startup
async function connectToDatabase(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            logger.info(`Attempting database connection (attempt ${i + 1}/${retries})...`);
            await sequelize.authenticate();
            logger.info('Database connection established successfully');
            return true;
        } catch (error) {
            logger.error(`Database connection failed (attempt ${i + 1}/${retries}):`, error.message);
            if (i < retries - 1) {
                const delay = Math.pow(2, i) * 1000; // Exponential backoff
                logger.info(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    return false;
}

async function ensureTimetableSchema() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const defaultSchema = sequelize.options?.define?.schema;
        const schoolsTableRef =
            sequelize.getDialect() === 'postgres'
                ? { tableName: 'schools', schema: defaultSchema }
                : 'schools';

        const schoolColumns = await queryInterface.describeTable(schoolsTableRef);

        if (!schoolColumns.offers_sixth_form) {
            await queryInterface.addColumn(schoolsTableRef, 'offers_sixth_form', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            });
            logger.info('Added schools.offers_sixth_form column');
        }

        await SchoolDayPolicy.sync({ alter: false });
        await ClassTimetableSlot.sync({ alter: false });
        await GradingPolicy.sync({ alter: false });
        await DataQualityIssue.sync({ alter: false });
        await DataQualitySnapshot.sync({ alter: false });
    } catch (error) {
        logger.warn('Schema check for timetable features failed:', error.message);
    }
}

async function startServer() {
    try {
        // Try to connect to database with retries
        const dbConnected = await connectToDatabase(3);
        
        if (!dbConnected) {
            logger.error('Could not establish database connection after multiple attempts');
            logger.info('Starting server without database connection for debugging...');
        }

        if (dbConnected) {
            await ensureTimetableSchema();
        }

        // Sync database in development if connection is established
        if (dbConnected && process.env.NODE_ENV === 'development') {
            try {
                // Use force: false to avoid destructive operations
                // Only create tables if they don't exist
                await sequelize.sync({ force: false, alter: false });
                logger.info('Database synchronized');
            } catch (syncError) {
                logger.error('Database sync failed:', syncError.message);
                logger.info('Continuing without database sync...');
            }
        }
        
        // Start HTTPS server if certificates are available and not force disabled
        const httpsForceDisabled = process.env.HTTPS_FORCE_DISABLED === 'true';
        const httpsServer = httpsForceDisabled ? null : createHttpsServer(app);
        
        if (httpsServer && !httpsForceDisabled) {
            const httpsPort = process.env.HTTPS_PORT || 443;
            httpsServer.listen(httpsPort, async () => {
                logger.info(`NiEMIS Backend HTTPS Server running on port ${httpsPort}`);
                logger.info(`Environment: ${process.env.NODE_ENV}`);
                logger.info(`Database status: ${dbConnected ? 'Connected' : 'Disconnected'}`);
                logger.info('SSL/TLS encryption enabled');

                // Initialize real-time services
                await initializeRealTimeServices(httpsServer);
            });
            
            // Start HTTP server for redirects (if not on Render.com)
            if (!process.env.RENDER) {
                app.listen(PORT, () => {
                    logger.info(`HTTP redirect server running on port ${PORT}`);
                });
            }
        } else {
            // Fallback to HTTP server
            const server = app.listen(PORT, async () => {
                logger.info(`NiEMIS Backend Server running on port ${PORT}`);
                logger.info(`Environment: ${process.env.NODE_ENV}`);
                logger.info(`Database status: ${dbConnected ? 'Connected' : 'Disconnected'}`);
                if (isProduction) {
                    logger.warn('Running HTTP server in production - SSL certificates not found');
                }

                // Initialize real-time services
                await initializeRealTimeServices(server);
            });
        }
        
    } catch (error) {
        logger.error('Unable to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    try {
        // Close real-time services
        await socketService.shutdown();
        logger.info('WebSocket service closed');
        
        await redisManager.disconnect();
        logger.info('Redis connection closed');
        
        // Close database connections
        await sequelize.close();
        logger.info('Database connections closed');
        
        // Exit process
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

if (require.main === module) {
    startServer();
}

module.exports = app;
module.exports.startServer = startServer;
