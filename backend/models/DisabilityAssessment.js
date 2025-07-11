module.exports = (sequelize, DataTypes) => {
    const DisabilityAssessment = sequelize.define('DisabilityAssessment', {
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
        disability_type: {
            type: DataTypes.STRING(100)
        },
        severity_level: {
            type: DataTypes.ENUM('mild', 'moderate', 'severe')
        },
        disability_index_score: {
            type: DataTypes.INTEGER
        },
        accommodations_needed: {
            type: DataTypes.TEXT
        },
        support_services: {
            type: DataTypes.TEXT
        },
        iep_status: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        iep_document_url: {
            type: DataTypes.STRING(255)
        },
        assessment_date: {
            type: DataTypes.DATEONLY
        },
        next_review_date: {
            type: DataTypes.DATEONLY
        }
    }, {
        tableName: 'disability_assessments'
    });

    return DisabilityAssessment;
};