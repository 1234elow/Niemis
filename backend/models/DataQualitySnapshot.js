module.exports = (sequelize, DataTypes) => {
    const DataQualitySnapshot = sequelize.define('DataQualitySnapshot', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        snapshot_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        generated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        scope_level: {
            type: DataTypes.ENUM('national', 'school'),
            allowNull: false,
            defaultValue: 'national'
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        overall_score: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM('healthy', 'watch', 'critical'),
            allowNull: false,
            defaultValue: 'critical'
        },
        issue_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        critical_issues: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        warning_issues: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        info_issues: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
        }
    }, {
        tableName: 'data_quality_snapshots',
        indexes: [
            { fields: ['snapshot_date'] },
            { fields: ['scope_level'] },
            { fields: ['school_id'] },
            { fields: ['generated_at'] }
        ]
    });

    return DataQualitySnapshot;
};
