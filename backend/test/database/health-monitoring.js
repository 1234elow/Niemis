const { sequelize } = require('../../config/database');
const { User, School, Student, Staff, AttendanceRecord } = require('../../models');
const logger = require('../../utils/logger');

/**
 * Database Health Monitoring System
 * Continuous monitoring of database health, performance, and integrity
 */

class DatabaseHealthMonitor {
    constructor() {
        this.healthMetrics = {
            timestamp: null,
            status: 'unknown',
            connection: {},
            performance: {},
            integrity: {},
            alerts: [],
            recommendations: []
        };
        
        this.thresholds = {
            connectionTime: 2000,     // 2 seconds
            queryTime: 5000,         // 5 seconds
            slowQueryTime: 10000,    // 10 seconds
            memoryUsage: 100 * 1024 * 1024, // 100MB
            errorRate: 0.05,         // 5%
            diskUsage: 0.85          // 85%
        };
        
        this.startTime = Date.now();
        this.queryCount = 0;
        this.errorCount = 0;
        this.slowQueryCount = 0;
    }

    /**
     * Run comprehensive health check
     */
    async runHealthCheck() {
        try {
            this.healthMetrics.timestamp = new Date().toISOString();
            
            logger.info('Starting database health check...');
            
            // Test database connectivity
            await this.checkConnection();
            
            // Test basic query performance
            await this.checkQueryPerformance();
            
            // Check data integrity
            await this.checkDataIntegrity();
            
            // Check resource utilization
            await this.checkResourceUsage();
            
            // Check for slow queries
            await this.checkSlowQueries();
            
            // Generate overall health status
            this.calculateHealthStatus();
            
            logger.info('Database health check completed', this.healthMetrics);
            
            return this.healthMetrics;
            
        } catch (error) {
            this.healthMetrics.status = 'critical';
            this.healthMetrics.alerts.push({
                level: 'critical',
                message: `Health check failed: ${error.message}`,
                timestamp: new Date().toISOString()
            });
            
            logger.error('Database health check failed:', error);
            throw error;
        }
    }

    /**
     * Check database connection health
     */
    async checkConnection() {
        const startTime = Date.now();
        
        try {
            await sequelize.authenticate();
            const connectionTime = Date.now() - startTime;
            
            this.healthMetrics.connection = {
                status: 'healthy',
                connection_time_ms: connectionTime,
                dialect: sequelize.getDialect(),
                database: sequelize.config.database || 'unknown',
                pool_size: sequelize.config.pool?.max || 'unknown',
                active_connections: sequelize.connectionManager.pool?.size || 'unknown'
            };
            
            if (connectionTime > this.thresholds.connectionTime) {
                this.healthMetrics.alerts.push({
                    level: 'warning',
                    message: `Slow database connection: ${connectionTime}ms`,
                    timestamp: new Date().toISOString()
                });
            }
            
            logger.info(`Database connection healthy: ${connectionTime}ms`);
            
        } catch (error) {
            this.healthMetrics.connection = {
                status: 'unhealthy',
                error: error.message,
                connection_time_ms: Date.now() - startTime
            };
            
            this.healthMetrics.alerts.push({
                level: 'critical',
                message: `Database connection failed: ${error.message}`,
                timestamp: new Date().toISOString()
            });
            
            throw error;
        }
    }

