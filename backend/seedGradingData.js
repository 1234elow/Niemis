const { sequelize, Subject, Class, Term, Grade, ReportCard, Student, Staff, School, Parent, StudentParentRelationship, StudentHealth, FamilySocialAssessment, DisabilityAssessment, User } = require('./models');
const bcrypt = require('bcryptjs');

// Sample data for comprehensive student profiles
const sampleData = {
    subjects: [
        { name: 'Language Arts', code: 'LA', description: 'Reading readiness, letter recognition, basic phonics', grade_levels: ['Infants A', 'Infants B'] },
        { name: 'Mathematics', code: 'MATH', description: 'Number recognition, counting, basic arithmetic', grade_levels: ['Infants A', 'Infants B'] },
        { name: 'Science', code: 'SCI', description: 'Nature study, basic observations, simple experiments', grade_levels: ['Infants A', 'Infants B'] },
        { name: 'Social Studies', code: 'SS', description: 'Community helpers, family units, cultural awareness', grade_levels: ['Infants A', 'Infants B'] },
        { name: 'Creative Arts', code: 'ART', description: 'Drawing, coloring, simple crafts, creative expression', grade_levels: ['Infants A', 'Infants B'] },
        { name: 'Physical Education', code: 'PE', description: 'Motor skills, coordination, physical fitness', grade_levels: ['Infants A', 'Infants B'] },
        { name: 'Music', code: 'MUS', description: 'Singing, rhythm, simple instruments, musical appreciation', grade_levels: ['Infants A', 'Infants B'] },
        { name: 'Character Education', code: 'CE', description: 'Sharing, manners, social skills, values', grade_levels: ['Infants A', 'Infants B'] }
    ],

    terms: [
        { name: 'Term 1', school_year: '2024-2025', term_number: 1, start_date: '2024-09-01', end_date: '2024-11-30', is_current: false },
        { name: 'Term 2', school_year: '2024-2025', term_number: 2, start_date: '2025-01-08', end_date: '2025-03-28', is_current: true },
        { name: 'Term 3', school_year: '2024-2025', term_number: 3, start_date: '2025-04-14', end_date: '2025-06-27', is_current: false }
    ],

    infantsAStudents: [
        { firstName: 'Aaliyah', lastName: 'Beckles', dob: '2020-03-15', gender: 'female', address: '12 Sunset Drive, Worthing, Christ Church', phone: '246-234-5678' },
        { firstName: 'Jamal', lastName: 'Blackman', dob: '2020-05-22', gender: 'male', address: '45 Palm Avenue, Oistins, Christ Church', phone: '246-345-6789' },
        { firstName: 'Kaia', lastName: 'Clarke', dob: '2020-02-08', gender: 'female', address: '78 Sea View Road, Dover, Christ Church', phone: '246-456-7890' },
        { firstName: 'Marcus', lastName: 'Drakes', dob: '2020-04-12', gender: 'male', address: '23 Coconut Lane, Maxwell, Christ Church', phone: '246-567-8901' },
        { firstName: 'Zara', lastName: 'Edwards', dob: '2020-01-30', gender: 'female', address: '56 Harmony Heights, Enterprise, Christ Church', phone: '246-678-9012' },
        { firstName: 'Liam', lastName: 'Forde', dob: '2020-06-18', gender: 'male', address: '34 Bougainvillea Court, Hastings, Christ Church', phone: '246-789-0123' },
        { firstName: 'Maya', lastName: 'Grant', dob: '2020-03-25', gender: 'female', address: '67 Hibiscus Street, Rockley, Christ Church', phone: '246-890-1234' },
        { firstName: 'Noah', lastName: 'Harper', dob: '2020-05-10', gender: 'male', address: '89 Frangipani Road, Rendezvous, Christ Church', phone: '246-901-2345' },
        { firstName: 'Aria', lastName: 'Jones', dob: '2020-02-14', gender: 'female', address: '12 Paradise View, Silver Sands, Christ Church', phone: '246-012-3456' },
        { firstName: 'Kai', lastName: 'King', dob: '2020-04-28', gender: 'male', address: '45 Ocean Breeze, Inch Marlow, Christ Church', phone: '246-123-4567' },
        { firstName: 'Leah', lastName: 'Lewis', dob: '2020-01-16', gender: 'female', address: '78 Tropical Gardens, Welches, Christ Church', phone: '246-234-5678' },
        { firstName: 'Ethan', lastName: 'Mitchell', dob: '2020-06-03', gender: 'male', address: '23 Coral Reef Drive, Worthing, Christ Church', phone: '246-345-6789' },
        { firstName: 'Sophia', lastName: 'Nurse', dob: '2020-03-07', gender: 'female', address: '56 Bamboo Heights, Oistins, Christ Church', phone: '246-456-7890' },
        { firstName: 'Caleb', lastName: 'Phillips', dob: '2020-05-20', gender: 'male', address: '34 Mahogany Lane, Dover, Christ Church', phone: '246-567-8901' },
        { firstName: 'Amara', lastName: 'Roberts', dob: '2020-02-26', gender: 'female', address: '67 Sunset Hills, Maxwell, Christ Church', phone: '246-678-9012' },
        { firstName: 'Aiden', lastName: 'Smith', dob: '2020-04-15', gender: 'male', address: '89 Caribbean Close, Enterprise, Christ Church', phone: '246-789-0123' },
        { firstName: 'Isla', lastName: 'Taylor', dob: '2020-01-09', gender: 'female', address: '12 Seagrape Avenue, Hastings, Christ Church', phone: '246-890-1234' },
        { firstName: 'Mason', lastName: 'Williams', dob: '2020-06-11', gender: 'male', address: '45 Almond Tree Court, Rockley, Christ Church', phone: '246-901-2345' },
        { firstName: 'Luna', lastName: 'Young', dob: '2020-03-19', gender: 'female', address: '78 Poinciana Place, Rendezvous, Christ Church', phone: '246-012-3456' },
        { firstName: 'Owen', lastName: 'Bourne', dob: '2020-05-05', gender: 'male', address: '23 Flamboyant Street, Silver Sands, Christ Church', phone: '246-123-4567' }
    ],

    infantsBStudents: [
        { firstName: 'Ava', lastName: 'Best', dob: '2019-08-12', gender: 'female', address: '34 Mango Grove, Inch Marlow, Christ Church', phone: '246-234-5678' },
        { firstName: 'Elijah', lastName: 'Braithwaite', dob: '2019-09-24', gender: 'male', address: '67 Breadfruit Lane, Welches, Christ Church', phone: '246-345-6789' },
        { firstName: 'Grace', lastName: 'Cumberbatch', dob: '2019-07-18', gender: 'female', address: '89 Tamarind Heights, Worthing, Christ Church', phone: '246-456-7890' },
        { firstName: 'Isaac', lastName: 'Durant', dob: '2019-10-06', gender: 'male', address: '12 Guinep Gardens, Oistins, Christ Church', phone: '246-567-8901' },
        { firstName: 'Olivia', lastName: 'Estwick', dob: '2019-08-30', gender: 'female', address: '45 Soursop Street, Dover, Christ Church', phone: '246-678-9012' },
        { firstName: 'Lucas', lastName: 'Fields', dob: '2019-11-14', gender: 'male', address: '78 Papaya Place, Maxwell, Christ Church', phone: '246-789-0123' },
        { firstName: 'Emma', lastName: 'Greenidge', dob: '2019-07-22', gender: 'female', address: '23 Cashew Court, Enterprise, Christ Church', phone: '246-890-1234' },
        { firstName: 'Carter', lastName: 'Hall', dob: '2019-09-08', gender: 'male', address: '56 Avocado Avenue, Hastings, Christ Church', phone: '246-901-2345' },
        { firstName: 'Isabella', lastName: 'Inniss', dob: '2019-08-16', gender: 'female', address: '34 Lime Tree Lane, Rockley, Christ Church', phone: '246-012-3456' },
        { firstName: 'Jackson', lastName: 'Jordan', dob: '2019-10-28', gender: 'male', address: '67 Orange Blossom, Rendezvous, Christ Church', phone: '246-123-4567' },
        { firstName: 'Madison', lastName: 'Knight', dob: '2019-07-10', gender: 'female', address: '89 Grapefruit Grove, Silver Sands, Christ Church', phone: '246-234-5678' },
        { firstName: 'Logan', lastName: 'Layne', dob: '2019-09-19', gender: 'male', address: '12 Coconut Creek, Inch Marlow, Christ Church', phone: '246-345-6789' },
        { firstName: 'Mia', lastName: 'Mayers', dob: '2019-08-03', gender: 'female', address: '45 Palm Paradise, Welches, Christ Church', phone: '246-456-7890' },
        { firstName: 'Alexander', lastName: 'Newton', dob: '2019-11-07', gender: 'male', address: '78 Tropical Terrace, Worthing, Christ Church', phone: '246-567-8901' },
        { firstName: 'Charlotte', lastName: 'Oneal', dob: '2019-07-25', gender: 'female', address: '23 Bajan Breeze, Oistins, Christ Church', phone: '246-678-9012' },
        { firstName: 'Benjamin', lastName: 'Parris', dob: '2019-09-12', gender: 'male', address: '56 Island View, Dover, Christ Church', phone: '246-789-0123' },
        { firstName: 'Abigail', lastName: 'Reece', dob: '2019-08-28', gender: 'female', address: '34 Coral Gardens, Maxwell, Christ Church', phone: '246-890-1234' },
        { firstName: 'Henry', lastName: 'Springer', dob: '2019-10-15', gender: 'male', address: '67 Sunset Shores, Enterprise, Christ Church', phone: '246-901-2345' },
        { firstName: 'Harper', lastName: 'Thompson', dob: '2019-07-30', gender: 'female', address: '89 Paradise Point, Hastings, Christ Church', phone: '246-012-3456' },
        { firstName: 'Sebastian', lastName: 'Walcott', dob: '2019-09-26', gender: 'male', address: '12 Caribbean Vista, Rockley, Christ Church', phone: '246-123-4567' }
    ],

    healthConditions: [
        { condition: 'Asthma', severity: 'mild', medication: 'Ventolin inhaler as needed' },
        { condition: 'Food allergies', severity: 'moderate', medication: 'EpiPen, avoid nuts and shellfish' },
        { condition: 'Eczema', severity: 'mild', medication: 'Moisturizing cream twice daily' },
        { condition: 'None', severity: null, medication: 'None' },
        { condition: 'Lactose intolerance', severity: 'mild', medication: 'Lactose-free milk products' },
        { condition: 'Attention concerns', severity: 'mild', medication: 'Behavioral strategies, shorter tasks' }
    ],

    parentOccupations: [
        'Teacher', 'Nurse', 'Police Officer', 'Shop Assistant', 'Bus Driver', 'Accountant', 
        'Chef', 'Mechanic', 'Hair Stylist', 'Construction Worker', 'Bank Teller', 'Farmer',
        'Tourist Guide', 'Hotel Staff', 'Security Guard', 'Electrician', 'Seamstress', 'Fisherman'
    ]
};

