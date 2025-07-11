module.exports = (sequelize, DataTypes) => {
    const AuditLog = sequelize.define('AuditLog', {
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
        action: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        table_name: {
            type: DataTypes.STRING(50)
        },
        record_id: {
            type: DataTypes.UUID
        },
        old_values: {
            type: DataTypes.JSONB
        },
        new_values: {
            type: DataTypes.JSONB
        },
        ip_address: {
            type: DataTypes.INET
        },
        user_agent: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'audit_logs'
    });

    return AuditLog;
};