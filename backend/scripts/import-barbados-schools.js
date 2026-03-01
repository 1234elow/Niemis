const { sequelize } = require('../config/database');
const BarbadosSchoolImporter = require('../services/barbadosSchoolImporter');
const { School, Zone, Parish } = require('../models');
const logger = require('../utils/logger');
const {
    BARBADOS_ZONE_DEFINITIONS,
    resolveBarbadosZoneKeyForSchool
} = require('../utils/barbadosEducationZones');

/**
 * Production-ready script for importing Barbados schools data
 * Handles 106 schools with proper error handling and transaction management
 */
class ProductionSchoolImporter {
    constructor() {
        this.importer = new BarbadosSchoolImporter();
        this.importResults = {
            success: false,
            total_processed: 0,
            imported: 0,
            skipped: 0,
            errors: [],
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Main import function with transaction management
     */
    async importSchoolsToProduction() {
        const transaction = await sequelize.transaction();
        
        try {
            logger.info('Starting production Barbados schools import...');
            
            // Validate database connection
            await this.validateDatabaseConnection();
            
            // Ensure zones and parishes exist
            await this.ensureZonesAndParishes(transaction);
            
            // Parse and validate school data
            const schoolsData = await this.importer.parseSchoolsFile();
            this.importResults.total_processed = schoolsData.length;
            
            // Import schools with proper zone/parish mapping
            await this.importSchoolsWithMapping(schoolsData, transaction);

            // Reconcile any legacy zone assignments onto canonical 3-zone IDs.
            await this.reconcileSchoolZoneAssignments(transaction);
            
            await transaction.commit();
            this.importResults.success = true;
            
            logger.info('Production schools import completed successfully:', this.importResults);
            return this.importResults;
            
        } catch (error) {
            await transaction.rollback();
            this.importResults.errors.push(error.message);
            logger.error('Production schools import failed:', error);
            throw error;
        }
    }

    /**
     * Validate database connection and required tables
     */
    async validateDatabaseConnection() {
        try {
            await sequelize.authenticate();
            logger.info('Database connection established successfully');
            
            // Check if required tables exist
            const [results] = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'school_system' 
                AND table_name IN ('schools', 'zones', 'parishes')
            `);
            
            if (results.length < 3) {
                throw new Error('Required tables (schools, zones, parishes) not found. Run migrations first.');
            }
            
            logger.info('Required database tables validated');
            
        } catch (error) {
            logger.error('Database validation failed:', error);
            throw new Error(`Database validation failed: ${error.message}`);
        }
    }

    /**
     * Ensure zones and parishes exist with proper mapping
     */
    async ensureZonesAndParishes(transaction) {
        try {
            // Always enforce canonical three-zone structure.
            await this.syncEducationalZones(transaction);
            
            // Check if parishes exist
            const parishCount = await Parish.count({ transaction });
            if (parishCount === 0) {
                logger.info('Creating Barbados parishes...');
                await this.createBarbadosParishes(transaction);
            }
            
            logger.info('Zones and parishes validated successfully');
            
        } catch (error) {
            logger.error('Error ensuring zones and parishes:', error);
            throw error;
        }
    }

    /**
     * Ensure canonical Barbados 3-zone model exists even in existing databases.
     */
    async syncEducationalZones(transaction) {
        const existingZones = await Zone.findAll({ transaction });
        const zonesByName = new Map(
            existingZones.map((zone) => [String(zone.name || '').trim().toLowerCase(), zone])
        );

        for (const definition of BARBADOS_ZONE_DEFINITIONS) {
            const existing = zonesByName.get(definition.name.toLowerCase());
            if (!existing) {
                await Zone.create(
                    {
                        name: definition.name,
                        description: definition.description
                    },
                    { transaction }
                );
                continue;
            }

            if ((existing.description || '') !== definition.description) {
                await existing.update(
                    { description: definition.description },
                    { transaction }
                );
            }
        }
    }

    /**
     * Create educational zones for Barbados
     */
    async createEducationalZones(transaction) {
        const zones = BARBADOS_ZONE_DEFINITIONS.map((zone) => ({
            name: zone.name,
            description: zone.description
        }));

        await Zone.bulkCreate(zones, { transaction });
        logger.info(`Created ${zones.length} educational zones`);
    }

    /**
     * Create Barbados parishes
     */
    async createBarbadosParishes(transaction) {
        const parishes = [
            { name: 'Christ Church', code: 'CC' },
            { name: 'St. Andrew', code: 'SA' },
            { name: 'St. George', code: 'SG' },
            { name: 'St. James', code: 'SJ' },
            { name: 'St. John', code: 'SJN' },
            { name: 'St. Joseph', code: 'SJO' },
            { name: 'St. Lucy', code: 'SL' },
            { name: 'St. Michael', code: 'SM' },
            { name: 'St. Peter', code: 'SP' },
            { name: 'St. Philip', code: 'SPH' },
            { name: 'St. Thomas', code: 'ST' }
        ];

        await Parish.bulkCreate(parishes, { transaction });
        logger.info(`Created ${parishes.length} Barbados parishes`);
    }

    /**
     * Import schools with proper zone and parish mapping
     */
    async importSchoolsWithMapping(schoolsData, transaction) {
        const zones = await Zone.findAll({ transaction });
        const parishes = await Parish.findAll({ transaction });
        
        // Create mapping objects for efficient lookups
        const parishMap = new Map(parishes.map(p => [p.code, p.id]));
        const zoneMap = this.createZoneMapping(zones);
        
        const schoolsWithMapping = [];
        
        for (const school of schoolsData) {
            try {
                const parishCode = this.normalizeParishCode(school.parish);

                // Map parish to ID
                const parishId = this.mapParishToId(parishCode, parishMap);
                
                // Map parish to zone
                const zoneId = this.mapParishToZone(
                    parishCode,
                    zoneMap,
                    school.name,
                    school.school_type
                );
                
                const mappedSchool = {
                    ...school,
                    parish_id: parishId,
                    zone_id: zoneId,
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date()
                };
                
                schoolsWithMapping.push(mappedSchool);
                
            } catch (error) {
                logger.warn(`Error mapping school ${school.name}:`, error.message);
                this.importResults.errors.push(`School ${school.name}: ${error.message}`);
            }
        }
        
        // Bulk insert schools
        if (schoolsWithMapping.length > 0) {
            const results = await School.bulkCreate(schoolsWithMapping, {
                transaction,
                updateOnDuplicate: ['name', 'student_population', 'parish_id', 'zone_id', 'updated_at'],
                ignoreDuplicates: false,
                validate: true
            });
            
            this.importResults.imported = results.length;
            this.importResults.skipped = schoolsData.length - results.length;
            
            logger.info(`Successfully imported ${results.length} schools`);
        }
    }

    /**
     * Normalize parish values from input file to canonical codes.
     */
    normalizeParishCode(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return null;
        }

        const directCodeMap = {
            CC: 'CC',
            SA: 'SA',
            SG: 'SG',
            SJ: 'SJ',
            SJN: 'SJN',
            SJO: 'SJO',
            SL: 'SL',
            SM: 'SM',
            SP: 'SP',
            SPH: 'SPH',
            ST: 'ST'
        };

        if (directCodeMap[raw]) {
            return directCodeMap[raw];
        }

        const normalized = raw.toLowerCase().replace(/[^a-z]/g, '');
        const aliasMap = {
            christchurch: 'CC',
            standrew: 'SA',
            stgeorge: 'SG',
            stjames: 'SJ',
            stjohn: 'SJN',
            stjoseph: 'SJO',
            stlucy: 'SL',
            stmichael: 'SM',
            stpeter: 'SP',
            stphilip: 'SPH',
            stthomas: 'ST'
        };

        return aliasMap[normalized] || null;
    }

    /**
     * Create zone mapping for parish-to-zone assignments
     */
    createZoneMapping(zones) {
        return zones.reduce((acc, zone) => {
            const normalizedName = String(zone.name || '').trim().toLowerCase();
            if (normalizedName === 'zone 1') {
                acc.zone_1 = zone.id;
            } else if (normalizedName === 'zone 2') {
                acc.zone_2 = zone.id;
            } else if (normalizedName === 'zone 3') {
                acc.zone_3 = zone.id;
            }
            return acc;
        }, {});
    }

    /**
     * Map parish name to parish ID
     */
    mapParishToId(parishCode, parishMap) {
        const parishId = parishMap.get(parishCode);
        
        if (!parishId) {
            throw new Error(`Parish not found: ${parishCode || 'unknown'}`);
        }
        
        return parishId;
    }

    /**
     * Map parish to educational zone
     */
    mapParishToZone(parishCode, zoneMap, schoolName, schoolType) {
        const zoneKey = resolveBarbadosZoneKeyForSchool({
            schoolName,
            schoolType,
            parishCode
        });
        if (!zoneKey) {
            logger.warn(`Zone mapping not found for school: ${schoolName} (${parishCode || 'unknown parish'})`);
            return null;
        }
        return zoneMap[zoneKey] || null;
    }

    /**
     * Re-map any remaining schools onto canonical zone IDs and clean unreferenced legacy zones.
     */
    async reconcileSchoolZoneAssignments(transaction) {
        const zones = await Zone.findAll({ transaction });
        const zoneMap = this.createZoneMapping(zones);
        const canonicalZoneNames = new Set(BARBADOS_ZONE_DEFINITIONS.map((zone) => zone.name.toLowerCase()));

        if (!zoneMap.zone_1 || !zoneMap.zone_2 || !zoneMap.zone_3) {
            logger.warn('Canonical zone IDs were not fully resolved during reconciliation.');
            return;
        }

        const schools = await School.findAll({
            attributes: ['id', 'name', 'school_type', 'parish', 'zone_id'],
            include: [
                {
                    model: Parish,
                    attributes: ['code'],
                    required: false
                }
            ],
            transaction
        });

        for (const school of schools) {
            const parishCode =
                this.normalizeParishCode(school.parish) ||
                school.Parish?.code ||
                null;
            const zoneKey = resolveBarbadosZoneKeyForSchool({
                schoolName: school.name,
                schoolType: school.school_type,
                parishCode
            });
            const targetZoneId = zoneMap[zoneKey] || null;

            if (!targetZoneId || school.zone_id === targetZoneId) {
                continue;
            }

            await school.update({ zone_id: targetZoneId }, { transaction });
        }

        const refreshedZones = await Zone.findAll({ transaction });
        for (const zone of refreshedZones) {
            const normalizedName = String(zone.name || '').trim().toLowerCase();
            if (canonicalZoneNames.has(normalizedName)) {
                continue;
            }

            const linkedSchools = await School.count({
                where: { zone_id: zone.id },
                transaction
            });
            if (linkedSchools === 0) {
                await zone.destroy({ transaction });
            }
        }
    }

    /**
     * Generate comprehensive import report
     */
    generateImportReport() {
        const report = {
            ...this.importResults,
            breakdown: {
                success_rate: this.importResults.total_processed > 0 
                    ? (this.importResults.imported / this.importResults.total_processed * 100).toFixed(2) + '%'
                    : '0%',
                error_count: this.importResults.errors.length,
                duration: new Date() - new Date(this.importResults.timestamp)
            }
        };
        
        return report;
    }
}

/**
 * CLI execution function
 */
async function runImport() {
    const importer = new ProductionSchoolImporter();
    
    try {
        const results = await importer.importSchoolsToProduction();
        console.log('✅ Import completed successfully!');
        console.log(JSON.stringify(importer.generateImportReport(), null, 2));
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Import failed:', error.message);
        console.log(JSON.stringify(importer.generateImportReport(), null, 2));
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Run if called directly
if (require.main === module) {
    runImport();
}

module.exports = ProductionSchoolImporter;
