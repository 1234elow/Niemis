'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('staff', {
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
      employee_id: {
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
        allowNull: true
      },
      gender: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      position: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      department: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      hire_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      salary: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      qualifications: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      certifications: {
        type: Sequelize.TEXT,
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
    await queryInterface.addIndex('staff', ['user_id']);
    await queryInterface.addIndex('staff', ['school_id']);
    await queryInterface.addIndex('staff', ['employee_id'], { unique: true });
    await queryInterface.addIndex('staff', ['position']);
    await queryInterface.addIndex('staff', ['department']);
    await queryInterface.addIndex('staff', ['is_active']);
    await queryInterface.addIndex('staff', ['hire_date']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('staff');
  }
};