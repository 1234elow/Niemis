const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, School, Student, Staff, Parent } = require('../../models');
const { sequelize } = require('../../config/database');

/**
 * Test Helper Functions for API Testing
 * Provides utilities for creating test users, tokens, and test data
 */

class TestHelpers {
    constructor() {
        this.testUsers = {};
        this.testSchools = {};
        this.testStudents = {};
        this.testStaff = {};
        this.testParents = {};
        this.createdIds = {
            users: [],
            schools: [],
            students: [],
            staff: [],
            parents: []
        };
    }

    /**
     * Create test users for all roles
     */
    async createTestUsers() {
        const testPassword = 'TestPassword123!';
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        
        // Find a real school to use for testing
        const testSchool = await School.findOne();
        if (!testSchool) {
            throw new Error('No schools found for testing. Please ensure database is seeded.');
        }
        
        const userRoles = [
            {
                role: 'super_admin',
                email: 'super.admin@test.niemis.com',
                first_name: 'Super',
                last_name: 'Admin',
                school_id: null // Super admin doesn't belong to a specific school
            },
            {
                role: 'admin',
                email: 'admin@test.niemis.com',
                first_name: 'School',
                last_name: 'Admin',
                school_id: testSchool.id
            },
            {
                role: 'teacher',
                email: 'teacher@test.niemis.com',
                first_name: 'Test',
                last_name: 'Teacher',
                school_id: testSchool.id
            },
            {
                role: 'parent',
                email: 'parent@test.niemis.com',
                first_name: 'Test',
                last_name: 'Parent',
                school_id: testSchool.id
            },
            {
                role: 'student',
                email: 'student@test.niemis.com',
                first_name: 'Test',
                last_name: 'Student',
                school_id: testSchool.id
            }
        ];
        
        for (const userData of userRoles) {
            // Check if user already exists
            let user = await User.findOne({ where: { email: userData.email } });
            
            if (!user) {
                user = await User.create({
                    ...userData,
                    password_hash: hashedPassword,
                    is_active: true
                });
                this.createdIds.users.push(user.id);
            }
            
            this.testUsers[userData.role] = {
                ...user.toJSON(),
                password: testPassword
            };
        }
        
        return this.testUsers;
    }

    /**
     * Create test school data
     */
    async createTestSchool() {
        const testSchool = await School.create({
            name: 'Test Elementary School',
            school_code: 'TEST001',
            school_type: 'Primary',
            address: '123 Test Street, Test City',
            phone: '246-555-0123',
            email: 'test@testschool.edu.bb',
            principal_name: 'Test Principal',
            zone_id: 1,
            parish_id: 1,
            is_active: true
        });
        
        this.createdIds.schools.push(testSchool.id);
        this.testSchools['test'] = testSchool;
        
        return testSchool;
    }

    /**
     * Create test student data
     */
    async createTestStudent(schoolId = null, userId = null) {
        const school = schoolId ? await School.findByPk(schoolId) : await School.findOne();
        const user = userId ? await User.findByPk(userId) : this.testUsers.student;
        
        if (!school || !user) {
            throw new Error('School or user not found for test student creation');
        }
        
        const testStudent = await Student.create({
            student_id: `STU${Date.now()}`,
            user_id: user.id,
            school_id: school.id,
            first_name: user.first_name,
            last_name: user.last_name,
            date_of_birth: new Date('2010-01-01'),
            gender: 'M',
            grade_level: '5',
            enrollment_date: new Date(),
            is_active: true
        });
        
        this.createdIds.students.push(testStudent.id);
        this.testStudents['test'] = testStudent;
        
        return testStudent;
    }

