const express = require('express');
const { body, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const { 
    Subject, Class, Term, Grade, ReportCard, Student, Staff, School, 
    Parent, StudentParentRelationship, StudentHealth, FamilySocialAssessment, 
    DisabilityAssessment, sequelize 
} = require('../models');
const { seedGradingData } = require('../seedGradingData');
const logger = require('../utils/logger');

const router = express.Router();

// Seed grading data
router.post('/seed', async (req, res, next) => {
    try {
        const result = await seedGradingData();
        logger.info('Grading data seeded successfully');
        res.json(result);
    } catch (error) {
        logger.error('Error seeding grading data:', error);
        next(error);
    }
});

// Get all subjects
router.get('/subjects', async (req, res, next) => {
    try {
        const subjects = await Subject.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });
        res.json(subjects);
    } catch (error) {
        next(error);
    }
});

// Get all classes
router.get('/classes', async (req, res, next) => {
    try {
        const classes = await Class.findAll({
            where: { is_active: true },
            include: [
                { model: School, attributes: ['name'] },
                { model: Staff, as: 'classTeacher', attributes: ['first_name', 'last_name'] }
            ],
            order: [['grade_level', 'ASC'], ['section', 'ASC']]
        });
        res.json(classes);
    } catch (error) {
        next(error);
    }
});

// Get current term
router.get('/current-term', async (req, res, next) => {
    try {
        const currentTerm = await Term.findOne({
            where: { is_current: true }
        });
        res.json(currentTerm);
    } catch (error) {
        next(error);
    }
});

// Get students by class
router.get('/classes/:classId/students', async (req, res, next) => {
    try {
        const { classId } = req.params;
        const students = await Student.findAll({
            where: { 
                class_id: classId,
                is_active: true 
            },
            include: [
                { model: StudentHealth },
                { 
                    model: Parent,
                    through: { attributes: ['relationship_type', 'is_primary'] },
                    attributes: ['first_name', 'last_name', 'phone', 'email']
                }
            ],
            order: [['last_name', 'ASC'], ['first_name', 'ASC']]
        });
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// Get grades for a class and term
router.get('/classes/:classId/grades/:termId', async (req, res, next) => {
    try {
        const { classId, termId } = req.params;
        const grades = await Grade.findAll({
            where: { 
                class_id: classId,
                term_id: termId 
            },
            include: [
                { 
                    model: Student, 
                    attributes: ['id', 'first_name', 'last_name', 'student_id']
                },
                { 
                    model: Subject, 
                    attributes: ['id', 'name', 'code']
                },
                { 
                    model: Staff, 
                    as: 'teacher',
                    attributes: ['first_name', 'last_name']
                }
            ],
            order: [
                [Student, 'last_name', 'ASC'],
                [Student, 'first_name', 'ASC'],
                [Subject, 'name', 'ASC']
            ]
        });
        res.json(grades);
    } catch (error) {
        next(error);
    }
});

// Get detailed student profile
router.get('/students/:studentId/profile', async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const student = await Student.findByPk(studentId, {
            include: [
                { model: School, attributes: ['name'] },
                { model: Class, attributes: ['name', 'grade_level', 'section'] },
                { model: StudentHealth },
                { model: FamilySocialAssessment },
                { model: DisabilityAssessment },
                { 
                    model: Parent,
                    through: { attributes: ['relationship_type', 'is_primary'] },
                    attributes: ['first_name', 'last_name', 'phone', 'email', 'address', 'occupation']
                },
                {
                    model: Grade,
                    include: [
                        { model: Subject, attributes: ['name', 'code'] },
                        { model: Term, attributes: ['name', 'school_year'] }
                    ]
                },
                {
                    model: ReportCard,
                    include: [
                        { model: Term, attributes: ['name', 'school_year'] }
                    ]
                }
            ]
        });
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json(student);
    } catch (error) {
        next(error);
    }
});

// Get report card for student and term
router.get('/students/:studentId/report-card/:termId', async (req, res, next) => {
    try {
        const { studentId, termId } = req.params;
        const reportCard = await ReportCard.findOne({
            where: { 
                student_id: studentId,
                term_id: termId 
            },
            include: [
                { 
                    model: Student,
                    include: [
                        { model: School, attributes: ['name'] },
                        { model: Class, attributes: ['name', 'grade_level'] },
                        { model: StudentHealth },
                        { 
                            model: Parent,
                            through: { attributes: ['relationship_type', 'is_primary'] },
                            attributes: ['first_name', 'last_name', 'phone']
                        }
                    ]
                },
                { model: Term, attributes: ['name', 'school_year'] }
            ]
        });

        if (!reportCard) {
            return res.status(404).json({ error: 'Report card not found' });
        }

        // Get grades for this student and term
        const grades = await Grade.findAll({
            where: {
                student_id: studentId,
                term_id: termId
            },
            include: [
                { model: Subject, attributes: ['name', 'code'] },
                { model: Staff, as: 'teacher', attributes: ['first_name', 'last_name'] }
            ],
            order: [[Subject, 'name', 'ASC']]
        });

        res.json({
            ...reportCard.toJSON(),
            grades
        });
    } catch (error) {
        next(error);
    }
});

// Update grades (bulk update for teacher grade entry)
router.put('/grades/bulk-update', [
    body('grades').isArray().withMessage('Grades must be an array'),
    body('grades.*.student_id').isUUID().withMessage('Student ID must be valid UUID'),
    body('grades.*.subject_id').isUUID().withMessage('Subject ID must be valid UUID'),
    body('grades.*.grade_value').isIn(['E', 'G', 'S', 'N']).withMessage('Invalid grade value'),
    body('grades.*.effort_grade').isIn(['E', 'G', 'S', 'N']).withMessage('Invalid effort grade'),
    body('grades.*.behavior_grade').isIn(['E', 'G', 'S', 'N']).withMessage('Invalid behavior grade')
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { grades } = req.body;
        const updatedGrades = [];

        // Use transaction for bulk update
        await sequelize.transaction(async (t) => {
            for (const gradeData of grades) {
                const [grade] = await Grade.findOrCreate({
                    where: {
                        student_id: gradeData.student_id,
                        subject_id: gradeData.subject_id,
                        term_id: gradeData.term_id
                    },
                    defaults: {
                        ...gradeData,
                        last_modified: new Date()
                    },
                    transaction: t
                });

                if (!grade.isNewRecord) {
                    await grade.update({
                        ...gradeData,
                        last_modified: new Date()
                    }, { transaction: t });
                }

                updatedGrades.push(grade);
            }
        });

        logger.info(`Bulk updated ${updatedGrades.length} grades`);
        res.json({ 
            message: 'Grades updated successfully',
            updated_count: updatedGrades.length 
        });
    } catch (error) {
        next(error);
    }
});

