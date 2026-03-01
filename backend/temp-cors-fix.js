// Temporary CORS fix for development
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Simple CORS configuration for development
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Initialize database connection
const { sequelize } = require('./models');

// Test database connection
sequelize.authenticate()
    .then(() => {
        console.log('Database connection successful');
    })
    .catch(err => {
        console.error('Database connection failed:', err.message);
    });

// Import and use auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Simple CORS server working' });
});

const PORT = 5002;
app.listen(PORT, () => {
    console.log(`Temporary CORS server running on port ${PORT}`);
    console.log('This is a simple server to test CORS issues');
    console.log('Try logging in through the frontend using port 5002 instead of 5000');
});

module.exports = app;