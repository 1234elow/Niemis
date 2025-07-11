'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create parents_guardians table
    await queryInterface.createTable('parents_guardians', {
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
      first_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      relationship: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      occupation: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      education_level: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      is_emergency_contact: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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

    // Create student_parent_relationships table
    await queryInterface.createTable('student_parent_relationships', {
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
      parent_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'parents_guardians',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      relationship_type: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('parents_guardians', ['user_id']);
    await queryInterface.addIndex('parents_guardians', ['relationship']);
    await queryInterface.addIndex('parents_guardians', ['is_emergency_contact']);
    await queryInterface.addIndex('parents_guardians', ['first_name', 'last_name']);

    await queryInterface.addIndex('student_parent_relationships', ['student_id']);
    await queryInterface.addIndex('student_parent_relationships', ['parent_id']);
    await queryInterface.addIndex('student_parent_relationships', ['relationship_type']);
    await queryInterface.addIndex('student_parent_relationships', ['is_primary']);
    
    // Ensure only one primary parent per student
    await queryInterface.addIndex('student_parent_relationships', ['student_id', 'is_primary'], {
      unique: true,
      where: { is_primary: true }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_parent_relationships');
    await queryInterface.dropTable('parents_guardians');
  }
};