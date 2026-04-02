module.exports = (sequelize, DataTypes) => {
    const TeacherTransfer = sequelize.define('TeacherTransfer', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        teacher_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'staff',
                key: 'id'
            }
        },
        from_school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        to_school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        initiated_by: {
            type: DataTypes.STRING(64),
            allowNull: false
        },
        approved_by: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        transfer_reason: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
            defaultValue: 'pending'
        },
        effective_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        transfer_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        class_handover_completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        documents_verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        admin_notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'teacher_transfers',
        indexes: [
            { fields: ['teacher_id'] },
            { fields: ['from_school_id'] },
            { fields: ['to_school_id'] },
            { fields: ['status'] },
            { fields: ['transfer_date'] }
        ]
    });

    return TeacherTransfer;
};
