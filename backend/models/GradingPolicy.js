module.exports = (sequelize, DataTypes) => {
  const GradingPolicy = sequelize.define(
    "GradingPolicy",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      school_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "schools",
          key: "id",
        },
      },
      policy_name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      grade_band: {
        type: DataTypes.ENUM(
          "pre_primary",
          "primary",
          "lower_secondary",
          "upper_secondary",
          "sixth_form",
        ),
        allowNull: false,
      },
      school_type: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      continuous_assessment_weight: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 70,
        validate: {
          min: 0,
          max: 100,
        },
      },
      end_term_exam_weight: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 30,
        validate: {
          min: 0,
          max: 100,
        },
      },
      pass_mark: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 50,
        validate: {
          min: 0,
          max: 100,
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "grading_policies",
      indexes: [
        { fields: ["school_id"] },
        { fields: ["grade_band"] },
        { fields: ["is_active"] },
      ],
    },
  );

  return GradingPolicy;
};
