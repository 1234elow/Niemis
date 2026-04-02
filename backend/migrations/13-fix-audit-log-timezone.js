'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE school_system.audit_logs
      ALTER COLUMN created_at TYPE timestamptz
      USING created_at AT TIME ZONE 'UTC'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE school_system.audit_logs
      ALTER COLUMN updated_at TYPE timestamptz
      USING updated_at AT TIME ZONE 'UTC'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE school_system.audit_logs
      ALTER COLUMN created_at TYPE timestamp without time zone
      USING created_at AT TIME ZONE 'UTC'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE school_system.audit_logs
      ALTER COLUMN updated_at TYPE timestamp without time zone
      USING updated_at AT TIME ZONE 'UTC'
    `);
  },
};