async function seedGradingData() {
    try {
        console.log('Starting comprehensive grading data seeding...');

        // First, get or create Christ Church Foundation School
        const [school] = await School.findOrCreate({
            where: { name: 'Christ Church Foundation School' },
            defaults: {
                name: 'Christ Church Foundation School',
                school_type: 'primary',
                address: '123 School Street, Christ Church, Barbados',
                phone: '246-428-1234',
                email: 'info@ccfs.edu.bb',
                principal_name: 'Mrs. Sandra Clarke',
                capacity: 500,
                is_active: true
            }
        });

        console.log('Found school:', school.name);

        // Create subjects
        console.log('Creating subjects...');
        const subjects = [];
        for (const subjectData of sampleData.subjects) {
            const [subject] = await Subject.findOrCreate({
                where: { code: subjectData.code },
                defaults: subjectData
            });
            subjects.push(subject);
        }
        console.log(`Created ${subjects.length} subjects`);

        // Create terms
        console.log('Creating terms...');
        const terms = [];
        for (const termData of sampleData.terms) {
            const [term] = await Term.findOrCreate({
                where: { 
                    name: termData.name,
                    school_year: termData.school_year
                },
                defaults: termData
            });
            terms.push(term);
        }
        console.log(`Created ${terms.length} terms`);

        // Get current term
        const currentTerm = terms.find(t => t.is_current);

        // Create teachers
        console.log('Creating teachers...');
        const teacher1 = await createTeacher(school.id, 'Sarah', 'Thompson', 'sarah.thompson@ccfs.edu.bb');
        const teacher2 = await createTeacher(school.id, 'Michelle', 'Roberts', 'michelle.roberts@ccfs.edu.bb');
        
        // Create classes
        console.log('Creating classes...');
        const [infantsA] = await Class.findOrCreate({
            where: { 
                school_id: school.id,
                name: 'Infants A',
                grade_level: 'Infants A'
            },
            defaults: {
                school_id: school.id,
                name: 'Infants A',
                grade_level: 'Infants A',
                section: 'A',
                class_teacher_id: teacher1.id,
                school_year: '2024-2025',
                capacity: 20,
                current_enrollment: 20
            }
        });

        const [infantsB] = await Class.findOrCreate({
            where: { 
                school_id: school.id,
                name: 'Infants B',
                grade_level: 'Infants B'
            },
            defaults: {
                school_id: school.id,
                name: 'Infants B',
                grade_level: 'Infants B',
                section: 'B',
                class_teacher_id: teacher2.id,
                school_year: '2024-2025',
                capacity: 20,
                current_enrollment: 20
            }
        });

        console.log('Created classes: Infants A and Infants B');

        // Create students with comprehensive profiles
        console.log('Creating Infants A students...');
        await createStudentsWithProfiles(sampleData.infantsAStudents, school.id, infantsA.id, 'Infants A');
        
        console.log('Creating Infants B students...');
        await createStudentsWithProfiles(sampleData.infantsBStudents, school.id, infantsB.id, 'Infants B');

        // Create grades for all students
        console.log('Creating grades for all students...');
        await createGradesForAllStudents(subjects, currentTerm, [teacher1, teacher2]);

        // Create report cards
        console.log('Creating report cards...');
        await createReportCards(currentTerm);

        console.log('Grading data seeding completed successfully!');
        return { success: true, message: 'All grading data created successfully' };

    } catch (error) {
        console.error('Error seeding grading data:', error);
        throw error;
    }
}

