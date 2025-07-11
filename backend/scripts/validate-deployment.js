const { sequelize } = require('../config/database');
const { User, School, Student, Zone, Parish } = require('../models');
const logger = require('../utils/logger');

/**
 * Comprehensive deployment validation script
 * Validates database setup, data integrity, and system readiness
 */
class DeploymentValidator {
    constructor() {
        this.validationResults = {
            timestamp: new Date().toISOString(),
            overall_status: 'unknown',
            tests_passed: 0,
            tests_failed: 0,
            validations: {},
            errors: [],
            warnings: []
        };
    }

    /**
     * Run comprehensive deployment validation
     */
    async validateDeployment() {
        try {
            logger.info('Starting deployment validation...');
            
            // Core Infrastructure Tests
            await this.validateDatabaseConnection();
            await this.validateTableStructure();
            await this.validateIndexes();
            
            // Data Integrity Tests
            await this.validateSchoolData();
            await this.validateUserSystem();
            await this.validateRelationships();
            
            // Security Tests
            await this.validateAuthentication();
            await this.validateAuthorization();
            
            // Performance Tests
            await this.validatePerformance();
            
            // System Configuration Tests
            await this.validateEnvironmentConfig();
            
            this.calculateOverallStatus();
            
            logger.info('Deployment validation completed:', this.validationResults);
            return this.validationResults;
            
        } catch (error) {
            this.validationResults.errors.push(error.message);
            this.validationResults.overall_status = 'failed';
            logger.error('Deployment validation failed:', error);
            throw error;
        }
    }

