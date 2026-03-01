const axios = require('axios');

async function testLogin() {
    try {
        console.log('Testing login with admin credentials...');
        
        const response = await axios.post('http://localhost:5000/api/auth/login', {
            login: 'admin',
            password: 'admin123'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Login successful!');
        console.log('Response:', response.data);
        
    } catch (error) {
        console.log('Login failed!');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data);
        console.log('Full error:', error.message);
        
        // Try with student credentials
        try {
            console.log('\nTesting login with student credentials...');
            
            const studentResponse = await axios.post('http://localhost:5000/api/auth/login', {
                login: 'student_demo',
                password: 'student123'
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Student login successful!');
            console.log('Response:', studentResponse.data);
            
        } catch (studentError) {
            console.log('Student login failed!');
            console.log('Status:', studentError.response?.status);
            console.log('Error:', studentError.response?.data);
        }
    }
}

testLogin();