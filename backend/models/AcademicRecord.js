module.exports = (sequelize, DataTypes) => {
    const AcademicRecord = sequelize.define('AcademicRecord', {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        student_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'students', key: 'id' } },
        school_year: { type: DataTypes.STRING(10), allowNull: false },
        term: { type: DataTypes.STRING(20), allowNull: false },
        subject: { type: DataTypes.STRING(50), allowNull: false },
        grade: { type: DataTypes.STRING(5) },
        grade_points: { type: DataTypes.DECIMAL(3,2) },
        teacher_id: { type: DataTypes.UUID, references: { model: 'staff', key: 'id' } },
        assignment_scores: { type: DataTypes.JSONB },
        exam_scores: { type: DataTypes.JSONB },
        comments: { type: DataTypes.TEXT }
    }, { tableName: 'academic_records' });
    return AcademicRecord;
};