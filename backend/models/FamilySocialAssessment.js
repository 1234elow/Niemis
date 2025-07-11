module.exports = (sequelize, DataTypes) => {
    const FamilySocialAssessment = sequelize.define('FamilySocialAssessment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        student_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'students',
                key: 'id'
            }
        },
        household_income_range: {
            type: DataTypes.STRING(20)
        },
        housing_type: {
            type: DataTypes.STRING(50)
        },
        number_of_dependents: {
            type: DataTypes.INTEGER
        },
        single_parent_household: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        foster_care: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        homeless: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        has_electricity: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        has_internet: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        food_insecurity_level: {
            type: DataTypes.STRING(20)
        },
        free_meal_eligible: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        social_worker_assigned: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        social_worker_name: {
            type: DataTypes.STRING(100)
        },
        notes: {
            type: DataTypes.TEXT
        },
        assessment_date: {
            type: DataTypes.DATEONLY
        }
    }, {
        tableName: 'family_social_assessment'
    });

    return FamilySocialAssessment;
};