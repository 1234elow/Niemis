module.exports = (sequelize, DataTypes) => {
    const StudentHealth = sequelize.define('StudentHealth', {
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
        medical_conditions: {
            type: DataTypes.TEXT
        },
        allergies: {
            type: DataTypes.TEXT
        },
        medications: {
            type: DataTypes.TEXT
        },
        immunization_records: {
            type: DataTypes.JSONB
        },
        emergency_contact_name: {
            type: DataTypes.STRING(100)
        },
        emergency_contact_phone: {
            type: DataTypes.STRING(20)
        },
        blood_type: {
            type: DataTypes.STRING(5)
        },
        doctor_name: {
            type: DataTypes.STRING(100)
        },
        doctor_phone: {
            type: DataTypes.STRING(20)
        },
        last_physical_exam: {
            type: DataTypes.DATEONLY
        }
    }, {
        tableName: 'student_health'
    });

    return StudentHealth;
};