const { sequelize } = require('./config/database');

async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully');
        
        // Test a simple query
        const result = await sequelize.query('SELECT COUNT(*) as count FROM information_schema.tables;');
        console.log('✅ Database query successful:', result[0][0]);
        
        await sequelize.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
    }
}

testConnection();