const { Staff, School, User, Class } = require('./models');
const bcrypt = require('bcryptjs');

async function createDemoTeachers() {
    try {
        console.log('🔄 Creating demo teacher accounts...');
        
        // Get some schools to assign teachers to
        const schools = await School.findAll({ 
            limit: 3,
            where: { is_active: true }
        });
        console.log(`Found ${schools.length} schools`);
        
        if (schools.length === 0) {
            console.log('❌ No schools found. Please import schools first.');
            return;
        }
        
        // Demo teachers data with login credentials
        const demoTeachers = [
            {
                // User account
                username: 'teacher1',
                email: 'teacher1@education.gov.bb',
                password: 'teacher123',
                role: 'teacher',
                
                // Staff details
                employee_id: 'TCH001',
                first_name: 'Sarah',
                last_name: 'Johnson',
                date_of_birth: '1985-03-15',
                gender: 'female',
                phone: '246-123-4567',
                address: 'Bridgetown, Barbados',
                position: 'Mathematics Teacher',
                role_level: 'teacher',
                department: 'Mathematics',
                hire_date: '2020-08-01',
                salary: 45000.00,
                qualifications: 'Bachelor of Science in Mathematics Education',
                certifications: 'Certified Mathematics Teacher',
                school_id: schools[0].id
            },
            {
                // User account
                username: 'teacher2',
                email: 'teacher2@education.gov.bb',
                password: 'teacher123',
                role: 'teacher',
                
                // Staff details
                employee_id: 'TCH002',
                first_name: 'Michael',
                last_name: 'Thompson',
                date_of_birth: '1982-07-22',
                gender: 'male',
                phone: '246-234-5678',
                address: 'Oistins, Barbados',
                position: 'English Teacher',
                role_level: 'teacher',
                department: 'English Language Arts',
                hire_date: '2018-09-01',
                salary: 48000.00,
                qualifications: 'Master of Arts in English Literature',
                certifications: 'Certified English Teacher',
                school_id: schools[1 % schools.length].id
            },
            {
                // User account
                username: 'teacher3',
                email: 'teacher3@education.gov.bb',
                password: 'teacher123',
                role: 'teacher',
                
                // Staff details
                employee_id: 'TCH003',
                first_name: 'Patricia',
                last_name: 'Williams',
                date_of_birth: '1979-11-08',
                gender: 'female',
                phone: '246-345-6789',
                address: 'Speightstown, Barbados',
                position: 'Science Teacher',
                role_level: 'teacher',
                department: 'Natural Sciences',
                hire_date: '2015-01-15',
                salary: 52000.00,
                qualifications: 'Bachelor of Science in Biology',
                certifications: 'Certified Science Teacher',
                school_id: schools[2 % schools.length].id
            }
        ];
        
        const createdTeachers = [];
        
        // Create teachers with user accounts
        for (const teacherData of demoTeachers) {
            // Check if user already exists
            const existingUser = await User.findOne({
                where: { 
                    email: teacherData.email
                }
            });
            
            if (existingUser) {
                console.log(`⚠️  Teacher ${teacherData.username} already exists, skipping...`);
                continue;
            }
            
            // Create user account
            const hashedPassword = await bcrypt.hash(teacherData.password, 10);
            
            const user = await User.create({
                username: teacherData.username,
                email: teacherData.email,
                password_hash: hashedPassword,
                role: teacherData.role,
                is_active: true
            });
            
            // Create staff record
            const staff = await Staff.create({
                user_id: user.id,
                school_id: teacherData.school_id,
                employee_id: teacherData.employee_id,
                first_name: teacherData.first_name,
                last_name: teacherData.last_name,
                date_of_birth: teacherData.date_of_birth,
                gender: teacherData.gender,
                phone: teacherData.phone,
                address: teacherData.address,
                position: teacherData.position,
                role_level: teacherData.role_level,
                department: teacherData.department,
                hire_date: teacherData.hire_date,
                salary: teacherData.salary,
                qualifications: teacherData.qualifications,
                certifications: teacherData.certifications,
                is_active: true
            });
            
            // Create demo classes for each teacher
            const demoClasses = [
                {
                    name: `${teacherData.department} - Primary`,
                    grade_level: 'Class 5',
                    section: 'A',
                    school_id: teacherData.school_id,
                    class_teacher_id: staff.id,
                    capacity: 25,
                    current_enrollment: 22,
                    school_year: '2024-2025',
                    is_active: true
                },
                {
                    name: `${teacherData.department} - Advanced`,
                    grade_level: 'Form 3',
                    section: 'B',
                    school_id: teacherData.school_id,
                    class_teacher_id: staff.id,
                    capacity: 30,
                    current_enrollment: 28,
                    school_year: '2024-2025',
                    is_active: true
                }
            ];
            
            for (const classData of demoClasses) {
                await Class.create(classData);
            }
            
            createdTeachers.push({
                user: user,
                staff: staff,
                school: schools.find(s => s.id === teacherData.school_id),
                credentials: {
                    username: teacherData.username,
                    password: teacherData.password
                }
            });
            
            console.log(`✅ Created teacher: ${teacherData.first_name} ${teacherData.last_name} (${teacherData.username})`);
        }
        
        console.log('\n🎉 Demo teacher creation completed!');
        console.log('\n📋 Login Credentials:');
        console.log('═══════════════════════');
        
        createdTeachers.forEach((teacher) => {
            console.log(`👤 ${teacher.staff.first_name} ${teacher.staff.last_name}`);
            console.log(`   Username: ${teacher.credentials.username}`);
            console.log(`   Password: ${teacher.credentials.password}`);
            console.log(`   Position: ${teacher.staff.position}`);
            console.log(`   School: ${teacher.school.name}`);
            console.log('');
        });
        
        console.log('🔐 Teachers can log in with username and password');
        console.log('📚 Each teacher has 2 demo classes assigned');
        console.log('🎯 Teachers will see their personalized dashboard upon login');
        
    } catch (error) {
        console.error('❌ Error creating demo teachers:', error);
    }
}

// Run the function
createDemoTeachers()
    .then(() => {
        console.log('✅ Demo teachers creation completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });