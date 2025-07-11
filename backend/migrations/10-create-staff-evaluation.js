'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create teacher_evaluations table
    await queryInterface.createTable('teacher_evaluations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      teacher_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'staff',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      evaluator_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'staff',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      evaluation_period: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      evaluation_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      teaching_effectiveness: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5
        }
      },
      classroom_management: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5
        }
      },
      student_engagement: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5
        }
      },
      professional_development: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5
        }
      },
      overall_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true
      },
      comments: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      improvement_areas: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      goals_next_period: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'completed', 'approved'),
        defaultValue: 'draft',
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

    // Create professional_development table
    await queryInterface.createTable('professional_development', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      staff_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'staff',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      course_name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      provider: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      course_type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      hours_completed: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      certificate_earned: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      certificate_url: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('registered', 'in_progress', 'completed', 'cancelled'),
        defaultValue: 'registered',
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

    // Create audit_logs table
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      table_name: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      record_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      old_values: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      new_values: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      ip_address: {
        type: Sequelize.INET,
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('teacher_evaluations', ['teacher_id']);
    await queryInterface.addIndex('teacher_evaluations', ['evaluator_id']);
    await queryInterface.addIndex('teacher_evaluations', ['evaluation_date']);
    await queryInterface.addIndex('teacher_evaluations', ['evaluation_period']);
    await queryInterface.addIndex('teacher_evaluations', ['status']);
    await queryInterface.addIndex('teacher_evaluations', ['overall_score']);

    await queryInterface.addIndex('professional_development', ['staff_id']);
    await queryInterface.addIndex('professional_development', ['course_type']);
    await queryInterface.addIndex('professional_development', ['status']);
    await queryInterface.addIndex('professional_development', ['start_date']);
    await queryInterface.addIndex('professional_development', ['end_date']);
    await queryInterface.addIndex('professional_development', ['certificate_earned']);

    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['action']);
    await queryInterface.addIndex('audit_logs', ['table_name']);
    await queryInterface.addIndex('audit_logs', ['record_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
    await queryInterface.addIndex('audit_logs', ['ip_address']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('professional_development');
    await queryInterface.dropTable('teacher_evaluations');
  }
};