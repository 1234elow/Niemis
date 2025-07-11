module.exports = (sequelize, DataTypes) => {
    const Parent = sequelize.define('Parent', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        first_name: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        last_name: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        relationship: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        phone: {
            type: DataTypes.STRING(20)
        },
        email: {
            type: DataTypes.STRING(100),
            validate: {
                isEmail: true
            }
        },
        address: {
            type: DataTypes.TEXT
        },
        occupation: {
            type: DataTypes.STRING(100)
        },
        education_level: {
            type: DataTypes.STRING(50)
        },
        is_emergency_contact: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'parents_guardians'
    });

    return Parent;
};