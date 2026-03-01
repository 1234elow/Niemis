const { sequelize } = require('./config/database');
const models = require('./models');

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database schema...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Create all tables based on models
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Database tables created/updated successfully');
    
    // List all tables to verify
    console.log('\n📋 Checking database tables:');
    const tables = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
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
        WHERE table_name = 'grades' 
        ORDER BY ordinal_position
      `, { type: sequelize.QueryTypes.SELECT });
      
      console.table(columns);
    } else {
      console.log('❌ Grades table not found');
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('\n✅ Database setup completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase };