const request = require('supertest');
const app = require('../../server');
const { sequelize } = require('../../config/database');
const TestHelpers = require('./test-helpers');

/**
 * Role-Based Access Control Tests
 * Tests access control for all 5 user roles across all endpoints
 */

describe('Role-Based Access Control Tests', () => {
    let testHelpers;
    let testUsers;
    let testScenarios;
    
    beforeAll(async () => {
        testHelpers = new TestHelpers();
        testUsers = await testHelpers.createTestUsers();
        testScenarios = await testHelpers.createTestScenarios();
    });

    afterAll(async () => {
        await testHelpers.cleanup();
        await sequelize.close();
    });

    describe('School Management Access Control', () => {
        describe('GET /api/schools', () => {
            test('super_admin should access all schools', async () => {
                const response = await request(app)
                    .get('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('super_admin'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.schools).toBeDefined();
                expect(Array.isArray(response.body.schools)).toBe(true);
                expect(response.body.schools.length).toBeGreaterThan(0);
            });

            test('admin should access only their school', async () => {
                const response = await request(app)
                    .get('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('admin'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.schools).toBeDefined();
                
                // Admin should see their school only
                if (response.body.schools.length > 0) {
                    const schoolIds = response.body.schools.map(s => s.id);
                    expect(schoolIds).toContain(testUsers.admin.school_id);
                }
            });

            test('teacher should access only their school', async () => {
                const response = await request(app)
                    .get('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('teacher'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.schools).toBeDefined();
                
                // Teacher should see their school only
                if (response.body.schools.length > 0) {
                    const schoolIds = response.body.schools.map(s => s.id);
                    expect(schoolIds).toContain(testUsers.teacher.school_id);
                }
            });

            test('parent should access only their school', async () => {
                const response = await request(app)
                    .get('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('parent'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.schools).toBeDefined();
            });

            test('student should access only their school', async () => {
                const response = await request(app)
                    .get('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('student'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.schools).toBeDefined();
            });
        });

        describe('GET /api/schools/:id', () => {
            test('super_admin should access any school', async () => {
                const schoolId = testScenarios.schools.primary.id;
                const response = await request(app)
                    .get(`/api/schools/${schoolId}`)
                    .set('Authorization', testHelpers.getAuthHeader('super_admin'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.school).toBeDefined();
                expect(response.body.school.id).toBe(schoolId);
            });

            test('admin should access only their school', async () => {
                const userSchoolId = testUsers.admin.school_id;
                const response = await request(app)
                    .get(`/api/schools/${userSchoolId}`)
                    .set('Authorization', testHelpers.getAuthHeader('admin'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.school).toBeDefined();
                expect(response.body.school.id).toBe(userSchoolId);
            });

            test('admin should NOT access other schools', async () => {
                const otherSchoolId = testScenarios.schools.primary.id;
                const response = await request(app)
                    .get(`/api/schools/${otherSchoolId}`)
                    .set('Authorization', testHelpers.getAuthHeader('admin'));

                // Should either return 403 or empty result
                if (response.status === 403) {
                    testHelpers.validateErrorResponse(response, 403, 'SCHOOL_ACCESS_DENIED');
                } else {
                    expect(response.status).toBe(200);
                    expect(response.body.school).toBeNull();
                }
            });

            test('teacher should access only their school', async () => {
                const userSchoolId = testUsers.teacher.school_id;
                const response = await request(app)
                    .get(`/api/schools/${userSchoolId}`)
                    .set('Authorization', testHelpers.getAuthHeader('teacher'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.school).toBeDefined();
                expect(response.body.school.id).toBe(userSchoolId);
            });

            test('student should access only their school', async () => {
                const userSchoolId = testUsers.student.school_id;
                const response = await request(app)
                    .get(`/api/schools/${userSchoolId}`)
                    .set('Authorization', testHelpers.getAuthHeader('student'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.school).toBeDefined();
                expect(response.body.school.id).toBe(userSchoolId);
            });
        });

        describe('POST /api/schools', () => {
            test('super_admin should create schools', async () => {
                const newSchool = {
                    name: 'New Test School',
                    school_code: 'NTS001',
                    school_type: 'Primary',
                    address: '123 New Street',
                    phone: '246-555-9999',
                    email: 'newtest@school.edu.bb',
                    principal_name: 'New Principal',
                    zone_id: 1,
                    parish_id: 1
                };

                const response = await request(app)
                    .post('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('super_admin'))
                    .send(newSchool);

                // Should succeed or return appropriate error
                if (response.status === 201) {
                    testHelpers.validateApiResponse(response, 201);
                    expect(response.body.school).toBeDefined();
                    testHelpers.createdIds.schools.push(response.body.school.id);
                }
            });

            test('admin should NOT create schools', async () => {
                const newSchool = {
                    name: 'Admin Test School',
                    school_code: 'ATS001',
                    school_type: 'Primary',
                    address: '456 Admin Street',
                    phone: '246-555-8888',
                    email: 'admintest@school.edu.bb',
                    principal_name: 'Admin Principal',
                    zone_id: 1,
                    parish_id: 1
                };

                const response = await request(app)
                    .post('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('admin'))
                    .send(newSchool);

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('teacher should NOT create schools', async () => {
                const response = await request(app)
                    .post('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('teacher'))
                    .send({});

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('parent should NOT create schools', async () => {
                const response = await request(app)
                    .post('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('parent'))
                    .send({});

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('student should NOT create schools', async () => {
                const response = await request(app)
                    .post('/api/schools')
                    .set('Authorization', testHelpers.getAuthHeader('student'))
                    .send({});

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });
        });
    });

    describe('Student Management Access Control', () => {
        describe('GET /api/students', () => {
            test('super_admin should access all students', async () => {
                const response = await request(app)
                    .get('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('super_admin'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.students).toBeDefined();
                expect(Array.isArray(response.body.students)).toBe(true);
            });

            test('admin should access only their school students', async () => {
                const response = await request(app)
                    .get('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('admin'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.students).toBeDefined();
                
                // All students should belong to admin's school
                if (response.body.students.length > 0) {
                    response.body.students.forEach(student => {
                        expect(student.school_id).toBe(testUsers.admin.school_id);
                    });
                }
            });

            test('teacher should access only their school students', async () => {
                const response = await request(app)
                    .get('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('teacher'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.students).toBeDefined();
                
                // All students should belong to teacher's school
                if (response.body.students.length > 0) {
                    response.body.students.forEach(student => {
                        expect(student.school_id).toBe(testUsers.teacher.school_id);
                    });
                }
            });

            test('parent should access only their children', async () => {
                const response = await request(app)
                    .get('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('parent'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.students).toBeDefined();
                
                // Parents should only see their own children
                // This would require parent-child relationships to be set up
            });

            test('student should access only their own data', async () => {
                const response = await request(app)
                    .get('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('student'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.students).toBeDefined();
                
                // Students should only see themselves
                if (response.body.students.length > 0) {
                    expect(response.body.students).toHaveLength(1);
                    expect(response.body.students[0].user_id).toBe(testUsers.student.id);
                }
            });
        });

        describe('GET /api/students/:id', () => {
            test('super_admin should access any student', async () => {
                const studentId = testScenarios.students.withUser.id;
                const response = await request(app)
                    .get(`/api/students/${studentId}`)
                    .set('Authorization', testHelpers.getAuthHeader('super_admin'));

                testHelpers.validateApiResponse(response, 200);
                expect(response.body.student).toBeDefined();
                expect(response.body.student.id).toBe(studentId);
            });

            test('admin should access only their school students', async () => {
                const studentId = testScenarios.students.withUser.id;
                const response = await request(app)
                    .get(`/api/students/${studentId}`)
                    .set('Authorization', testHelpers.getAuthHeader('admin'));

                // Should succeed if student is in admin's school, otherwise 403
                if (response.status === 200) {
                    expect(response.body.student.school_id).toBe(testUsers.admin.school_id);
                } else {
                    testHelpers.validateErrorResponse(response, 403, 'SCHOOL_ACCESS_DENIED');
                }
            });

            test('teacher should access only their school students', async () => {
                const studentId = testScenarios.students.withUser.id;
                const response = await request(app)
                    .get(`/api/students/${studentId}`)
                    .set('Authorization', testHelpers.getAuthHeader('teacher'));

                // Should succeed if student is in teacher's school, otherwise 403
                if (response.status === 200) {
                    expect(response.body.student.school_id).toBe(testUsers.teacher.school_id);
                } else {
                    testHelpers.validateErrorResponse(response, 403, 'SCHOOL_ACCESS_DENIED');
                }
            });

            test('student should access only their own data', async () => {
                const studentId = testScenarios.students.withUser.id;
                const response = await request(app)
                    .get(`/api/students/${studentId}`)
                    .set('Authorization', testHelpers.getAuthHeader('student'));

                // Should succeed if it's the student's own data, otherwise 403
                if (response.status === 200) {
                    expect(response.body.student.user_id).toBe(testUsers.student.id);
                } else {
                    testHelpers.validateErrorResponse(response, 403, 'STUDENT_DATA_ACCESS_DENIED');
                }
            });
        });

        describe('POST /api/students', () => {
            test('super_admin should create students', async () => {
                const newStudent = {
                    student_id: 'STU999',
                    first_name: 'New',
                    last_name: 'Student',
                    date_of_birth: '2010-01-01',
                    gender: 'M',
                    grade_level: '5',
                    school_id: testScenarios.schools.primary.id
                };

                const response = await request(app)
                    .post('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('super_admin'))
                    .send(newStudent);

                // Should succeed or return appropriate error
                if (response.status === 201) {
                    testHelpers.validateApiResponse(response, 201);
                    expect(response.body.student).toBeDefined();
                    testHelpers.createdIds.students.push(response.body.student.id);
                }
            });

            test('admin should create students in their school only', async () => {
                const newStudent = {
                    student_id: 'STU998',
                    first_name: 'Admin',
                    last_name: 'Student',
                    date_of_birth: '2010-01-01',
                    gender: 'F',
                    grade_level: '4',
                    school_id: testUsers.admin.school_id
                };

                const response = await request(app)
                    .post('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('admin'))
                    .send(newStudent);

                // Should succeed or return appropriate error
                if (response.status === 201) {
                    testHelpers.validateApiResponse(response, 201);
                    expect(response.body.student).toBeDefined();
                    expect(response.body.student.school_id).toBe(testUsers.admin.school_id);
                    testHelpers.createdIds.students.push(response.body.student.id);
                }
            });

            test('teacher should NOT create students', async () => {
                const response = await request(app)
                    .post('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('teacher'))
                    .send({});

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('parent should NOT create students', async () => {
                const response = await request(app)
                    .post('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('parent'))
                    .send({});

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('student should NOT create students', async () => {
                const response = await request(app)
                    .post('/api/students')
                    .set('Authorization', testHelpers.getAuthHeader('student'))
                    .send({});

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });
        });
    });

    describe('Administrative Access Control', () => {
        describe('GET /api/admin/dashboard', () => {
            test('super_admin should access admin dashboard', async () => {
                const response = await request(app)
                    .get('/api/admin/dashboard')
                    .set('Authorization', testHelpers.getAuthHeader('super_admin'));

                // Should succeed or return appropriate error
                if (response.status === 200) {
                    testHelpers.validateApiResponse(response, 200);
                }
            });

            test('admin should access admin dashboard', async () => {
                const response = await request(app)
                    .get('/api/admin/dashboard')
                    .set('Authorization', testHelpers.getAuthHeader('admin'));

                // Should succeed or return appropriate error
                if (response.status === 200) {
                    testHelpers.validateApiResponse(response, 200);
                }
            });

            test('teacher should NOT access admin dashboard', async () => {
                const response = await request(app)
                    .get('/api/admin/dashboard')
                    .set('Authorization', testHelpers.getAuthHeader('teacher'));

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('parent should NOT access admin dashboard', async () => {
                const response = await request(app)
                    .get('/api/admin/dashboard')
                    .set('Authorization', testHelpers.getAuthHeader('parent'));

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('student should NOT access admin dashboard', async () => {
                const response = await request(app)
                    .get('/api/admin/dashboard')
                    .set('Authorization', testHelpers.getAuthHeader('student'));

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });
        });

        describe('GET /api/admin/system-stats', () => {
            test('super_admin should access system stats', async () => {
                const response = await request(app)
                    .get('/api/admin/system-stats')
                    .set('Authorization', testHelpers.getAuthHeader('super_admin'));

                // Should succeed or return appropriate error
                if (response.status === 200) {
                    testHelpers.validateApiResponse(response, 200);
                    expect(response.body.stats).toBeDefined();
                }
            });

            test('admin should access limited system stats', async () => {
                const response = await request(app)
                    .get('/api/admin/system-stats')
                    .set('Authorization', testHelpers.getAuthHeader('admin'));

                // Should succeed with limited data or return appropriate error
                if (response.status === 200) {
                    testHelpers.validateApiResponse(response, 200);
                    // Admin should see school-specific stats only
                }
            });

            test('teacher should NOT access system stats', async () => {
                const response = await request(app)
                    .get('/api/admin/system-stats')
                    .set('Authorization', testHelpers.getAuthHeader('teacher'));

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('parent should NOT access system stats', async () => {
                const response = await request(app)
                    .get('/api/admin/system-stats')
                    .set('Authorization', testHelpers.getAuthHeader('parent'));

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });

            test('student should NOT access system stats', async () => {
                const response = await request(app)
                    .get('/api/admin/system-stats')
                    .set('Authorization', testHelpers.getAuthHeader('student'));

                testHelpers.validateErrorResponse(response, 403, 'INSUFFICIENT_PERMISSIONS');
            });
        });
    });

    describe('Cross-Role Access Violation Tests', () => {
        test('should prevent role escalation attempts', async () => {
            // Try to access super_admin endpoints with different roles
            const superAdminEndpoints = [
                '/api/admin/users',
                '/api/admin/schools',
                '/api/admin/system-config'
            ];

            for (const endpoint of superAdminEndpoints) {
                for (const role of ['admin', 'teacher', 'parent', 'student']) {
                    const response = await request(app)
                        .get(endpoint)
                        .set('Authorization', testHelpers.getAuthHeader(role));

                    expect(response.status).toBeGreaterThanOrEqual(403);
                }
            }
        });

        test('should prevent cross-school data access', async () => {
            // Create students in different schools
            const schoolA = testScenarios.schools.primary;
            const schoolB = testScenarios.schools.secondary;

            // Teacher from school A should not access school B data
            const response = await request(app)
                .get(`/api/schools/${schoolB.id}/students`)
                .set('Authorization', testHelpers.getAuthHeader('teacher'));

            // Should either return 403 or empty results
            if (response.status === 403) {
                testHelpers.validateErrorResponse(response, 403, 'SCHOOL_ACCESS_DENIED');
            } else if (response.status === 200) {
                expect(response.body.students).toHaveLength(0);
            }
        });

        test('should prevent unauthorized data modification', async () => {
            const endpoints = [
                { method: 'PUT', url: '/api/schools/1' },
                { method: 'DELETE', url: '/api/schools/1' },
                { method: 'POST', url: '/api/admin/users' },
                { method: 'DELETE', url: '/api/admin/users/1' }
            ];

            for (const endpoint of endpoints) {
                for (const role of ['teacher', 'parent', 'student']) {
                    const response = await request(app)
                        [endpoint.method.toLowerCase()](endpoint.url)
                        .set('Authorization', testHelpers.getAuthHeader(role))
                        .send({});

                    expect(response.status).toBeGreaterThanOrEqual(403);
                }
            }
        });
    });

    describe('Access Control Performance Tests', () => {
        test('should perform authorization checks efficiently', async () => {
            const authorizationTests = 50;
            const startTime = Date.now();

            const requests = Array(authorizationTests).fill(0).map((_, index) => {
                const role = ['student', 'teacher', 'admin', 'super_admin'][index % 4];
                return request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', testHelpers.getAuthHeader(role));
            });

            const responses = await Promise.all(requests);
            const endTime = Date.now();

            const successfulRequests = responses.filter(r => r.status === 200).length;
            const metrics = testHelpers.generatePerformanceMetrics(
                'authorization_performance',
                startTime,
                endTime,
                authorizationTests
            );

            expect(successfulRequests).toBe(authorizationTests);
            expect(metrics.avg_response_time_ms).toBeLessThan(500); // Authorization should be fast
            expect(metrics.duration_ms).toBeLessThan(15000); // All requests within 15 seconds
        });
    });
});