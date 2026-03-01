module.exports = (sequelize, DataTypes) => {
  const Facility = sequelize.define('Facility', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    school_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    facility_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    facility_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    room_number: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    area_sqm: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true
    },
    condition_status: {
      type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor'),
      defaultValue: 'good',
      allowNull: false
    },
    accessibility_features: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    last_maintenance: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    next_maintenance: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    }
  }, {
    tableName: 'facilities',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Facility;
};