async function createTeacher(schoolId, firstName, lastName, email) {
    // Create user account
    const password_hash = await bcrypt.hash('teacher123', 12);
    const [user] = await User.findOrCreate({
        where: { email },
        defaults: {
            username: email.split('@')[0],
            email,
            password_hash,
            role: 'teacher'
        }
    });

    // Create staff record
    const [staff] = await Staff.findOrCreate({
        where: { user_id: user.id },
        defaults: {
            user_id: user.id,
            school_id: schoolId,
            employee_id: `CCFS-T-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            first_name: firstName,
            last_name: lastName,
            position: 'Class Teacher',
            department: 'Early Childhood',
            hire_date: '2023-09-01',
            employment_status: 'active',
            qualification: "Bachelor's in Early Childhood Education",
            experience_years: 5
        }
    });

    return staff;
}

async function createStudentsWithProfiles(studentsData, schoolId, classId, gradeLevel) {
    for (let i = 0; i < studentsData.length; i++) {
        const studentData = studentsData[i];
        const studentIdCode = gradeLevel === 'Infants A' ? 
            `CCFS-IA-${(i + 1).toString().padStart(3, '0')}` : 
            `CCFS-IB-${(i + 1).toString().padStart(3, '0')}`;

        // Create user account for student
        const password_hash = await bcrypt.hash('student123', 12);
        const username = `${studentData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}${studentData.lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}${i + 1}`;
        const email = `${username}@student.ccfs.edu.bb`;

        const [user] = await User.findOrCreate({
            where: { username },
            defaults: {
                username,
                email,
                password_hash,
                role: 'student'
            }
        });

        // Create student record
        const [student] = await Student.findOrCreate({
            where: { student_id: studentIdCode },
            defaults: {
                user_id: user.id,
                school_id: schoolId,
                class_id: classId,
                student_id: studentIdCode,
                first_name: studentData.firstName,
                last_name: studentData.lastName,
                date_of_birth: studentData.dob,
                gender: studentData.gender,
                address: studentData.address,
                phone: studentData.phone,
                email: email,
                rfid_tag: `RFID-${studentIdCode}`,
                enrollment_date: '2024-09-01',
                grade_level: gradeLevel,
                class_section: gradeLevel === 'Infants A' ? 'A' : 'B',
                is_active: true
            }
        });

        // Create health record
        const healthCondition = sampleData.healthConditions[i % sampleData.healthConditions.length];
        await StudentHealth.findOrCreate({
            where: { student_id: student.id },
            defaults: {
                student_id: student.id,
                medical_conditions: healthCondition.condition,
                allergies: healthCondition.condition === 'Food allergies' ? 'Nuts, shellfish' : 'None',
                medications: healthCondition.medication,
                immunization_records: {
                    BCG: '2020-01-15',
                    DPT: '2020-03-20',
                    MMR: '2021-01-15',
                    Polio: '2020-05-10'
                },
                emergency_contact_name: `Emergency Contact for ${studentData.firstName}`,
                emergency_contact_phone: studentData.phone,
                blood_type: ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'][i % 8],
                doctor_name: 'Dr. Johnson Medical Centre',
                doctor_phone: '246-434-5678',
                last_physical_exam: '2024-08-15'
            }
        });

        // Create parents
        await createParentsForStudent(student, studentData, i);

        // Create family social assessment
        await FamilySocialAssessment.findOrCreate({
            where: { student_id: student.id },
            defaults: {
                student_id: student.id,
                household_income_range: ['Under $25,000', '$25,000-$50,000', '$50,000-$75,000', '$75,000+'][i % 4],
                housing_type: ['Owned home', 'Rented apartment', 'Rented house', 'Family home'][i % 4],
                number_of_dependents: Math.floor(Math.random() * 3) + 2,
                single_parent_household: i % 5 === 0,
                foster_care: false,
                homeless: false,
                has_electricity: true,
                has_internet: i % 3 !== 0,
                food_insecurity_level: 'Low',
                free_meal_eligible: i % 4 === 0,
                social_worker_assigned: false,
                assessment_date: '2024-09-01'
            }
        });

        // Create disability assessment if needed (5% of students)
        if (i % 20 === 0) {
            await DisabilityAssessment.findOrCreate({
                where: { student_id: student.id },
                defaults: {
                    student_id: student.id,
                    disability_type: 'Learning support needs',
                    severity_level: 'mild',
                    accommodations_needed: 'Extra time for activities, visual aids, smaller group work',
                    support_services: 'Speech therapy, occupational therapy',
                    iep_status: true,
                    assessment_date: '2024-08-01',
                    next_review_date: '2025-02-01'
                }
            });
        }
    }
}

async function createTeacher(schoolId, firstName, lastName, email) {
    const username = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    const [teacherUser] = await User.findOrCreate({
        where: { email },
        defaults: {
            username,
            email,
            password_hash: await bcrypt.hash('teacher123', 12),
            role: 'teacher'
        }
    });

    const [teacher] = await Staff.findOrCreate({
        where: { user_id: teacherUser.id },
        defaults: {
            user_id: teacherUser.id,
            school_id: schoolId,
            first_name: firstName,
            last_name: lastName,
            email,
            phone: '246-234-5678',
            position: 'Teacher',
            department: 'Primary',
            qualification: 'Bachelor of Education',
            hire_date: '2020-09-01',
            employee_id: `TCHR${Date.now()}`,
            is_active: true
        }
    });

    return teacher;
}

async function createParentsForStudent(student, studentData, index) {
    const motherOccupation = sampleData.parentOccupations[index % sampleData.parentOccupations.length];
    const fatherOccupation = sampleData.parentOccupations[(index + 1) % sampleData.parentOccupations.length];

    // Create mother
    const motherEmail = `${studentData.firstName.toLowerCase()}.mother${index}@parent.ccfs.edu.bb`;
    const [motherUser] = await User.findOrCreate({
        where: { email: motherEmail },
        defaults: {
            username: `${studentData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}mother${index}`,
            email: motherEmail,
            password_hash: await bcrypt.hash('parent123', 12),
            role: 'parent'
        }
    });

    const [mother] = await Parent.findOrCreate({
        where: { user_id: motherUser.id },
        defaults: {
            user_id: motherUser.id,
            first_name: `${studentData.firstName}'s`,
            last_name: `Mother ${studentData.lastName}`,
            relationship: 'Mother',
            phone: studentData.phone,
            email: motherEmail,
            address: studentData.address,
            occupation: motherOccupation,
            education_level: ['Primary', 'Secondary', 'Tertiary', 'Vocational'][index % 4],
            is_emergency_contact: true
        }
    });

    // Create father
    const fatherEmail = `${studentData.firstName.toLowerCase()}.father${index}@parent.ccfs.edu.bb`;
    const [fatherUser] = await User.findOrCreate({
        where: { email: fatherEmail },
        defaults: {
            username: `${studentData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}father${index}`,
            email: fatherEmail,
            password_hash: await bcrypt.hash('parent123', 12),
            role: 'parent'
        }
    });

    const [father] = await Parent.findOrCreate({
        where: { user_id: fatherUser.id },
        defaults: {
            user_id: fatherUser.id,
            first_name: `${studentData.firstName}'s`,
            last_name: `Father ${studentData.lastName}`,
            relationship: 'Father',
            phone: studentData.phone.replace(studentData.phone.slice(-4), String(Math.floor(Math.random() * 10000)).padStart(4, '0')),
            email: fatherEmail,
            address: studentData.address,
            occupation: fatherOccupation,
            education_level: ['Primary', 'Secondary', 'Tertiary', 'Vocational'][index % 4],
            is_emergency_contact: false
        }
    });

    // Create relationships
    await StudentParentRelationship.findOrCreate({
        where: { student_id: student.id, parent_id: mother.id },
        defaults: {
            student_id: student.id,
            parent_id: mother.id,
            relationship_type: 'Mother',
            is_primary: true
        }
    });

    await StudentParentRelationship.findOrCreate({
        where: { student_id: student.id, parent_id: father.id },
        defaults: {
            student_id: student.id,
            parent_id: father.id,
            relationship_type: 'Father',
            is_primary: false
        }
    });
}

