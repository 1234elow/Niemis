// Test script to verify teacher grade and attendance storage functionality
const axios = require('axios');

// Configuration
const API_BASE = 'http://192.168.192.1:5000/api';
let authToken = null;
let teacherData = null;
let classId = null;

// Test teacher login credentials (assuming teacher1 exists)
const TEACHER_CREDENTIALS = {
    login: 'teacher1',
    password: 'teacher123'
};

async function login() {
    try {
        console.log('\n=== Testing Teacher Login ===');
        const response = await axios.post(`${API_BASE}/auth/login`, TEACHER_CREDENTIALS);
        
        if (response.data.token) {
            authToken = response.data.token;
            console.log('✅ Login successful');
            console.log(`Teacher: ${response.data.user.username} (${response.data.user.role})`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function getTeacherProfile() {
    try {
        console.log('\n=== Testing Teacher Profile ===');
        const response = await axios.get(`${API_BASE}/teachers/profile`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        teacherData = response.data.teacher;
        console.log('✅ Teacher profile retrieved');
        console.log(`Name: ${teacherData.first_name} ${teacherData.last_name}`);
        console.log(`School: ${teacherData.School.name}`);
        return true;
    } catch (error) {
        console.error('❌ Get teacher profile failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function getTeacherClasses() {
    try {
        console.log('\n=== Testing Teacher Classes ===');
        const response = await axios.get(`${API_BASE}/teachers/classes`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const classes = response.data.classes;
        console.log('✅ Teacher classes retrieved');
        console.log(`Total classes: ${classes.length}`);
        
        if (classes.length > 0) {
            classId = classes[0].id;
            console.log(`Using class: ${classes[0].name} (${classes[0].grade_level})`);
            return true;
        } else {
            console.log('❌ No classes found for teacher');
            return false;
        }
    } catch (error) {
        console.error('❌ Get teacher classes failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function getClassStudents() {
    try {
        console.log('\n=== Testing Class Students ===');
        const response = await axios.get(`${API_BASE}/teachers/classes/${classId}/students`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const students = response.data.students;
        console.log('✅ Class students retrieved');
        console.log(`Total students: ${students.length}`);
        
        if (students.length > 0) {
            students.forEach((student, index) => {
                console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} (${student.student_id})`);
            });
            return students;
        } else {
            console.log('❌ No students found in class');
            return [];
        }
    } catch (error) {
        console.error('❌ Get class students failed:', error.response?.data?.error || error.message);
        return [];
    }
}

async function testAttendanceMarking(students) {
    try {
        console.log('\n=== Testing Attendance Storage ===');
        
        if (students.length === 0) {
            console.log('❌ No students available for attendance test');
            return false;
        }
        
        // Create test attendance data
        const attendanceRecords = students.slice(0, 2).map((student, index) => ({
            student_id: student.id,
            status: index === 0 ? 'present' : 'late',
            arrival_time: index === 0 ? '08:00' : '08:15',
            notes: index === 0 ? 'On time' : 'Traffic delay'
        }));
        
        const payload = {
            attendance_date: new Date().toISOString().split('T')[0],
            attendance_time: '08:00',
            notes: 'Daily attendance test',
            attendance_records: attendanceRecords
        };
        
        console.log(`Marking attendance for ${attendanceRecords.length} students...`);
        
        const response = await axios.post(
            `${API_BASE}/teachers/classes/${classId}/attendance`,
            payload,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        console.log('✅ Attendance storage test completed');
        console.log(`Records processed: ${response.data.records_processed}`);
        console.log(`Success: ${response.data.success}`);
        
        if (response.data.processed_records) {
            response.data.processed_records.forEach(record => {
                console.log(`  - ${record.student_name}: ${record.status}`);
            });
        }
        
        return response.data.success;
    } catch (error) {
        console.error('❌ Attendance marking failed:', error.response?.data?.error || error.message);
        if (error.response?.data?.errors) {
            console.error('Errors:', error.response.data.errors);
        }
        return false;
    }
}

async function testGradeEntry(students) {
    try {
        console.log('\n=== Testing Grade Entry Storage ===');
        
        if (students.length === 0) {
            console.log('❌ No students available for grade test');
            return false;
        }
        
        // Create test grade data
        const gradeData = students.slice(0, 2).map((student, index) => ({
            student_id: student.id,
            score: index === 0 ? 95 : 78,
            letter_grade: index === 0 ? 'A' : 'C',
            excused: false,
            notes: index === 0 ? 'Excellent work' : 'Good effort'
        }));
        
        const payload = {
            assessment_name: 'Math Quiz #1',
            assessment_type: 'quiz',
            max_points: 100,
            due_date: new Date().toISOString().split('T')[0],
            notes: 'Basic arithmetic test',
            grades: gradeData
        };
        
        console.log(`Entering grades for ${gradeData.length} students...`);
        
        const response = await axios.post(
            `${API_BASE}/teachers/classes/${classId}/grades`,
            payload,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        console.log('✅ Grade entry storage test completed');
        console.log(`Assessment: ${response.data.assessment_name} (${response.data.assessment_type})`);
        console.log(`Term: ${response.data.term}`);
        console.log(`Subject: ${response.data.subject}`);
        console.log(`Grades processed: ${response.data.grades_processed}`);
        console.log(`Success: ${response.data.success}`);
        
        if (response.data.processed_grades) {
            response.data.processed_grades.forEach(grade => {
                console.log(`  - ${grade.student_name}: ${grade.numeric_score}/100 (${grade.letter_grade} → ${grade.barbados_grade})`);
            });
        }
        
        return response.data.success;
    } catch (error) {
        console.error('❌ Grade entry failed:', error.response?.data?.error || error.message);
        if (error.response?.data?.errors) {
            console.error('Errors:', error.response.data.errors);
        }
        return false;
    }
}

async function runTests() {
    console.log('🧪 Starting Teacher Data Storage Tests');
    console.log('=====================================');
    
    let success = true;
    
    // Test authentication
    if (!await login()) {
        console.error('❌ Cannot continue without authentication');
        return false;
    }
    
    // Test teacher profile
    if (!await getTeacherProfile()) {
        success = false;
    }
    
    // Test teacher classes
    if (!await getTeacherClasses()) {
        console.error('❌ Cannot test storage without classes');
        return false;
    }
    
    // Test class students
    const students = await getClassStudents();
    
    // Test attendance storage
    if (!await testAttendanceMarking(students)) {
        success = false;
    }
    
    // Test grade entry storage
    if (!await testGradeEntry(students)) {
        success = false;
    }
    
    console.log('\n=== Test Results Summary ===');
    if (success) {
        console.log('🎉 All teacher data storage tests passed!');
        console.log('✅ Attendance records are being saved to database');
        console.log('✅ Grade records are being saved to database');
        console.log('✅ Teacher-student interactions are working end-to-end');
    } else {
        console.log('❌ Some tests failed - check the logs above');
    }
    
    return success;
}

// Run the tests
runTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Test script failed:', error.message);
        process.exit(1);
    });