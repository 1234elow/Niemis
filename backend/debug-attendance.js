// Debug script to test attendance functionality specifically
const axios = require('axios');

const API_BASE = 'http://192.168.192.1:5000/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3YzQ1YzVkLTA4ODgtNDMzNS05NjZmLWNmNTk0Mjg5ODNkNSIsInVzZXJuYW1lIjoidGVhY2hlcjEiLCJyb2xlIjoidGVhY2hlciIsImlhdCI6MTc1NDkxOTYxOCwianRpIjoiM2JiMTBiODg5NTViNTc1NWFmMGQ3NzI1ZWEyZjMyMmEiLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU1MDA2MDE4LCJhdWQiOiJuaWVtaXMtY2xpZW50cyIsImlzcyI6Im5pZW1pcy1iYWNrZW5kIn0.imZqOe4TEnj7Yr63bVI4GBdN9CQi-Kl6WkYihB6E2Gg';

async function debugAttendance() {
    try {
        console.log('=== Getting Teacher Classes ===');
        
        // Get teacher classes
        const classesResponse = await axios.get(`${API_BASE}/teachers/classes`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        
        const classes = classesResponse.data.classes;
        console.log(`Found ${classes.length} classes`);
        
        if (classes.length === 0) {
            console.log('No classes found');
            return;
        }
        
        const classId = classes[0].id;
        console.log(`Using class: ${classId} - ${classes[0].name}`);
        
        console.log('\n=== Getting Students ===');
        
        // Get students in class
        const studentsResponse = await axios.get(`${API_BASE}/teachers/classes/${classId}/students`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        
        const students = studentsResponse.data.students;
        console.log(`Found ${students.length} students`);
        
        if (students.length === 0) {
            console.log('No students found in class');
            return;
        }
        
        const student = students[0];
        console.log(`Using student: ${student.id} - ${student.first_name} ${student.last_name}`);
        
        console.log('\n=== Testing Attendance Submission ===');
        
        const attendancePayload = {
            attendance_date: '2025-08-11',
            attendance_time: '08:00',
            notes: 'Debug test attendance',
            attendance_records: [
                {
                    student_id: student.id,
                    status: 'present',
                    arrival_time: '08:00',
                    notes: 'On time for debug test'
                }
            ]
        };
        
        console.log('Payload:', JSON.stringify(attendancePayload, null, 2));
        
        const attendanceResponse = await axios.post(
            `${API_BASE}/teachers/classes/${classId}/attendance`,
            attendancePayload,
            { 
                headers: { 
                    Authorization: `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                } 
            }
        );
        
        console.log('\n=== Attendance Response ===');
        console.log(JSON.stringify(attendanceResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        if (error.response?.data?.errors) {
            console.error('Detailed errors:', error.response.data.errors);
        }
    }
}

debugAttendance();