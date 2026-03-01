const { Subject, Term } = require('../models');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

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

async function createSubjectsAndTerms() {
  try {
    logger.info('Starting creation of Subjects and Terms...');
    
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');

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
    logger.info(`Successfully processed ${createdSubjects.length} subjects and ${createdTerms.length} terms`);
    
    const summary = {
      subjects_created: createdSubjects.length,
      terms_created: createdTerms.length,
      subjects: createdSubjects.map(s => ({ id: s.id, name: s.name, code: s.code })),
      terms: createdTerms.map(t => ({ id: t.id, name: t.name, school_year: t.school_year, is_current: t.is_current }))
    };
    
    console.log('\n=== CREATION SUMMARY ===');
    console.log(JSON.stringify(summary, null, 2));
    
    return summary;
    
  } catch (error) {
    logger.error('Error in createSubjectsAndTerms:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createSubjectsAndTerms()
    .then(summary => {
      console.log('\n✅ Subjects and Terms creation completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error creating subjects and terms:', error.message);
      process.exit(1);
    });
}

module.exports = { createSubjectsAndTerms };