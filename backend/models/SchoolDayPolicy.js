module.exports = (sequelize, DataTypes) => {
  const SchoolDayPolicy = sequelize.define(
    "SchoolDayPolicy",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      school_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "schools",
          key: "id",
        },
      },
      school_day_start: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: "08:00:00",
      },
      school_day_end: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: "15:00:00",
      },
      break_start: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: "10:00:00",
      },
      break_end: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: "10:20:00",
      },
      lunch_start: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: "12:00:00",
      },
      lunch_end: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: "12:45:00",
      },
      notes: {
        type: DataTypes.TEXT,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      tableName: "school_day_policies",
      indexes: [{ fields: ["school_id"], unique: true }, { fields: ["is_active"] }],
    },
  );

  return SchoolDayPolicy;
};
