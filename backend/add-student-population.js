const { sequelize } = require('./config/database');

async function addStudentPopulation() {
    try {
        await sequelize.query(`
            ALTER TABLE school_system.schools 
            ADD COLUMN IF NOT EXISTS student_population INTEGER;
        `);
        console.log('✅ student_population column added successfully');
        
        // Add the index
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_schools_student_population 
            ON school_system.schools (student_population);
        `);
        console.log('✅ Index on student_population added successfully');
        
        // Add description column too
        await sequelize.query(`
            ALTER TABLE school_system.schools 
            ADD COLUMN IF NOT EXISTS description TEXT;
        `);
        console.log('✅ description column added successfully');
        
    } catch (error) {
        console.error('❌ Error adding student_population column:', error.message);
    } finally {
        await sequelize.close();
    }
}

addStudentPopulation();