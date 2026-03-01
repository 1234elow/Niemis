'use strict';

const { v4: uuidv4 } = require('uuid');
const { QueryTypes } = require('sequelize');
const {
  BARBADOS_ZONE_DEFINITIONS,
  resolveBarbadosZoneKeyForSchool
} = require('../utils/barbadosEducationZones');

const canonicalZoneNameSet = new Set(
  BARBADOS_ZONE_DEFINITIONS.map((zone) => zone.name.toLowerCase())
);

module.exports = {
  up: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const existingZones = await queryInterface.sequelize.query(
        'SELECT id, name, description, created_at FROM zones ORDER BY created_at ASC, name ASC',
        { type: QueryTypes.SELECT, transaction }
      );

      const zonesByName = existingZones.reduce((accumulator, zone) => {
        const key = String(zone.name || '').trim().toLowerCase();
        if (!accumulator.has(key)) {
          accumulator.set(key, []);
        }
        accumulator.get(key).push(zone);
        return accumulator;
      }, new Map());

      const canonicalZoneIds = new Map();
      const duplicateCanonicalZoneIds = [];

      for (const definition of BARBADOS_ZONE_DEFINITIONS) {
        const nameKey = definition.name.toLowerCase();
        const candidates = zonesByName.get(nameKey) || [];
        let canonicalZoneId = null;

        if (candidates.length > 0) {
          canonicalZoneId = candidates[0].id;
          if ((candidates[0].description || '') !== definition.description) {
            await queryInterface.sequelize.query(
              'UPDATE zones SET description = :description WHERE id = :zoneId',
              {
                replacements: {
                  description: definition.description,
                  zoneId: canonicalZoneId
                },
                type: QueryTypes.UPDATE,
                transaction
              }
            );
          }
          duplicateCanonicalZoneIds.push(...candidates.slice(1).map((zone) => zone.id));
        } else {
          canonicalZoneId = uuidv4();
          await queryInterface.sequelize.query(
            `INSERT INTO zones (id, name, description, created_at)
             VALUES (:id, :name, :description, :createdAt)`,
            {
              replacements: {
                id: canonicalZoneId,
                name: definition.name,
                description: definition.description,
                createdAt: new Date()
              },
              type: QueryTypes.INSERT,
              transaction
            }
          );
        }

        canonicalZoneIds.set(definition.key, canonicalZoneId);
      }

      const parishRows = await queryInterface.sequelize.query(
        'SELECT id, code FROM parishes',
        { type: QueryTypes.SELECT, transaction }
      );
      const parishCodeById = new Map(parishRows.map((row) => [row.id, row.code]));

      const schoolRows = await queryInterface.sequelize.query(
        'SELECT id, name, school_type, parish_id, zone_id FROM schools',
        { type: QueryTypes.SELECT, transaction }
      );

      for (const school of schoolRows) {
        const zoneKey = resolveBarbadosZoneKeyForSchool({
          schoolName: school.name,
          schoolType: school.school_type,
          parishCode: parishCodeById.get(school.parish_id) || null
        });
        const targetZoneId = canonicalZoneIds.get(zoneKey) || null;
        if (!targetZoneId || school.zone_id === targetZoneId) {
          continue;
        }

        await queryInterface.sequelize.query(
          'UPDATE schools SET zone_id = :zoneId, updated_at = :updatedAt WHERE id = :schoolId',
          {
            replacements: {
              zoneId: targetZoneId,
              updatedAt: new Date(),
              schoolId: school.id
            },
            type: QueryTypes.UPDATE,
            transaction
          }
        );
      }

      const zonesAfterUpdates = await queryInterface.sequelize.query(
        'SELECT id, name FROM zones',
        { type: QueryTypes.SELECT, transaction }
      );
      const canonicalIdSet = new Set(canonicalZoneIds.values());
      const nonCanonicalIds = zonesAfterUpdates
        .filter((zone) => !canonicalZoneNameSet.has(String(zone.name || '').trim().toLowerCase()))
        .map((zone) => zone.id);
      const cleanupZoneIds = Array.from(new Set([...duplicateCanonicalZoneIds, ...nonCanonicalIds]))
        .filter((zoneId) => !canonicalIdSet.has(zoneId));

      if (cleanupZoneIds.length > 0) {
        const referencedZoneRows = await queryInterface.sequelize.query(
          'SELECT DISTINCT zone_id FROM schools WHERE zone_id = ANY(:zoneIds)',
          {
            replacements: { zoneIds: cleanupZoneIds },
            type: QueryTypes.SELECT,
            transaction
          }
        );
        const referencedZoneIds = new Set(referencedZoneRows.map((row) => row.zone_id));
        const deletableZoneIds = cleanupZoneIds.filter((zoneId) => !referencedZoneIds.has(zoneId));

        if (deletableZoneIds.length > 0) {
          await queryInterface.sequelize.query(
            'DELETE FROM zones WHERE id = ANY(:zoneIds)',
            {
              replacements: { zoneIds: deletableZoneIds },
              type: QueryTypes.DELETE,
              transaction
            }
          );
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async () => {
    // No-op: this migration enforces canonical zone data and re-maps school assignments.
  }
};
