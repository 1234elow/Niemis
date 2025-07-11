module.exports = (sequelize, DataTypes) => {
    const StudentParentRelationship = sequelize.define('StudentParentRelationship', {
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
        parent_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'parents_guardians',
                key: 'id'
            }
        },
        relationship_type: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        is_primary: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'student_parent_relationships'
    });

    return StudentParentRelationship;
};