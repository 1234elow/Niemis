module.exports = (sequelize, DataTypes) => {
    const AttendanceRecord = sequelize.define('AttendanceRecord', {
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
        school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        attendance_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        check_in_time: {
            type: DataTypes.TIME
        },
        check_out_time: {
            type: DataTypes.TIME
        },
        status: {
            type: DataTypes.ENUM('present', 'absent', 'late', 'excused'),
            defaultValue: 'present'
        },
        rfid_entry_time: {
            type: DataTypes.DATE
        },
        rfid_exit_time: {
            type: DataTypes.DATE
        },
        notes: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'attendance_records',
        indexes: [
            { fields: ['student_id', 'attendance_date'] },
            { fields: ['school_id', 'attendance_date'] },
            { fields: ['status'] }
        ]
    });

    return AttendanceRecord;
};