const fs = require('fs').promises;
const { School } = require('../models');
const logger = require('../utils/logger');

/**
 * Barbados Schools Data Import Service
 * Parses the official government schools data file and imports all 118 schools
 */
class BarbadosSchoolImporter {
    constructor() {
        this.parishMapping = {
            'St. Michael': 'st_michael',
            'Christ Church': 'christ_church',
            'St. Philip': 'st_philip',
            'St. James': 'st_james',
            'St. John': 'st_john',
            'St. Andrew': 'st_andrew',
            'St. George': 'st_george',
            'St. Peter': 'st_peter',
            'St. Lucy': 'st_lucy'
        };

        this.categoryMapping = {
            'PRIMARY SCHOOLS': 'primary',
            'SECONDARY SCHOOLS': 'secondary',
            'NURSERY SCHOOLS': 'nursery',
            'SPECIAL SCHOOLS': 'special',
            'TERTIARY INSTITUTIONS': 'tertiary'
        };
    }

    /**
     * Parse the complete schools.txt file and extract all school data
     */
    async parseSchoolsFile(filePath = '/mnt/c/Users/SamuelLowe/NiEMIS/schools.txt') {
        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            const lines = fileContent.split('\n').map(line => line.trim());
            
            const schools = [];
            let currentCategory = null;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Detect category headers
                if (line.includes('PRIMARY SCHOOLS')) {
                    currentCategory = 'primary';
                    continue;
                } else if (line.includes('SECONDARY SCHOOLS')) {
                    currentCategory = 'secondary';
                    continue;
                } else if (line.includes('NURSERY SCHOOLS')) {
                    currentCategory = 'nursery';
                    continue;
                } else if (line.includes('SPECIAL SCHOOLS')) {
                    currentCategory = 'special';
                    continue;
                } else if (line.includes('TERTIARY INSTITUTIONS')) {
                    currentCategory = 'tertiary';
                    continue;
                }
                
                // Parse individual school entries
                if (currentCategory && this.isSchoolNameLine(line)) {
                    const schoolData = this.parseSchoolEntry(line, lines[i + 1], currentCategory);
                    if (schoolData) {
                        schools.push(schoolData);
                    }
                }
            }
            
