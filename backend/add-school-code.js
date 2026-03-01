const { sequelize } = require('./config/database');

async function addSchoolCodeColumn() {
    try {
        await sequelize.query(`
            ALTER TABLE school_system.schools 
            ADD COLUMN IF NOT EXISTS school_code VARCHAR(20) UNIQUE;
        `);
        console.log('✅ school_code column added successfully');
        
        // Also add the index if it doesn't exist
        await sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_school_code 
            ON school_system.schools (school_code);
        `);
        console.log('✅ Index on school_code added successfully');
        
    } catch (error) {
        console.error('❌ Error adding school_code column:', error.message);
    } finally {
        await sequelize.close();
    }
}

addSchoolCodeColumn();