    /**
     * Check basic query performance
     */
    async checkQueryPerformance() {
        const performanceTests = [
            {
                name: 'basic_query',
                test: () => sequelize.query('SELECT 1 as test'),
                threshold: 1000
            },
            {
                name: 'student_count',
                test: () => Student.count(),
                threshold: 2000
            },
            {
                name: 'school_lookup',
                test: () => School.findAll({ limit: 10 }),
                threshold: 3000
            },
            {
                name: 'user_lookup',
                test: () => User.findAll({ limit: 10, where: { is_active: true } }),
                threshold: 3000
            }
        ];
        
        const performanceResults = {};
        
        for (const test of performanceTests) {
            const startTime = Date.now();
            this.queryCount++;
            
            try {
                await test.test();
                const queryTime = Date.now() - startTime;
                
                performanceResults[test.name] = {
                    status: 'success',
                    time_ms: queryTime,
                    threshold_ms: test.threshold
                };
                
                if (queryTime > test.threshold) {
                    this.slowQueryCount++;
                    this.healthMetrics.alerts.push({
                        level: 'warning',
                        message: `Slow query ${test.name}: ${queryTime}ms (threshold: ${test.threshold}ms)`,
                        timestamp: new Date().toISOString()
                    });
                }
                
            } catch (error) {
                this.errorCount++;
                performanceResults[test.name] = {
                    status: 'error',
                    error: error.message,
                    time_ms: Date.now() - startTime
                };
                
                this.healthMetrics.alerts.push({
                    level: 'error',
                    message: `Query failed ${test.name}: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        this.healthMetrics.performance = {
            query_count: this.queryCount,
            error_count: this.errorCount,
            slow_query_count: this.slowQueryCount,
            error_rate: this.errorCount / this.queryCount,
            results: performanceResults
        };
        
        logger.info('Query performance check completed', performanceResults);
    }

    /**
     * Check data integrity
     */
    async checkDataIntegrity() {
        const integrityTests = [
            {
                name: 'school_count',
                test: () => School.count(),
                expected: { min: 100, max: 200 },
                description: 'Barbados schools should be around 106'
            },
            {
                name: 'zone_count',
                test: () => sequelize.query('SELECT COUNT(*) as count FROM zones'),
                expected: { exact: 5 },
                description: 'Should have exactly 5 zones'
            },
            {
                name: 'parish_count',
                test: () => sequelize.query('SELECT COUNT(*) as count FROM parishes'),
                expected: { exact: 11 },
                description: 'Should have exactly 11 parishes'
            },
            {
                name: 'orphaned_students',
                test: () => sequelize.query(`
                    SELECT COUNT(*) as count FROM students 
                    WHERE school_id IS NOT NULL 
                    AND school_id NOT IN (SELECT id FROM schools)
                `),
                expected: { exact: 0 },
                description: 'Should have no orphaned student records'
            },
            {
                name: 'user_student_consistency',
                test: async () => {
                    const [studentsWithUsers] = await sequelize.query(`
                        SELECT COUNT(*) as count FROM students 
                        WHERE user_id IS NOT NULL 
                        AND user_id NOT IN (SELECT id FROM users WHERE role = 'student')
                    `);
                    return studentsWithUsers;
                },
                expected: { exact: 0 },
                description: 'Student-user relationships should be consistent'
            }
        ];
        
        const integrityResults = {};
        
        for (const test of integrityTests) {
            try {
                const result = await test.test();
                const count = Array.isArray(result) ? parseInt(result[0].count) : parseInt(result);
                
                let status = 'healthy';
                if (test.expected.exact !== undefined && count !== test.expected.exact) {
                    status = 'unhealthy';
                } else if (test.expected.min !== undefined && count < test.expected.min) {
                    status = 'unhealthy';
                } else if (test.expected.max !== undefined && count > test.expected.max) {
                    status = 'unhealthy';
                }
                
                integrityResults[test.name] = {
                    status,
                    count,
                    expected: test.expected,
                    description: test.description
                };
                
                if (status === 'unhealthy') {
                    this.healthMetrics.alerts.push({
                        level: 'error',
                        message: `Data integrity issue in ${test.name}: ${test.description}`,
                        timestamp: new Date().toISOString()
                    });
                }
                
            } catch (error) {
                integrityResults[test.name] = {
                    status: 'error',
                    error: error.message,
                    description: test.description
                };
                
                this.healthMetrics.alerts.push({
                    level: 'error',
                    message: `Integrity check failed ${test.name}: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        this.healthMetrics.integrity = {
            tests_run: integrityTests.length,
            results: integrityResults
        };
        
        logger.info('Data integrity check completed', integrityResults);
    }

    /**
     * Check resource utilization
     */
    async checkResourceUsage() {
        const initialMemory = process.memoryUsage();
        
        // Run a memory-intensive query
        const startTime = Date.now();
        await Student.findAll({
            limit: 500,
            include: [
                { model: User, attributes: ['id', 'email'] },
                { model: School, attributes: ['id', 'name'] }
            ]
        });
        
        const afterMemory = process.memoryUsage();
        const memoryUsage = afterMemory.heapUsed - initialMemory.heapUsed;
        const queryTime = Date.now() - startTime;
        
        this.healthMetrics.performance.resource_usage = {
            memory_usage_bytes: memoryUsage,
            memory_usage_mb: (memoryUsage / 1024 / 1024).toFixed(2),
            query_time_ms: queryTime,
            heap_used_mb: (afterMemory.heapUsed / 1024 / 1024).toFixed(2),
            heap_total_mb: (afterMemory.heapTotal / 1024 / 1024).toFixed(2)
        };
        
        if (memoryUsage > this.thresholds.memoryUsage) {
            this.healthMetrics.alerts.push({
                level: 'warning',
                message: `High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`,
                timestamp: new Date().toISOString()
            });
        }
        
        logger.info('Resource usage check completed', this.healthMetrics.performance.resource_usage);
    }

    /**
     * Check for slow queries
     */
    async checkSlowQueries() {
        const slowQueryTests = [
            {
                name: 'complex_join',
                query: () => Student.findAll({
                    limit: 100,
                    include: [
                        { model: User, attributes: ['id', 'email'] },
                        { 
                            model: School, 
                            attributes: ['id', 'name'],
                            include: [
                                { model: Zone, attributes: ['name'] },
                                { model: Parish, attributes: ['name'] }
                            ]
                        }
                    ]
                }),
                threshold: 5000
            },
            {
                name: 'aggregate_query',
                query: () => sequelize.query(`
                    SELECT 
                        s.name as school_name,
                        COUNT(DISTINCT st.id) as student_count,
                        COUNT(DISTINCT sf.id) as staff_count
                    FROM schools s
                    LEFT JOIN students st ON s.id = st.school_id
                    LEFT JOIN staff sf ON s.id = sf.school_id
                    GROUP BY s.id, s.name
                    ORDER BY student_count DESC
                    LIMIT 20
                `),
                threshold: 8000
            }
        ];
        
        const slowQueryResults = {};
        
        for (const test of slowQueryTests) {
            const startTime = Date.now();
            
            try {
                await test.query();
                const queryTime = Date.now() - startTime;
                
                slowQueryResults[test.name] = {
                    status: queryTime > test.threshold ? 'slow' : 'healthy',
                    time_ms: queryTime,
                    threshold_ms: test.threshold
                };
                
                if (queryTime > test.threshold) {
                    this.healthMetrics.alerts.push({
                        level: 'warning',
                        message: `Slow query detected ${test.name}: ${queryTime}ms`,
                        timestamp: new Date().toISOString()
                    });
                }
                
            } catch (error) {
                slowQueryResults[test.name] = {
                    status: 'error',
                    error: error.message,
                    time_ms: Date.now() - startTime
                };
            }
        }
        
        this.healthMetrics.performance.slow_queries = slowQueryResults;
        
        logger.info('Slow query check completed', slowQueryResults);
    }

    /**
     * Calculate overall health status
     */
    calculateHealthStatus() {
        let status = 'healthy';
        let score = 100;
        
        // Check for critical alerts
        const criticalAlerts = this.healthMetrics.alerts.filter(alert => alert.level === 'critical');
        if (criticalAlerts.length > 0) {
            status = 'critical';
            score = 0;
        }
        
        // Check for error alerts
        const errorAlerts = this.healthMetrics.alerts.filter(alert => alert.level === 'error');
        if (errorAlerts.length > 0 && status !== 'critical') {
            status = 'unhealthy';
            score = Math.max(0, score - (errorAlerts.length * 30));
        }
        
        // Check for warning alerts
        const warningAlerts = this.healthMetrics.alerts.filter(alert => alert.level === 'warning');
        if (warningAlerts.length > 0 && status === 'healthy') {
            status = 'warning';
            score = Math.max(0, score - (warningAlerts.length * 10));
        }
        
        // Check error rate
        if (this.healthMetrics.performance.error_rate > this.thresholds.errorRate) {
            status = status === 'healthy' ? 'unhealthy' : status;
            score = Math.max(0, score - 25);
        }
        
        this.healthMetrics.status = status;
        this.healthMetrics.health_score = score;
        this.healthMetrics.uptime_ms = Date.now() - this.startTime;
        
        // Generate recommendations
        this.generateRecommendations();
        
        logger.info(`Database health status: ${status} (score: ${score})`);
    }

    /**
     * Generate health recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Connection recommendations
        if (this.healthMetrics.connection.connection_time_ms > this.thresholds.connectionTime) {
            recommendations.push({
                category: 'connection',
                message: 'Consider optimizing database connection settings or checking network latency',
                priority: 'medium'
            });
        }
        
        // Performance recommendations
        if (this.healthMetrics.performance.slow_query_count > 0) {
            recommendations.push({
                category: 'performance',
                message: 'Consider adding database indexes or optimizing slow queries',
                priority: 'high'
            });
        }
        
        // Error rate recommendations
        if (this.healthMetrics.performance.error_rate > this.thresholds.errorRate) {
            recommendations.push({
                category: 'reliability',
                message: 'High error rate detected. Review application logs and database connectivity',
                priority: 'high'
            });
        }
        
        // Memory recommendations
        if (this.healthMetrics.performance.resource_usage) {
            const memoryMB = parseFloat(this.healthMetrics.performance.resource_usage.memory_usage_mb);
            if (memoryMB > 50) {
                recommendations.push({
                    category: 'memory',
                    message: 'High memory usage detected. Consider implementing result pagination',
                    priority: 'medium'
                });
            }
        }
        
        this.healthMetrics.recommendations = recommendations;
    }

    /**
     * Generate health report
     */
    generateHealthReport() {
        const report = {
            ...this.healthMetrics,
            summary: {
                status: this.healthMetrics.status,
                health_score: this.healthMetrics.health_score,
                uptime_ms: this.healthMetrics.uptime_ms,
                alert_count: this.healthMetrics.alerts.length,
                critical_alerts: this.healthMetrics.alerts.filter(a => a.level === 'critical').length,
                error_alerts: this.healthMetrics.alerts.filter(a => a.level === 'error').length,
                warning_alerts: this.healthMetrics.alerts.filter(a => a.level === 'warning').length,
                recommendations_count: this.healthMetrics.recommendations.length
            }
        };
        
        return report;
    }
}

/**
 * CLI execution function
 */
async function runHealthCheck() {
    const monitor = new DatabaseHealthMonitor();
    
    try {
        await monitor.runHealthCheck();
        const report = monitor.generateHealthReport();
        
        console.log('🔍 Database Health Check Results:');
        console.log('==================================');
        console.log(`Status: ${report.summary.status.toUpperCase()}`);
        console.log(`Health Score: ${report.summary.health_score}/100`);
        console.log(`Uptime: ${report.summary.uptime_ms}ms`);
        console.log(`Alerts: ${report.summary.alert_count} (${report.summary.critical_alerts} critical, ${report.summary.error_alerts} error, ${report.summary.warning_alerts} warning)`);
        console.log(`Recommendations: ${report.summary.recommendations_count}`);
        console.log('');
        
        if (report.alerts.length > 0) {
            console.log('🚨 Alerts:');
            report.alerts.forEach(alert => {
                const icon = alert.level === 'critical' ? '🔴' : 
                           alert.level === 'error' ? '🟠' : '🟡';
                console.log(`  ${icon} [${alert.level.toUpperCase()}] ${alert.message}`);
            });
            console.log('');
        }
        
        if (report.recommendations.length > 0) {
            console.log('💡 Recommendations:');
            report.recommendations.forEach(rec => {
                console.log(`  - [${rec.priority.toUpperCase()}] ${rec.message}`);
            });
            console.log('');
        }
        
        console.log('Full Report:');
        console.log(JSON.stringify(report, null, 2));
        
        // Exit with appropriate code
        if (report.summary.status === 'critical') {
            process.exit(1);
        } else {
            process.exit(0);
        }
        
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Run if called directly
if (require.main === module) {
    runHealthCheck();
}

module.exports = DatabaseHealthMonitor;