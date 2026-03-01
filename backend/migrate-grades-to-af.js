const { sequelize } = require('./config/database');
const { Grade } = require('./models');

/**
 * Migration Script: Convert E/G/S/N grades to A/B/C/D/F system
 * 
 * This script will:
 * 1. Check current grade distribution
 * 2. Convert existing grades from E/G/S/N to A/B/C/D/F
 * 3. Update database schema to support new grade values
 */

const gradeConversionMap = {
  'E': 'A',   // Excellent (90-100%) -> A (93-96%)
  'G': 'B',   // Good (80-89%) -> B (83-86%) 
  'S': 'C',   // Satisfactory (65-79%) -> C (73-76%)
  'N': 'D'    // Needs Improvement (0-64%) -> D (65-66%)
};

async function migrateGradingSystem() {
  try {
    console.log('🔄 Starting grading system migration from E/G/S/N to A/B/C/D/F...\n');
    
    // Step 1: Check current grade distribution
    console.log('📊 Current grade distribution:');
    const currentGrades = await sequelize.query(`
      SELECT grade_value, COUNT(*) as count 
      FROM grades 
      GROUP BY grade_value 
      ORDER BY grade_value
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.table(currentGrades);
    
    if (currentGrades.length === 0) {
      console.log('✅ No grades found in database. Migration not needed.');
      return;
    }
    
    // Step 2: Check if migration already completed
    const hasNewGrades = currentGrades.some(g => 
      ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'].includes(g.grade_value)
    );
    
    if (hasNewGrades) {
      console.log('✅ Database already contains A-F grades. Migration may have been completed.');
      console.log('Current grades in system:');
      console.table(currentGrades);
      return;
    }
    
    // Step 3: Perform migration in transaction
    await sequelize.transaction(async (transaction) => {
      console.log('🔧 Converting grades...');
      
      // Update grade_value
      for (const [oldGrade, newGrade] of Object.entries(gradeConversionMap)) {
        const result = await sequelize.query(`
          UPDATE grades 
          SET grade_value = :newGrade 
          WHERE grade_value = :oldGrade
        `, {
          replacements: { oldGrade, newGrade },
          type: sequelize.QueryTypes.UPDATE,
          transaction
        });
        
        console.log(`   ${oldGrade} -> ${newGrade}: ${result[1]} records updated`);
      }
      
      // Update effort_grade  
      for (const [oldGrade, newGrade] of Object.entries(gradeConversionMap)) {
        await sequelize.query(`
          UPDATE grades 
          SET effort_grade = :newGrade 
          WHERE effort_grade = :oldGrade
        `, {
          replacements: { oldGrade, newGrade },
          type: sequelize.QueryTypes.UPDATE,
          transaction
        });
      }
      
      // Update behavior_grade
      for (const [oldGrade, newGrade] of Object.entries(gradeConversionMap)) {
        await sequelize.query(`
          UPDATE grades 
          SET behavior_grade = :newGrade 
          WHERE behavior_grade = :oldGrade
        `, {
          replacements: { oldGrade, newGrade },
          type: sequelize.QueryTypes.UPDATE,
          transaction
        });
      }
      
      console.log('✅ Grade values converted successfully!');
    });
    
    // Step 4: Verify migration results
    console.log('\n📊 Updated grade distribution:');
    const updatedGrades = await sequelize.query(`
      SELECT grade_value, COUNT(*) as count 
      FROM grades 
      GROUP BY grade_value 
      ORDER BY grade_value
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.table(updatedGrades);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('Summary:');
    console.log('- E (Excellent) -> A');
    console.log('- G (Good) -> B'); 
    console.log('- S (Satisfactory) -> C');
    console.log('- N (Needs Improvement) -> D');
    console.log('\nNote: The database model now supports the full A-F scale with plus/minus modifiers.');
    console.log('New grades entered will use the complete A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F scale.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateGradingSystem()
    .then(() => {
      console.log('\n✅ Migration script completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateGradingSystem, gradeConversionMap };