            logger.info(`Parsed ${schools.length} schools from Barbados data file`);
            return schools;
            
        } catch (error) {
            logger.error('Error parsing schools file:', error);
            throw new Error(`Failed to parse schools file: ${error.message}`);
        }
    }

    /**
     * Check if a line contains a school name entry
     */
    isSchoolNameLine(line) {
        return line.includes('(ID:') && !line.includes('Parish:') && !line.includes('Students:');
    }

    /**
     * Parse individual school entry from name line and details line
     */
    parseSchoolEntry(nameLine, detailsLine, category) {
        try {
            // Extract school name and ID from: "School Name (ID: XXX)"
            const nameMatch = nameLine.match(/^(.+?)\s*\(ID:\s*([^)]+)\)$/);
            if (!nameMatch) {
                logger.warn(`Could not parse school name from: ${nameLine}`);
                return null;
            }
            
            const [, name, school_code] = nameMatch;
            
            // Extract details from: "Parish: XXX | Students: XXX | [other data to ignore]"
            if (!detailsLine || !detailsLine.includes('Parish:')) {
                logger.warn(`No details line found for school: ${name}`);
                return null;
            }
            
            const detailsMatch = detailsLine.match(/Parish:\s*([^|]+)\s*\|\s*Students:\s*(\d+|N\/A)/);
            if (!detailsMatch) {
                logger.warn(`Could not parse details from: ${detailsLine}`);
                return null;
            }
            
            const [, parishText, studentsText] = detailsMatch;
            const parish = this.convertParishToEnum(parishText.trim());
            const student_population = studentsText === 'N/A' ? null : parseInt(studentsText);
            
            // Map category to both school_type and school_category
            const school_type = this.mapCategoryToSchoolType(category);
            
            return {
                name: name.trim(),
                school_code: school_code.trim(),
                school_type,
                school_category: category,
                parish,
                student_population,
                last_enrollment_update: new Date().toISOString().split('T')[0],
                is_active: true,
                description: `${category.charAt(0).toUpperCase() + category.slice(1)} school in ${parishText.trim()}`
            };
            
        } catch (error) {
            logger.error(`Error parsing school entry: ${nameLine}`, error);
            return null;
        }
    }

    /**
     * Convert parish name to enum value
     */
    convertParishToEnum(parishText) {
        return this.parishMapping[parishText] || parishText.toLowerCase().replace(' ', '_');
    }

    /**
     * Map category to existing school_type enum
     */
    mapCategoryToSchoolType(category) {
        switch (category) {
            case 'nursery':
                return 'pre_primary';
            case 'primary':
                return 'primary';
            case 'secondary':
            case 'special':
            case 'tertiary':
                return 'secondary';
            default:
                return 'primary';
        }
    }

    /**
     * Validate school data before import
     */
    validateSchoolData(school) {
        const required = ['name', 'school_code', 'school_type'];
        const missing = required.filter(field => !school[field]);
        
        if (missing.length > 0) {
            logger.warn(`School missing required fields: ${missing.join(', ')}`, school);
            return false;
        }
        
        if (school.student_population !== null && school.student_population < 0) {
            logger.warn(`Invalid student population for school: ${school.name}`, school);
            return false;
        }
        
        return true;
    }

    /**
     * Import all schools into the database
     */
    async importSchools() {
        try {
            logger.info('Starting Barbados schools import...');
            
            // Parse the schools file
            const schoolsData = await this.parseSchoolsFile();
            
            // Validate all school records
            const validSchools = schoolsData.filter(school => this.validateSchoolData(school));
            logger.info(`${validSchools.length} of ${schoolsData.length} schools passed validation`);
            
            // Import schools with conflict handling
            const results = await School.bulkCreate(validSchools, {
                updateOnDuplicate: ['name', 'student_population', 'parish', 'school_category', 'last_enrollment_update'],
                ignoreDuplicates: false,
                validate: true
            });
            
            // Generate import summary
            const summary = this.generateImportSummary(validSchools, results);
            logger.info('Barbados schools import completed:', summary);
            
            return summary;
            
        } catch (error) {
            logger.error('Barbados schools import failed:', error);
            throw error;
        }
    }

    /**
     * Generate comprehensive import summary
     */
    generateImportSummary(validSchools, results) {
        const breakdown = {
            primary: validSchools.filter(s => s.school_category === 'primary').length,
            secondary: validSchools.filter(s => s.school_category === 'secondary').length,
            nursery: validSchools.filter(s => s.school_category === 'nursery').length,
            special: validSchools.filter(s => s.school_category === 'special').length,
            tertiary: validSchools.filter(s => s.school_category === 'tertiary').length
        };

        const parishBreakdown = {};
        Object.values(this.parishMapping).forEach(parish => {
            parishBreakdown[parish] = validSchools.filter(s => s.parish === parish).length;
        });

        const totalStudents = validSchools
            .filter(s => s.student_population !== null)
            .reduce((sum, s) => sum + s.student_population, 0);

        return {
            success: true,
            imported: results.length,
            total_parsed: validSchools.length,
            total_expected: 118,
            breakdown,
            parish_breakdown: parishBreakdown,
            total_students: totalStudents,
            import_timestamp: new Date().toISOString()
        };
    }

    /**
     * Get statistics for imported schools
     */
    async getImportedSchoolsStats() {
        try {
            const stats = await School.findAll({
                attributes: [
                    'school_category',
                    'parish',
                    [School.sequelize.fn('COUNT', '*'), 'count'],
                    [School.sequelize.fn('SUM', School.sequelize.col('student_population')), 'total_students']
                ],
                where: {
                    school_code: { [School.sequelize.Op.not]: null }
                },
                group: ['school_category', 'parish'],
                raw: true
            });

            return stats;
        } catch (error) {
            logger.error('Error getting schools stats:', error);
            throw error;
        }
    }
}

module.exports = BarbadosSchoolImporter;