// Generate report cards for a class and term
router.post('/report-cards/generate', [
    body('class_id').isUUID().withMessage('Class ID must be valid UUID'),
    body('term_id').isUUID().withMessage('Term ID must be valid UUID')
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { class_id, term_id } = req.body;

        // Get all students in the class
        const students = await Student.findAll({
            where: { 
                class_id,
                is_active: true 
            },
            include: [
                {
                    model: Grade,
                    where: { term_id },
                    include: [{ model: Subject }]
                }
            ]
        });

        const generatedReportCards = [];

        await sequelize.transaction(async (t) => {
            for (const student of students) {
                // Calculate overall grades
                const grades = student.Grades;
                const gradeValues = grades.map(g => g.grade_value);
                const effortValues = grades.map(g => g.effort_grade);
                const behaviorValues = grades.map(g => g.behavior_grade);

                const overallGrade = calculateOverallGrade(gradeValues);
                const overallEffort = calculateOverallGrade(effortValues);
                const overallBehavior = calculateOverallGrade(behaviorValues);

                // Mock attendance data
                const daysPresent = 45 + Math.floor(Math.random() * 10);
                const daysAbsent = 5 - Math.floor(Math.random() * 5);
                const attendancePercentage = ((daysPresent / (daysPresent + daysAbsent)) * 100).toFixed(1);

                const [reportCard] = await ReportCard.findOrCreate({
                    where: {
                        student_id: student.id,
                        term_id
                    },
                    defaults: {
                        student_id: student.id,
                        class_id,
                        term_id,
                        overall_grade: overallGrade,
                        overall_effort: overallEffort,
                        overall_behavior: overallBehavior,
                        attendance_days_present: daysPresent,
                        attendance_days_absent: daysAbsent,
                        attendance_percentage: parseFloat(attendancePercentage),
                        class_teacher_comments: `${student.first_name} has made good progress this term.`,
                        principal_comments: `${student.first_name} is a valued member of our school community.`,
                        is_final: true
                    },
                    transaction: t
                });

                generatedReportCards.push(reportCard);
            }
        });

        logger.info(`Generated ${generatedReportCards.length} report cards`);
        res.json({ 
            message: 'Report cards generated successfully',
            generated_count: generatedReportCards.length 
        });
    } catch (error) {
        next(error);
    }
});

