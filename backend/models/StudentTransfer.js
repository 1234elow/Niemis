module.exports = (sequelize, DataTypes) => {
    const StudentTransfer = sequelize.define('StudentTransfer', {
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
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        approved_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        transfer_reason: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        academic_year: {
            type: DataTypes.STRING(10),
            allowNull: false
        },
        current_grade: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        target_grade: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
            defaultValue: 'pending'
        },
        transfer_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        effective_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        admin_notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        parent_consent: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        academic_records_transferred: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        medical_records_transferred: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'student_transfers',
        indexes: [
            { fields: ['student_id'] },
            { fields: ['from_school_id'] },
            { fields: ['to_school_id'] },
            { fields: ['status'] },
            { fields: ['transfer_date'] }
        ]
    });

    return StudentTransfer;
};