async function createGradesForAllStudents(subjects, currentTerm, teachers) {
    // Get all students
    const allStudents = await Student.findAll({
        where: { is_active: true },
        include: [{ model: Class }]
    });

    console.log(`Creating grades for ${allStudents.length} students across ${subjects.length} subjects`);

    for (const student of allStudents) {
        for (const subject of subjects) {
            const teacher = student.Class.class_teacher_id === teachers[0].id ? teachers[0] : teachers[1];
            
            // Generate realistic grades for infant level
            const gradeValues = ['E', 'G', 'S', 'N'];
            const weights = [0.3, 0.4, 0.25, 0.05]; // 30% E, 40% G, 25% S, 5% N
            
            const gradeValue = getWeightedRandomGrade(gradeValues, weights);
            const effortGrade = getWeightedRandomGrade(gradeValues, [0.4, 0.4, 0.15, 0.05]);
            const behaviorGrade = getWeightedRandomGrade(gradeValues, [0.5, 0.35, 0.12, 0.03]);

            const comments = generateTeacherComment(student.first_name, subject.name, gradeValue);

            await Grade.findOrCreate({
                where: {
                    student_id: student.id,
                    subject_id: subject.id,
                    term_id: currentTerm.id
                },
                defaults: {
                    student_id: student.id,
                    subject_id: subject.id,
                    class_id: student.class_id,
                    term_id: currentTerm.id,
                    teacher_id: teacher.id,
                    grade_value: gradeValue,
                    numeric_score: getNumericScore(gradeValue),
                    effort_grade: effortGrade,
                    behavior_grade: behaviorGrade,
                    teacher_comments: comments,
                    assessment_components: {
                        classwork: getNumericScore(gradeValue) + Math.random() * 10 - 5,
                        participation: getNumericScore(effortGrade),
                        projects: getNumericScore(gradeValue) + Math.random() * 8 - 4,
                        observation: getNumericScore(behaviorGrade)
                    },
                    is_final: true
                }
            });
        }
    }
}

function getWeightedRandomGrade(grades, weights) {
    const random = Math.random();
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (random < sum) return grades[i];
    }
    return grades[grades.length - 1];
}

function getNumericScore(grade) {
    switch (grade) {
        case 'E': return 85 + Math.random() * 15; // 85-100
        case 'G': return 70 + Math.random() * 15; // 70-85
        case 'S': return 60 + Math.random() * 10; // 60-70
        case 'N': return 40 + Math.random() * 20; // 40-60
        default: return 75;
    }
}

function generateTeacherComment(studentName, subject, grade) {
    const comments = {
        'Language Arts': {
            'E': `${studentName} excels in letter recognition and shows excellent phonetic awareness. Demonstrates strong pre-reading skills.`,
            'G': `${studentName} is making good progress with letter sounds and enjoys story time. Shows interest in books and writing.`,
            'S': `${studentName} is developing letter recognition skills. Continues to work on listening skills during story time.`,
            'N': `${studentName} needs additional support with letter recognition. Requires more practice with fine motor skills for writing.`
        },
        'Mathematics': {
            'E': `${studentName} demonstrates excellent number recognition and counting skills. Shows strong mathematical thinking.`,
            'G': `${studentName} counts confidently to 20 and recognizes most numbers. Good understanding of basic math concepts.`,
            'S': `${studentName} is working on number recognition and counting. Making steady progress with one-to-one correspondence.`,
            'N': `${studentName} needs more practice with number recognition and counting. Requires additional support with basic concepts.`
        },
        'Science': {
            'E': `${studentName} shows excellent curiosity about nature and asks thoughtful questions during science activities.`,
            'G': `${studentName} enjoys science experiments and makes good observations about the world around them.`,
            'S': `${studentName} participates in science activities and is learning to make simple observations.`,
            'N': `${studentName} needs encouragement to participate in science activities and express observations.`
        },
        'Social Studies': {
            'E': `${studentName} demonstrates excellent understanding of community helpers and family relationships.`,
            'G': `${studentName} shows good knowledge of community helpers and enjoys learning about different cultures.`,
            'S': `${studentName} is learning about community helpers and family structures. Shows interest in social topics.`,
            'N': `${studentName} needs support understanding community roles and relationships.`
        },
        'Creative Arts': {
            'E': `${studentName} shows exceptional creativity and fine motor skills in art activities. Takes pride in their work.`,
            'G': `${studentName} enjoys art activities and creates beautiful work. Shows good imagination and creativity.`,
            'S': `${studentName} participates in art activities and is developing fine motor skills through creative work.`,
            'N': `${studentName} needs encouragement to participate in art activities and develop fine motor skills.`
        },
        'Physical Education': {
            'E': `${studentName} demonstrates excellent gross motor skills and enthusiastically participates in all physical activities.`,
            'G': `${studentName} shows good coordination and enjoys physical activities. Follows instructions well.`,
            'S': `${studentName} participates in physical activities and is developing gross motor skills.`,
            'N': `${studentName} needs support with gross motor development and following PE instructions.`
        },
        'Music': {
            'E': `${studentName} shows excellent rhythm and pitch awareness. Enthusiastically participates in singing and music activities.`,
            'G': `${studentName} enjoys music time and participates well in singing and rhythm activities.`,
            'S': `${studentName} participates in music activities and is developing listening skills.`,
            'N': `${studentName} needs encouragement to participate in music activities and develop listening skills.`
        },
        'Character Education': {
            'E': `${studentName} demonstrates excellent social skills and consistently shows kindness and respect to others.`,
            'G': `${studentName} shows good social skills and usually makes positive choices in interactions with peers.`,
            'S': `${studentName} is learning appropriate social skills and making progress with sharing and cooperation.`,
            'N': `${studentName} needs support developing social skills and making positive choices in peer interactions.`
        }
    };

    return comments[subject] ? comments[subject][grade] : `${studentName} is making progress in ${subject}.`;
}

