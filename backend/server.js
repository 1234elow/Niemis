const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./models');
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

const logger = require('./utils/logger');
const { errorHandler, notFoundHandler, timeoutHandler } = require('./middleware/errorHandler');
const { authMiddleware, refreshToken, jwtHealthCheck, jwtMetrics, revokeToken } = require('./middleware/auth');
const { 
    generalLimiter, 
    authLimiter, 
    roleBasedLimiter, 
    demoLimiter,
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

// Dynamic rate limiting based on server load
app.use(createDynamicRateLimiter());

// Rate limiting middleware
if (process.env.ENABLE_RATE_LIMITING === 'true') {
    app.use(generalLimiter);
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
}

// Student adaptive rate limiting
app.use(studentAdaptiveLimiter);

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

// IP management endpoints (admin only)
app.post('/api/security/block-ip', authMiddleware, blockIPEndpoint);
app.post('/api/security/unblock-ip', authMiddleware, unblockIPEndpoint);

// CORS management endpoints (admin only)
app.post('/api/security/cors/add-temp-origin', authMiddleware, addTempOriginEndpoint);
app.post('/api/security/cors/remove-temp-origin', authMiddleware, removeTempOriginEndpoint);

// Demo endpoint without authentication (with rate limiting)
app.get('/api/demo', demoLimiter, (req, res) => {
    res.json({
        message: 'NiEMIS Demo API is working!',
        system: 'National Integrated Education Management Information System',
        version: '1.0.0',
        schools: 106,
        coverage: 'Barbados (Pre-primary, Primary, Secondary)',
        features: [
            'Student Information System (SPIS)',
            'Staff Management',
            'RFID Attendance Tracking',
            'Facility Management',
            'Report Generation',
            'Role-based Access Control'
        ],
        timestamp: new Date().toISOString()
    });
});

// Demo data endpoints (with rate limiting)
app.get('/api/demo/schools', demoLimiter, (req, res) => {
    res.json({
        total: 106,
        schools: [
            { id: 1, name: "Harrison College", type: "Secondary", parish: "St. Michael", zone: "Zone 1", students: 1250, staff: 85, status: "Active", principal: "Dr. Marcia Pilgrim" },
            { id: 2, name: "Christ Church Foundation School", type: "Secondary", parish: "Christ Church", zone: "Zone 4", students: 1111, staff: 85, status: "Active", principal: "Mrs. Sandra Clarke" },
            { id: 3, name: "Combermere School", type: "Secondary", parish: "St. Michael", zone: "Zone 1", students: 1100, staff: 78, status: "Active", principal: "Mr. Wayne Robinson" },
            { id: 4, name: "St. Leonard's Boys' School", type: "Primary", parish: "St. Michael", zone: "Zone 1", students: 380, staff: 28, status: "Active", principal: "Mrs. Jennifer King" },
            { id: 5, name: "Queen's College", type: "Secondary", parish: "St. Michael", zone: "Zone 1", students: 950, staff: 68, status: "Active", principal: "Mrs. Donna Cadogan" },
            { id: 6, name: "St. Gabriel's School", type: "Primary", parish: "St. George", zone: "Zone 2", students: 320, staff: 24, status: "Active", principal: "Mr. David Thompson" },
            { id: 7, name: "The Lodge School", type: "Secondary", parish: "St. John", zone: "Zone 3", students: 890, staff: 62, status: "Active", principal: "Mrs. Susan Matthews" }
        ]
    });
});

app.get('/api/demo/students', demoLimiter, (req, res) => {
    res.json({
        total: 45230,
        students: [
            { id: "S001", studentId: "2024-HMS-001", name: "Sarah Johnson", grade: "Form 5", school: "Harrison College", parish: "St. Michael", age: 16, gender: "Female", attendance: 95.2, status: "Active" },
            { id: "S002", studentId: "2024-SLB-034", name: "Marcus Williams", grade: "Class 4", school: "St. Leonard's Boys'", parish: "St. Michael", age: 11, gender: "Male", attendance: 92.1, status: "Active" },
            { id: "S003", studentId: "2024-QC-156", name: "Isabella Brown", grade: "Form 3", school: "Queen's College", parish: "St. Michael", age: 14, gender: "Female", attendance: 98.4, status: "Active" },
            { id: "S004", studentId: "2024-CS-089", name: "David Miller", grade: "Form 1", school: "Combermere School", parish: "St. Michael", age: 12, gender: "Male", attendance: 89.7, status: "Active" },
            { id: "S005", studentId: "2024-CCF-067", name: "Emma Davis", grade: "Form 2", school: "Christ Church Foundation", parish: "Christ Church", age: 13, gender: "Female", attendance: 96.8, status: "Active" },
            { id: "S006", studentId: "2024-SGS-023", name: "Jordan Thompson", grade: "Class 4", school: "St. Gabriel's School", parish: "St. George", age: 9, gender: "Male", attendance: 94.3, status: "Active" }
        ]
    });
});

app.get('/api/demo/attendance', demoLimiter, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    res.json({
        date: today,
        totalStudents: 45230,
        present: 42587,
        absent: 2643,
        attendanceRate: 94.2,
        records: [
            { studentId: "S001", name: "Sarah Johnson", school: "Harrison College", checkIn: "08:15", status: "Present", method: "RFID" },
            { studentId: "S002", name: "Marcus Williams", school: "St. Leonard's Boys'", checkIn: "08:22", status: "Present", method: "RFID" },
            { studentId: "S003", name: "Isabella Brown", school: "Queen's College", checkIn: "08:08", status: "Present", method: "RFID" },
            { studentId: "S004", name: "David Miller", school: "Combermere School", checkIn: "08:35", status: "Late", method: "RFID" },
            { studentId: "S005", name: "Emma Davis", school: "Christ Church Foundation", checkIn: "08:12", status: "Present", method: "RFID" },
            { studentId: "S006", name: "Jordan Thompson", school: "St. Gabriel's School", checkIn: null, status: "Absent", method: null }
        ]
    });
});