// Export grades to Excel
router.get('/export/grades/:classId/:termId', async (req, res, next) => {
    try {
        const { classId, termId } = req.params;

        // Get class and term info
        const classInfo = await Class.findByPk(classId, {
            include: [{ model: School, attributes: ['name'] }]
        });
        const termInfo = await Term.findByPk(termId);

        if (!classInfo || !termInfo) {
            return res.status(404).json({ error: 'Class or term not found' });
        }

        // Get all students with grades
        const students = await Student.findAll({
            where: { 
                class_id: classId,
                is_active: true 
            },
            include: [
                {
                    model: Grade,
                    where: { term_id: termId },
                    include: [{ model: Subject }],
                    required: false
                },
                { model: StudentHealth },
                { 
                    model: Parent,
                    through: { attributes: ['relationship_type', 'is_primary'] },
                    attributes: ['first_name', 'last_name', 'phone']
                }
            ],
            order: [['last_name', 'ASC'], ['first_name', 'ASC']]
        });

        // Get all subjects
        const subjects = await Subject.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        
        // Class Summary Sheet
        const summarySheet = workbook.addWorksheet('Class Summary');
        
        // Header information
        summarySheet.mergeCells('A1:H1');
        summarySheet.getCell('A1').value = `${classInfo.School.name} - ${classInfo.name} Grade Report`;
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.mergeCells('A2:H2');
        summarySheet.getCell('A2').value = `${termInfo.name} ${termInfo.school_year}`;
        summarySheet.getCell('A2').font = { bold: true, size: 12 };
        summarySheet.getCell('A2').alignment = { horizontal: 'center' };

        // Headers
        const headers = ['Student ID', 'Name', 'DOB', 'Gender', ...subjects.map(s => s.code), 'Overall', 'Comments'];
        summarySheet.addRow([]);
        const headerRow = summarySheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        // Student data
        for (const student of students) {
            const row = [
                student.student_id,
                `${student.first_name} ${student.last_name}`,
                student.date_of_birth,
                student.gender
            ];

            // Add grades for each subject
            for (const subject of subjects) {
                const grade = student.Grades.find(g => g.subject_id === subject.id);
                row.push(grade ? grade.grade_value : '-');
            }

            // Calculate overall grade
            const gradeValues = student.Grades.map(g => g.grade_value);
            const overallGrade = calculateOverallGrade(gradeValues);
            row.push(overallGrade);
            row.push('See individual report card');

            summarySheet.addRow(row);
        }

        // Auto-fit columns
        summarySheet.columns.forEach(column => {
            column.width = 15;
        });

        // Individual Student Sheets
        for (const student of students) {
            const studentSheet = workbook.addWorksheet(`${student.first_name} ${student.last_name}`);
            
            // Student information
            studentSheet.mergeCells('A1:D1');
            studentSheet.getCell('A1').value = `Student Report Card - ${student.first_name} ${student.last_name}`;
            studentSheet.getCell('A1').font = { bold: true, size: 14 };

            studentSheet.addRow(['Student ID:', student.student_id]);
            studentSheet.addRow(['Class:', classInfo.name]);
            studentSheet.addRow(['Term:', `${termInfo.name} ${termInfo.school_year}`]);
            studentSheet.addRow(['Date of Birth:', student.date_of_birth]);
            studentSheet.addRow([]);

            // Parent information
            const primaryParent = student.Parents.find(p => p.StudentParentRelationship.is_primary);
            if (primaryParent) {
                studentSheet.addRow(['Primary Contact:', `${primaryParent.first_name} ${primaryParent.last_name}`]);
                studentSheet.addRow(['Phone:', primaryParent.phone]);
                studentSheet.addRow([]);
            }

            // Health information
            if (student.StudentHealth) {
                studentSheet.addRow(['Health Information:']);
                studentSheet.addRow(['Medical Conditions:', student.StudentHealth.medical_conditions || 'None']);
                studentSheet.addRow(['Allergies:', student.StudentHealth.allergies || 'None']);
                studentSheet.addRow(['Medications:', student.StudentHealth.medications || 'None']);
                studentSheet.addRow([]);
            }

            // Grades
            studentSheet.addRow(['Subject', 'Grade', 'Effort', 'Behavior', 'Teacher Comments']);
            const gradeHeaderRow = studentSheet.lastRow;
            gradeHeaderRow.font = { bold: true };
            gradeHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

            for (const grade of student.Grades) {
                studentSheet.addRow([
                    grade.Subject.name,
                    grade.grade_value,
                    grade.effort_grade,
                    grade.behavior_grade,
                    grade.teacher_comments || ''
                ]);
            }

            // Auto-fit columns
            studentSheet.columns.forEach(column => {
                column.width = 20;
            });
        }

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${classInfo.name}_${termInfo.name}_Grades.xlsx"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

        logger.info(`Excel report generated for class ${classInfo.name}, term ${termInfo.name}`);
    } catch (error) {
        next(error);
    }
});

// Helper function to calculate overall grade
function calculateOverallGrade(grades) {
    const gradePoints = { 'E': 4, 'G': 3, 'S': 2, 'N': 1 };
    const totalPoints = grades.reduce((sum, grade) => sum + gradePoints[grade], 0);
    const average = totalPoints / grades.length;
    
    if (average >= 3.5) return 'E';
    if (average >= 2.5) return 'G';
    if (average >= 1.5) return 'S';
    return 'N';
}

module.exports = router;