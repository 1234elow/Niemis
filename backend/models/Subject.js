module.exports = (sequelize, DataTypes) => {
    const Subject = sequelize.define('Subject', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                len: [2, 100]
            }
        },
        code: {
            type: DataTypes.STRING(10),
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.TEXT
        },
        grade_levels: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: 'Array of applicable grade levels'
        },
        is_core_subject: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'subjects',
        indexes: [
            { fields: ['code'] },
            { fields: ['is_active'] },
            { fields: ['is_core_subject'] }
        ]
    });

    return Subject;
};