app.get('/api/demo/rfid-devices', demoLimiter, (req, res) => {
    res.json({
        totalDevices: 156,
        online: 149,
        offline: 7,
        devices: [
            { id: "RFID001", deviceId: "HMS-MAIN-001", location: "Main Entrance", school: "Harrison College", status: "Online", lastScan: "2 min ago", totalScans: 1247 },
            { id: "RFID002", deviceId: "HMS-LIB-002", location: "Library", school: "Harrison College", status: "Online", lastScan: "5 min ago", totalScans: 689 },
            { id: "RFID003", deviceId: "QC-CAF-001", location: "Cafeteria", school: "Queen's College", status: "Online", lastScan: "1 min ago", totalScans: 892 },
            { id: "RFID004", deviceId: "CS-GATE-001", location: "Main Gate", school: "Combermere School", status: "Offline", lastScan: "1 hour ago", totalScans: 1156 },
            { id: "RFID005", deviceId: "CCF-ADM-001", location: "Admin Block", school: "Christ Church Foundation", status: "Online", lastScan: "3 min ago", totalScans: 567 },
            { id: "RFID006", deviceId: "SGS-ENT-001", location: "School Entrance", school: "St. Gabriel's School", status: "Online", lastScan: "7 min ago", totalScans: 423 }
        ]
    });
});

app.get('/api/demo/statistics', demoLimiter, (req, res) => {
    res.json({
        schools: {
            total: 106,
            byType: {
                primary: 78,
                secondary: 23,
                prePrimary: 5
            },
            byParish: {
                "St. Michael": 32,
                "Christ Church": 18,
                "St. George": 14,
                "St. Philip": 12,
                "St. John": 10,
                "St. James": 8,
                "St. Thomas": 7,
                "St. Joseph": 5
            }
        },
        students: {
            total: 45230,
            byLevel: {
                prePrimary: 2150,
                primary: 28450,
                secondary: 14630
            },
            byGender: {
                male: 22890,
                female: 22340
            }
        },
        staff: {
            total: 3845,
            teachers: 3102,
            administrators: 543,
            support: 200
        },
        facilities: {
            total: 2340,
            classrooms: 1456,
            laboratories: 234,
            libraries: 98,
            cafeterias: 89,
            gymnasiums: 67,
            other: 396
        }
    });
});

// Token refresh endpoint
app.post('/api/auth/refresh', refreshToken);

// Token revocation endpoint
app.post('/api/auth/revoke', authMiddleware, revokeToken);