async function createReportCards(currentTerm) {
    // Get all students with their grades
    const students = await Student.findAll({
        where: { is_active: true },
        include: [
            { 
                model: Grade, 
                where: { term_id: currentTerm.id },
                include: [{ model: Subject }]
            },
            { model: Class }
        ]
    });

    for (const student of students) {
        // Calculate overall grades
        const grades = student.Grades;
        const gradeValues = grades.map(g => g.grade_value);
        const effortValues = grades.map(g => g.effort_grade);
        const behaviorValues = grades.map(g => g.behavior_grade);

        const overallGrade = calculateOverallGrade(gradeValues);
        const overallEffort = calculateOverallGrade(effortValues);
        const overallBehavior = calculateOverallGrade(behaviorValues);

        // Generate attendance data (mock)
        const daysPresent = 45 + Math.floor(Math.random() * 10);
        const daysAbsent = 5 - Math.floor(Math.random() * 5);
        const daysLate = Math.floor(Math.random() * 3);
        const attendancePercentage = ((daysPresent / (daysPresent + daysAbsent)) * 100).toFixed(1);

        await ReportCard.findOrCreate({
            where: {
                student_id: student.id,
                term_id: currentTerm.id
            },
            defaults: {
                student_id: student.id,
                class_id: student.class_id,
                term_id: currentTerm.id,
                overall_grade: overallGrade,
                overall_effort: overallEffort,
                overall_behavior: overallBehavior,
                attendance_days_present: daysPresent,
                attendance_days_absent: daysAbsent,
                attendance_days_late: daysLate,
                attendance_percentage: parseFloat(attendancePercentage),
                class_teacher_comments: generateClassTeacherComment(student.first_name, overallGrade),
                principal_comments: generatePrincipalComment(student.first_name, overallGrade, overallBehavior),
                health_notes: generateHealthNotes(student.first_name),
                social_emotional_notes: generateSocialEmotionalNotes(student.first_name, overallBehavior),
                next_term_goals: generateNextTermGoals(student.first_name, overallGrade),
                is_final: true
            }
        });
    }
}

