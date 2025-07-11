module.exports = (sequelize, DataTypes) => {
    const Term = sequelize.define('Term', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                len: [2, 50]
            }
        },
        school_year: {
            type: DataTypes.STRING(10),
            allowNull: false
        },
        term_number: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 4
            }
        },
        start_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        end_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        is_current: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        report_card_release_date: {
            type: DataTypes.DATEONLY
        }
    }, {
        tableName: 'terms',
        indexes: [
            { fields: ['school_year'] },
            { fields: ['term_number'] },
            { fields: ['is_current'] },
            { fields: ['is_active'] }
        ],
        validate: {
            endDateAfterStartDate() {
                if (this.end_date <= this.start_date) {
                    throw new Error('End date must be after start date');
                }
            }
        }
    });

    return Term;
};