const { sequelize } = require('./config/database');

async function clearDemoUsers() {
    try {
        // Delete existing demo users and students
        await sequelize.query(`
            DELETE FROM school_system.students 
            WHERE student_id LIKE 'STU-ALX-%' OR student_id LIKE 'STU-ALL-%';
        `);
        console.log('✅ Demo students cleared');

        await sequelize.query(`
            DELETE FROM school_system.users 
            WHERE username LIKE 'alex_student%' OR username LIKE 'alleyne_student%';
        `);
        console.log('✅ Demo users cleared');

        console.log('✅ All demo data cleared successfully');
        
    } catch (error) {
        console.error('❌ Error clearing demo data:', error.message);
    } finally {
        await sequelize.close();
    }
}

clearDemoUsers();