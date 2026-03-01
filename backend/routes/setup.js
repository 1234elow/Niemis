const express = require('express');
const { Subject, Term } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

// Barbados Standard Education Subjects
const SUBJECTS_DATA = [
  // Core Primary Subjects
  { name: 'English Language', code: 'ENG', description: 'Reading, Writing, Grammar, Literature', grade_levels: ['Pre-K', 'K', '1', '2', '3', '4', '5', '6'], is_core_subject: true },
  { name: 'Mathematics', code: 'MATH', description: 'Arithmetic, Algebra, Geometry, Problem Solving', grade_levels: ['Pre-K', 'K', '1', '2', '3', '4', '5', '6'], is_core_subject: true },
  { name: 'Science', code: 'SCI', description: 'General Science, Nature Studies, Basic Chemistry/Physics', grade_levels: ['1', '2', '3', '4', '5', '6'], is_core_subject: true },
  { name: 'Social Studies', code: 'SS', description: 'History, Geography, Civics, Caribbean Studies', grade_levels: ['1', '2', '3', '4', '5', '6'], is_core_subject: true },
  
  // Creative and Physical Subjects
  { name: 'Visual Arts', code: 'ART', description: 'Drawing, Painting, Crafts, Art Appreciation', grade_levels: ['K', '1', '2', '3', '4', '5', '6'], is_core_subject: false },
  { name: 'Music', code: 'MUS', description: 'Singing, Rhythm, Music Theory, Instruments', grade_levels: ['K', '1', '2', '3', '4', '5', '6'], is_core_subject: false },
  { name: 'Physical Education', code: 'PE', description: 'Sports, Health, Fitness, Motor Skills', grade_levels: ['K', '1', '2', '3', '4', '5', '6'], is_core_subject: true },
  
  // Secondary Level Subjects
  { name: 'Biology', code: 'BIO', description: 'Life Sciences, Human Biology, Ecology', grade_levels: ['7', '8', '9', '10', '11'], is_core_subject: true },
  { name: 'Chemistry', code: 'CHEM', description: 'Chemical Reactions, Organic Chemistry, Laboratory Skills', grade_levels: ['7', '8', '9', '10', '11'], is_core_subject: true },
  { name: 'Physics', code: 'PHYS', description: 'Mechanics, Electricity, Waves, Modern Physics', grade_levels: ['7', '8', '9', '10', '11'], is_core_subject: true },
  { name: 'Caribbean History', code: 'CHIST', description: 'Regional History, Cultural Studies, Post-Colonial Studies', grade_levels: ['7', '8', '9', '10', '11'], is_core_subject: true },
  { name: 'Geography', code: 'GEOG', description: 'Physical Geography, Human Geography, Caribbean Geography', grade_levels: ['7', '8', '9', '10', '11'], is_core_subject: true },
  
  // Specialized Subjects
  { name: 'Information Technology', code: 'IT', description: 'Computer Skills, Programming, Digital Literacy', grade_levels: ['3', '4', '5', '6', '7', '8', '9', '10', '11'], is_core_subject: false },
  { name: 'Spanish', code: 'SPAN', description: 'Spanish Language, Literature, Caribbean Spanish', grade_levels: ['7', '8', '9', '10', '11'], is_core_subject: false },
  { name: 'French', code: 'FR', description: 'French Language, Literature, Francophone Caribbean', grade_levels: ['7', '8', '9', '10', '11'], is_core_subject: false },
  { name: 'Technical Drawing', code: 'TD', description: 'Engineering Drawing, Design, CAD', grade_levels: ['8', '9', '10', '11'], is_core_subject: false },
  { name: 'Home Economics', code: 'HE', description: 'Food & Nutrition, Textiles, Family Life', grade_levels: ['7', '8', '9', '10', '11'], is_core_subject: false },
];

// Barbados School Terms (2024-2025 Academic Year)
const TERMS_DATA = [
  {
    name: 'First Term',
    school_year: '2024-2025',
    term_number: 1,
    start_date: '2024-09-09',
    end_date: '2024-12-20',
    is_current: true,
    is_active: true,
    report_card_release_date: '2025-01-15'
  },
  {
    name: 'Second Term',
    school_year: '2024-2025',
    term_number: 2,
    start_date: '2025-01-06',
    end_date: '2025-04-11',
    is_current: false,
    is_active: true,
    report_card_release_date: '2025-04-25'
  },
  {
    name: 'Third Term',
    school_year: '2024-2025',
    term_number: 3,
    start_date: '2025-04-21',
    end_date: '2025-07-11',
    is_current: false,
    is_active: true,
    report_card_release_date: '2025-07-25'
  },
  
  // Previous Year for Historical Data
  {
    name: 'Third Term',
    school_year: '2023-2024',
    term_number: 3,
    start_date: '2024-04-22',
    end_date: '2024-07-12',
    is_current: false,
    is_active: false,
    report_card_release_date: '2024-07-26'
  }
];

