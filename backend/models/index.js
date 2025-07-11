const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Import all models
const User = require('./User')(sequelize, DataTypes);
const Zone = require('./Zone')(sequelize, DataTypes);
const Parish = require('./Parish')(sequelize, DataTypes);
const School = require('./School')(sequelize, DataTypes);
const Staff = require('./Staff')(sequelize, DataTypes);
const Student = require('./Student')(sequelize, DataTypes);
const Parent = require('./Parent')(sequelize, DataTypes);
const StudentParentRelationship = require('./StudentParentRelationship')(sequelize, DataTypes);
const StudentHealth = require('./StudentHealth')(sequelize, DataTypes);
const FamilySocialAssessment = require('./FamilySocialAssessment')(sequelize, DataTypes);
const DisabilityAssessment = require('./DisabilityAssessment')(sequelize, DataTypes);
const StudentAthletics = require('./StudentAthletics')(sequelize, DataTypes);
const AttendanceRecord = require('./AttendanceRecord')(sequelize, DataTypes);
const AcademicRecord = require('./AcademicRecord')(sequelize, DataTypes);
const StudentTransfer = require('./StudentTransfer')(sequelize, DataTypes);
const Facility = require('./Facility')(sequelize, DataTypes);
const InventoryItem = require('./InventoryItem')(sequelize, DataTypes);
const TeacherEvaluation = require('./TeacherEvaluation')(sequelize, DataTypes);
const ProfessionalDevelopment = require('./ProfessionalDevelopment')(sequelize, DataTypes);
const RFIDDevice = require('./RFIDDevice')(sequelize, DataTypes);
const AuditLog = require('./AuditLog')(sequelize, DataTypes);
const Subject = require('./Subject')(sequelize, DataTypes);
const Class = require('./Class')(sequelize, DataTypes);
const Term = require('./Term')(sequelize, DataTypes);
const Grade = require('./Grade')(sequelize, DataTypes);
const ReportCard = require('./ReportCard')(sequelize, DataTypes);

// Define associations
const models = {
    User,
    Zone,
    Parish,
    School,
    Staff,
    Student,
    Parent,
    StudentParentRelationship,
    StudentHealth,
    FamilySocialAssessment,
    DisabilityAssessment,
    StudentAthletics,
    AttendanceRecord,
    AcademicRecord,
    StudentTransfer,
    Facility,
    InventoryItem,
    TeacherEvaluation,
    ProfessionalDevelopment,
    RFIDDevice,
    AuditLog,
    Subject,
    Class,
    Term,
    Grade,
    ReportCard
};

// User associations
User.hasOne(Staff, { foreignKey: 'user_id' });
User.hasOne(Student, { foreignKey: 'user_id' });
User.hasOne(Parent, { foreignKey: 'user_id' });

// School associations
School.belongsTo(Zone, { foreignKey: 'zone_id' });
School.belongsTo(Parish, { foreignKey: 'parish_id' });
School.hasMany(Staff, { foreignKey: 'school_id' });
School.hasMany(Student, { foreignKey: 'school_id' });
School.hasMany(Facility, { foreignKey: 'school_id' });
School.hasMany(RFIDDevice, { foreignKey: 'school_id' });

// Staff associations
Staff.belongsTo(User, { foreignKey: 'user_id' });
Staff.belongsTo(School, { foreignKey: 'school_id' });
Staff.hasMany(TeacherEvaluation, { foreignKey: 'teacher_id' });
Staff.hasMany(ProfessionalDevelopment, { foreignKey: 'staff_id' });
Staff.hasMany(AcademicRecord, { foreignKey: 'teacher_id' });

// Student associations
Student.belongsTo(User, { foreignKey: 'user_id' });
Student.belongsTo(School, { foreignKey: 'school_id' });
Student.hasOne(StudentHealth, { foreignKey: 'student_id' });
Student.hasOne(FamilySocialAssessment, { foreignKey: 'student_id' });
Student.hasMany(DisabilityAssessment, { foreignKey: 'student_id' });
Student.hasMany(StudentAthletics, { foreignKey: 'student_id' });
Student.hasMany(AttendanceRecord, { foreignKey: 'student_id' });
Student.hasMany(AcademicRecord, { foreignKey: 'student_id' });
Student.hasMany(StudentTransfer, { foreignKey: 'student_id' });
Student.belongsToMany(Parent, { 
    through: StudentParentRelationship, 
    foreignKey: 'student_id',
    otherKey: 'parent_id'
});

// Parent associations
Parent.belongsTo(User, { foreignKey: 'user_id' });
Parent.belongsToMany(Student, { 
    through: StudentParentRelationship, 
    foreignKey: 'parent_id',
    otherKey: 'student_id'
});

// Facility associations
Facility.belongsTo(School, { foreignKey: 'school_id' });
Facility.hasMany(InventoryItem, { foreignKey: 'facility_id' });

// Other associations
AttendanceRecord.belongsTo(Student, { foreignKey: 'student_id' });
AttendanceRecord.belongsTo(School, { foreignKey: 'school_id' });

AcademicRecord.belongsTo(Student, { foreignKey: 'student_id' });
AcademicRecord.belongsTo(Staff, { foreignKey: 'teacher_id', as: 'teacher' });

StudentTransfer.belongsTo(Student, { foreignKey: 'student_id' });
StudentTransfer.belongsTo(School, { foreignKey: 'from_school_id', as: 'fromSchool' });
StudentTransfer.belongsTo(School, { foreignKey: 'to_school_id', as: 'toSchool' });

TeacherEvaluation.belongsTo(Staff, { foreignKey: 'teacher_id', as: 'teacher' });
TeacherEvaluation.belongsTo(Staff, { foreignKey: 'evaluator_id', as: 'evaluator' });

AuditLog.belongsTo(User, { foreignKey: 'user_id' });

// New grading system associations
// Class associations
Class.belongsTo(School, { foreignKey: 'school_id' });
Class.belongsTo(Staff, { foreignKey: 'class_teacher_id', as: 'classTeacher' });
Class.hasMany(Student, { foreignKey: 'class_id' });
Class.hasMany(Grade, { foreignKey: 'class_id' });
Class.hasMany(ReportCard, { foreignKey: 'class_id' });

// School associations for new models
School.hasMany(Class, { foreignKey: 'school_id' });

// Staff associations for new models
Staff.hasMany(Class, { foreignKey: 'class_teacher_id' });
Staff.hasMany(Grade, { foreignKey: 'teacher_id' });

// Student associations for new models
Student.belongsTo(Class, { foreignKey: 'class_id' });
Student.hasMany(Grade, { foreignKey: 'student_id' });
Student.hasMany(ReportCard, { foreignKey: 'student_id' });

// Subject associations
Subject.hasMany(Grade, { foreignKey: 'subject_id' });

// Term associations
Term.hasMany(Grade, { foreignKey: 'term_id' });
Term.hasMany(ReportCard, { foreignKey: 'term_id' });

// Grade associations
Grade.belongsTo(Student, { foreignKey: 'student_id' });
Grade.belongsTo(Subject, { foreignKey: 'subject_id' });
Grade.belongsTo(Class, { foreignKey: 'class_id' });
Grade.belongsTo(Term, { foreignKey: 'term_id' });
Grade.belongsTo(Staff, { foreignKey: 'teacher_id', as: 'teacher' });

// ReportCard associations
ReportCard.belongsTo(Student, { foreignKey: 'student_id' });
ReportCard.belongsTo(Class, { foreignKey: 'class_id' });
ReportCard.belongsTo(Term, { foreignKey: 'term_id' });

module.exports = {
    sequelize,
    ...models
};