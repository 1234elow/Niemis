const { sequelize } = require('./config/database');

async function addStudentColumns() {
    try {
        // Add missing columns to students table
        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS user_id UUID;
        `);
        console.log('✅ user_id column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS student_id VARCHAR(20) UNIQUE;
        `);
        console.log('✅ student_id column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS first_name VARCHAR(50) NOT NULL DEFAULT '';
        `);
        console.log('✅ first_name column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS last_name VARCHAR(50) NOT NULL DEFAULT '';
        `);
        console.log('✅ last_name column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS date_of_birth DATE;
        `);
        console.log('✅ date_of_birth column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
        `);
        console.log('✅ gender column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS address TEXT;
        `);
        console.log('✅ address column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
        `);
        console.log('✅ phone column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS email VARCHAR(100);
        `);
        console.log('✅ email column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS rfid_tag VARCHAR(50) UNIQUE;
        `);
        console.log('✅ rfid_tag column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS enrollment_date DATE;
        `);
        console.log('✅ enrollment_date column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS grade_level VARCHAR(10);
        `);
        console.log('✅ grade_level column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS class_section VARCHAR(10);
        `);
        console.log('✅ class_section column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS class_id UUID;
        `);
        console.log('✅ class_id column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255);
        `);
        console.log('✅ photo_url column added successfully');

        await sequelize.query(`
            ALTER TABLE school_system.students 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
        `);
        console.log('✅ is_active column added successfully');

        // Add indexes
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_students_student_id 
            ON school_system.students (student_id);
        `);
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_students_school_id 
            ON school_system.students (school_id);
        `);
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_students_grade_level 
            ON school_system.students (grade_level);
        `);
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_students_rfid_tag 
            ON school_system.students (rfid_tag);
        `);
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_students_is_active 
            ON school_system.students (is_active);
        `);
        console.log('✅ All indexes added successfully');
        
        // Show current table structure
        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'school_system' 
            AND table_name = 'students' 
            ORDER BY ordinal_position;
        `);
        
        console.log('\\n📋 Current students table structure:');
        results.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });
        
    } catch (error) {
        console.error('❌ Error adding student columns:', error.message);
    } finally {
        await sequelize.close();
    }
}

addStudentColumns();