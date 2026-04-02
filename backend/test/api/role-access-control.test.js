const request = require('supertest');
const app = require('../../server');
const { sequelize } = require('../../config/database');
const TestHelpers = require('./test-helpers');

describe('Role-Based Access Control Tests', () => {
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

    test('requires auth for protected students route', async () => {
        const response = await request(app).get('/api/students');
        expect(response.status).toBe(401);
        expect(response.body.code).toBe('NO_TOKEN');
    });

    test('admin dashboard: super_admin and admin allowed', async () => {
        for (const role of ['super_admin', 'admin']) {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', testHelpers.getAuthHeader(role));

            expect(response.status).toBe(200);
        }
    });

    test('admin dashboard: teacher/parent/student denied', async () => {
        for (const role of ['teacher', 'parent', 'student']) {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', testHelpers.getAuthHeader(role));

            expect(response.status).toBe(403);
        }
    });

    test('access-control matrix is super_admin only', async () => {
        const superAdminResponse = await request(app)
            .get('/api/admin/access-control/matrix')
            .set('Authorization', testHelpers.getAuthHeader('super_admin'));
        expect(superAdminResponse.status).toBe(200);
        expect(superAdminResponse.body).toBeDefined();

        for (const role of ['admin', 'teacher', 'parent', 'student']) {
            const response = await request(app)
                .get('/api/admin/access-control/matrix')
                .set('Authorization', testHelpers.getAuthHeader(role));
            expect(response.status).toBe(403);
        }
    });

    test('admin schools route: super_admin/admin allowed, others denied', async () => {
        for (const role of ['super_admin', 'admin']) {
            const response = await request(app)
                .get('/api/admin/schools')
                .set('Authorization', testHelpers.getAuthHeader(role));
            expect(response.status).toBe(200);
        }

        for (const role of ['teacher', 'parent', 'student']) {
            const response = await request(app)
                .get('/api/admin/schools')
                .set('Authorization', testHelpers.getAuthHeader(role));
            expect(response.status).toBe(403);
        }
    });

    test('barbados school stats: super_admin/admin allowed, others denied', async () => {
        for (const role of ['super_admin', 'admin']) {
            const response = await request(app)
                .get('/api/schools/statistics/barbados')
                .set('Authorization', testHelpers.getAuthHeader(role));
            expect(response.status).toBe(200);
            expect(response.body.overview).toBeDefined();
        }

        for (const role of ['teacher', 'parent', 'student']) {
            const response = await request(app)
                .get('/api/schools/statistics/barbados')
                .set('Authorization', testHelpers.getAuthHeader(role));
            expect(response.status).toBe(403);
        }
    });

    test('students list route is reachable for authenticated roles', async () => {
        for (const role of ['super_admin', 'admin', 'teacher', 'parent', 'student']) {
            const response = await request(app)
                .get('/api/students')
                .set('Authorization', testHelpers.getAuthHeader(role));
            expect(response.status).toBe(200);
        }
    });

    test('students create route blocks parent/student', async () => {
        const basePayload = {
            first_name: 'API',
            last_name: 'TestStudent',
            date_of_birth: '2012-01-01',
            gender: 'male',
            school_id: testUsers.admin.school_id,
            grade_level: 'Class 4'
        };

        for (const role of ['super_admin', 'admin']) {
            const response = await request(app)
                .post('/api/students')
                .set('Authorization', testHelpers.getAuthHeader(role))
                .send({
                    ...basePayload,
                    student_id: `TEST-${role}-${Date.now()}-${Math.floor(Math.random() * 1000)}`.slice(0, 20)
                });

            expect([201, 400]).toContain(response.status);
            if (response.status === 201 && response.body?.student?.id) {
                testHelpers.createdIds.students.push(response.body.student.id);
            }
        }

        for (const role of ['parent', 'student']) {
            const response = await request(app)
                .post('/api/students')
                .set('Authorization', testHelpers.getAuthHeader(role))
                .send({
                    ...basePayload,
                    student_id: `TEST-${role}-${Date.now()}-${Math.floor(Math.random() * 1000)}`.slice(0, 20)
                });

            expect(response.status).toBe(403);
        }
    });
});
