'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bssee_applications', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
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
      primary_school_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      exam_year: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      exam_candidate_number: {
        type: Sequelize.STRING(40),
        allowNull: true
      },
      exam_score: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      english_score: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      math_score: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'submitted'
      },
      preferred_school_1_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      preferred_school_2_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      preferred_school_3_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      placement_school_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      accommodation_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      deferral_requested: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      citizenship_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'national'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      review_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      submitted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: { tableName: 'users', schema: 'school_system' },
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      reviewed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: { tableName: 'users', schema: 'school_system' },
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      placed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex('bssee_applications', ['student_id']);
    await queryInterface.addIndex('bssee_applications', ['primary_school_id']);
    await queryInterface.addIndex('bssee_applications', ['exam_year']);
    await queryInterface.addIndex('bssee_applications', ['status']);
    await queryInterface.addIndex('bssee_applications', ['placement_school_id']);
    await queryInterface.addIndex('bssee_applications', ['is_active']);
    await queryInterface.addIndex('bssee_applications', ['student_id', 'exam_year'], {
      unique: true,
      name: 'bssee_applications_student_year_unique'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('bssee_applications');
  }
};