    /**
     * Create test staff data
     */
    async createTestStaff(schoolId = null, userId = null) {
        const school = schoolId ? await School.findByPk(schoolId) : await School.findOne();
        const user = userId ? await User.findByPk(userId) : this.testUsers.teacher;
        
        if (!school || !user) {
            throw new Error('School or user not found for test staff creation');
        }
        
        const testStaff = await Staff.create({
            staff_id: `STF${Date.now()}`,
            user_id: user.id,
            school_id: school.id,
            first_name: user.first_name,
            last_name: user.last_name,
            position: 'Teacher',
            department: 'Mathematics',
            hire_date: new Date('2020-01-01'),
            is_active: true
        });
        
        this.createdIds.staff.push(testStaff.id);
        this.testStaff['test'] = testStaff;
        
        return testStaff;
    }

    /**
     * Generate JWT token for test user
     */
    generateToken(userRole) {
        const user = this.testUsers[userRole];
        if (!user) {
            throw new Error(`Test user not found for role: ${userRole}`);
        }
        
        const payload = {
            id: user.id,
            role: user.role,
            school_id: user.school_id,
            email: user.email
        };
        
        return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
            expiresIn: '1h'
        });
    }

    /**
     * Get authorization header for test user
     */
    getAuthHeader(userRole) {
        const token = this.generateToken(userRole);
        return `Bearer ${token}`;
    }

    /**
     * Create test data for different scenarios
     */
    async createTestScenarios() {
        // Create multiple schools for testing
        const schools = await Promise.all([
            School.create({
                name: 'Test Primary School A',
                school_code: 'TPSA001',
                school_type: 'Primary',
                address: '100 Primary Street',
                phone: '246-555-0100',
                email: 'primary@test.edu.bb',
                principal_name: 'Principal A',
                zone_id: 1,
                parish_id: 1,
                is_active: true
            }),
            School.create({
                name: 'Test Secondary School B',
                school_code: 'TSSB001',
                school_type: 'Secondary',
                address: '200 Secondary Street',
                phone: '246-555-0200',
                email: 'secondary@test.edu.bb',
                principal_name: 'Principal B',
                zone_id: 2,
                parish_id: 2,
                is_active: true
            })
        ]);
        
        schools.forEach(school => this.createdIds.schools.push(school.id));
        
        // Create students for different schools
        const students = await Promise.all([
            Student.create({
                student_id: 'STU001',
                user_id: this.testUsers.student.id,
                school_id: schools[0].id,
                first_name: 'Student',
                last_name: 'One',
                date_of_birth: new Date('2010-01-01'),
                gender: 'M',
                grade_level: '5',
                enrollment_date: new Date(),
                is_active: true
            }),
            Student.create({
                student_id: 'STU002',
                user_id: null, // Student without user account
                school_id: schools[1].id,
                first_name: 'Student',
                last_name: 'Two',
                date_of_birth: new Date('2008-01-01'),
                gender: 'F',
                grade_level: '8',
                enrollment_date: new Date(),
                is_active: true
            })
        ]);
        
        students.forEach(student => this.createdIds.students.push(student.id));
        
        this.testSchools = {
            primary: schools[0],
            secondary: schools[1]
        };
        
        this.testStudents = {
            withUser: students[0],
            withoutUser: students[1]
        };
        
        return {
            schools: this.testSchools,
            students: this.testStudents
        };
    }

    /**
     * Clean up test data
     */
    async cleanup() {
        const transaction = await sequelize.transaction();
        
        try {
            // Delete in reverse order to respect foreign key constraints
            if (this.createdIds.students.length > 0) {
                await Student.destroy({
                    where: { id: this.createdIds.students },
                    transaction
                });
            }
            
            if (this.createdIds.staff.length > 0) {
                await Staff.destroy({
                    where: { id: this.createdIds.staff },
                    transaction
                });
            }
            
            if (this.createdIds.parents.length > 0) {
                await Parent.destroy({
                    where: { id: this.createdIds.parents },
                    transaction
                });
            }
            
            if (this.createdIds.users.length > 0) {
                await User.destroy({
                    where: { id: this.createdIds.users },
                    transaction
                });
            }
            
            if (this.createdIds.schools.length > 0) {
                await School.destroy({
                    where: { id: this.createdIds.schools },
                    transaction
                });
            }
            
            await transaction.commit();
            
            // Reset tracking
            this.createdIds = {
                users: [],
                schools: [],
                students: [],
                staff: [],
                parents: []
            };
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Validate API response structure
     */
    validateApiResponse(response, expectedStatus = 200) {
        expect(response.status).toBe(expectedStatus);
        expect(response.body).toBeDefined();
        
        if (response.body.error) {
            expect(response.body.error).toEqual(expect.any(String));
        }
        
        if (response.body.data) {
            expect(response.body.data).toBeDefined();
        }
        
        return response.body;
    }

    /**
     * Validate error response structure
     */
    validateErrorResponse(response, expectedStatus, expectedErrorCode = null) {
        expect(response.status).toBe(expectedStatus);
        expect(response.body).toBeDefined();
        expect(response.body.error).toBeDefined();
        
        if (expectedErrorCode) {
            expect(response.body.code).toBe(expectedErrorCode);
        }
        
        return response.body;
    }

    /**
     * Validate user data structure
     */
    validateUserData(userData, role = null) {
        expect(userData).toHaveProperty('id');
        expect(userData).toHaveProperty('email');
        expect(userData).toHaveProperty('role');
        expect(userData).toHaveProperty('first_name');
        expect(userData).toHaveProperty('last_name');
        expect(userData).toHaveProperty('is_active');
        
        // Should not expose password hash
        expect(userData).not.toHaveProperty('password_hash');
        
        if (role) {
            expect(userData.role).toBe(role);
        }
        
        return userData;
    }

    /**
     * Validate school data structure
     */
    validateSchoolData(schoolData) {
        expect(schoolData).toHaveProperty('id');
        expect(schoolData).toHaveProperty('name');
        expect(schoolData).toHaveProperty('school_code');
        expect(schoolData).toHaveProperty('school_type');
        expect(schoolData).toHaveProperty('address');
        expect(schoolData).toHaveProperty('phone');
        expect(schoolData).toHaveProperty('email');
        expect(schoolData).toHaveProperty('principal_name');
        
        return schoolData;
    }

    /**
     * Validate student data structure
     */
    validateStudentData(studentData) {
        expect(studentData).toHaveProperty('id');
        expect(studentData).toHaveProperty('student_id');
        expect(studentData).toHaveProperty('first_name');
        expect(studentData).toHaveProperty('last_name');
        expect(studentData).toHaveProperty('date_of_birth');
        expect(studentData).toHaveProperty('gender');
        expect(studentData).toHaveProperty('grade_level');
        expect(studentData).toHaveProperty('school_id');
        expect(studentData).toHaveProperty('is_active');
        
        return studentData;
    }

    /**
     * Generate test performance metrics
     */
    generatePerformanceMetrics(testName, startTime, endTime, requestCount = 1) {
        const duration = endTime - startTime;
        const avgResponseTime = duration / requestCount;
        
        return {
            test_name: testName,
            duration_ms: duration,
            request_count: requestCount,
            avg_response_time_ms: avgResponseTime,
            requests_per_second: Math.round((requestCount / duration) * 1000),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Test rate limiting
     */
    async testRateLimit(request, endpoint, authHeader, limit = 100) {
        const requests = [];
        const startTime = Date.now();
        
        for (let i = 0; i < limit + 10; i++) {
            const req = request
                .get(endpoint)
                .set('Authorization', authHeader);
            
            requests.push(req);
        }
        
        const responses = await Promise.all(requests.map(req => 
            req.then(res => ({ status: res.status, body: res.body }))
               .catch(err => ({ status: err.status || 500, error: err.message }))
        ));
        
        const endTime = Date.now();
        const successful = responses.filter(r => r.status < 400).length;
        const rateLimited = responses.filter(r => r.status === 429).length;
        
        return {
            total_requests: limit + 10,
            successful_requests: successful,
            rate_limited_requests: rateLimited,
            duration_ms: endTime - startTime,
            performance: this.generatePerformanceMetrics('rate_limit_test', startTime, endTime, limit + 10)
        };
    }
}

module.exports = TestHelpers;