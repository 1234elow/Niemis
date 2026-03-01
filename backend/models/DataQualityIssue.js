module.exports = (sequelize, DataTypes) => {
    const DataQualityIssue = sequelize.define('DataQualityIssue', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        issue_signature: {
            type: DataTypes.STRING(200),
            allowNull: false,
            unique: true
        },
        check_key: {
            type: DataTypes.STRING(120),
            allowNull: false
        },
        label: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        severity: {
            type: DataTypes.ENUM('critical', 'warning', 'info'),
            allowNull: false,
            defaultValue: 'warning'
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
        status: {
            type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'ignored'),
            allowNull: false,
            defaultValue: 'open'
        },
        issue_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        sample_details: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        assigned_to: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        assigned_by: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        due_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        ignored_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        resolution_notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        first_detected_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        last_detected_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        resolved_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        sla_hours: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 72
        }
    }, {
        tableName: 'data_quality_issues',
        indexes: [
            { fields: ['issue_signature'], unique: true },
            { fields: ['check_key'] },
            { fields: ['severity'] },
            { fields: ['status'] },
            { fields: ['scope_level'] },
            { fields: ['school_id'] },
            { fields: ['last_detected_at'] }
        ]
    });

    return DataQualityIssue;
};
