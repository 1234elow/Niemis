const { sequelize } = require('./config/database');

async function addMissingColumns() {
    try {
        // Add parish column with enum type
        await sequelize.query(`
            ALTER TABLE school_system.schools 
            ADD COLUMN IF NOT EXISTS parish VARCHAR(20);
        `);
        console.log('✅ parish column added successfully');
        
        // Add other missing columns that may be needed
        await sequelize.query(`
            ALTER TABLE school_system.schools 
            ADD COLUMN IF NOT EXISTS last_enrollment_update DATE;
        `);
        console.log('✅ last_enrollment_update column added successfully');
        
        // Add the indexes
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_schools_parish 
            ON school_system.schools (parish);
        `);
        console.log('✅ Index on parish added successfully');
        
        // Show current table structure
        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'school_system' 
            AND table_name = 'schools' 
            ORDER BY ordinal_position;
        `);
        
        console.log('\\n📋 Current schools table structure:');
        results.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });
        
    } catch (error) {
        console.error('❌ Error adding missing columns:', error.message);
    } finally {
        await sequelize.close();
    }
}

addMissingColumns();