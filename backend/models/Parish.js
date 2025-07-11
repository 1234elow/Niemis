module.exports = (sequelize, DataTypes) => {
    const Parish = sequelize.define('Parish', {
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
        code: {
            type: DataTypes.STRING(10),
            allowNull: false,
            unique: true,
            validate: {
                len: [2, 10]
            }
        }
    }, {
        tableName: 'parishes'
    });

    return Parish;
};