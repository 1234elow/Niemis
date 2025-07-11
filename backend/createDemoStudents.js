const bcrypt = require('bcryptjs');
const { sequelize } = require('./config/database');
const { User, Student, School } = require('./models');
const logger = require('./utils/logger');

/**
 * Create demo student accounts for testing the student dashboard
 */
async function createDemoStudents() {
    try {
        await sequelize.authenticate();
        logger.info('Database connected successfully');

        // Get the two secondary schools (Alexandra and Alleyne)
        const schools = await School.findAll({
            where: {
                school_category: 'secondary'
            },
            limit: 2,
            order: [['name', 'ASC']]
        });

        if (schools.length < 2) {
            throw new Error('Not enough secondary schools found in database');
        }

        const [school1, school2] = schools;
        console.log('Using schools:', school1.name, 'and', school2.name);

        // Create demo students for each school
        const demoStudents = [
            {
                // Student 1 - Alexandra School
                user: {
                    username: 'alex_student1',
                    email: 'alex.student1@student.gov.bb',
                    password: 'student123',
                    role: 'student'
                },
                student: {
                    school_id: school1.id,
                    student_id: 'STU-ALX-001',
                    first_name: 'Michael',
                    last_name: 'Johnson',
                    date_of_birth: '2006-03-15',
                    gender: 'male',
                    address: '123 Main Street, St. Peter, Barbados',
                    phone: '246-555-0001',
                    email: 'alex.student1@student.gov.bb',
                    grade_level: '4th Form',
                    class_section: 'A',
                    enrollment_date: '2023-09-01'
                }
            },
            {
                // Student 2 - Alexandra School
                user: {
                    username: 'alex_student2',
                    email: 'alex.student2@student.gov.bb',
                    password: 'student123',
                    role: 'student'
                },
                student: {
                    school_id: school1.id,
                    student_id: 'STU-ALX-002',
                    first_name: 'Sarah',
                    last_name: 'Williams',
                    date_of_birth: '2005-11-22',
                    gender: 'female',
                    address: '456 Oak Avenue, St. Peter, Barbados',
                    phone: '246-555-0002',
                    email: 'alex.student2@student.gov.bb',
                    grade_level: '5th Form',
                    class_section: 'B',
                    enrollment_date: '2022-09-01'
                }
            },
            {
                // Student 3 - Alleyne School
                user: {
                    username: 'alleyne_student1',
                    email: 'alleyne.student1@student.gov.bb',
                    password: 'student123',
                    role: 'student'
                },
                student: {
                    school_id: school2.id,
                    student_id: 'STU-ALL-001',
                    first_name: 'David',
                    last_name: 'Brown',
                    date_of_birth: '2006-07-10',
                    gender: 'male',
                    address: '789 Cedar Road, St. Andrew, Barbados',
                    phone: '246-555-0003',
                    email: 'alleyne.student1@student.gov.bb',
                    grade_level: '4th Form',
                    class_section: 'A',
                    enrollment_date: '2023-09-01'
                }
            },
            {
                // Student 4 - Alleyne School
                user: {
                    username: 'alleyne_student2',
                    email: 'alleyne.student2@student.gov.bb',
                    password: 'student123',
                    role: 'student'
                },
                student: {
                    school_id: school2.id,
                    student_id: 'STU-ALL-002',
                    first_name: 'Emma',
                    last_name: 'Davis',
                    date_of_birth: '2005-12-03',
                    gender: 'female',
                    address: '321 Pine Lane, St. Andrew, Barbados',
                    phone: '246-555-0004',
                    email: 'alleyne.student2@student.gov.bb',
                    grade_level: '5th Form',
                    class_section: 'C',
                    enrollment_date: '2022-09-01'
                }
            }
        ];

        // Create users and students
        const createdStudents = [];
        const saltRounds = 10;

        for (const demoStudent of demoStudents) {
            // Hash password
            const hashedPassword = await bcrypt.hash(demoStudent.user.password, saltRounds);

            // Create user account
            const user = await User.create({
                ...demoStudent.user,
                password_hash: hashedPassword
            });

            // Create student profile
            const student = await Student.create({
                ...demoStudent.student,
                user_id: user.id
            });

            createdStudents.push({
                user: user.dataValues,
                student: student.dataValues
            });

            logger.info(`Created demo student: ${demoStudent.student.first_name} ${demoStudent.student.last_name} (${demoStudent.user.username})`);
        }

        // Generate summary
        const summary = {
            success: true,
            created_students: createdStudents.length,
            schools_used: [
                { name: school1.name, id: school1.id, students: 2 },
                { name: school2.name, id: school2.id, students: 2 }
            ],
            login_credentials: demoStudents.map(ds => ({
                username: ds.user.username,
                email: ds.user.email,
                password: ds.user.password,
                school: ds.student.school_id === school1.id ? school1.name : school2.name
            }))
        };

        console.log('\n=== DEMO STUDENT ACCOUNTS CREATED ===');
        console.log('Login credentials for testing:');
        summary.login_credentials.forEach((cred, index) => {
            console.log(`${index + 1}. ${cred.username} | ${cred.email} | ${cred.password} | ${cred.school}`);
        });

        return summary;

    } catch (error) {
        logger.error('Error creating demo students:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Run the script
if (require.main === module) {
    createDemoStudents()
        .then(result => {
            console.log('Demo students created successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Failed to create demo students:', error);
            process.exit(1);
        });
}

module.exports = { createDemoStudents };