function calculateOverallGrade(grades) {
    const gradePoints = { 'E': 4, 'G': 3, 'S': 2, 'N': 1 };
    const totalPoints = grades.reduce((sum, grade) => sum + gradePoints[grade], 0);
    const average = totalPoints / grades.length;
    
    if (average >= 3.5) return 'E';
    if (average >= 2.5) return 'G';
    if (average >= 1.5) return 'S';
    return 'N';
}

function generateClassTeacherComment(studentName, overallGrade) {
    const comments = {
        'E': `${studentName} has had an outstanding term and consistently demonstrates excellence across all subject areas. They show strong leadership qualities and are always eager to help classmates. Their positive attitude and enthusiasm for learning make them a joy to teach.`,
        'G': `${studentName} has had a very good term and shows solid understanding across most subject areas. They participate well in class activities and demonstrate good effort in their work. With continued support, they will continue to thrive.`,
        'S': `${studentName} has made satisfactory progress this term. They are developing confidence in various subject areas and with continued encouragement will continue to grow. Their effort is appreciated and they are becoming more independent.`,
        'N': `${studentName} has faced some challenges this term but has shown improvement with additional support. We will continue to work together to help them reach their full potential. Their perseverance is commendable.`
    };
    return comments[overallGrade];
}

function generatePrincipalComment(studentName, overallGrade, behaviorGrade) {
    const comments = {
        'E': `${studentName} is a wonderful addition to our school community. Their excellent academic performance is matched by their outstanding character and social skills. They consistently demonstrate our school values and are a positive role model for their peers.`,
        'G': `${studentName} has shown good progress this term and demonstrates positive character traits. They are developing into a confident learner and contribute positively to our school community. We are proud of their achievements.`,
        'S': `${studentName} is making steady progress and showing growth in both academic and social areas. With continued support from home and school, they will continue to develop confidence and skills. We value their contribution to our school community.`,
        'N': `${studentName} has worked hard this term despite facing some challenges. We appreciate their effort and determination. With continued collaboration between home and school, we are confident they will continue to make progress.`
    };
    return comments[overallGrade];
}

