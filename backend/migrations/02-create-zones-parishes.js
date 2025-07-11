'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create zones table
    await queryInterface.createTable('zones', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create parishes table
    await queryInterface.createTable('parishes', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        unique: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('zones', ['name']);
    await queryInterface.addIndex('parishes', ['code'], { unique: true });
    await queryInterface.addIndex('parishes', ['name']);

    // Insert Barbados parishes data
    await queryInterface.bulkInsert('parishes', [
      {
        id: require('uuid').v4(),
        name: 'Christ Church',
        code: 'CC',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. Andrew',
        code: 'SA',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. George',
        code: 'SG',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. James',
        code: 'SJ',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. John',
        code: 'SJN',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. Joseph',
        code: 'SJO',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. Lucy',
        code: 'SL',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. Michael',
        code: 'SM',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. Peter',
        code: 'SP',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. Philip',
        code: 'SPH',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'St. Thomas',
        code: 'ST',
        created_at: new Date()
      }
    ]);

    // Insert Barbados educational zones
    await queryInterface.bulkInsert('zones', [
      {
        id: require('uuid').v4(),
        name: 'Zone 1 - North',
        description: 'Northern parishes including St. Lucy, St. Peter',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'Zone 2 - East',
        description: 'Eastern parishes including St. John, St. Joseph',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'Zone 3 - South',
        description: 'Southern parishes including Christ Church, St. Philip',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'Zone 4 - West',
        description: 'Western parishes including St. James, St. Thomas',
        created_at: new Date()
      },
      {
        id: require('uuid').v4(),
        name: 'Zone 5 - Central',
        description: 'Central parishes including St. Michael, St. George',
        created_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('parishes');
    await queryInterface.dropTable('zones');
  }
};