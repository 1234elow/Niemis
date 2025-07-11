module.exports = (sequelize, DataTypes) => {
    const Zone = sequelize.define('Zone', {
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
        description: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'zones'
    });

    return Zone;
};