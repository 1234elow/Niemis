module.exports = (sequelize, DataTypes) => {
    const BsseeApplication = sequelize.define('BsseeApplication', {
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
        primary_school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        exam_year: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 2020,
                max: 2100
            }
        },
        exam_candidate_number: {
            type: DataTypes.STRING(40),
            allowNull: true
        },
        exam_score: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        english_score: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        math_score: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        status: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: 'submitted',
            validate: {
                isIn: [[
                    'submitted',
                    'under_review',
                    'placement_pending',
                    'placed',
                    'appeal_pending',
                    'completed',
                    'rejected'
                ]]
            }
        },
        preferred_school_1_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        preferred_school_2_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        preferred_school_3_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        placement_school_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        accommodation_required: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        deferral_requested: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        citizenship_status: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: 'national',
            validate: {
                isIn: [['national', 'resident', 'non_national']]
            }
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        review_notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        submitted_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        reviewed_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        submitted_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        reviewed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        placed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'bssee_applications',
        indexes: [
            { fields: ['student_id'] },
            { fields: ['primary_school_id'] },
            { fields: ['exam_year'] },
            { fields: ['status'] },
            { fields: ['placement_school_id'] },
            { fields: ['is_active'] },
            { fields: ['student_id', 'exam_year'], unique: true }
        ]
    });

    return BsseeApplication;
};