function generateHealthNotes(studentName) {
    const notes = [
        `${studentName} has maintained good health throughout the term with no significant concerns.`,
        `${studentName} has successfully managed their health needs with appropriate support.`,
        `${studentName} demonstrates good self-care habits and awareness of personal health needs.`,
        `${studentName} participates fully in all activities with necessary health accommodations in place.`
    ];
    return notes[Math.floor(Math.random() * notes.length)];
}

function generateSocialEmotionalNotes(studentName, behaviorGrade) {
    const notes = {
        'E': `${studentName} demonstrates excellent social and emotional maturity. They show empathy, kindness, and strong friendship skills.`,
        'G': `${studentName} shows good social skills and is developing emotional regulation. They interact well with peers and adults.`,
        'S': `${studentName} is developing social skills and learning to express emotions appropriately. They are making good progress.`,
        'N': `${studentName} needs support developing social skills and emotional regulation. We continue to work on these important areas.`
    };
    return notes[behaviorGrade];
}

function generateNextTermGoals(studentName, overallGrade) {
    const goals = {
        'E': `Continue to challenge ${studentName} with enrichment activities while maintaining their love of learning. Encourage peer mentoring opportunities.`,
        'G': `Build on ${studentName}'s strengths while providing targeted support in areas for growth. Continue to foster independence and confidence.`,
        'S': `Focus on building ${studentName}'s confidence and skills through differentiated instruction and positive reinforcement.`,
        'N': `Provide intensive support and encouragement to help ${studentName} build foundational skills and confidence.`
    };
    return goals[overallGrade];
}

module.exports = { seedGradingData };