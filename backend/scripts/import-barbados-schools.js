const { sequelize } = require('../config/database');
const BarbadosSchoolImporter = require('../services/barbadosSchoolImporter');
const { School, Zone, Parish } = require('../models');
const logger = require('../utils/logger');

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
                WHERE table_schema = 'public' 
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
            // Check if zones exist
            const zoneCount = await Zone.count({ transaction });
            if (zoneCount === 0) {
                logger.info('Creating educational zones...');
                await this.createEducationalZones(transaction);
            }
            
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
     * Create educational zones for Barbados
     */
    async createEducationalZones(transaction) {
        const zones = [
            {
                name: 'Zone 1 - North',
                description: 'Northern parishes including St. Lucy, St. Peter'
            },
            {
                name: 'Zone 2 - East',
                description: 'Eastern parishes including St. John, St. Joseph'
            },
            {
                name: 'Zone 3 - South',
                description: 'Southern parishes including Christ Church, St. Philip'
            },
            {
                name: 'Zone 4 - West',
                description: 'Western parishes including St. James, St. Thomas'
            },
            {
                name: 'Zone 5 - Central',
                description: 'Central parishes including St. Michael, St. George'
            }
        ];

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
        const parishMap = new Map(parishes.map(p => [p.name, p.id]));
        const zoneMap = this.createZoneMapping(zones);
        
        const schoolsWithMapping = [];
        
        for (const school of schoolsData) {
            try {
                // Map parish to ID
                const parishId = this.mapParishToId(school.parish, parishMap);
                
                // Map parish to zone
                const zoneId = this.mapParishToZone(school.parish, zoneMap);
                
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
     * Create zone mapping for parish-to-zone assignments
     */
    createZoneMapping(zones) {
        const zoneMap = new Map();
        
        zones.forEach(zone => {
            switch (zone.name) {
                case 'Zone 1 - North':
                    zoneMap.set('St. Lucy', zone.id);
                    zoneMap.set('St. Peter', zone.id);
                    break;
                case 'Zone 2 - East':
                    zoneMap.set('St. John', zone.id);
                    zoneMap.set('St. Joseph', zone.id);
                    zoneMap.set('St. Andrew', zone.id);
                    break;
                case 'Zone 3 - South':
                    zoneMap.set('Christ Church', zone.id);
                    zoneMap.set('St. Philip', zone.id);
                    break;
                case 'Zone 4 - West':
                    zoneMap.set('St. James', zone.id);
                    zoneMap.set('St. Thomas', zone.id);
                    break;
                case 'Zone 5 - Central':
                    zoneMap.set('St. Michael', zone.id);
                    zoneMap.set('St. George', zone.id);
                    break;
            }
        });
        
        return zoneMap;
    }

    /**
     * Map parish name to parish ID
     */
    mapParishToId(parishName, parishMap) {
        const normalizedName = parishName.trim();
        const parishId = parishMap.get(normalizedName);
        
        if (!parishId) {
            throw new Error(`Parish not found: ${normalizedName}`);
        }
        
        return parishId;
    }

    /**
     * Map parish to educational zone
     */
    mapParishToZone(parishName, zoneMap) {
        const normalizedName = parishName.trim();
        const zoneId = zoneMap.get(normalizedName);
        
        if (!zoneId) {
            logger.warn(`Zone mapping not found for parish: ${normalizedName}`);
            return null;
        }
        
        return zoneId;
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