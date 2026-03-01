module.exports = (sequelize, DataTypes) => {
  const ClassTimetableSlot = sequelize.define(
    "ClassTimetableSlot",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      class_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "classes",
          key: "id",
        },
      },
      teacher_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "staff",
          key: "id",
        },
      },
      subject_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "subjects",
          key: "id",
        },
      },
      day_of_week: {
        type: DataTypes.ENUM(
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ),
        allowNull: false,
      },
      start_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      end_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      slot_type: {
        type: DataTypes.ENUM("lesson", "break", "lunch", "assembly"),
        allowNull: false,
        defaultValue: "lesson",
      },
      room: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "class_timetable_slots",
      indexes: [
        { fields: ["class_id", "day_of_week", "start_time"] },
        { fields: ["teacher_id", "day_of_week", "start_time"] },
        { fields: ["slot_type"] },
        { fields: ["is_active"] },
      ],
    },
  );

  return ClassTimetableSlot;
};
