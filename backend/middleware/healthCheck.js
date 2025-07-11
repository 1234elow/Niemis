const { sequelize } = require('../models');
const logger = require('../utils/logger');

// Basic health check
const basicHealthCheck = async (req, res, next) => {
    try {
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            service: 'niemis-backend'
        };

        res.json(healthData);
    } catch (error) {
        logger.logError(error, {
            endpoint: 'health_check',
            type: 'basic'
        });
        
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Detailed health check
const detailedHealthCheck = async (req, res, next) => {
    const startTime = Date.now();
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        service: 'niemis-backend',
        checks: {}
    };

    // Database health check
    try {
        const dbStart = Date.now();
        await sequelize.authenticate();
        const dbEnd = Date.now();
        
        healthData.checks.database = {
            status: 'healthy',
            responseTime: `${dbEnd - dbStart}ms`,
            connection: 'active'
        };
    } catch (error) {
        healthData.status = 'unhealthy';
        healthData.checks.database = {
            status: 'unhealthy',
            error: error.message,
            connection: 'failed'
        };
    }

    // Memory usage check
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
    };

    healthData.checks.memory = {
        status: memoryUsageMB.heapUsed > 500 ? 'warning' : 'healthy',
        usage: memoryUsageMB,
        unit: 'MB'
    };

    // CPU usage check (approximate)
    const cpuUsage = process.cpuUsage();
    healthData.checks.cpu = {
        status: 'healthy',
        usage: {
            user: cpuUsage.user,
            system: cpuUsage.system
        },
        unit: 'microseconds'
    };

    // Disk space check (basic)
    try {
        const fs = require('fs');
        const stats = fs.statSync('.');
        healthData.checks.disk = {
            status: 'healthy',
            available: true
        };
    } catch (error) {
        healthData.checks.disk = {
            status: 'unhealthy',
            error: error.message
        };
    }

    // Environment variables check
    const requiredEnvVars = ['JWT_SECRET', 'NODE_ENV'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    healthData.checks.environment = {
        status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
        missing: missingEnvVars,
        required: requiredEnvVars
    };

    // Response time
    const endTime = Date.now();
    healthData.responseTime = `${endTime - startTime}ms`;

    // Log health check
    logger.logPerformance('health_check', endTime - startTime, {
        status: healthData.status,
        checks: Object.keys(healthData.checks).reduce((acc, key) => {
            acc[key] = healthData.checks[key].status;
            return acc;
        }, {})
    });

    const statusCode = healthData.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthData);
};

// Liveness probe (for Kubernetes/container orchestration)
const livenessProbe = async (req, res, next) => {
    try {
        // Simple check to ensure the process is running
        const uptime = process.uptime();
        
        if (uptime > 0) {
            res.status(200).json({
                status: 'alive',
                uptime,
                timestamp: new Date().toISOString()
            });
        } else {
            throw new Error('Process uptime is invalid');
        }
    } catch (error) {
        logger.logError(error, {
            endpoint: 'liveness_probe'
        });
        
        res.status(500).json({
            status: 'dead',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Readiness probe (for Kubernetes/container orchestration)
const readinessProbe = async (req, res, next) => {
    try {
        // Check if the application is ready to serve traffic
        const checks = [];
        
        // Database readiness
        try {
            await sequelize.authenticate();
            checks.push({ name: 'database', status: 'ready' });
        } catch (error) {
            checks.push({ name: 'database', status: 'not_ready', error: error.message });
        }

        // Check if all critical services are ready
        const allReady = checks.every(check => check.status === 'ready');
        
        if (allReady) {
            res.status(200).json({
                status: 'ready',
                checks,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                status: 'not_ready',
                checks,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        logger.logError(error, {
            endpoint: 'readiness_probe'
        });
        
        res.status(503).json({
            status: 'not_ready',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Database health check
const databaseHealthCheck = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Test database connection
        await sequelize.authenticate();
        
        // Test a simple query
        const [results] = await sequelize.query('SELECT 1 as test');
        
        // Get database stats
        const dbStats = await sequelize.query('PRAGMA database_list;');
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        res.json({
            status: 'healthy',
            database: {
                connection: 'active',
                dialect: sequelize.getDialect(),
                version: sequelize.getDatabaseVersion ? await sequelize.getDatabaseVersion() : 'unknown',
                responseTime: `${responseTime}ms`,
                testQuery: results[0]?.test === 1 ? 'passed' : 'failed'
            },
            timestamp: new Date().toISOString()
        });
        
        logger.logPerformance('database_health_check', responseTime, {
            status: 'healthy',
            dialect: sequelize.getDialect()
        });
        
    } catch (error) {
        logger.logError(error, {
            endpoint: 'database_health_check'
        });
        
        res.status(503).json({
            status: 'unhealthy',
            database: {
                connection: 'failed',
                error: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
};

// System metrics endpoint
const systemMetrics = async (req, res, next) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                usage: process.memoryUsage(),
                system: {
                    total: require('os').totalmem(),
                    free: require('os').freemem()
                }
            },
            cpu: {
                usage: process.cpuUsage(),
                loadAvg: require('os').loadavg(),
                cores: require('os').cpus().length
            },
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                hostname: require('os').hostname()
            },
            process: {
                pid: process.pid,
                title: process.title,
                argv: process.argv.slice(2) // Remove node and script path
            }
        };

        res.json(metrics);
    } catch (error) {
        logger.logError(error, {
            endpoint: 'system_metrics'
        });
        
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// API status endpoint
const apiStatus = async (req, res, next) => {
    try {
        const status = {
            api: {
                name: 'NiEMIS Backend API',
                version: process.env.npm_package_version || '1.0.0',
                description: 'National Integrated Education Management Information System',
                environment: process.env.NODE_ENV || 'development',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            },
            features: {
                authentication: true,
                roleBasedAccess: true,
                schoolManagement: true,
                studentManagement: true,
                rfidIntegration: true,
                attendanceTracking: true,
                reportGeneration: true,
                facilityManagement: true
            },
            endpoints: {
                health: '/health',
                auth: '/api/auth',
                schools: '/api/schools',
                students: '/api/students',
                teachers: '/api/teachers',
                attendance: '/api/attendance',
                reports: '/api/reports',
                rfid: '/api/rfid',
                facilities: '/api/facilities'
            }
        };

        res.json(status);
    } catch (error) {
        logger.logError(error, {
            endpoint: 'api_status'
        });
        
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = {
    basicHealthCheck,
    detailedHealthCheck,
    livenessProbe,
    readinessProbe,
    databaseHealthCheck,
    systemMetrics,
    apiStatus
};