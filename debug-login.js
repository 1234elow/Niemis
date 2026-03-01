// Debug script to test login issue
// Run this from Windows Command Prompt in the backend directory

const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Test endpoint to check if demo users exist
app.get('/debug/users', async (req, res) => {
    try {
        const { User } = require('./models');
        
        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'role', 'is_active', 'created_at'],
            limit: 10
        });
        
        res.json({
            count: users.length,
            users: users
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint to verify password
app.post('/debug/password', async (req, res) => {
    try {
        const { User } = require('./models');
        const { username, password } = req.body;
        
        const user = await User.findOne({
            where: { username }
        });
        
        if (!user) {
            return res.json({ found: false, message: 'User not found' });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        res.json({
            found: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_active: user.is_active
            },
            password_valid: isValid
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(5001, () => {
    console.log('Debug server running on port 5001');
    console.log('Test endpoints:');
    console.log('  GET  http://localhost:5001/debug/users');
    console.log('  POST http://localhost:5001/debug/password');
    console.log('');
    console.log('Example password test:');
    console.log('curl -X POST http://localhost:5001/debug/password \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"username": "admin", "password": "admin123"}\'');
});