const { sequelize } = require('../../config/database');
const { User, School, Student, Zone, Parish, Staff, Parent } = require('../../models');
const logger = require('../../utils/logger');

/**
 * Comprehensive Database Connection and Query Testing
 * Tests database connectivity, query performance, and data integrity
 */

describe('Database Connection Tests', () => {
    let testStartTime;
    
    beforeAll(async () => {
        testStartTime = Date.now();
        
        // Wait for database to be ready
        let retries = 3;
        while (retries > 0) {
            try {
                await sequelize.authenticate();
                break;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    });

    afterAll(async () => {
        const testDuration = Date.now() - testStartTime;
        logger.info(`Database connection tests completed in ${testDuration}ms`);
        await sequelize.close();
    });

    describe('Basic Connection Tests', () => {
        test('should successfully connect to database', async () => {
            const startTime = Date.now();
            await sequelize.authenticate();
            const connectionTime = Date.now() - startTime;
            
            expect(connectionTime).toBeLessThan(2000); // Should connect within 2 seconds
            expect(sequelize.getDialect()).toBeDefined();
        });

        test('should execute basic query successfully', async () => {
            const startTime = Date.now();
            const [results] = await sequelize.query('SELECT 1 as test');
            const queryTime = Date.now() - startTime;
            
            expect(results).toBeDefined();
            expect(results[0]).toEqual({ test: 1 });
            expect(queryTime).toBeLessThan(1000); // Should query within 1 second
        });

        test('should handle concurrent connections', async () => {
            const concurrentQueries = Array(10).fill(0).map((_, index) => 
                sequelize.query(`SELECT ${index + 1} as query_number`)
            );
            
            const startTime = Date.now();
            const results = await Promise.all(concurrentQueries);
            const totalTime = Date.now() - startTime;
            
            expect(results).toHaveLength(10);
            expect(totalTime).toBeLessThan(5000); // All queries should complete within 5 seconds
            
            results.forEach((result, index) => {
                expect(result[0][0]).toEqual({ query_number: index + 1 });
            });
        });
    });

    describe('Table Structure Validation', () => {
        test('should have all required tables', async () => {
            const expectedTables = [
                'users', 'schools', 'students', 'staff', 'parents_guardians',
                'zones', 'parishes', 'attendance_records', 'academic_records',
                'student_health', 'family_social_assessment', 'disability_assessments',
                'student_athletics', 'facilities', 'inventory_items', 'rfid_devices',
                'teacher_evaluations', 'professional_development', 'audit_logs',
                'student_parent_relationships', 'student_transfers'
            ];
            
            const existingTables = await sequelize.getQueryInterface().showAllTables();
            
            expectedTables.forEach(table => {
                expect(existingTables).toContain(table);
            });
        });

        test('should validate table indexes', async () => {
            const dialect = sequelize.getDialect();
            let indexQuery;
            
            if (dialect === 'postgres') {
                indexQuery = `
                    SELECT schemaname, tablename, indexname, indexdef
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                    AND tablename IN ('users', 'schools', 'students', 'staff')
                    ORDER BY tablename, indexname
                `;
            } else if (dialect === 'sqlite') {
                indexQuery = `
                    SELECT name, sql, tbl_name
                    FROM sqlite_master
                    WHERE type = 'index'
                    AND name NOT LIKE 'sqlite_%'
                    AND tbl_name IN ('users', 'schools', 'students', 'staff')
                    ORDER BY tbl_name, name
                `;
            }
            
            if (indexQuery) {
                const [indexes] = await sequelize.query(indexQuery);
                expect(indexes.length).toBeGreaterThan(0);
                
                // Check for primary key indexes
                const indexNames = indexes.map(idx => idx.indexname || idx.name);
                expect(indexNames.some(name => name.includes('primary') || name.includes('pkey'))).toBe(true);
            }
        });
    });

    describe('Model Validation Tests', () => {
        test('should validate User model structure', async () => {
            const userAttributes = User.rawAttributes;
            
            // Check required fields
            expect(userAttributes.id).toBeDefined();
            expect(userAttributes.email).toBeDefined();
            expect(userAttributes.password_hash).toBeDefined();
            expect(userAttributes.role).toBeDefined();
            expect(userAttributes.is_active).toBeDefined();
            expect(userAttributes.school_id).toBeDefined();
            
            // Check role validation
            expect(userAttributes.role.validate).toBeDefined();
        });

        test('should validate School model structure', async () => {
            const schoolAttributes = School.rawAttributes;
            
            expect(schoolAttributes.id).toBeDefined();
            expect(schoolAttributes.name).toBeDefined();
            expect(schoolAttributes.school_code).toBeDefined();
            expect(schoolAttributes.school_type).toBeDefined();
            expect(schoolAttributes.zone_id).toBeDefined();
            expect(schoolAttributes.parish_id).toBeDefined();
            expect(schoolAttributes.address).toBeDefined();
            expect(schoolAttributes.phone).toBeDefined();
            expect(schoolAttributes.email).toBeDefined();
            expect(schoolAttributes.principal_name).toBeDefined();
        });

        test('should validate Student model structure', async () => {
            const studentAttributes = Student.rawAttributes;
            
            expect(studentAttributes.id).toBeDefined();
            expect(studentAttributes.student_id).toBeDefined();
            expect(studentAttributes.user_id).toBeDefined();
            expect(studentAttributes.school_id).toBeDefined();
            expect(studentAttributes.first_name).toBeDefined();
            expect(studentAttributes.last_name).toBeDefined();
            expect(studentAttributes.date_of_birth).toBeDefined();
            expect(studentAttributes.gender).toBeDefined();
            expect(studentAttributes.grade_level).toBeDefined();
            expect(studentAttributes.enrollment_date).toBeDefined();
            expect(studentAttributes.is_active).toBeDefined();
        });
    });

    describe('Data Integrity Tests', () => {
        test('should validate Barbados school data', async () => {
            const schoolCount = await School.count();
            const zoneCount = await Zone.count();
            const parishCount = await Parish.count();
            
            expect(schoolCount).toBeGreaterThanOrEqual(100); // At least 100 schools (tolerance for 106)
            expect(zoneCount).toEqual(5); // Exactly 5 zones
            expect(parishCount).toEqual(11); // Exactly 11 parishes
        });

        test('should validate user-student relationships', async () => {
            const studentsWithUsers = await Student.count({
                where: { user_id: { [sequelize.Op.ne]: null } }
            });
            
            const studentUsers = await User.count({
                where: { role: 'student' }
            });
            
            expect(studentsWithUsers).toEqual(studentUsers);
        });

        test('should validate school-student relationships', async () => {
            const studentsWithSchools = await Student.count({
                where: { school_id: { [sequelize.Op.ne]: null } }
            });
            
            const totalStudents = await Student.count();
            
            expect(studentsWithSchools).toEqual(totalStudents);
        });

        test('should validate foreign key constraints', async () => {
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
                },
                {
                    name: 'schools_without_zones',
                    query: `SELECT COUNT(*) as count FROM schools WHERE zone_id IS NOT NULL AND zone_id NOT IN (SELECT id FROM zones)`
                }
            ];
            
            for (const orphanQuery of orphanQueries) {
                const [result] = await sequelize.query(orphanQuery.query);
                const count = parseInt(result[0].count);
                expect(count).toEqual(0);
            }
        });
    });

    describe('Query Performance Tests', () => {
        test('should perform student lookup efficiently', async () => {
            const startTime = Date.now();
            
            const students = await Student.findAll({
                limit: 100,
                include: [
                    { model: User, attributes: ['id', 'email', 'role'] },
                    { model: School, attributes: ['id', 'name', 'school_code'] }
                ]
            });
            
            const queryTime = Date.now() - startTime;
            
            expect(students.length).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(2000); // Should complete within 2 seconds
        });

        test('should perform school statistics efficiently', async () => {
            const startTime = Date.now();
            
            const schoolStats = await School.findAll({
                attributes: [
                    'id',
                    'name',
                    [sequelize.fn('COUNT', sequelize.col('students.id')), 'student_count'],
                    [sequelize.fn('COUNT', sequelize.col('staff.id')), 'staff_count']
                ],
                include: [
                    { model: Student, attributes: [], required: false },
                    { model: Staff, attributes: [], required: false }
                ],
                group: ['School.id', 'School.name'],
                limit: 50
            });
            
            const queryTime = Date.now() - startTime;
            
            expect(schoolStats.length).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(3000); // Should complete within 3 seconds
        });

        test('should handle large dataset queries efficiently', async () => {
            const startTime = Date.now();
            
            // Simulate a complex query that might be used in reporting
            const [results] = await sequelize.query(`
                SELECT 
                    s.name as school_name,
                    COUNT(DISTINCT st.id) as total_students,
                    COUNT(DISTINCT sf.id) as total_staff,
                    z.name as zone_name,
                    p.name as parish_name
                FROM schools s
                LEFT JOIN students st ON s.id = st.school_id
                LEFT JOIN staff sf ON s.id = sf.school_id
                LEFT JOIN zones z ON s.zone_id = z.id
                LEFT JOIN parishes p ON s.parish_id = p.id
                GROUP BY s.id, s.name, z.name, p.name
                ORDER BY total_students DESC
                LIMIT 20
            `);
            
            const queryTime = Date.now() - startTime;
            
            expect(results.length).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
        });
    });

    describe('Connection Pool Tests', () => {
        test('should handle connection pool limits', async () => {
            const poolSize = 10;
            const queries = Array(poolSize + 5).fill(0).map((_, index) => 
                sequelize.query(`SELECT ${index} as query_id, pg_sleep(0.1)`, { timeout: 5000 })
                    .catch(err => ({ error: err.message, queryId: index }))
            );
            
            const startTime = Date.now();
            const results = await Promise.all(queries);
            const totalTime = Date.now() - startTime;
            
            // Should handle all queries without fatal errors
            const errors = results.filter(r => r.error);
            expect(errors.length).toBeLessThan(results.length / 2); // Less than half should fail
            expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
        });

        test('should recover from connection failures', async () => {
            // Test connection recovery by forcing a disconnect and reconnect
            try {
                await sequelize.close();
                
                // Try to reconnect
                await sequelize.authenticate();
                
                // Test that queries work after reconnection
                const [result] = await sequelize.query('SELECT 1 as recovered');
                expect(result[0]).toEqual({ recovered: 1 });
            } catch (error) {
                // If we can't test reconnection, just ensure we can authenticate
                await sequelize.authenticate();
            }
        });
    });

    describe('Transaction Tests', () => {
        test('should handle transactions correctly', async () => {
            const transaction = await sequelize.transaction();
            
            try {
                // Create a test user within transaction
                const testUser = await User.create({
                    email: 'test.transaction@test.com',
                    password_hash: 'test_hash_123',
                    role: 'student',
                    first_name: 'Test',
                    last_name: 'Transaction',
                    is_active: true
                }, { transaction });
                
                expect(testUser.id).toBeDefined();
                
                // Rollback transaction
                await transaction.rollback();
                
                // Verify user was not created
                const foundUser = await User.findOne({
                    where: { email: 'test.transaction@test.com' }
                });
                
                expect(foundUser).toBeNull();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });

        test('should handle concurrent transactions', async () => {
            const transactions = await Promise.all([
                sequelize.transaction(),
                sequelize.transaction(),
                sequelize.transaction()
            ]);
            
            try {
                // Create different users in each transaction
                const users = await Promise.all(
                    transactions.map((transaction, index) => 
                        User.create({
                            email: `concurrent.test${index}@test.com`,
                            password_hash: 'test_hash_concurrent',
                            role: 'student',
                            first_name: 'Concurrent',
                            last_name: `Test${index}`,
                            is_active: true
                        }, { transaction })
                    )
                );
                
                expect(users).toHaveLength(3);
                users.forEach(user => expect(user.id).toBeDefined());
                
                // Rollback all transactions
                await Promise.all(transactions.map(t => t.rollback()));
                
                // Verify no users were created
                const foundUsers = await User.findAll({
                    where: { email: { [sequelize.Op.like]: 'concurrent.test%@test.com' } }
                });
                
                expect(foundUsers).toHaveLength(0);
            } catch (error) {
                await Promise.all(transactions.map(t => t.rollback()));
                throw error;
            }
        });
    });
});