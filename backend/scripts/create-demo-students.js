const { sequelize } = require('../config/database');
const { User, Student, School, Parish } = require('../models');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

/**
 * Production-ready script for creating demo student accounts
 * Creates test students for Alexandra and Alleyne secondary schools
 */
class DemoStudentCreator {
    constructor() {
        this.demoResults = {
            success: false,
            students_created: 0,
            users_created: 0,
            errors: [],
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Main function to create demo students
     */
    async createDemoStudents() {
        const transaction = await sequelize.transaction();
        
        try {
            logger.info('Starting demo student creation...');
            
            // Validate database connection
            await this.validateDatabaseConnection();
            
            // Find target schools
            const schools = await this.findTargetSchools(transaction);
            
            // Create demo students for each school
            await this.createStudentsForSchools(schools, transaction);
            
            await transaction.commit();
            this.demoResults.success = true;
            
            logger.info('Demo student creation completed successfully:', this.demoResults);
            return this.demoResults;
            
        } catch (error) {
            await transaction.rollback();
            this.demoResults.errors.push(error.message);
            logger.error('Demo student creation failed:', error);
            throw error;
        }
    }

    /**
     * Validate database connection and required tables
     */
    async validateDatabaseConnection() {
        try {
            await sequelize.authenticate();
            logger.info('Database connection established successfully');
            
            // Check if required tables exist
            const [results] = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('users', 'students', 'schools')
            `);
            
            if (results.length < 3) {
                throw new Error('Required tables (users, students, schools) not found. Run migrations first.');
            }
            
            logger.info('Required database tables validated');
            
        } catch (error) {
            logger.error('Database validation failed:', error);
            throw new Error(`Database validation failed: ${error.message}`);
        }
    }

    /**
     * Find target schools for demo student creation
     */
    async findTargetSchools(transaction) {
        const targetSchoolNames = [
            'Alexandra Secondary School',
            'Alleyne Secondary School',
            'Harrison College',
            'Queen\'s College',
            'Combermere School'
        ];
        
        const schools = await School.findAll({
            where: {
                name: {
                    [sequelize.Op.in]: targetSchoolNames
                },
                is_active: true
            },
            transaction
        });
        
        if (schools.length === 0) {
            throw new Error('Target schools not found. Import schools first.');
        }
        
        logger.info(`Found ${schools.length} target schools for demo student creation`);
        return schools;
    }

    /**
     * Create demo students for specified schools
     */
    async createStudentsForSchools(schools, transaction) {
        const studentsPerSchool = 5;
        const gradelevels = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6L', 'Form 6U'];
        
        for (const school of schools) {
            logger.info(`Creating demo students for ${school.name}...`);
            
            for (let i = 1; i <= studentsPerSchool; i++) {
                try {
                    const studentData = this.generateStudentData(school, i, gradelevels);
                    await this.createStudentWithUser(studentData, transaction);
                    
                } catch (error) {
                    logger.warn(`Error creating student ${i} for ${school.name}:`, error.message);
                    this.demoResults.errors.push(`${school.name} Student ${i}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Generate student data
     */
    generateStudentData(school, studentNumber, gradelevels) {
        const firstNames = ['John', 'Mary', 'David', 'Sarah', 'Michael', 'Lisa', 'Robert', 'Emma', 'James', 'Ashley'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore'];
        
        const firstName = firstNames[studentNumber % firstNames.length];
        const lastName = lastNames[Math.floor(studentNumber / firstNames.length) % lastNames.length];
        const gradeLevel = gradelevels[studentNumber % gradelevels.length];
        
        // Generate unique student ID
        const schoolCode = school.school_code || school.name.substring(0, 3).toUpperCase();
        const studentId = `${schoolCode}-${String(studentNumber).padStart(4, '0')}`;
        
        // Generate birth date (14-18 years old)
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - 14 - (studentNumber % 5);
        const birthMonth = Math.floor(Math.random() * 12) + 1;
        const birthDay = Math.floor(Math.random() * 28) + 1;
        const dateOfBirth = new Date(birthYear, birthMonth - 1, birthDay);
        
        // Generate enrollment date (within last 2 years)
        const enrollmentYear = currentYear - (studentNumber % 2);
        const enrollmentMonth = 8; // Start of school year
        const enrollmentDate = new Date(enrollmentYear, enrollmentMonth, 1);
        
        return {
            school_id: school.id,
            student_id: studentId,
            first_name: firstName,
            last_name: lastName,
            date_of_birth: dateOfBirth,
            gender: studentNumber % 2 === 0 ? 'Male' : 'Female',
            grade_level: gradeLevel,
            class_section: `${gradeLevel}A`,
            enrollment_date: enrollmentDate,
            is_active: true,
            // Generate username and email
            username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${studentNumber}`,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${studentNumber}@student.niemis.bb`,
            address: `${studentNumber} Demo Street, Barbados`,
            phone: `246-${String(Math.floor(Math.random() * 9000000) + 1000000)}`
        };
    }

    /**
     * Create student with associated user account
     */
    async createStudentWithUser(studentData, transaction) {
        // Create user account
        const hashedPassword = await bcrypt.hash('DemoPassword123!', 12);
        
        const user = await User.create({
            username: studentData.username,
            email: studentData.email,
            password_hash: hashedPassword,
            role: 'student',
            is_active: true
        }, { transaction });
        
        this.demoResults.users_created++;
        
        // Create student profile
        const student = await Student.create({
            user_id: user.id,
            school_id: studentData.school_id,
            student_id: studentData.student_id,
            first_name: studentData.first_name,
            last_name: studentData.last_name,
            date_of_birth: studentData.date_of_birth,
            gender: studentData.gender,
            grade_level: studentData.grade_level,
            class_section: studentData.class_section,
            enrollment_date: studentData.enrollment_date,
            address: studentData.address,
            phone: studentData.phone,
            email: studentData.email,
            is_active: true
        }, { transaction });
        
        this.demoResults.students_created++;
        
        logger.info(`Created demo student: ${studentData.first_name} ${studentData.last_name} (${studentData.student_id})`);
        
        return { user, student };
    }

    /**
     * Create admin user for testing
     */
    async createAdminUser(transaction) {
        try {
            const adminExists = await User.findOne({
                where: { username: 'admin' },
                transaction
            });
            
            if (adminExists) {
                logger.info('Admin user already exists');
                return adminExists;
            }
            
            const hashedPassword = await bcrypt.hash('AdminPassword123!', 12);
            
            const adminUser = await User.create({
                username: 'admin',
                email: 'admin@niemis.bb',
                password_hash: hashedPassword,
                role: 'super_admin',
                is_active: true
            }, { transaction });
            
            logger.info('Created admin user: admin@niemis.bb');
            return adminUser;
            
        } catch (error) {
            logger.error('Error creating admin user:', error);
            throw error;
        }
    }

    /**
     * Generate demo creation report
     */
    generateDemoReport() {
        const report = {
            ...this.demoResults,
            breakdown: {
                success_rate: this.demoResults.students_created > 0 
                    ? ((this.demoResults.students_created / (this.demoResults.students_created + this.demoResults.errors.length)) * 100).toFixed(2) + '%'
                    : '0%',
                error_count: this.demoResults.errors.length,
                duration: new Date() - new Date(this.demoResults.timestamp)
            },
            credentials: {
                student_login: {
                    note: 'Use any created student email and password: DemoPassword123!',
                    example: 'john.smith1@student.niemis.bb / DemoPassword123!'
                },
                admin_login: {
                    username: 'admin',
                    email: 'admin@niemis.bb',
                    password: 'AdminPassword123!'
                }
            }
        };
        
        return report;
    }
}

/**
 * CLI execution function
 */
async function runDemoCreation() {
    const creator = new DemoStudentCreator();
    
    try {
        const transaction = await sequelize.transaction();
        
        // Create admin user first
        await creator.createAdminUser(transaction);
        
        // Create demo students
        const results = await creator.createDemoStudents();
        
        await transaction.commit();
        
        console.log('✅ Demo student creation completed successfully!');
        console.log(JSON.stringify(creator.generateDemoReport(), null, 2));
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Demo creation failed:', error.message);
        console.log(JSON.stringify(creator.generateDemoReport(), null, 2));
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Run if called directly
if (require.main === module) {
    runDemoCreation();
}

module.exports = DemoStudentCreator;