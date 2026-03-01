const jwt = require('jsonwebtoken');
require('dotenv').config();

// Test JWT token validation
const testToken = process.argv[2];

if (!testToken) {
    console.log('Usage: node test-jwt.js <token>');
    console.log('Example: node test-jwt.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
    process.exit(1);
}

console.log('JWT Secret:', process.env.JWT_SECRET);
console.log('Testing token:', testToken.substring(0, 50) + '...');

try {
    const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
    console.log('✅ Token is valid!');
    console.log('Decoded payload:', decoded);
} catch (error) {
    console.log('❌ Token is invalid!');
    console.log('Error:', error.message);
    
    // Try to decode without verification to see the payload
    try {
        const decoded = jwt.decode(testToken, { complete: true });
        console.log('Token header:', decoded.header);
        console.log('Token payload:', decoded.payload);
    } catch (decodeError) {
        console.log('Cannot decode token:', decodeError.message);
    }
}