// API Routes with middleware
app.use('/api/auth', authRoutes);

// Public demo endpoints (no authentication required)
app.post('/api/schools/import-barbados', async (req, res, next) => {
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

app.get('/api/schools/statistics/barbados', async (req, res, next) => {
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

// Public demo endpoints for school listings (no authentication required)
app.get('/api/schools/by-category/:category', async (req, res, next) => {
    try {
        const { School } = require('./models');
        const { category } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        const validCategories = ['primary', 'secondary', 'nursery', 'special', 'tertiary'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ 
                error: 'Invalid category', 
                valid_categories: validCategories 
            });
        }
        
        const schools = await School.findAndCountAll({
            where: { 
                school_category: category,
                is_active: true 
            },
            attributes: [
                'id', 'name', 'school_code', 'school_category', 'parish', 
                'student_population', 'principal_name', 'phone', 'email'
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']]
        });
        
        res.json({
            category,
            schools: schools.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(schools.count / limit),
                total_count: schools.count,
                per_page: parseInt(limit)
            }
        });
        
    } catch (error) {
        next(error);
    }
});

app.get('/api/schools/by-parish/:parish', async (req, res, next) => {
    try {
        const { School } = require('./models');
        const { parish } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        const validParishes = ['st_michael', 'christ_church', 'st_philip', 'st_james', 'st_john', 'st_andrew', 'st_george', 'st_peter', 'st_lucy'];
        if (!validParishes.includes(parish)) {
            return res.status(400).json({ 
                error: 'Invalid parish', 
                valid_parishes: validParishes 
            });
        }
        
        const schools = await School.findAndCountAll({
            where: { 
                parish,
                is_active: true 
            },
            attributes: [
                'id', 'name', 'school_code', 'school_category', 'parish', 
                'student_population', 'principal_name', 'phone', 'email'
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']]
        });
        
        res.json({
            parish,
            schools: schools.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(schools.count / limit),
                total_count: schools.count,
                per_page: parseInt(limit)
            }
        });
        
    } catch (error) {
        next(error);
    }
});

// Protected API routes with role-based rate limiting
app.use('/api/students', authMiddleware, roleBasedLimiter, studentRoutes);
app.use('/api/admin', authMiddleware, roleBasedLimiter, adminRoutes);
app.use('/api/admin/schools', authMiddleware, roleBasedLimiter, schoolRoutes);
app.use('/api/teachers', authMiddleware, roleBasedLimiter, teacherRoutes);
app.use('/api/attendance', authMiddleware, roleBasedLimiter, attendanceRoutes);
app.use('/api/facilities', authMiddleware, roleBasedLimiter, facilityRoutes);
app.use('/api/reports', authMiddleware, roleBasedLimiter, reportRoutes);
app.use('/api/rfid', authMiddleware, roleBasedLimiter, rfidRoutes);
app.use('/api/grading', authMiddleware, roleBasedLimiter, gradingRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

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

async function startServer() {
    try {
        // Try to connect to database with retries
        const dbConnected = await connectToDatabase(3);
        
        if (!dbConnected) {
            logger.error('Could not establish database connection after multiple attempts');
            logger.info('Starting server without database connection for debugging...');
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
            httpsServer.listen(httpsPort, () => {
                logger.info(`NiEMIS Backend HTTPS Server running on port ${httpsPort}`);
                logger.info(`Environment: ${process.env.NODE_ENV}`);
                logger.info(`Database status: ${dbConnected ? 'Connected' : 'Disconnected'}`);
                logger.info('SSL/TLS encryption enabled');
            });
            
            // Start HTTP server for redirects (if not on Render.com)
            if (!process.env.RENDER) {
                app.listen(PORT, () => {
                    logger.info(`HTTP redirect server running on port ${PORT}`);
                });
            }
        } else {
            // Fallback to HTTP server
            app.listen(PORT, () => {
                logger.info(`NiEMIS Backend Server running on port ${PORT}`);
                logger.info(`Environment: ${process.env.NODE_ENV}`);
                logger.info(`Database status: ${dbConnected ? 'Connected' : 'Disconnected'}`);
                if (isProduction) {
                    logger.warn('Running HTTP server in production - SSL certificates not found');
                }
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

startServer();

module.exports = app;