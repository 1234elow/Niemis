module.exports = (sequelize, DataTypes) => {
    const School = sequelize.define('School', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(200),
            allowNull: false,
            validate: {
                len: [2, 200]
            }
        },
        school_type: {
            type: DataTypes.ENUM('pre_primary', 'primary', 'secondary'),
            allowNull: false
        },
        school_code: {
            type: DataTypes.STRING(20),
            allowNull: true,
            unique: true,
            comment: 'Official government school ID from Barbados Ministry of Education'
        },
        school_category: {
            type: DataTypes.ENUM('primary', 'secondary', 'nursery', 'special', 'tertiary'),
            allowNull: true,
            comment: 'Extended categorization for Barbados school system'
        },
        parish: {
            type: DataTypes.ENUM('st_michael', 'christ_church', 'st_philip', 'st_james', 'st_john', 'st_andrew', 'st_george', 'st_peter', 'st_lucy'),
            allowNull: true,
            comment: 'Barbados parish where school is located'
        },
        student_population: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 0
            },
            comment: 'Current total student enrollment'
        },
        zone_id: {
            type: DataTypes.UUID,
            references: {
                model: 'zones',
                key: 'id'
            }
        },
        parish_id: {
            type: DataTypes.UUID,
            references: {
                model: 'parishes',
                key: 'id'
            }
        },
        address: {
            type: DataTypes.TEXT
        },
        phone: {
            type: DataTypes.STRING(20),
            validate: {
                is: /^[\+]?[0-9\s\-\(\)]+$/
            }
        },
        email: {
            type: DataTypes.STRING(100),
            validate: {
                isEmail: true
            }
        },
        principal_name: {
            type: DataTypes.STRING(100)
        },
        established_date: {
            type: DataTypes.DATEONLY
        },
        capacity: {
            type: DataTypes.INTEGER,
            validate: {
                min: 1
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Additional information about the school'
        },
        last_enrollment_update: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Date when student population was last updated'
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'schools',
        indexes: [
            { fields: ['school_type'] },
            { fields: ['school_category'] },
            { fields: ['parish'] },
            { fields: ['school_code'] },
            { fields: ['zone_id'] },
            { fields: ['parish_id'] },
            { fields: ['is_active'] },
            { fields: ['student_population'] }
        ]
    });

    return School;
};