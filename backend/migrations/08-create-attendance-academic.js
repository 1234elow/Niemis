'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create attendance_records table
    await queryInterface.createTable('attendance_records', {
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
      attendance_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      check_in_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      check_out_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('present', 'absent', 'late', 'excused'),
        defaultValue: 'present',
        allowNull: false
      },
      rfid_entry_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rfid_exit_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create academic_records table
    await queryInterface.createTable('academic_records', {
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
      school_year: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      term: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      grade: {
        type: Sequelize.STRING(5),
        allowNull: true
      },
      grade_points: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true
      },
      teacher_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'staff',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      assignment_scores: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      exam_scores: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      comments: {
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

    // Create student_transfers table
    await queryInterface.createTable('student_transfers', {
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
      transfer_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'completed'),
        defaultValue: 'pending',
        allowNull: false
      },
      approved_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'staff',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      parent_consent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      documents_transferred: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      transcript_verified: {
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

    // Add indexes for performance
    await queryInterface.addIndex('attendance_records', ['student_id', 'attendance_date']);
    await queryInterface.addIndex('attendance_records', ['school_id', 'attendance_date']);
    await queryInterface.addIndex('attendance_records', ['attendance_date']);
    await queryInterface.addIndex('attendance_records', ['status']);
    await queryInterface.addIndex('attendance_records', ['check_in_time']);
    await queryInterface.addIndex('attendance_records', ['check_out_time']);

    await queryInterface.addIndex('academic_records', ['student_id', 'school_year', 'term']);
    await queryInterface.addIndex('academic_records', ['school_year', 'term']);
    await queryInterface.addIndex('academic_records', ['subject']);
    await queryInterface.addIndex('academic_records', ['teacher_id']);
    await queryInterface.addIndex('academic_records', ['grade']);
    await queryInterface.addIndex('academic_records', ['grade_points']);

    await queryInterface.addIndex('student_transfers', ['student_id']);
    await queryInterface.addIndex('student_transfers', ['from_school_id']);
    await queryInterface.addIndex('student_transfers', ['to_school_id']);
    await queryInterface.addIndex('student_transfers', ['status']);
    await queryInterface.addIndex('student_transfers', ['transfer_date']);
    await queryInterface.addIndex('student_transfers', ['approved_by']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_transfers');
    await queryInterface.dropTable('academic_records');
    await queryInterface.dropTable('attendance_records');
  }
};