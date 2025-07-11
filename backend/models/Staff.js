module.exports = (sequelize, DataTypes) => {
    const Staff = sequelize.define('Staff', {
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
        school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        employee_id: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true
        },
        first_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                len: [1, 50]
            }
        },
        last_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                len: [1, 50]
            }
        },
        date_of_birth: {
            type: DataTypes.DATEONLY,
            validate: {
                isDate: true,
                isBefore: new Date().toDateString()
            }
        },
        gender: {
            type: DataTypes.ENUM('male', 'female', 'other')
        },
        phone: {
            type: DataTypes.STRING(20),
            validate: {
                is: /^[\+]?[0-9\s\-\(\)]+$/
            }
        },
        address: {
            type: DataTypes.TEXT
        },
        position: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        role_level: {
            type: DataTypes.ENUM('teacher', 'department_head', 'administrator', 'principal', 'janitorial', 'support'),
            defaultValue: 'teacher'
        },
        previous_role: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        role_change_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        role_changed_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        department: {
            type: DataTypes.STRING(50)
        },
        hire_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        salary: {
            type: DataTypes.DECIMAL(10, 2),
            validate: {
                min: 0
            }
        },
        qualifications: {
            type: DataTypes.TEXT
        },
        certifications: {
            type: DataTypes.TEXT
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'staff',
        indexes: [
            { fields: ['employee_id'] },
            { fields: ['school_id'] },
            { fields: ['position'] },
            { fields: ['is_active'] }
        ]
    });

    return Staff;
};