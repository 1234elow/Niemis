'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('students', {
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
      school_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      student_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      first_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      gender: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      rfid_tag: {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true
      },
      enrollment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      grade_level: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      class_section: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      photo_url: {
        type: Sequelize.STRING(255),
        allowNull: true
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
    await queryInterface.addIndex('students', ['user_id']);
    await queryInterface.addIndex('students', ['school_id']);
    await queryInterface.addIndex('students', ['student_id'], { unique: true });
    await queryInterface.addIndex('students', ['rfid_tag'], { unique: true });
    await queryInterface.addIndex('students', ['grade_level']);
    await queryInterface.addIndex('students', ['class_section']);
    await queryInterface.addIndex('students', ['is_active']);
    await queryInterface.addIndex('students', ['enrollment_date']);
    await queryInterface.addIndex('students', ['first_name', 'last_name']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('students');
  }
};