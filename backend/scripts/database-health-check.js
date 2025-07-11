const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Database health check and performance monitoring
 * Validates database connection, performance, and data integrity
 */
class DatabaseHealthChecker {
    constructor() {
        this.healthResults = {
            timestamp: new Date().toISOString(),
            overall_status: 'unknown',
            connection_status: 'unknown',
            performance_metrics: {},
            table_statistics: {},
            indexes_status: {},
            warnings: [],
            errors: []
        };
    }

    /**
     * Run comprehensive database health check
     */
    async runHealthCheck() {
        try {
            logger.info('Starting database health check...');
            
            // Test database connection
            await this.checkDatabaseConnection();
            
            // Check database performance
            await this.checkDatabasePerformance();
            
            // Validate table statistics
            await this.checkTableStatistics();
            
            // Check index health
            await this.checkIndexHealth();
            
            // Check data integrity
            await this.checkDataIntegrity();
            
            // Determine overall health status
            this.determineOverallStatus();
            
            logger.info('Database health check completed:', this.healthResults);
            return this.healthResults;
            
        } catch (error) {
            this.healthResults.errors.push(error.message);
            this.healthResults.overall_status = 'critical';
            logger.error('Database health check failed:', error);
            throw error;
        }
    }

    /**
     * Test database connection and basic functionality
     */
    async checkDatabaseConnection() {
        try {
            const startTime = Date.now();
            
            // Test basic connection
            await sequelize.authenticate();
            
            const connectionTime = Date.now() - startTime;
            
            // Test query execution
            const queryStart = Date.now();
            const [results] = await sequelize.query('SELECT 1 as test', {
                type: QueryTypes.SELECT
            });
            const queryTime = Date.now() - queryStart;
            
            this.healthResults.connection_status = 'healthy';
            this.healthResults.performance_metrics.connection_time_ms = connectionTime;
            this.healthResults.performance_metrics.query_time_ms = queryTime;
            
            if (connectionTime > 1000) {
                this.healthResults.warnings.push('Database connection time is high (>1s)');
            }
            
            logger.info('Database connection check passed');
            
        } catch (error) {
            this.healthResults.connection_status = 'failed';
            this.healthResults.errors.push(`Connection test failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check database performance metrics
     */
    async checkDatabasePerformance() {
        try {
            const dbConfig = sequelize.config;
            
            if (dbConfig.dialect === 'postgres') {
                await this.checkPostgreSQLPerformance();
            } else if (dbConfig.dialect === 'sqlite') {
                await this.checkSQLitePerformance();
            }
            
            logger.info('Database performance check completed');
            
        } catch (error) {
            this.healthResults.warnings.push(`Performance check failed: ${error.message}`);
            logger.warn('Database performance check failed:', error);
        }
    }

    /**
     * Check PostgreSQL specific performance metrics
     */
    async checkPostgreSQLPerformance() {
        try {
            // Check database size
            const [sizeResult] = await sequelize.query(`
                SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
                       pg_database_size(current_database()) as db_size_bytes
            `, { type: QueryTypes.SELECT });
            
            this.healthResults.performance_metrics.database_size = sizeResult.db_size;
            this.healthResults.performance_metrics.database_size_bytes = sizeResult.db_size_bytes;
            
            // Check active connections
            const [connectionsResult] = await sequelize.query(`
                SELECT count(*) as active_connections,
                       max_conn.setting as max_connections
                FROM pg_stat_activity
                CROSS JOIN (SELECT setting FROM pg_settings WHERE name = 'max_connections') max_conn
                WHERE state = 'active'
            `, { type: QueryTypes.SELECT });
            
            this.healthResults.performance_metrics.active_connections = parseInt(connectionsResult.active_connections);
            this.healthResults.performance_metrics.max_connections = parseInt(connectionsResult.max_connections);
            
            // Check for long-running queries
            const longQueries = await sequelize.query(`
                SELECT count(*) as long_queries
                FROM pg_stat_activity
                WHERE state = 'active'
                AND query_start < now() - interval '5 minutes'
                AND query NOT LIKE '%pg_stat_activity%'
            `, { type: QueryTypes.SELECT });
            
            const longQueryCount = parseInt(longQueries[0].long_queries);
            this.healthResults.performance_metrics.long_running_queries = longQueryCount;
            
            if (longQueryCount > 0) {
                this.healthResults.warnings.push(`${longQueryCount} long-running queries detected`);
            }
            
            // Check cache hit ratio
            const [cacheResult] = await sequelize.query(`
                SELECT 
                    round(sum(blks_hit) * 100.0 / sum(blks_hit + blks_read), 2) as cache_hit_ratio
                FROM pg_stat_database
                WHERE datname = current_database()
            `, { type: QueryTypes.SELECT });
            
            this.healthResults.performance_metrics.cache_hit_ratio = parseFloat(cacheResult.cache_hit_ratio);
            
            if (this.healthResults.performance_metrics.cache_hit_ratio < 95) {
                this.healthResults.warnings.push('Cache hit ratio is below 95%');
            }
            
        } catch (error) {
            this.healthResults.warnings.push(`PostgreSQL performance check failed: ${error.message}`);
        }
    }

    /**
     * Check SQLite specific performance metrics
     */
    async checkSQLitePerformance() {
        try {
            // Check database size
            const dbFile = sequelize.config.storage;
            const fs = require('fs');
            const stats = fs.statSync(dbFile);
            
            this.healthResults.performance_metrics.database_size_bytes = stats.size;
            this.healthResults.performance_metrics.database_size = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
            
            // Check SQLite version and settings
            const [versionResult] = await sequelize.query('SELECT sqlite_version() as version', {
                type: QueryTypes.SELECT
            });
            
            this.healthResults.performance_metrics.sqlite_version = versionResult.version;
            
        } catch (error) {
            this.healthResults.warnings.push(`SQLite performance check failed: ${error.message}`);
        }
    }

    /**
     * Check table statistics and record counts
     */
    async checkTableStatistics() {
        try {
            const tables = [
                'users', 'schools', 'students', 'staff', 'parents_guardians',
                'attendance_records', 'academic_records', 'zones', 'parishes'
            ];
            
            for (const table of tables) {
                try {
                    const [result] = await sequelize.query(`SELECT COUNT(*) as count FROM ${table}`, {
                        type: QueryTypes.SELECT
                    });
                    
                    this.healthResults.table_statistics[table] = parseInt(result.count);
                    
                } catch (error) {
                    this.healthResults.warnings.push(`Could not get statistics for table ${table}: ${error.message}`);
                }
            }
            
            // Check for expected data relationships
            if (this.healthResults.table_statistics.schools > 0 && this.healthResults.table_statistics.students === 0) {
                this.healthResults.warnings.push('Schools exist but no students found');
            }
            
            if (this.healthResults.table_statistics.users > 0 && this.healthResults.table_statistics.students === 0) {
                this.healthResults.warnings.push('Users exist but no students found');
            }
            
            logger.info('Table statistics check completed');
            
        } catch (error) {
            this.healthResults.warnings.push(`Table statistics check failed: ${error.message}`);
        }
    }

    /**
     * Check index health and usage
     */
    async checkIndexHealth() {
        try {
            const dbConfig = sequelize.config;
            
            if (dbConfig.dialect === 'postgres') {
                await this.checkPostgreSQLIndexes();
            } else if (dbConfig.dialect === 'sqlite') {
                await this.checkSQLiteIndexes();
            }
            
            logger.info('Index health check completed');
            
        } catch (error) {
            this.healthResults.warnings.push(`Index health check failed: ${error.message}`);
        }
    }

    /**
     * Check PostgreSQL indexes
     */
    async checkPostgreSQLIndexes() {
        try {
            // Check unused indexes
            const unusedIndexes = await sequelize.query(`
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch
                FROM pg_stat_user_indexes
                WHERE idx_scan = 0
                AND schemaname = 'public'
                ORDER BY tablename, indexname
            `, { type: QueryTypes.SELECT });
            
            this.healthResults.indexes_status.unused_indexes = unusedIndexes.length;
            
            if (unusedIndexes.length > 0) {
                this.healthResults.warnings.push(`${unusedIndexes.length} unused indexes found`);
            }
            
            // Check index sizes
            const indexSizes = await sequelize.query(`
                SELECT 
                    tablename,
                    indexname,
                    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                    pg_relation_size(indexrelid) as index_size_bytes
                FROM pg_stat_user_indexes
                WHERE schemaname = 'public'
                ORDER BY pg_relation_size(indexrelid) DESC
                LIMIT 10
            `, { type: QueryTypes.SELECT });
            
            this.healthResults.indexes_status.largest_indexes = indexSizes;
            
        } catch (error) {
            this.healthResults.warnings.push(`PostgreSQL index check failed: ${error.message}`);
        }
    }

    /**
     * Check SQLite indexes
     */
    async checkSQLiteIndexes() {
        try {
            // List all indexes
            const indexes = await sequelize.query(`
                SELECT name, sql 
                FROM sqlite_master 
                WHERE type = 'index' 
                AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `, { type: QueryTypes.SELECT });
            
            this.healthResults.indexes_status.total_indexes = indexes.length;
            
        } catch (error) {
            this.healthResults.warnings.push(`SQLite index check failed: ${error.message}`);
        }
    }

    /**
     * Check data integrity and foreign key constraints
     */
    async checkDataIntegrity() {
        try {
            // Check for orphaned records
            const orphanChecks = [
                {
                    name: 'students_without_users',
                    query: `SELECT COUNT(*) as count FROM students WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)`
                },
                {
                    name: 'students_without_schools',
                    query: `SELECT COUNT(*) as count FROM students WHERE school_id IS NOT NULL AND school_id NOT IN (SELECT id FROM schools)`
                },
                {
                    name: 'attendance_without_students',
                    query: `SELECT COUNT(*) as count FROM attendance_records WHERE student_id NOT IN (SELECT id FROM students)`
                }
            ];
            
            for (const check of orphanChecks) {
                try {
                    const [result] = await sequelize.query(check.query, {
                        type: QueryTypes.SELECT
                    });
                    
                    const orphanCount = parseInt(result.count);
                    
                    if (orphanCount > 0) {
                        this.healthResults.warnings.push(`${orphanCount} orphaned records found: ${check.name}`);
                    }
                    
                } catch (error) {
                    this.healthResults.warnings.push(`Data integrity check failed for ${check.name}: ${error.message}`);
                }
            }
            
            logger.info('Data integrity check completed');
            
        } catch (error) {
            this.healthResults.warnings.push(`Data integrity check failed: ${error.message}`);
        }
    }

    /**
     * Determine overall health status
     */
    determineOverallStatus() {
        if (this.healthResults.errors.length > 0) {
            this.healthResults.overall_status = 'critical';
        } else if (this.healthResults.warnings.length > 5) {
            this.healthResults.overall_status = 'warning';
        } else if (this.healthResults.warnings.length > 0) {
            this.healthResults.overall_status = 'healthy_with_warnings';
        } else {
            this.healthResults.overall_status = 'healthy';
        }
    }

    /**
     * Generate health report
     */
    generateHealthReport() {
        return {
            ...this.healthResults,
            summary: {
                status: this.healthResults.overall_status,
                total_warnings: this.healthResults.warnings.length,
                total_errors: this.healthResults.errors.length,
                connection_healthy: this.healthResults.connection_status === 'healthy',
                performance_grade: this.calculatePerformanceGrade()
            }
        };
    }

    /**
     * Calculate performance grade
     */
    calculatePerformanceGrade() {
        let score = 100;
        
        // Deduct points for warnings and errors
        score -= this.healthResults.warnings.length * 5;
        score -= this.healthResults.errors.length * 15;
        
        // Deduct points for poor performance metrics
        if (this.healthResults.performance_metrics.connection_time_ms > 1000) {
            score -= 10;
        }
        
        if (this.healthResults.performance_metrics.cache_hit_ratio < 95) {
            score -= 10;
        }
        
        if (this.healthResults.performance_metrics.long_running_queries > 0) {
            score -= 10;
        }
        
        if (score >= 95) return 'A';
        if (score >= 85) return 'B';
        if (score >= 75) return 'C';
        if (score >= 65) return 'D';
        return 'F';
    }
}

/**
 * CLI execution function
 */
async function runHealthCheck() {
    const checker = new DatabaseHealthChecker();
    
    try {
        const results = await checker.runHealthCheck();
        const report = checker.generateHealthReport();
        
        console.log('🏥 Database Health Check Results:');
        console.log('==================================');
        console.log(`Overall Status: ${report.summary.status.toUpperCase()}`);
        console.log(`Performance Grade: ${report.summary.performance_grade}`);
        console.log(`Warnings: ${report.summary.total_warnings}`);
        console.log(`Errors: ${report.summary.total_errors}`);
        console.log('');
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

module.exports = DatabaseHealthChecker;