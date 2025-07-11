module.exports = (sequelize, DataTypes) => {
    const Class = sequelize.define('Class', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                len: [1, 50]
            }
        },
        grade_level: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        section: {
            type: DataTypes.STRING(10),
            allowNull: false
        },
        class_teacher_id: {
            type: DataTypes.UUID,
            references: {
                model: 'staff',
                key: 'id'
            }
        },
        school_year: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: '2024-2025'
        },
        capacity: {
            type: DataTypes.INTEGER,
            defaultValue: 25,
            validate: {
                min: 1,
                max: 50
            }
        },
        current_enrollment: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'classes',
        indexes: [
            { fields: ['school_id'] },
            { fields: ['grade_level'] },
            { fields: ['class_teacher_id'] },
            { fields: ['school_year'] },
            { fields: ['is_active'] }
        ]
    });

    return Class;
};