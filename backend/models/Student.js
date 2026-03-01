module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define(
    "Student",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        references: {
          model: "users",
          key: "id",
        },
      },
      school_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "schools",
          key: "id",
        },
      },
      student_id: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      first_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          len: [1, 50],
        },
      },
      last_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          len: [1, 50],
        },
      },
      date_of_birth: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: true,
          isBefore: new Date().toDateString(),
        },
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: false,
      },
      address: {
        type: DataTypes.TEXT,
      },
      phone: {
        type: DataTypes.STRING(20),
        validate: {
          is: /^[\+]?[0-9\s\-\(\)]+$/,
        },
      },
      email: {
        type: DataTypes.STRING(100),
        validate: {
          isEmail: true,
        },
      },
      rfid_tag: {
        type: DataTypes.STRING(50),
        unique: true,
      },
      enrollment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      grade_level: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      class_section: {
        type: DataTypes.STRING(10),
      },
      class_id: {
        type: DataTypes.UUID,
        references: {
          model: "classes",
          key: "id",
        },
      },
      photo_url: {
        type: DataTypes.STRING(255),
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      year_end_status: {
        type: DataTypes.ENUM("promoted", "stop_down", "graduated"),
        allowNull: true,
        defaultValue: null,
        comment:
          "Year-end progression status: promoted, stop_down (retained), or graduated",
      },
      year_end_status_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: "Date when year-end status was set",
      },
      year_end_status_set_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        comment: "User who set the year-end status",
      },
      year_end_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Additional notes about year-end status decision",
      },
    },
    {
      tableName: "students",
      indexes: [
        { fields: ["student_id"] },
        { fields: ["school_id"] },
        { fields: ["grade_level"] },
        { fields: ["rfid_tag"] },
        { fields: ["is_active"] },
        { fields: ["year_end_status"] },
      ],
    },
  );

  return Student;
};
