'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE school_system.schools
      SET school_category = CASE
        WHEN school_type = 'pre_primary' THEN 'nursery'
        WHEN school_type = 'primary' THEN 'primary'
        WHEN school_type = 'secondary' THEN 'secondary'
        ELSE school_category
      END
      WHERE school_type IN ('pre_primary', 'primary', 'secondary');
    `);
  },

  down: async () => {
    // no-op: this is a one-way consistency sync
  }
};