    /**
     * Validate database connection and configuration
     */
    async validateDatabaseConnection() {
        const testName = 'database_connection';
        try {
            const startTime = Date.now();
            
            // Test authentication
            await sequelize.authenticate();
            
            // Test query execution
            const [results] = await sequelize.query('SELECT 1 as test');
            
            const connectionTime = Date.now() - startTime;
            
            this.validationResults.validations[testName] = {
                status: 'passed',
                connection_time_ms: connectionTime,
                dialect: sequelize.getDialect(),
                database: sequelize.config.database || 'unknown'
            };
            
            this.validationResults.tests_passed++;
            
            if (connectionTime > 2000) {
                this.validationResults.warnings.push('Database connection time is high (>2s)');
            }
            
            logger.info(`✅ ${testName} - passed`);
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate table structure and schemas
     */
    async validateTableStructure() {
        const testName = 'table_structure';
        try {
            const expectedTables = [
                'users', 'schools', 'students', 'staff', 'parents_guardians',
                'zones', 'parishes', 'attendance_records', 'academic_records',
                'student_health', 'family_social_assessment', 'disability_assessments',
                'student_athletics', 'facilities', 'inventory_items', 'rfid_devices',
                'teacher_evaluations', 'professional_development', 'audit_logs',
                'student_parent_relationships', 'student_transfers'
            ];
            
            const existingTables = await sequelize.getQueryInterface().showAllTables();
            const missingTables = expectedTables.filter(table => !existingTables.includes(table));
            
            if (missingTables.length === 0) {
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    tables_found: existingTables.length,
                    expected_tables: expectedTables.length
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'failed',
                    missing_tables: missingTables,
                    tables_found: existingTables.length,
                    expected_tables: expectedTables.length
                };
                this.validationResults.tests_failed++;
                this.validationResults.errors.push(`${testName}: Missing tables: ${missingTables.join(', ')}`);
                logger.error(`❌ ${testName} - failed: Missing tables`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate database indexes
     */
    async validateIndexes() {
        const testName = 'database_indexes';
        try {
            const dialect = sequelize.getDialect();
            let indexQuery;
            
            if (dialect === 'postgres') {
                indexQuery = `
                    SELECT schemaname, tablename, indexname, indexdef
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                    ORDER BY tablename, indexname
                `;
            } else if (dialect === 'sqlite') {
                indexQuery = `
                    SELECT name, sql
                    FROM sqlite_master
                    WHERE type = 'index'
                    AND name NOT LIKE 'sqlite_%'
                    ORDER BY name
                `;
            }
            
            if (indexQuery) {
                const [indexes] = await sequelize.query(indexQuery);
                
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    indexes_found: indexes.length,
                    sample_indexes: indexes.slice(0, 5)
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed (${indexes.length} indexes)`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'skipped',
                    reason: 'Unsupported database dialect'
                };
                this.validationResults.warnings.push(`${testName}: Skipped for ${dialect}`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate Barbados school data
     */
    async validateSchoolData() {
        const testName = 'school_data';
        try {
            const schoolCount = await School.count();
            const zoneCount = await Zone.count();
            const parishCount = await Parish.count();
            
            // Expected data counts
            const expectedSchools = 106;
            const expectedZones = 5;
            const expectedParishes = 11;
            
            const schoolDataValid = schoolCount >= 100; // Allow some tolerance
            const zoneDataValid = zoneCount === expectedZones;
            const parishDataValid = parishCount === expectedParishes;
            
            if (schoolDataValid && zoneDataValid && parishDataValid) {
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    schools_count: schoolCount,
                    zones_count: zoneCount,
                    parishes_count: parishCount
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'failed',
                    schools_count: schoolCount,
                    zones_count: zoneCount,
                    parishes_count: parishCount,
                    expected_schools: expectedSchools,
                    expected_zones: expectedZones,
                    expected_parishes: expectedParishes
                };
                this.validationResults.tests_failed++;
                this.validationResults.errors.push(`${testName}: Insufficient data - Schools: ${schoolCount}, Zones: ${zoneCount}, Parishes: ${parishCount}`);
                logger.error(`❌ ${testName} - failed: Insufficient data`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate user system
     */
    async validateUserSystem() {
        const testName = 'user_system';
        try {
            const userCount = await User.count();
            const adminCount = await User.count({ where: { role: 'super_admin' } });
            const studentCount = await Student.count();
            
            const hasUsers = userCount > 0;
            const hasAdmin = adminCount > 0;
            const hasStudents = studentCount > 0;
            
            if (hasUsers && hasAdmin && hasStudents) {
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    total_users: userCount,
                    admin_users: adminCount,
                    students: studentCount
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'failed',
                    total_users: userCount,
                    admin_users: adminCount,
                    students: studentCount,
                    issues: {
                        no_users: !hasUsers,
                        no_admin: !hasAdmin,
                        no_students: !hasStudents
                    }
                };
                this.validationResults.tests_failed++;
                this.validationResults.errors.push(`${testName}: User system validation failed`);
                logger.error(`❌ ${testName} - failed: User system issues`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate foreign key relationships
     */
    async validateRelationships() {
        const testName = 'foreign_key_relationships';
        try {
            // Check for orphaned records
            const orphanQueries = [
                {
                    name: 'students_without_users',
                    query: `SELECT COUNT(*) as count FROM students WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users WHERE role = 'student')`
                },
                {
                    name: 'students_without_schools',
                    query: `SELECT COUNT(*) as count FROM students WHERE school_id IS NOT NULL AND school_id NOT IN (SELECT id FROM schools)`
                },
                {
                    name: 'schools_without_parishes',
                    query: `SELECT COUNT(*) as count FROM schools WHERE parish_id IS NOT NULL AND parish_id NOT IN (SELECT id FROM parishes)`
                }
            ];
            
            let totalOrphans = 0;
            const orphanResults = {};
            
            for (const orphanQuery of orphanQueries) {
                const [result] = await sequelize.query(orphanQuery.query);
                const count = parseInt(result[0].count);
                totalOrphans += count;
                orphanResults[orphanQuery.name] = count;
            }
            
            if (totalOrphans === 0) {
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    orphan_records: orphanResults
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'failed',
                    orphan_records: orphanResults,
                    total_orphans: totalOrphans
                };
                this.validationResults.tests_failed++;
                this.validationResults.errors.push(`${testName}: Found ${totalOrphans} orphaned records`);
                logger.error(`❌ ${testName} - failed: Orphaned records found`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate authentication system
     */
    async validateAuthentication() {
        const testName = 'authentication_system';
        try {
            // Test that users have proper password hashes
            const [result] = await sequelize.query(`
                SELECT COUNT(*) as count FROM users 
                WHERE password_hash IS NOT NULL 
                AND length(password_hash) > 50
            `);
            
            const usersWithHashes = parseInt(result[0].count);
            const totalUsers = await User.count();
            
            if (usersWithHashes === totalUsers && totalUsers > 0) {
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    users_with_hashes: usersWithHashes,
                    total_users: totalUsers
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'failed',
                    users_with_hashes: usersWithHashes,
                    total_users: totalUsers
                };
                this.validationResults.tests_failed++;
                this.validationResults.errors.push(`${testName}: Password hash validation failed`);
                logger.error(`❌ ${testName} - failed: Password hash issues`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate authorization roles
     */
    async validateAuthorization() {
        const testName = 'authorization_roles';
        try {
            const roleDistribution = await User.findAll({
                attributes: [
                    'role',
                    [sequelize.fn('COUNT', '*'), 'count']
                ],
                group: ['role'],
                raw: true
            });
            
            const roles = roleDistribution.reduce((acc, curr) => {
                acc[curr.role] = parseInt(curr.count);
                return acc;
            }, {});
            
            const expectedRoles = ['super_admin', 'admin', 'teacher', 'parent', 'student'];
            const hasRequiredRoles = roles.super_admin > 0 && roles.student > 0;
            
            if (hasRequiredRoles) {
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    role_distribution: roles
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'failed',
                    role_distribution: roles,
                    missing_required_roles: !roles.super_admin || !roles.student
                };
                this.validationResults.tests_failed++;
                this.validationResults.errors.push(`${testName}: Missing required roles`);
                logger.error(`❌ ${testName} - failed: Missing required roles`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate system performance
     */
    async validatePerformance() {
        const testName = 'performance_validation';
        try {
            const startTime = Date.now();
            
            // Test query performance
            const [result] = await sequelize.query(`
                SELECT COUNT(*) as total_records FROM students 
                JOIN schools ON students.school_id = schools.id
                JOIN users ON students.user_id = users.id
            `);
            
            const queryTime = Date.now() - startTime;
            const recordCount = parseInt(result[0].total_records);
            
            const performanceGood = queryTime < 1000; // Under 1 second
            
            if (performanceGood) {
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    query_time_ms: queryTime,
                    records_processed: recordCount
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'warning',
                    query_time_ms: queryTime,
                    records_processed: recordCount
                };
                this.validationResults.warnings.push(`${testName}: Slow query performance (${queryTime}ms)`);
                logger.warn(`⚠️ ${testName} - warning: Slow performance`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Validate environment configuration
     */
    async validateEnvironmentConfig() {
        const testName = 'environment_config';
        try {
            const requiredVars = [
                'NODE_ENV',
                'DATABASE_URL',
                'JWT_SECRET'
            ];
            
            const missingVars = requiredVars.filter(varName => !process.env[varName]);
            
            if (missingVars.length === 0) {
                this.validationResults.validations[testName] = {
                    status: 'passed',
                    environment: process.env.NODE_ENV,
                    database_configured: !!process.env.DATABASE_URL,
                    jwt_configured: !!process.env.JWT_SECRET
                };
                this.validationResults.tests_passed++;
                logger.info(`✅ ${testName} - passed`);
            } else {
                this.validationResults.validations[testName] = {
                    status: 'failed',
                    missing_variables: missingVars
                };
                this.validationResults.tests_failed++;
                this.validationResults.errors.push(`${testName}: Missing environment variables: ${missingVars.join(', ')}`);
                logger.error(`❌ ${testName} - failed: Missing environment variables`);
            }
            
        } catch (error) {
            this.validationResults.validations[testName] = {
                status: 'failed',
                error: error.message
            };
            this.validationResults.tests_failed++;
            this.validationResults.errors.push(`${testName}: ${error.message}`);
            logger.error(`❌ ${testName} - failed:`, error);
        }
    }

    /**
     * Calculate overall validation status
     */
    calculateOverallStatus() {
        const totalTests = this.validationResults.tests_passed + this.validationResults.tests_failed;
        const successRate = totalTests > 0 ? (this.validationResults.tests_passed / totalTests) * 100 : 0;
        
        if (this.validationResults.tests_failed === 0) {
            this.validationResults.overall_status = 'passed';
        } else if (successRate >= 80) {
            this.validationResults.overall_status = 'passed_with_warnings';
        } else {
            this.validationResults.overall_status = 'failed';
        }
        
        this.validationResults.success_rate = `${successRate.toFixed(1)}%`;
    }

    /**
     * Generate validation report
     */
    generateValidationReport() {
        return {
            ...this.validationResults,
            summary: {
                status: this.validationResults.overall_status,
                tests_total: this.validationResults.tests_passed + this.validationResults.tests_failed,
                tests_passed: this.validationResults.tests_passed,
                tests_failed: this.validationResults.tests_failed,
                success_rate: this.validationResults.success_rate,
                warnings_count: this.validationResults.warnings.length,
                errors_count: this.validationResults.errors.length
            }
        };
    }
}

/**
 * CLI execution function
 */
async function runValidation() {
    const validator = new DeploymentValidator();
    
    try {
        const results = await validator.validateDeployment();
        const report = validator.generateValidationReport();
        
        console.log('🔍 Deployment Validation Results:');
        console.log('=================================');
        console.log(`Overall Status: ${report.summary.status.toUpperCase()}`);
        console.log(`Success Rate: ${report.summary.success_rate}`);
        console.log(`Tests Passed: ${report.summary.tests_passed}/${report.summary.tests_total}`);
        console.log(`Warnings: ${report.summary.warnings_count}`);
        console.log(`Errors: ${report.summary.errors_count}`);
        console.log('');
        
        if (report.errors.length > 0) {
            console.log('❌ Errors:');
            report.errors.forEach(error => console.log(`  - ${error}`));
            console.log('');
        }
        
        if (report.warnings.length > 0) {
            console.log('⚠️ Warnings:');
            report.warnings.forEach(warning => console.log(`  - ${warning}`));
            console.log('');
        }
        
        console.log('Full Report:');
        console.log(JSON.stringify(report, null, 2));
        
        // Exit with appropriate code
        if (report.summary.status === 'failed') {
            process.exit(1);
        } else {
            process.exit(0);
        }
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Run if called directly
if (require.main === module) {
    runValidation();
}

module.exports = DeploymentValidator;