// Create subjects and terms via API endpoint
router.post('/create-subjects-terms', async (req, res) => {
  try {
    logger.info('Starting creation of Subjects and Terms via API...');

    // Create Subjects
    logger.info('Creating subjects...');
    const createdSubjects = [];
    
    for (const subjectData of SUBJECTS_DATA) {
      try {
        // Check if subject already exists
        const existingSubject = await Subject.findOne({ 
          where: { code: subjectData.code } 
        });
        
        if (existingSubject) {
          logger.info(`Subject ${subjectData.code} already exists, skipping...`);
          createdSubjects.push(existingSubject);
          continue;
        }
        
        const subject = await Subject.create(subjectData);
        createdSubjects.push(subject);
        logger.info(`Created subject: ${subject.name} (${subject.code})`);
        
      } catch (error) {
        logger.error(`Error creating subject ${subjectData.code}:`, error.message);
      }
    }

    // Create Terms
    logger.info('Creating terms...');
    const createdTerms = [];
    
    for (const termData of TERMS_DATA) {
      try {
        // Check if term already exists
        const existingTerm = await Term.findOne({ 
          where: { 
            school_year: termData.school_year,
            term_number: termData.term_number 
          } 
        });
        
        if (existingTerm) {
          logger.info(`Term ${termData.school_year} Term ${termData.term_number} already exists, skipping...`);
          createdTerms.push(existingTerm);
          continue;
        }
        
        const term = await Term.create(termData);
        createdTerms.push(term);
        logger.info(`Created term: ${term.name} ${term.school_year}`);
        
      } catch (error) {
        logger.error(`Error creating term ${termData.school_year} Term ${termData.term_number}:`, error.message);
      }
    }

    // Summary
    const summary = {
      success: true,
      subjects_created: createdSubjects.length,
      terms_created: createdTerms.length,
      subjects: createdSubjects.map(s => ({ id: s.id, name: s.name, code: s.code })),
      terms: createdTerms.map(t => ({ id: t.id, name: t.name, school_year: t.school_year, is_current: t.is_current })),
      message: `Successfully processed ${createdSubjects.length} subjects and ${createdTerms.length} terms`,
      timestamp: new Date().toISOString()
    };
    
    logger.info(`Successfully processed ${createdSubjects.length} subjects and ${createdTerms.length} terms`);
    
    res.json(summary);
    
  } catch (error) {
    logger.error('Error in create-subjects-terms endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to create subjects and terms'
    });
  }
});

