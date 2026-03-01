const { sequelize } = require('./config/database');

async function addSchoolCategoryColumn() {
    try {
        await sequelize.query(`
            ALTER TABLE school_system.schools 
            ADD COLUMN IF NOT EXISTS school_category VARCHAR(20);
        `);
        console.log('✅ school_category column added successfully');
        
        // Add the index
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_schools_school_category 
            ON school_system.schools (school_category);
        `);
        console.log('✅ Index on school_category added successfully');
        
    } catch (error) {
        console.error('❌ Error adding school_category column:', error.message);
    } finally {
        await sequelize.close();
    }
}

addSchoolCategoryColumn();