module.exports = (sequelize, DataTypes) => {
    const StudentAthletics = sequelize.define('StudentAthletics', {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        student_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'students', key: 'id' } },
        sport_name: { type: DataTypes.STRING(50), allowNull: false },
        skill_level: { type: DataTypes.ENUM('beginner', 'intermediate', 'advanced') },
        participation_start_date: { type: DataTypes.DATEONLY },
        coach_name: { type: DataTypes.STRING(100) },
        coach_evaluation: { type: DataTypes.TEXT },
        competitions_attended: { type: DataTypes.INTEGER, defaultValue: 0 },
        achievements: { type: DataTypes.TEXT },
        fitness_score: { type: DataTypes.INTEGER },
        health_clearance: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
    }, { tableName: 'student_athletics' });
    return StudentAthletics;
};