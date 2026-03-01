const { sequelize } = require('./config/database');

async function checkStaffTable() {
    try {
        // Check the current columns in the staff table
        const [results] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'staff' AND table_schema = 'school_system'
            ORDER BY ordinal_position;
        `);
        
        console.log('Current columns in staff table:');
        results.forEach(col => {
            console.log(`- ${col.column_name} (${col.data_type}${col.is_nullable === 'YES' ? ', nullable' : ', not null'})`);
        });
        
        // Check if role_level exists
        const roleLevel = results.find(col => col.column_name === 'role_level');
        if (!roleLevel) {
            console.log('\n❌ role_level column is missing!');
            console.log('Please run this SQL in pgAdmin:');
            console.log('ALTER TABLE school_system.staff ADD COLUMN role_level VARCHAR(50) DEFAULT \'teacher\';');
        } else {
            console.log('\n✅ role_level column exists');
        }
        
    } catch (error) {
        console.error('Error checking staff table:', error);
    }
}

checkStaffTable()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });