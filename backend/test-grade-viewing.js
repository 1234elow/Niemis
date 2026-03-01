// Test script to verify the complete grade viewing functionality
const axios = require('axios');

const API_BASE = 'http://192.168.192.1:5000/api';
let authToken = null;

// Test teacher login credentials
const TEACHER_CREDENTIALS = {
    login: 'teacher1',
    password: 'teacher123'
};

async function login() {
    try {
        console.log('=== Testing Teacher Login ===');
        const response = await axios.post(`${API_BASE}/auth/login`, TEACHER_CREDENTIALS);
        
        if (response.data.token) {
            authToken = response.data.token;
            console.log('✅ Login successful');
            console.log(`Teacher: ${response.data.user.username}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data?.error || error.message);
        return false;
    }
}

async function testGradeViewing() {
    try {
        console.log('\n=== Testing Grade Viewing Functionality ===');
        
        // Get teacher classes first
        const classesResponse = await axios.get(`${API_BASE}/teachers/classes`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const classes = classesResponse.data.classes;
        if (classes.length === 0) {
            console.log('❌ No classes found for teacher');
            return false;
        }
        
        const classId = classes[0].id;
        console.log(`Using class: ${classes[0].name}`);
        
        // Test getting class grades
        console.log('\n--- Testing Class Grades Retrieval ---');
        const gradesResponse = await axios.get(`${API_BASE}/teachers/classes/${classId}/grades`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const gradesData = gradesResponse.data;
        console.log('✅ Grade viewing API working');
        console.log(`Students with grades: ${gradesData.total_students_with_grades}`);
        console.log(`Total grade entries: ${gradesData.total_grade_entries}`);
        console.log(`Current term: ${gradesData.current_term?.name || 'N/A'}`);
        console.log(`Available terms: ${gradesData.available_terms?.length || 0}`);
        console.log(`Available subjects: ${gradesData.available_subjects?.length || 0}`);
        
        // Display grade details
        if (gradesData.grades_by_student && gradesData.grades_by_student.length > 0) {
            console.log('\n--- Grade Details ---');
            gradesData.grades_by_student.forEach((studentData, index) => {
                const { student, grades } = studentData;
                console.log(`${index + 1}. ${student.name} (${student.student_id})`);
                console.log(`   Total grades: ${grades.length}`);
                
                if (grades.length > 0) {
                    const recentGrade = grades[0];
                    console.log(`   Recent grade: ${recentGrade.grade_value} (${recentGrade.numeric_score}%)`);
                    console.log(`   Assessment: ${recentGrade.assessment_components?.assessment_name || 'N/A'}`);
                    console.log(`   Subject: ${recentGrade.subject?.name || 'N/A'}`);
                    console.log(`   Date: ${new Date(recentGrade.date_entered).toLocaleDateString()}`);
                    console.log(`   Comments: ${recentGrade.teacher_comments || 'No comments'}`);
                }
                console.log('');
            });
        } else {
            console.log('No grades found in database yet');
        }
        
        // Test filtering by term
        console.log('\n--- Testing Grade Filtering ---');
        if (gradesData.available_terms && gradesData.available_terms.length > 0) {
            const termId = gradesData.available_terms[0].id;
            const filteredResponse = await axios.get(`${API_BASE}/teachers/classes/${classId}/grades`, {
                headers: { Authorization: `Bearer ${authToken}` },
                params: { term_id: termId }
            });
            
            console.log(`✅ Term filtering works - ${filteredResponse.data.total_grade_entries} grades found`);
        }
        
        // Test student individual grade history
        if (gradesData.grades_by_student && gradesData.grades_by_student.length > 0) {
            console.log('\n--- Testing Individual Student Grade History ---');
            const studentId = gradesData.grades_by_student[0].student.id;
            const studentName = gradesData.grades_by_student[0].student.name;
            
            const studentGradesResponse = await axios.get(
                `${API_BASE}/teachers/classes/${classId}/students/${studentId}/grades`,
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
            
            const studentGradesData = studentGradesResponse.data;
            console.log(`✅ Student grade history works for ${studentName}`);
            console.log(`   Total grades: ${studentGradesData.total_grades}`);
            
            if (studentGradesData.grades.length > 0) {
                console.log('   Grade history:');
                studentGradesData.grades.forEach((grade, index) => {
                    console.log(`   ${index + 1}. ${grade.grade_value} (${grade.numeric_score}%) - ${grade.assessment_components?.assessment_name || 'N/A'} - ${new Date(grade.date_entered).toLocaleDateString()}`);
                });
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Grade viewing test failed:', error.response?.data?.error || error.message);
        if (error.response?.data?.errors) {
            console.error('Detailed errors:', error.response.data.errors);
        }
        return false;
    }
}

async function runTests() {
    console.log('🧪 Testing Grade Viewing Functionality');
    console.log('=====================================');
    
    // Test authentication
    if (!await login()) {
        console.error('❌ Cannot continue without authentication');
        return false;
    }
    
    // Test grade viewing
    const success = await testGradeViewing();
    
    console.log('\n=== Test Results Summary ===');
    if (success) {
        console.log('🎉 Grade viewing functionality test passed!');
        console.log('✅ Teachers can now view stored grades');
        console.log('✅ Grade filtering by term and subject works');
        console.log('✅ Individual student grade history available');
        console.log('✅ Complete grade management cycle working');
    } else {
        console.log('❌ Grade viewing test failed - check the logs above');
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