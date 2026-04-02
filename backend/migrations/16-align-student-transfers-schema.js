'use strict';

const buildAcademicYearFromDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableName = 'student_transfers';
    const columns = await queryInterface.describeTable(tableName);

    const addColumnIfMissing = async (columnName, definition) => {
      if (!columns[columnName]) {
        await queryInterface.addColumn(tableName, columnName, definition);
        columns[columnName] = { ...definition };
      }
    };

    await addColumnIfMissing('initiated_by', {
      type: Sequelize.STRING(64),
      allowNull: true
    });

    await addColumnIfMissing('transfer_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await addColumnIfMissing('academic_year', {
      type: Sequelize.STRING(10),
      allowNull: true
    });

    await addColumnIfMissing('current_grade', {
      type: Sequelize.STRING(30),
      allowNull: true
    });

    await addColumnIfMissing('target_grade', {
      type: Sequelize.STRING(30),
      allowNull: true
    });

    await addColumnIfMissing('effective_date', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });

    await addColumnIfMissing('admin_notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await addColumnIfMissing('academic_records_transferred', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await addColumnIfMissing('medical_records_transferred', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Backfill from legacy columns when they exist.
    if (columns.reason) {
      await queryInterface.sequelize.query(`
        UPDATE school_system.student_transfers
        SET transfer_reason = COALESCE(transfer_reason, reason)
      `);
    }

    if (columns.documents_transferred) {
      await queryInterface.sequelize.query(`
        UPDATE school_system.student_transfers
        SET academic_records_transferred = COALESCE(academic_records_transferred, documents_transferred, false)
      `);
    }

    if (columns.transcript_verified) {
      await queryInterface.sequelize.query(`
        UPDATE school_system.student_transfers
        SET medical_records_transferred = COALESCE(medical_records_transferred, transcript_verified, false)
      `);
    }

    if (columns.approved_by) {
      await queryInterface.sequelize.query(`
        UPDATE school_system.student_transfers
        SET initiated_by = COALESCE(initiated_by, approved_by::text)
      `);
    }

    const studentColumns = await queryInterface.describeTable('students');
    const studentGradeField = studentColumns.current_grade
      ? 'current_grade'
      : studentColumns.grade_level
        ? 'grade_level'
        : null;

    if (studentGradeField) {
      await queryInterface.sequelize.query(`
        UPDATE school_system.student_transfers st
        SET current_grade = COALESCE(st.current_grade, s.${studentGradeField})
        FROM school_system.students s
        WHERE st.student_id = s.id
      `);
    }

    await queryInterface.sequelize.query(`
      UPDATE school_system.student_transfers
      SET target_grade = COALESCE(target_grade, current_grade)
    `);

    const [rows] = await queryInterface.sequelize.query(`
      SELECT id, transfer_date, created_at
      FROM school_system.student_transfers
      WHERE academic_year IS NULL
    `);

    for (const row of rows) {
      const fallbackDate = row.transfer_date || row.created_at;
      const academicYear = buildAcademicYearFromDate(fallbackDate);
      if (!academicYear) continue;
      await queryInterface.sequelize.query(
        `UPDATE school_system.student_transfers SET academic_year = :academicYear WHERE id = :id`,
        {
          replacements: { academicYear, id: row.id }
        }
      );
    }

    await queryInterface.sequelize.query(`
      UPDATE school_system.student_transfers
      SET transfer_reason = COALESCE(transfer_reason, 'Transfer request')
    `);
  },

  down: async (queryInterface) => {
    const tableName = 'student_transfers';
    const columns = await queryInterface.describeTable(tableName);

    const removeColumnIfPresent = async (columnName) => {
      if (columns[columnName]) {
        await queryInterface.removeColumn(tableName, columnName);
      }
    };

    await removeColumnIfPresent('medical_records_transferred');
    await removeColumnIfPresent('academic_records_transferred');
    await removeColumnIfPresent('admin_notes');
    await removeColumnIfPresent('effective_date');
    await removeColumnIfPresent('target_grade');
    await removeColumnIfPresent('current_grade');
    await removeColumnIfPresent('academic_year');
    await removeColumnIfPresent('transfer_reason');
    await removeColumnIfPresent('initiated_by');
  }
};
