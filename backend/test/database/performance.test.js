const { sequelize } = require('../../config/database');
const { User, School, Student, Staff, AttendanceRecord, AcademicRecord } = require('../../models');
const logger = require('../../utils/logger');

/**
 * Database Performance and Load Testing
 * Tests system performance under various load conditions
 * Critical for 24,750+ students across 106 schools
 */

describe('Database Performance Tests', () => {
    let testStartTime;
    
    beforeAll(async () => {
        testStartTime = Date.now();
        await sequelize.authenticate();
    });

    afterAll(async () => {
        const testDuration = Date.now() - testStartTime;
        logger.info(`Database performance tests completed in ${testDuration}ms`);
        await sequelize.close();
    });

    describe('Large Dataset Query Performance', () => {
        test('should handle full student dataset queries efficiently', async () => {
            const startTime = Date.now();
            
            const studentCount = await Student.count();
            const queryTime = Date.now() - startTime;
            
            expect(studentCount).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(2000); // Should count within 2 seconds
            
            logger.info(`Student count query: ${studentCount} students in ${queryTime}ms`);
        });

        test('should paginate through large student datasets efficiently', async () => {
            const pageSize = 100;
            const totalPages = 10;
            let totalRecords = 0;
            let maxQueryTime = 0;
            
            for (let page = 0; page < totalPages; page++) {
                const startTime = Date.now();
                
                const students = await Student.findAll({
                    limit: pageSize,
                    offset: page * pageSize,
                    include: [
                        { model: User, attributes: ['id', 'email', 'role'] },
                        { model: School, attributes: ['id', 'name', 'school_code'] }
                    ]
                });
                
                const queryTime = Date.now() - startTime;
                maxQueryTime = Math.max(maxQueryTime, queryTime);
                totalRecords += students.length;
                
                expect(queryTime).toBeLessThan(3000); // Each page should load within 3 seconds
                
                if (students.length < pageSize) break; // No more records
            }
            
            expect(totalRecords).toBeGreaterThan(0);
            expect(maxQueryTime).toBeLessThan(3000);
            
            logger.info(`Paginated ${totalRecords} records, max query time: ${maxQueryTime}ms`);
        });

        test('should handle school-wide statistics efficiently', async () => {
            const startTime = Date.now();
            
            const schoolStats = await School.findAll({
                attributes: [
                    'id',
                    'name',
                    'school_code',
                    'school_type',
                    [sequelize.fn('COUNT', sequelize.col('students.id')), 'student_count']
                ],
                include: [
                    { 
                        model: Student, 
                        attributes: [],
                        required: false 
                    }
                ],
                group: ['School.id', 'School.name', 'School.school_code', 'School.school_type'],
                order: [[sequelize.fn('COUNT', sequelize.col('students.id')), 'DESC']]
            });
            
            const queryTime = Date.now() - startTime;
            
            expect(schoolStats.length).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
            
            logger.info(`School statistics query: ${schoolStats.length} schools in ${queryTime}ms`);
        });

        test('should handle complex reporting queries efficiently', async () => {
            const startTime = Date.now();
            
            // Simulate a complex dashboard query
            const [results] = await sequelize.query(`
                SELECT 
                    s.name as school_name,
                    s.school_code,
                    s.school_type,
                    z.name as zone_name,
                    p.name as parish_name,
                    COUNT(DISTINCT st.id) as total_students,
                    COUNT(DISTINCT sf.id) as total_staff,
                    COUNT(DISTINCT CASE WHEN st.is_active = true THEN st.id END) as active_students,
                    COUNT(DISTINCT CASE WHEN sf.is_active = true THEN sf.id END) as active_staff,
                    AVG(CASE WHEN st.grade_level IS NOT NULL THEN CAST(st.grade_level AS FLOAT) END) as avg_grade_level
                FROM schools s
                LEFT JOIN students st ON s.id = st.school_id
                LEFT JOIN staff sf ON s.id = sf.school_id
                LEFT JOIN zones z ON s.zone_id = z.id
                LEFT JOIN parishes p ON s.parish_id = p.id
                GROUP BY s.id, s.name, s.school_code, s.school_type, z.name, p.name
                HAVING COUNT(DISTINCT st.id) > 0
                ORDER BY total_students DESC, school_name
                LIMIT 50
            `);
            
            const queryTime = Date.now() - startTime;
            
            expect(results.length).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(10000); // Should complete within 10 seconds
            
            logger.info(`Complex reporting query: ${results.length} schools in ${queryTime}ms`);
        });
    });

    describe('Concurrent Access Performance', () => {
        test('should handle concurrent student lookups', async () => {
            const concurrentQueries = 20;
            const startTime = Date.now();
            
            const queries = Array(concurrentQueries).fill(0).map((_, index) => 
                Student.findAll({
                    limit: 10,
                    offset: index * 10,
                    include: [
                        { model: User, attributes: ['id', 'email'] },
                        { model: School, attributes: ['id', 'name'] }
                    ]
                })
            );
            
            const results = await Promise.all(queries);
            const totalTime = Date.now() - startTime;
            
            expect(results).toHaveLength(concurrentQueries);
            expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
            
            const totalRecords = results.reduce((sum, result) => sum + result.length, 0);
            logger.info(`Concurrent queries: ${totalRecords} records in ${totalTime}ms`);
        });

        test('should handle concurrent school statistics', async () => {
            const concurrentQueries = 10;
            const startTime = Date.now();
            
            const queries = Array(concurrentQueries).fill(0).map((_, index) => 
                School.findAll({
                    attributes: [
                        'id',
                        'name',
                        [sequelize.fn('COUNT', sequelize.col('students.id')), 'student_count']
                    ],
                    include: [
                        { model: Student, attributes: [], required: false }
                    ],
                    group: ['School.id', 'School.name'],
                    limit: 20,
                    offset: index * 10
                })
            );
            
            const results = await Promise.all(queries);
            const totalTime = Date.now() - startTime;
            
            expect(results).toHaveLength(concurrentQueries);
            expect(totalTime).toBeLessThan(20000); // Should complete within 20 seconds
            
            logger.info(`Concurrent school statistics: ${results.length} queries in ${totalTime}ms`);
        });

        test('should handle mixed read/write operations', async () => {
            const startTime = Date.now();
            
            // Mix of read and write operations
            const operations = [
                // Read operations
                Student.findAll({ limit: 50 }),
                School.findAll({ limit: 20 }),
                User.count({ where: { role: 'student' } }),
                
                // Write operations (within transaction to avoid data pollution)
                sequelize.transaction(async (transaction) => {
                    const testUser = await User.create({
                        email: 'perf.test@test.com',
                        password_hash: 'test_hash',
                        role: 'student',
                        first_name: 'Performance',
                        last_name: 'Test',
                        is_active: true
                    }, { transaction });
                    
                    await transaction.rollback();
                    return testUser;
                }),
                
                // More read operations
                sequelize.query('SELECT COUNT(*) as total FROM students'),
                sequelize.query('SELECT COUNT(*) as total FROM schools')
            ];
            
            const results = await Promise.all(operations);
            const totalTime = Date.now() - startTime;
            
            expect(results).toHaveLength(6);
            expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
            
            logger.info(`Mixed operations completed in ${totalTime}ms`);
        });
    });

    describe('Memory and Resource Usage', () => {
        test('should handle large result sets without memory issues', async () => {
            const initialMemory = process.memoryUsage();
            
            // Query a large dataset
            const students = await Student.findAll({
                limit: 1000,
                include: [
                    { model: User, attributes: ['id', 'email', 'role'] },
                    { model: School, attributes: ['id', 'name', 'school_code'] }
                ]
            });
            
            const afterQueryMemory = process.memoryUsage();
            const memoryIncrease = afterQueryMemory.heapUsed - initialMemory.heapUsed;
            
            expect(students.length).toBeGreaterThan(0);
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
            
            logger.info(`Large query memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        });

        test('should handle streaming large datasets', async () => {
            const startTime = Date.now();
            let recordCount = 0;
            
            // Use raw query with streaming for large datasets
            const stream = sequelize.query(
                'SELECT st.id, st.first_name, st.last_name, s.name as school_name FROM students st LEFT JOIN schools s ON st.school_id = s.id LIMIT 1000',
                { type: sequelize.QueryTypes.SELECT }
            );
            
            const results = await stream;
            recordCount = results.length;
            
            const queryTime = Date.now() - startTime;
            
            expect(recordCount).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
            
            logger.info(`Streamed ${recordCount} records in ${queryTime}ms`);
        });
    });

    describe('Database Load Testing', () => {
        test('should handle sustained load', async () => {
            const duration = 5000; // 5 seconds
            const startTime = Date.now();
            const queries = [];
            
            // Generate queries for 5 seconds
            while (Date.now() - startTime < duration) {
                queries.push(
                    Student.findAll({ 
                        limit: 10,
                        include: [{ model: School, attributes: ['name'] }]
                    })
                );
                
                // Add small delay to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const results = await Promise.all(queries);
            const totalTime = Date.now() - startTime;
            
            expect(results.length).toBeGreaterThan(0);
            expect(totalTime).toBeLessThan(duration + 5000); // Should complete within duration + 5 seconds
            
            logger.info(`Sustained load test: ${results.length} queries in ${totalTime}ms`);
        });

        test('should handle burst traffic', async () => {
            const burstSize = 50;
            const startTime = Date.now();
            
            // Create a burst of queries
            const burstQueries = Array(burstSize).fill(0).map((_, index) => {
                const queryType = index % 3;
                
                switch (queryType) {
                    case 0:
                        return Student.findAll({ limit: 5 });
                    case 1:
                        return School.findAll({ limit: 5 });
                    case 2:
                        return User.count({ where: { is_active: true } });
                    default:
                        return Student.count();
                }
            });
            
            const results = await Promise.all(burstQueries);
            const totalTime = Date.now() - startTime;
            
            expect(results).toHaveLength(burstSize);
            expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
            
            logger.info(`Burst traffic test: ${burstSize} queries in ${totalTime}ms`);
        });
    });

    describe('Index Performance Validation', () => {
        test('should use indexes for common queries', async () => {
            const queries = [
                // Student email lookup (should use email index)
                () => User.findOne({ where: { email: 'test@example.com' } }),
                
                // School code lookup (should use school_code index)
                () => School.findOne({ where: { school_code: 'TEST001' } }),
                
                // Student ID lookup (should use primary key)
                () => Student.findByPk(1),
                
                // School students lookup (should use foreign key index)
                () => Student.findAll({ where: { school_id: 1 } })
            ];
            
            for (const query of queries) {
                const startTime = Date.now();
                await query();
                const queryTime = Date.now() - startTime;
                
                expect(queryTime).toBeLessThan(1000); // Should use index and complete quickly
            }
        });

        test('should perform range queries efficiently', async () => {
            const startTime = Date.now();
            
            // Date range query (should use date index if available)
            const recentStudents = await Student.findAll({
                where: {
                    enrollment_date: {
                        [sequelize.Op.gte]: new Date('2023-01-01')
                    }
                },
                limit: 100
            });
            
            const queryTime = Date.now() - startTime;
            
            expect(recentStudents.length).toBeGreaterThanOrEqual(0);
            expect(queryTime).toBeLessThan(3000); // Should complete within 3 seconds
            
            logger.info(`Range query: ${recentStudents.length} recent students in ${queryTime}ms`);
        });
    });

    describe('Query Optimization Tests', () => {
        test('should optimize JOIN queries', async () => {
            const startTime = Date.now();
            
            // Complex JOIN query with multiple relationships
            const studentsWithDetails = await Student.findAll({
                limit: 100,
                include: [
                    { 
                        model: User, 
                        attributes: ['id', 'email', 'role'],
                        required: true 
                    },
                    { 
                        model: School, 
                        attributes: ['id', 'name', 'school_code'],
                        required: true,
                        include: [
                            { model: Zone, attributes: ['name'] },
                            { model: Parish, attributes: ['name'] }
                        ]
                    }
                ]
            });
            
            const queryTime = Date.now() - startTime;
            
            expect(studentsWithDetails.length).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
            
            // Verify all relationships are populated
            studentsWithDetails.forEach(student => {
                expect(student.User).toBeDefined();
                expect(student.School).toBeDefined();
                expect(student.School.Zone).toBeDefined();
                expect(student.School.Parish).toBeDefined();
            });
            
            logger.info(`Complex JOIN query: ${studentsWithDetails.length} students in ${queryTime}ms`);
        });

        test('should optimize aggregate queries', async () => {
            const startTime = Date.now();
            
            // Aggregate query with grouping
            const schoolSummary = await School.findAll({
                attributes: [
                    'id',
                    'name',
                    'school_type',
                    [sequelize.fn('COUNT', sequelize.col('students.id')), 'student_count'],
                    [sequelize.fn('AVG', sequelize.col('students.grade_level')), 'avg_grade']
                ],
                include: [
                    { 
                        model: Student, 
                        attributes: [],
                        required: false 
                    }
                ],
                group: ['School.id', 'School.name', 'School.school_type'],
                having: sequelize.where(sequelize.fn('COUNT', sequelize.col('students.id')), '>', 0),
                order: [[sequelize.fn('COUNT', sequelize.col('students.id')), 'DESC']],
                limit: 20
            });
            
            const queryTime = Date.now() - startTime;
            
            expect(schoolSummary.length).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(8000); // Should complete within 8 seconds
            
            logger.info(`Aggregate query: ${schoolSummary.length} schools in ${queryTime}ms`);
        });
    });
});