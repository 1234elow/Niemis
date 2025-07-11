const { Sequelize } = require('sequelize');
require('dotenv').config();

console.log('Testing database connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment variables');
    process.exit(1);
}

console.log('\nTesting with connection URL...');

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

async function testConnection() {
    try {
        console.log('Attempting to connect to database...');
        await sequelize.authenticate();
        console.log('✅ Database connection successful!');
        
        // Test a simple query
        const result = await sequelize.query('SELECT version();');
        console.log('✅ PostgreSQL version:', result[0][0].version);
        
    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
        
        // Additional debugging for specific error types
        if (error.original) {
            console.error('Original error:', error.original);
        }
    } finally {
        await sequelize.close();
        console.log('Connection closed.');
    }
}

testConnection();