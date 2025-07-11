module.exports = (sequelize, DataTypes) => {
    const ReportCard = sequelize.define('ReportCard', {
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
        overall_grade: {
            type: DataTypes.ENUM('E', 'G', 'S', 'N'),
            allowNull: false
        },
        overall_effort: {
            type: DataTypes.ENUM('E', 'G', 'S', 'N'),
            allowNull: false
        },
        overall_behavior: {
            type: DataTypes.ENUM('E', 'G', 'S', 'N'),
            allowNull: false
        },
        attendance_days_present: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        attendance_days_absent: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        attendance_days_late: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        attendance_percentage: {
            type: DataTypes.DECIMAL(5, 2),
            validate: {
                min: 0,
                max: 100
            }
        },
        class_teacher_comments: {
            type: DataTypes.TEXT,
            validate: {
                len: [0, 2000]
            }
        },
        principal_comments: {
            type: DataTypes.TEXT,
            validate: {
                len: [0, 2000]
            }
        },
        health_notes: {
            type: DataTypes.TEXT,
            comment: 'Any health-related observations or concerns'
        },
        social_emotional_notes: {
            type: DataTypes.TEXT,
            comment: 'Social and emotional development observations'
        },
        next_term_goals: {
            type: DataTypes.TEXT,
            comment: 'Goals and recommendations for next term'
        },
        parent_conference_requested: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        generated_date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        released_to_parent: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        parent_signature_date: {
            type: DataTypes.DATE
        },
        is_final: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'report_cards',
        indexes: [
            { fields: ['student_id'] },
            { fields: ['class_id'] },
            { fields: ['term_id'] },
            { fields: ['overall_grade'] },
            { fields: ['generated_date'] },
            { fields: ['is_final'] },
            { unique: true, fields: ['student_id', 'term_id'] }
        ]
    });

    return ReportCard;
};