// Check attendance_records table structure
router.get('/check-attendance-table', async (req, res) => {
  try {
    const { sequelize } = require('../config/database');
    
    // Get table structure for PostgreSQL
    const tableInfo = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'attendance_records' 
      ORDER BY ordinal_position
    `, { type: sequelize.QueryTypes.SELECT });
    
    res.json({
      success: true,
      message: 'Retrieved attendance_records table structure',
      columns: tableInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking attendance table:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to check attendance_records table'
    });
  }
});

// Migrate grading system from E/G/S/N to A/B/C/D/F
router.post('/migrate-grading-system', async (req, res) => {
  try {
    const { sequelize } = require('../config/database');
    
    console.log('Starting grading system migration from E/G/S/N to A/B/C/D/F...');
    
    // Drop and recreate the ENUM types for PostgreSQL
    await sequelize.query(`
      -- First, add a temporary column with the new enum values
      DO $$ 
      BEGIN 
          -- Check if grades table exists in school_system schema
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'school_system' AND table_name = 'grades') THEN
              -- Add new columns with updated enum values
              ALTER TABLE school_system.grades ADD COLUMN grade_value_new VARCHAR(3) DEFAULT 'A';
              ALTER TABLE school_system.grades ADD COLUMN effort_grade_new VARCHAR(3) DEFAULT 'A';
              ALTER TABLE school_system.grades ADD COLUMN behavior_grade_new VARCHAR(3) DEFAULT 'A';
              
              -- Convert existing E/G/S/N values to A/B/C/D/F
              UPDATE school_system.grades SET 
                grade_value_new = CASE 
                  WHEN grade_value = 'E' THEN 'A'
                  WHEN grade_value = 'G' THEN 'B' 
                  WHEN grade_value = 'S' THEN 'C'
                  WHEN grade_value = 'N' THEN 'D'
                  ELSE 'C'
                END,
                effort_grade_new = CASE 
                  WHEN effort_grade = 'E' THEN 'A'
                  WHEN effort_grade = 'G' THEN 'B' 
                  WHEN effort_grade = 'S' THEN 'C'
                  WHEN effort_grade = 'N' THEN 'D'
                  ELSE 'C'
                END,
                behavior_grade_new = CASE 
                  WHEN behavior_grade = 'E' THEN 'A'
                  WHEN behavior_grade = 'G' THEN 'B' 
                  WHEN behavior_grade = 'S' THEN 'C'
                  WHEN behavior_grade = 'N' THEN 'D'
                  ELSE 'C'
                END;
                
              -- Drop old columns
              ALTER TABLE school_system.grades DROP COLUMN grade_value CASCADE;
              ALTER TABLE school_system.grades DROP COLUMN effort_grade CASCADE;
              ALTER TABLE school_system.grades DROP COLUMN behavior_grade CASCADE;
              
              -- Rename new columns
              ALTER TABLE school_system.grades RENAME COLUMN grade_value_new TO grade_value;
              ALTER TABLE school_system.grades RENAME COLUMN effort_grade_new TO effort_grade;  
              ALTER TABLE school_system.grades RENAME COLUMN behavior_grade_new TO behavior_grade;
              
              -- Add constraints
              ALTER TABLE school_system.grades ADD CONSTRAINT check_grade_value 
                CHECK (grade_value IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'));
              ALTER TABLE school_system.grades ADD CONSTRAINT check_effort_grade 
                CHECK (effort_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'));
              ALTER TABLE school_system.grades ADD CONSTRAINT check_behavior_grade 
                CHECK (behavior_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'));
                
              -- Set NOT NULL constraints
              ALTER TABLE school_system.grades ALTER COLUMN grade_value SET NOT NULL;
              ALTER TABLE school_system.grades ALTER COLUMN effort_grade SET NOT NULL;
              ALTER TABLE school_system.grades ALTER COLUMN behavior_grade SET NOT NULL;
          END IF;
      END $$;
    `);
    
    console.log('Grading system migration completed successfully');
    
    res.json({
      success: true,
      message: 'Grading system successfully migrated from E/G/S/N to A/B/C/D/F system',
      changes: [
        'E (Excellent) → A',
        'G (Good) → B', 
        'S (Satisfactory) → C',
        'N (Needs Improvement) → D'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error migrating grading system:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to migrate grading system'
    });
  }
});

// Check grades table status  
router.get('/check-grades-table', async (req, res) => {
  try {
    const { sequelize } = require('../config/database');
    
    // Check if grades table exists
    const tableExists = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'school_system' 
        AND table_name = 'grades'
      );
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (tableExists[0].exists) {
      // Get table structure
      const columns = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'grades' AND table_schema = 'school_system'
        ORDER BY ordinal_position
      `, { type: sequelize.QueryTypes.SELECT });
      
      // Get current grade distribution
      const gradeDistribution = await sequelize.query(`
        SELECT grade_value, COUNT(*) as count 
        FROM grades 
        GROUP BY grade_value 
        ORDER BY grade_value
      `, { type: sequelize.QueryTypes.SELECT });
      
      res.json({
        success: true,
        table_exists: true,
        columns: columns,
        grade_distribution: gradeDistribution,
        total_grades: gradeDistribution.reduce((sum, row) => sum + parseInt(row.count), 0)
      });
    } else {
      res.json({
        success: true,
        table_exists: false,
        message: 'Grades table does not exist yet'
      });
    }
    
  } catch (error) {
    console.error('Error checking grades table:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to check grades table'
    });
  }
});

// Get current subjects and terms for verification
router.get('/subjects-terms-status', async (req, res) => {
  try {
    const subjects = await Subject.findAll({
      attributes: ['id', 'name', 'code', 'is_active'],
      order: [['code', 'ASC']]
    });
    
    const terms = await Term.findAll({
      attributes: ['id', 'name', 'school_year', 'term_number', 'is_current', 'is_active'],
      order: [['school_year', 'DESC'], ['term_number', 'ASC']]
    });
    
    res.json({
      success: true,
      subjects_count: subjects.length,
      terms_count: terms.length,
      subjects,
      terms,
      current_term: terms.find(t => t.is_current),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in subjects-terms-status endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to retrieve subjects and terms status'
    });
  }
});

module.exports = router;