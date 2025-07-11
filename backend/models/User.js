module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            validate: {
                len: [3, 50],
                is: /^[a-zA-Z0-9._-]+$/
            }
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password_hash: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('super_admin', 'admin', 'teacher', 'parent', 'student'),
            allowNull: false,
            defaultValue: 'student'
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        last_login: {
            type: DataTypes.DATE
        }
    }, {
        tableName: 'users',
        indexes: [
            { fields: ['email'] },
            { fields: ['username'] },
            { fields: ['role'] }
        ]
    });

    return User;
};