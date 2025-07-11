const request = require('supertest');
const app = require('../../server');
const { sequelize } = require('../../config/database');
const TestHelpers = require('./test-helpers');

/**
 * Authentication API Tests
 * Tests authentication endpoints for all user roles
 */

describe('Authentication API Tests', () => {
    let testHelpers;
    let testUsers;
    
    beforeAll(async () => {
        testHelpers = new TestHelpers();
        testUsers = await testHelpers.createTestUsers();
    });

    afterAll(async () => {
        await testHelpers.cleanup();
        await sequelize.close();
    });

    describe('POST /api/auth/login', () => {
        test('should authenticate super admin successfully', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUsers.super_admin.email,
                    password: testUsers.super_admin.password
                });

            testHelpers.validateApiResponse(response, 200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.role).toBe('super_admin');
            expect(response.body.user).not.toHaveProperty('password_hash');
        });

        test('should authenticate admin successfully', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUsers.admin.email,
                    password: testUsers.admin.password
                });

            testHelpers.validateApiResponse(response, 200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.role).toBe('admin');
            expect(response.body.user.school_id).toBeDefined();
        });

        test('should authenticate teacher successfully', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUsers.teacher.email,
                    password: testUsers.teacher.password
                });

            testHelpers.validateApiResponse(response, 200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.role).toBe('teacher');
            expect(response.body.user.school_id).toBeDefined();
        });

        test('should authenticate parent successfully', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUsers.parent.email,
                    password: testUsers.parent.password
                });

            testHelpers.validateApiResponse(response, 200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.role).toBe('parent');
            expect(response.body.user.school_id).toBeDefined();
        });

        test('should authenticate student successfully', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUsers.student.email,
                    password: testUsers.student.password
                });

            testHelpers.validateApiResponse(response, 200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.role).toBe('student');
            expect(response.body.user.school_id).toBeDefined();
        });

        test('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUsers.student.email,
                    password: 'wrongpassword'
                });

            testHelpers.validateErrorResponse(response, 401);
            expect(response.body.error).toContain('Invalid credentials');
        });

        test('should reject non-existent user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@test.com',
                    password: 'password123'
                });

            testHelpers.validateErrorResponse(response, 401);
            expect(response.body.error).toContain('Invalid credentials');
        });

        test('should reject empty credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({});

            testHelpers.validateErrorResponse(response, 400);
        });

        test('should reject invalid email format', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'invalid-email',
                    password: 'password123'
                });

            testHelpers.validateErrorResponse(response, 400);
        });
    });

    describe('GET /api/auth/profile', () => {
        test('should return super admin profile', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', testHelpers.getAuthHeader('super_admin'));

            testHelpers.validateApiResponse(response, 200);
            const userData = testHelpers.validateUserData(response.body.user, 'super_admin');
            expect(userData.school_id).toBeNull();
        });

        test('should return admin profile', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', testHelpers.getAuthHeader('admin'));

            testHelpers.validateApiResponse(response, 200);
            const userData = testHelpers.validateUserData(response.body.user, 'admin');
            expect(userData.school_id).toBeDefined();
        });

        test('should return teacher profile', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', testHelpers.getAuthHeader('teacher'));

            testHelpers.validateApiResponse(response, 200);
            const userData = testHelpers.validateUserData(response.body.user, 'teacher');
            expect(userData.school_id).toBeDefined();
        });

        test('should return parent profile', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', testHelpers.getAuthHeader('parent'));

            testHelpers.validateApiResponse(response, 200);
            const userData = testHelpers.validateUserData(response.body.user, 'parent');
            expect(userData.school_id).toBeDefined();
        });

        test('should return student profile', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', testHelpers.getAuthHeader('student'));

            testHelpers.validateApiResponse(response, 200);
            const userData = testHelpers.validateUserData(response.body.user, 'student');
            expect(userData.school_id).toBeDefined();
        });

        test('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/auth/profile');

            testHelpers.validateErrorResponse(response, 401, 'NO_TOKEN');
        });

        test('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer invalid-token');

            testHelpers.validateErrorResponse(response, 401, 'INVALID_TOKEN');
        });

        test('should reject request with expired token', async () => {
            // Generate expired token
            const jwt = require('jsonwebtoken');
            const expiredToken = jwt.sign(
                { id: testUsers.student.id, role: 'student' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1ms' }
            );

            // Wait for token to expire
            await new Promise(resolve => setTimeout(resolve, 10));

            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${expiredToken}`);

            testHelpers.validateErrorResponse(response, 401, 'TOKEN_EXPIRED');
        });
    });

    describe('POST /api/auth/refresh', () => {
        test('should refresh token successfully', async () => {
            // First login to get refresh token
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUsers.student.email,
                    password: testUsers.student.password
                });

            expect(loginResponse.body.refreshToken).toBeDefined();

            // Test refresh
            const refreshResponse = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: loginResponse.body.refreshToken
                });

            testHelpers.validateApiResponse(refreshResponse, 200);
            expect(refreshResponse.body).toHaveProperty('accessToken');
            expect(refreshResponse.body).toHaveProperty('expiresIn');
        });

        test('should reject invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: 'invalid-refresh-token'
                });

            testHelpers.validateErrorResponse(response, 401, 'INVALID_REFRESH_TOKEN');
        });

        test('should reject missing refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({});

            testHelpers.validateErrorResponse(response, 401, 'REFRESH_TOKEN_REQUIRED');
        });
    });

    describe('POST /api/auth/logout', () => {
        test('should logout successfully', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', testHelpers.getAuthHeader('student'));

            testHelpers.validateApiResponse(response, 200);
            expect(response.body.message).toContain('Logged out successfully');
        });

        test('should reject logout without token', async () => {
            const response = await request(app)
                .post('/api/auth/logout');

            testHelpers.validateErrorResponse(response, 401, 'NO_TOKEN');
        });
    });

    describe('PUT /api/auth/change-password', () => {
        test('should change password successfully', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', testHelpers.getAuthHeader('student'))
                .send({
                    currentPassword: testUsers.student.password,
                    newPassword: 'NewPassword123!',
                    confirmPassword: 'NewPassword123!'
                });

            testHelpers.validateApiResponse(response, 200);
            expect(response.body.message).toContain('Password changed successfully');

            // Change back to original password for other tests
            await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', testHelpers.getAuthHeader('student'))
                .send({
                    currentPassword: 'NewPassword123!',
                    newPassword: testUsers.student.password,
                    confirmPassword: testUsers.student.password
                });
        });

        test('should reject incorrect current password', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', testHelpers.getAuthHeader('student'))
                .send({
                    currentPassword: 'wrongpassword',
                    newPassword: 'NewPassword123!',
                    confirmPassword: 'NewPassword123!'
                });

            testHelpers.validateErrorResponse(response, 400);
            expect(response.body.error).toContain('Current password is incorrect');
        });

        test('should reject mismatched password confirmation', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', testHelpers.getAuthHeader('student'))
                .send({
                    currentPassword: testUsers.student.password,
                    newPassword: 'NewPassword123!',
                    confirmPassword: 'DifferentPassword123!'
                });

            testHelpers.validateErrorResponse(response, 400);
            expect(response.body.error).toContain('Passwords do not match');
        });

        test('should reject weak password', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', testHelpers.getAuthHeader('student'))
                .send({
                    currentPassword: testUsers.student.password,
                    newPassword: 'weak',
                    confirmPassword: 'weak'
                });

            testHelpers.validateErrorResponse(response, 400);
            expect(response.body.error).toContain('Password does not meet requirements');
        });

        test('should reject password change without authentication', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .send({
                    currentPassword: 'password',
                    newPassword: 'NewPassword123!',
                    confirmPassword: 'NewPassword123!'
                });

            testHelpers.validateErrorResponse(response, 401, 'NO_TOKEN');
        });
    });

    describe('Authentication Performance Tests', () => {
        test('should handle concurrent login requests', async () => {
            const concurrentLogins = 10;
            const startTime = Date.now();

            const loginPromises = Array(concurrentLogins).fill(0).map((_, index) => 
                request(app)
                    .post('/api/auth/login')
                    .send({
                        email: testUsers.student.email,
                        password: testUsers.student.password
                    })
            );

            const responses = await Promise.all(loginPromises);
            const endTime = Date.now();

            // All requests should succeed
            responses.forEach(response => {
                testHelpers.validateApiResponse(response, 200);
                expect(response.body).toHaveProperty('token');
            });

            const metrics = testHelpers.generatePerformanceMetrics(
                'concurrent_logins',
                startTime,
                endTime,
                concurrentLogins
            );

            expect(metrics.duration_ms).toBeLessThan(10000); // Should complete within 10 seconds
            expect(metrics.avg_response_time_ms).toBeLessThan(1000); // Average response under 1 second
        });

        test('should handle authentication load efficiently', async () => {
            const loadTestRequests = 50;
            const startTime = Date.now();

            const requests = Array(loadTestRequests).fill(0).map((_, index) => {
                const userRole = ['student', 'teacher', 'admin'][index % 3];
                const user = testUsers[userRole];
                
                return request(app)
                    .post('/api/auth/login')
                    .send({
                        email: user.email,
                        password: user.password
                    });
            });

            const responses = await Promise.all(requests);
            const endTime = Date.now();

            const successfulLogins = responses.filter(r => r.status === 200).length;
            const metrics = testHelpers.generatePerformanceMetrics(
                'authentication_load_test',
                startTime,
                endTime,
                loadTestRequests
            );

            expect(successfulLogins).toBeGreaterThan(loadTestRequests * 0.9); // At least 90% success rate
            expect(metrics.duration_ms).toBeLessThan(30000); // Should complete within 30 seconds
        });
    });

    describe('Token Security Tests', () => {
        test('should generate unique tokens for different users', async () => {
            const tokens = [];
            
            for (const role of ['student', 'teacher', 'admin']) {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: testUsers[role].email,
                        password: testUsers[role].password
                    });
                
                expect(response.status).toBe(200);
                tokens.push(response.body.token);
            }

            // All tokens should be different
            const uniqueTokens = [...new Set(tokens)];
            expect(uniqueTokens.length).toBe(tokens.length);
        });

        test('should include correct role in token payload', async () => {
            const jwt = require('jsonwebtoken');
            
            for (const role of ['student', 'teacher', 'admin', 'super_admin']) {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: testUsers[role].email,
                        password: testUsers[role].password
                    });
                
                expect(response.status).toBe(200);
                
                const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET || 'test-secret');
                expect(decoded.role).toBe(role);
                expect(decoded.id).toBe(testUsers[role].id);
            }
        });

        test('should reject tampered tokens', async () => {
            const validToken = testHelpers.generateToken('student');
            const tamperedToken = validToken.slice(0, -5) + 'XXXXX'; // Tamper with signature
            
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${tamperedToken}`);

            testHelpers.validateErrorResponse(response, 401, 'INVALID_TOKEN');
        });
    });
});