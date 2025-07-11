'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create student_health table
    await queryInterface.createTable('student_health', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      student_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'students',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      medical_conditions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      allergies: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      medications: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      immunization_records: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      emergency_contact_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      emergency_contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      blood_type: {
        type: Sequelize.STRING(5),
        allowNull: true
      },
      doctor_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      doctor_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      last_physical_exam: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create family_social_assessment table
    await queryInterface.createTable('family_social_assessment', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      student_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'students',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      household_income_range: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      housing_type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      number_of_dependents: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      single_parent_household: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      foster_care: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      homeless: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      has_electricity: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      has_internet: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      food_insecurity_level: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      free_meal_eligible: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      social_worker_assigned: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      social_worker_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      assessment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create disability_assessments table
    await queryInterface.createTable('disability_assessments', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      student_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'students',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      disability_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      severity_level: {
        type: Sequelize.ENUM('mild', 'moderate', 'severe'),
        allowNull: true
      },
      disability_index_score: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      accommodations_needed: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      support_services: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      iep_status: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      iep_document_url: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      assessment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      next_review_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create student_athletics table
    await queryInterface.createTable('student_athletics', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      student_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'students',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sport_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      skill_level: {
        type: Sequelize.ENUM('beginner', 'intermediate', 'advanced'),
        allowNull: true
      },
      participation_start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      coach_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      coach_evaluation: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      competitions_attended: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      achievements: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      fitness_score: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      health_clearance: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('student_health', ['student_id'], { unique: true });
    await queryInterface.addIndex('student_health', ['blood_type']);
    await queryInterface.addIndex('student_health', ['last_physical_exam']);

    await queryInterface.addIndex('family_social_assessment', ['student_id'], { unique: true });
    await queryInterface.addIndex('family_social_assessment', ['household_income_range']);
    await queryInterface.addIndex('family_social_assessment', ['free_meal_eligible']);
    await queryInterface.addIndex('family_social_assessment', ['social_worker_assigned']);
    await queryInterface.addIndex('family_social_assessment', ['assessment_date']);

    await queryInterface.addIndex('disability_assessments', ['student_id']);
    await queryInterface.addIndex('disability_assessments', ['disability_type']);
    await queryInterface.addIndex('disability_assessments', ['severity_level']);
    await queryInterface.addIndex('disability_assessments', ['iep_status']);
    await queryInterface.addIndex('disability_assessments', ['assessment_date']);

    await queryInterface.addIndex('student_athletics', ['student_id']);
    await queryInterface.addIndex('student_athletics', ['sport_name']);
    await queryInterface.addIndex('student_athletics', ['skill_level']);
    await queryInterface.addIndex('student_athletics', ['is_active']);
    await queryInterface.addIndex('student_athletics', ['health_clearance']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_athletics');
    await queryInterface.dropTable('disability_assessments');
    await queryInterface.dropTable('family_social_assessment');
    await queryInterface.dropTable('student_health');
  }
};