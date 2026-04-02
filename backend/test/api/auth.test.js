const request = require('supertest');
const app = require('../../server');
const { sequelize } = require('../../config/database');
const { jwtManager } = require('../../config/jwt');
const TestHelpers = require('./test-helpers');

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
        test('should authenticate all roles successfully', async () => {
            for (const role of ['super_admin', 'admin', 'teacher', 'parent', 'student']) {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        login: testUsers[role].email,
                        password: testUsers[role].password
                    });

                testHelpers.validateApiResponse(response, 200);
                expect(response.body).toHaveProperty('token');
                expect(response.body).toHaveProperty('user');
                expect(response.body.user.role).toBe(role);
                expect(response.body.user).not.toHaveProperty('password_hash');
            }
        });

        test('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    login: testUsers.student.email,
                    password: 'wrongpassword'
                });

            testHelpers.validateErrorResponse(response, 401);
            expect(response.body.error).toContain('Invalid credentials');
        });

        test('should reject non-existent user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    login: 'nonexistent@test.com',
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
    });

    describe('GET /api/auth/profile', () => {
        test('should return profile for each role', async () => {
            for (const role of ['super_admin', 'admin', 'teacher', 'parent', 'student']) {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', testHelpers.getAuthHeader(role));

                testHelpers.validateApiResponse(response, 200);
                const userData = testHelpers.validateUserData(response.body.user, role);
                expect(userData.email).toBe(testUsers[role].email);
            }
        });

        test('should reject request without token', async () => {
            const response = await request(app).get('/api/auth/profile');
            testHelpers.validateErrorResponse(response, 401, 'NO_TOKEN');
        });

        test('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer invalid-token');

            testHelpers.validateErrorResponse(response, 401, 'INVALID_TOKEN');
        });

        test('should reject request with expired token', async () => {
            const expiredToken = jwtManager.generateAccessToken(
                { id: testUsers.student.id, role: 'student', school_id: testUsers.student.school_id },
                { expiresIn: '1ms' }
            ).token;

            await new Promise(resolve => setTimeout(resolve, 10));

            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${expiredToken}`);

            testHelpers.validateErrorResponse(response, 401, 'TOKEN_EXPIRED');
        });
    });

    describe('GET /api/auth/access', () => {
        test('should return access context for authenticated user', async () => {
            const response = await request(app)
                .get('/api/auth/access')
                .set('Authorization', testHelpers.getAuthHeader('admin'));

            testHelpers.validateApiResponse(response, 200);
            expect(response.body).toHaveProperty('access');
        });
    });

    describe('PUT /api/auth/change-password', () => {
        test('should change password successfully', async () => {
            const newPassword = 'NewPassword123!';
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', testHelpers.getAuthHeader('student'))
                .send({
                    current_password: testUsers.student.password,
                    new_password: newPassword
                });

            testHelpers.validateApiResponse(response, 200);
            expect(response.body.message).toContain('Password changed successfully');

            const restoreResponse = await request(app)
                .post('/api/auth/login')
                .send({ login: testUsers.student.email, password: newPassword });
            expect(restoreResponse.status).toBe(200);

            const revertToken = restoreResponse.body.token;
            const revertResponse = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', `Bearer ${revertToken}`)
                .send({
                    current_password: newPassword,
                    new_password: testUsers.student.password
                });
            expect(revertResponse.status).toBe(200);
        });

        test('should reject incorrect current password', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', testHelpers.getAuthHeader('student'))
                .send({
                    current_password: 'wrongpassword',
                    new_password: 'NewPassword123!'
                });

            testHelpers.validateErrorResponse(response, 400);
            expect(response.body.error).toContain('Current password is incorrect');
        });

        test('should reject weak password', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', testHelpers.getAuthHeader('student'))
                .send({
                    current_password: testUsers.student.password,
                    new_password: 'weak'
                });

            testHelpers.validateErrorResponse(response, 400);
            expect(response.body.error).toContain('Validation failed');
        });

        test('should reject password change without authentication', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .send({
                    current_password: 'password',
                    new_password: 'NewPassword123!'
                });

            testHelpers.validateErrorResponse(response, 401);
        });
    });

    describe('Token Security Tests', () => {
        test('should generate unique tokens for different users', async () => {
            const tokens = [];

            for (const role of ['student', 'teacher', 'admin']) {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        login: testUsers[role].email,
                        password: testUsers[role].password
                    });

                expect(response.status).toBe(200);
                tokens.push(response.body.token);
            }

            expect(new Set(tokens).size).toBe(tokens.length);
        });

        test('should include correct role in token payload', async () => {
            for (const role of ['student', 'teacher', 'admin', 'super_admin']) {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        login: testUsers[role].email,
                        password: testUsers[role].password
                    });

                expect(response.status).toBe(200);
                const decoded = jwtManager.verifyAccessToken(response.body.token);
                expect(decoded.role).toBe(role);
                expect(decoded.id).toBe(testUsers[role].id);
            }
        });

        test('should reject tampered tokens', async () => {
            const validToken = testHelpers.generateToken('student');
            const tamperedToken = `${validToken.slice(0, -5)}XXXXX`;

            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${tamperedToken}`);

            testHelpers.validateErrorResponse(response, 401, 'INVALID_TOKEN');
        });
    });
});
