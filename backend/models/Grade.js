module.exports = (sequelize, DataTypes) => {
    const Grade = sequelize.define('Grade', {
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
        subject_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'subjects',
                key: 'id'
            }
        },
        class_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'classes',
                key: 'id'
            }
        },
        term_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'terms',
                key: 'id'
            }
        },
        teacher_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'staff',
                key: 'id'
            }
        },
        grade_value: {
            type: DataTypes.ENUM('E', 'G', 'S', 'N'),
            allowNull: false,
            comment: 'E=Excellent, G=Good, S=Satisfactory, N=Needs Improvement'
        },
        numeric_score: {
            type: DataTypes.DECIMAL(5, 2),
            validate: {
                min: 0,
                max: 100
            }
        },
        effort_grade: {
            type: DataTypes.ENUM('E', 'G', 'S', 'N'),
            allowNull: false
        },
        behavior_grade: {
            type: DataTypes.ENUM('E', 'G', 'S', 'N'),
            allowNull: false
        },
        teacher_comments: {
            type: DataTypes.TEXT,
            validate: {
                len: [0, 1000]
            }
        },
        assessment_components: {
            type: DataTypes.JSONB,
            comment: 'Breakdown of assessments: classwork, participation, projects, etc.'
        },
        attendance_impact: {
            type: DataTypes.TEXT,
            comment: 'How attendance affected performance'
        },
        date_entered: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        last_modified: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        is_final: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Whether grade is finalized for the term'
        }
    }, {
        tableName: 'grades',
        indexes: [
            { fields: ['student_id'] },
            { fields: ['subject_id'] },
            { fields: ['class_id'] },
            { fields: ['term_id'] },
            { fields: ['teacher_id'] },
            { fields: ['grade_value'] },
            { fields: ['is_final'] },
            { unique: true, fields: ['student_id', 'subject_id', 'term_id'] }
        ]
    });

    return Grade;
};