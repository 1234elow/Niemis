'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('teacher_transfers', {
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
      from_school_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      to_school_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      initiated_by: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      approved_by: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      transfer_reason: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'completed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      effective_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      transfer_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      class_handover_completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      documents_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      admin_notes: {
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

    await queryInterface.addIndex('teacher_transfers', ['teacher_id']);
    await queryInterface.addIndex('teacher_transfers', ['from_school_id']);
    await queryInterface.addIndex('teacher_transfers', ['to_school_id']);
    await queryInterface.addIndex('teacher_transfers', ['status']);
    await queryInterface.addIndex('teacher_transfers', ['transfer_date']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('teacher_transfers');
  }
};
