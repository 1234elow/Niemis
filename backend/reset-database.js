const { sequelize } = require('./config/database');

async function resetDatabase() {
  try {
    console.log('🔧 Resetting database schema...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Drop the entire schema and recreate it
    console.log('🗑️  Dropping existing schema...');
    await sequelize.query('DROP SCHEMA IF EXISTS school_system CASCADE');
    
    console.log('📦 Creating fresh schema...');
    await sequelize.query('CREATE SCHEMA school_system');
    
    // Now create all tables fresh using the models
    console.log('🔧 Creating tables from models...');
    await sequelize.sync({ force: true });
    
    console.log('✅ Database reset completed successfully');
    
    // Verify tables were created
    console.log('\n📋 Checking created tables:');
    const tables = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'school_system' 
      ORDER BY table_name
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.table(tables);
    
    // Check if grades table exists and show its structure  
    const gradesTableExists = tables.some(t => t.table_name === 'grades');
    
    if (gradesTableExists) {
      console.log('\n📊 Grades table structure:');
      const columns = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'grades' AND table_schema = 'school_system'
        ORDER BY ordinal_position
      `, { type: sequelize.QueryTypes.SELECT });
      
      console.table(columns);
      
      // Check the grade ENUM values
      console.log('\n📝 Grade ENUM values:');
      const enumValues = await sequelize.query(`
        SELECT t.typname, array_agg(e.enumlabel ORDER BY enumsortorder) as enum_values
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace 
        WHERE n.nspname = 'school_system' AND t.typname LIKE '%grade%'
        GROUP BY t.typname
      `, { type: sequelize.QueryTypes.SELECT });
      
      console.table(enumValues);
    }
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run reset if called directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('\n✅ Database reset completed successfully.');
      console.log('You can now run the grade migration if needed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Database reset failed:', error);
      process.exit(1);
    });
}

module.exports = { resetDatabase };