'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create facilities table
    await queryInterface.createTable('facilities', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      school_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      facility_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      facility_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      room_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      area_sqm: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true
      },
      condition_status: {
        type: Sequelize.ENUM('excellent', 'good', 'fair', 'poor'),
        defaultValue: 'good',
        allowNull: false
      },
      accessibility_features: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      last_maintenance: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      next_maintenance: {
        type: Sequelize.DATEONLY,
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

    // Create inventory_items table
    await queryInterface.createTable('inventory_items', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      school_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'facilities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      item_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      item_category: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      unit_cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      purchase_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      condition_status: {
        type: Sequelize.STRING(20),
        defaultValue: 'good',
        allowNull: false
      },
      supplier: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      warranty_expiry: {
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

    // Create rfid_devices table
    await queryInterface.createTable('rfid_devices', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      school_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      device_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      device_type: {
        type: Sequelize.ENUM('gate_reader', 'classroom_reader', 'mobile_reader'),
        allowNull: false
      },
      location: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'maintenance'),
        defaultValue: 'active',
        allowNull: false
      },
      last_sync: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex('facilities', ['school_id']);
    await queryInterface.addIndex('facilities', ['facility_type']);
    await queryInterface.addIndex('facilities', ['condition_status']);
    await queryInterface.addIndex('facilities', ['is_active']);
    await queryInterface.addIndex('facilities', ['last_maintenance']);
    await queryInterface.addIndex('facilities', ['next_maintenance']);

    await queryInterface.addIndex('inventory_items', ['school_id']);
    await queryInterface.addIndex('inventory_items', ['facility_id']);
    await queryInterface.addIndex('inventory_items', ['item_category']);
    await queryInterface.addIndex('inventory_items', ['condition_status']);
    await queryInterface.addIndex('inventory_items', ['purchase_date']);
    await queryInterface.addIndex('inventory_items', ['warranty_expiry']);

    await queryInterface.addIndex('rfid_devices', ['school_id']);
    await queryInterface.addIndex('rfid_devices', ['device_id'], { unique: true });
    await queryInterface.addIndex('rfid_devices', ['device_type']);
    await queryInterface.addIndex('rfid_devices', ['status']);
    await queryInterface.addIndex('rfid_devices', ['last_sync']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('rfid_devices');
    await queryInterface.dropTable('inventory_items');
    await queryInterface.dropTable('facilities');
  }
};