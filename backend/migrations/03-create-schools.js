'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('schools', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      school_type: {
        type: Sequelize.ENUM('pre_primary', 'primary', 'secondary'),
        allowNull: false
      },
      zone_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'zones',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      parish_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'parishes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
      principal_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      established_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      school_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true
      },
      school_category: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      student_population: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      last_enrollment_update: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
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

    // Add indexes for performance
    await queryInterface.addIndex('schools', ['zone_id']);
    await queryInterface.addIndex('schools', ['parish_id']);
    await queryInterface.addIndex('schools', ['school_type']);
    await queryInterface.addIndex('schools', ['is_active']);
    await queryInterface.addIndex('schools', ['school_code'], { unique: true });
    await queryInterface.addIndex('schools', ['name']);
    await queryInterface.addIndex('schools', ['school_category']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('schools');
  }
};