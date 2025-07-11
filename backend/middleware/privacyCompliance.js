const logger = require('../utils/logger');
const { User, Student, Parent, AuditLog } = require('../models');
const { Op } = require('sequelize');

/**
 * GDPR/Privacy Compliance Middleware for NiEMIS
 * Handles data protection, privacy rights, and compliance requirements
 */

/**
 * Privacy Rights under GDPR and local data protection laws
 */
const PrivacyRights = {
    RIGHT_TO_ACCESS: 'right_to_access',
    RIGHT_TO_RECTIFICATION: 'right_to_rectification',
    RIGHT_TO_ERASURE: 'right_to_erasure',
    RIGHT_TO_PORTABILITY: 'right_to_portability',
    RIGHT_TO_RESTRICT_PROCESSING: 'right_to_restrict_processing',
    RIGHT_TO_OBJECT: 'right_to_object',
    RIGHT_TO_WITHDRAW_CONSENT: 'right_to_withdraw_consent'
};

/**
 * Data Processing Purposes
 */
const ProcessingPurposes = {
    EDUCATIONAL_ADMINISTRATION: 'educational_administration',
    STUDENT_PROGRESS_TRACKING: 'student_progress_tracking',
    HEALTH_AND_SAFETY: 'health_and_safety',
    REGULATORY_COMPLIANCE: 'regulatory_compliance',
    COMMUNICATION: 'communication',
    EMERGENCY_CONTACT: 'emergency_contact',
    STATISTICAL_ANALYSIS: 'statistical_analysis'
};

/**
 * Data Categories
 */
const DataCategories = {
    PERSONAL_IDENTIFIERS: 'personal_identifiers',
    CONTACT_INFORMATION: 'contact_information',
    DEMOGRAPHIC_DATA: 'demographic_data',
    ACADEMIC_RECORDS: 'academic_records',
    ATTENDANCE_DATA: 'attendance_data',
    HEALTH_DATA: 'health_data',
    FAMILY_DATA: 'family_data',
    BEHAVIORAL_DATA: 'behavioral_data',
    BIOMETRIC_DATA: 'biometric_data',
    FINANCIAL_DATA: 'financial_data'
};

/**
 * Legal Bases for Processing
 */
const LegalBases = {
    CONSENT: 'consent',
    CONTRACT: 'contract',
    LEGAL_OBLIGATION: 'legal_obligation',
    VITAL_INTERESTS: 'vital_interests',
    PUBLIC_TASK: 'public_task',
    LEGITIMATE_INTERESTS: 'legitimate_interests'
};

class PrivacyComplianceManager {
    constructor() {
        this.enabled = process.env.PRIVACY_COMPLIANCE_ENABLED === 'true';
        this.dataRetentionPeriods = this.loadDataRetentionPeriods();
        this.consentDatabase = new Map();
        this.dataProcessingLog = [];
        this.privacySettings = this.loadPrivacySettings();
    }

    /**
     * Load data retention periods
     */
    loadDataRetentionPeriods() {
        return {
            // Student data retention periods (in months)
            student_records: parseInt(process.env.RETENTION_STUDENT_RECORDS) || 84, // 7 years
            academic_records: parseInt(process.env.RETENTION_ACADEMIC_RECORDS) || 60, // 5 years
            attendance_records: parseInt(process.env.RETENTION_ATTENDANCE_RECORDS) || 36, // 3 years
            health_records: parseInt(process.env.RETENTION_HEALTH_RECORDS) || 60, // 5 years
            disciplinary_records: parseInt(process.env.RETENTION_DISCIPLINARY_RECORDS) || 24, // 2 years
            
            // Staff data retention periods
            staff_records: parseInt(process.env.RETENTION_STAFF_RECORDS) || 84, // 7 years
            performance_evaluations: parseInt(process.env.RETENTION_PERFORMANCE_EVALS) || 60, // 5 years
            
            // System data retention periods
            audit_logs: parseInt(process.env.RETENTION_AUDIT_LOGS) || 60, // 5 years
            security_logs: parseInt(process.env.RETENTION_SECURITY_LOGS) || 84, // 7 years
            backup_data: parseInt(process.env.RETENTION_BACKUP_DATA) || 12, // 1 year
            
            // Communication data
            email_communications: parseInt(process.env.RETENTION_EMAIL_COMM) || 24, // 2 years
            sms_communications: parseInt(process.env.RETENTION_SMS_COMM) || 12, // 1 year
        };
    }

    /**
     * Load privacy settings
     */
    loadPrivacySettings() {
        return {
            requireExplicitConsent: process.env.PRIVACY_REQUIRE_EXPLICIT_CONSENT === 'true',
            enableDataPortability: process.env.PRIVACY_ENABLE_DATA_PORTABILITY === 'true',
            enableRightToErasure: process.env.PRIVACY_ENABLE_RIGHT_TO_ERASURE === 'true',
            enableConsentWithdrawal: process.env.PRIVACY_ENABLE_CONSENT_WITHDRAWAL === 'true',
            anonymizeAfterRetention: process.env.PRIVACY_ANONYMIZE_AFTER_RETENTION === 'true',
            dataProcessingNotifications: process.env.PRIVACY_DATA_PROCESSING_NOTIFICATIONS === 'true',
            privacyByDesign: process.env.PRIVACY_BY_DESIGN === 'true',
            minimumDataCollection: process.env.PRIVACY_MINIMUM_DATA_COLLECTION === 'true'
        };
    }

    /**
     * Record consent
     */
    async recordConsent(userId, purpose, dataCategories, legalBasis = LegalBases.CONSENT) {
        const consentRecord = {
            userId,
            purpose,
            dataCategories: Array.isArray(dataCategories) ? dataCategories : [dataCategories],
            legalBasis,
            timestamp: new Date(),
            consentGiven: true,
            withdrawnAt: null,
            ipAddress: null,
            userAgent: null
        };

        this.consentDatabase.set(`${userId}-${purpose}`, consentRecord);
        
        // Log consent
        logger.info('Consent recorded', {
            userId,
            purpose,
            dataCategories,
            legalBasis,
            timestamp: consentRecord.timestamp
        });

        return consentRecord;
    }

    /**
     * Check if consent exists and is valid
     */
    hasValidConsent(userId, purpose, dataCategory = null) {
        const consentKey = `${userId}-${purpose}`;
        const consent = this.consentDatabase.get(consentKey);

        if (!consent || !consent.consentGiven || consent.withdrawnAt) {
            return false;
        }

        if (dataCategory && !consent.dataCategories.includes(dataCategory)) {
            return false;
        }

        return true;
    }

    /**
     * Withdraw consent
     */
    async withdrawConsent(userId, purpose, reason = null) {
        const consentKey = `${userId}-${purpose}`;
        const consent = this.consentDatabase.get(consentKey);

        if (consent) {
            consent.consentGiven = false;
            consent.withdrawnAt = new Date();
            consent.withdrawalReason = reason;

            // Log consent withdrawal
            logger.info('Consent withdrawn', {
                userId,
                purpose,
                reason,
                timestamp: consent.withdrawnAt
            });

            // Audit log
            await this.logDataProcessingActivity('consent_withdrawn', {
                userId,
                purpose,
                reason,
                dataCategories: consent.dataCategories
            });

            return true;
        }

        return false;
    }

    /**
     * Get user's consent history
     */
    getUserConsentHistory(userId) {
        const userConsents = [];
        
        for (const [key, consent] of this.consentDatabase.entries()) {
            if (consent.userId === userId) {
                userConsents.push({
                    purpose: consent.purpose,
                    dataCategories: consent.dataCategories,
                    legalBasis: consent.legalBasis,
                    consentGiven: consent.consentGiven,
                    timestamp: consent.timestamp,
                    withdrawnAt: consent.withdrawnAt,
                    withdrawalReason: consent.withdrawalReason
                });
            }
        }

        return userConsents;
    }

    /**
     * Log data processing activity
     */
    async logDataProcessingActivity(activity, details) {
        const logEntry = {
            activity,
            timestamp: new Date(),
            details,
            compliance: 'gdpr'
        };

        this.dataProcessingLog.push(logEntry);

        // Also log to audit system
        logger.info('Data processing activity', logEntry);
    }

    /**
     * Check data retention compliance
     */
    async checkDataRetentionCompliance() {
        const results = {
            compliant: true,
            expiredData: [],
            warnings: []
        };

        try {
            // Check student data retention
            const studentRetentionDate = new Date();
            studentRetentionDate.setMonth(studentRetentionDate.getMonth() - this.dataRetentionPeriods.student_records);

            const expiredStudents = await Student.findAll({
                where: {
                    updated_at: { [Op.lt]: studentRetentionDate },
                    is_active: false
                },
                attributes: ['id', 'student_id', 'updated_at']
            });

            if (expiredStudents.length > 0) {
                results.expiredData.push({
                    type: 'student_records',
                    count: expiredStudents.length,
                    records: expiredStudents.map(s => s.id)
                });
                results.compliant = false;
            }

            // Check audit log retention
            const auditRetentionDate = new Date();
            auditRetentionDate.setMonth(auditRetentionDate.getMonth() - this.dataRetentionPeriods.audit_logs);

            const expiredAuditLogs = await AuditLog.count({
                where: {
                    timestamp: { [Op.lt]: auditRetentionDate }
                }
            });

            if (expiredAuditLogs > 0) {
                results.expiredData.push({
                    type: 'audit_logs',
                    count: expiredAuditLogs
                });
                results.compliant = false;
            }

        } catch (error) {
            logger.error('Data retention compliance check failed:', error);
            results.warnings.push('Failed to check data retention compliance');
        }

        return results;
    }

    /**
     * Anonymize expired data
     */
    async anonymizeExpiredData() {
        const anonymized = {
            students: 0,
            auditLogs: 0,
            errors: []
        };

        try {
            // Anonymize expired student records
            const studentRetentionDate = new Date();
            studentRetentionDate.setMonth(studentRetentionDate.getMonth() - this.dataRetentionPeriods.student_records);

            const expiredStudents = await Student.findAll({
                where: {
                    updated_at: { [Op.lt]: studentRetentionDate },
                    is_active: false
                }
            });

            for (const student of expiredStudents) {
                await this.anonymizeStudentData(student);
                anonymized.students++;
            }

            // Anonymize expired audit logs
            const auditRetentionDate = new Date();
            auditRetentionDate.setMonth(auditRetentionDate.getMonth() - this.dataRetentionPeriods.audit_logs);

            const result = await AuditLog.update(
                {
                    user_email: '[ANONYMIZED]',
                    ip_address: '[ANONYMIZED]',
                    user_agent: '[ANONYMIZED]',
                    details: {},
                    metadata: {}
                },
                {
                    where: {
                        timestamp: { [Op.lt]: auditRetentionDate }
                    }
                }
            );

            anonymized.auditLogs = result[0];

        } catch (error) {
            logger.error('Data anonymization failed:', error);
            anonymized.errors.push(error.message);
        }

        return anonymized;
    }

    /**
     * Anonymize student data
     */
    async anonymizeStudentData(student) {
        const anonymizedData = {
            first_name: '[ANONYMIZED]',
            last_name: '[ANONYMIZED]',
            middle_name: '[ANONYMIZED]',
            email: '[ANONYMIZED]',
            phone: '[ANONYMIZED]',
            address: '[ANONYMIZED]',
            parent_guardian_name: '[ANONYMIZED]',
            parent_guardian_phone: '[ANONYMIZED]',
            parent_guardian_email: '[ANONYMIZED]',
            emergency_contact_name: '[ANONYMIZED]',
            emergency_contact_phone: '[ANONYMIZED]',
            medical_conditions: '[ANONYMIZED]',
            allergies: '[ANONYMIZED]',
            medications: '[ANONYMIZED]',
            special_needs: '[ANONYMIZED]'
        };

        await student.update(anonymizedData);
        
        // Log anonymization
        await this.logDataProcessingActivity('data_anonymized', {
            studentId: student.id,
            reason: 'retention_period_expired'
        });
    }

    /**
     * Export user data (Right to Data Portability)
     */
    async exportUserData(userId, userType = 'student') {
        if (!this.privacySettings.enableDataPortability) {
            throw new Error('Data portability is not enabled');
        }

        const exportData = {
            userId,
            userType,
            exportDate: new Date().toISOString(),
            data: {}
        };

        try {
            if (userType === 'student') {
                const student = await Student.findByPk(userId, {
                    include: [
                        'AttendanceRecords',
                        'AcademicRecords',
                        'StudentHealth',
                        'StudentParentRelationships'
                    ]
                });

                if (student) {
                    exportData.data = {
                        personalInfo: {
                            firstName: student.first_name,
                            lastName: student.last_name,
                            dateOfBirth: student.date_of_birth,
                            gender: student.gender,
                            email: student.email,
                            phone: student.phone,
                            address: student.address
                        },
                        academicInfo: {
                            studentId: student.student_id,
                            gradeLevel: student.grade_level,
                            school: student.school_id,
                            enrollmentDate: student.enrollment_date,
                            academicRecords: student.AcademicRecords,
                            attendanceRecords: student.AttendanceRecords
                        },
                        healthInfo: student.StudentHealth,
                        familyInfo: student.StudentParentRelationships
                    };
                }
            }

            // Log data export
            await this.logDataProcessingActivity('data_exported', {
                userId,
                userType,
                exportSize: JSON.stringify(exportData).length
            });

        } catch (error) {
            logger.error('Data export failed:', error);
            throw error;
        }

        return exportData;
    }

    /**
     * Process data erasure request (Right to be Forgotten)
     */
    async processDataErasureRequest(userId, userType = 'student', reason = null) {
        if (!this.privacySettings.enableRightToErasure) {
            throw new Error('Right to erasure is not enabled');
        }

        const erasureResult = {
            userId,
            userType,
            erasureDate: new Date().toISOString(),
            reason,
            success: false,
            erasedData: [],
            retainedData: [],
            errors: []
        };

        try {
            if (userType === 'student') {
                const student = await Student.findByPk(userId);
                
                if (student) {
                    // Check if we can erase the data (legal obligations, etc.)
                    const canErase = await this.canEraseStudentData(student);
                    
                    if (canErase.allowed) {
                        // Perform soft deletion (anonymization)
                        await this.anonymizeStudentData(student);
                        erasureResult.success = true;
                        erasureResult.erasedData.push('student_profile');
                        erasureResult.erasedData.push('contact_information');
                        erasureResult.erasedData.push('health_records');
                        erasureResult.erasedData.push('family_information');
                    } else {
                        erasureResult.retainedData = canErase.reasons;
                        erasureResult.errors.push('Cannot erase data due to legal obligations');
                    }
                }
            }

            // Log erasure request
            await this.logDataProcessingActivity('data_erasure_requested', {
                userId,
                userType,
                reason,
                success: erasureResult.success,
                erasedData: erasureResult.erasedData,
                retainedData: erasureResult.retainedData
            });

        } catch (error) {
            logger.error('Data erasure failed:', error);
            erasureResult.errors.push(error.message);
        }

        return erasureResult;
    }

    /**
     * Check if student data can be erased
     */
    async canEraseStudentData(student) {
        const result = {
            allowed: true,
            reasons: []
        };

        // Check if student is currently enrolled
        if (student.is_active) {
            result.allowed = false;
            result.reasons.push('Student is currently enrolled');
        }

        // Check if there are legal obligations to retain data
        const graduationDate = new Date(student.graduation_date);
        const retentionPeriod = new Date();
        retentionPeriod.setFullYear(graduationDate.getFullYear() + 7); // 7 years retention

        if (new Date() < retentionPeriod) {
            result.allowed = false;
            result.reasons.push('Legal retention period has not expired');
        }

        // Check for ongoing legal proceedings
        // This would need to be implemented based on your specific requirements

        return result;
    }

    /**
     * Generate privacy impact assessment
     */
    async generatePrivacyImpactAssessment(dataProcessingActivity) {
        const assessment = {
            activity: dataProcessingActivity,
            assessmentDate: new Date().toISOString(),
            riskLevel: 'medium',
            dataCategories: [],
            purposes: [],
            legalBases: [],
            risks: [],
            mitigations: [],
            recommendations: []
        };

        // Basic privacy impact assessment logic
        // This would need to be expanded based on specific requirements

        return assessment;
    }

    /**
     * Check compliance with privacy regulations
     */
    async checkPrivacyCompliance() {
        const compliance = {
            gdpr: true,
            localRegulations: true,
            issues: [],
            recommendations: []
        };

        try {
            // Check consent management
            const consentIssues = await this.checkConsentCompliance();
            if (consentIssues.length > 0) {
                compliance.gdpr = false;
                compliance.issues.push(...consentIssues);
            }

            // Check data retention
            const retentionCompliance = await this.checkDataRetentionCompliance();
            if (!retentionCompliance.compliant) {
                compliance.gdpr = false;
                compliance.issues.push('Data retention periods exceeded');
                compliance.recommendations.push('Implement automated data cleanup');
            }

            // Check data minimization
            const minimizationIssues = await this.checkDataMinimization();
            if (minimizationIssues.length > 0) {
                compliance.gdpr = false;
                compliance.issues.push(...minimizationIssues);
            }

        } catch (error) {
            logger.error('Privacy compliance check failed:', error);
            compliance.issues.push('Failed to perform compliance check');
        }

        return compliance;
    }

    /**
     * Check consent compliance
     */
    async checkConsentCompliance() {
        const issues = [];

        // Check for processing without consent
        // This would need to be implemented based on your data processing activities

        return issues;
    }

    /**
     * Check data minimization compliance
     */
    async checkDataMinimization() {
        const issues = [];

        // Check if we're collecting more data than necessary
        // This would need to be implemented based on your data collection practices

        return issues;
    }
}

/**
 * Privacy compliance middleware
 */
const privacyComplianceMiddleware = (req, res, next) => {
    const complianceManager = new PrivacyComplianceManager();
    
    // Attach compliance manager to request
    req.privacy = complianceManager;
    
    // Check if data processing requires consent
    if (complianceManager.privacySettings.requireExplicitConsent) {
        // Implementation would depend on your specific requirements
    }
    
    next();
};

/**
 * Data processing consent middleware
 */
const dataProcessingConsentMiddleware = (purpose, dataCategories) => {
    return (req, res, next) => {
        const userId = req.user?.id;
        const complianceManager = req.privacy || new PrivacyComplianceManager();
        
        if (userId && complianceManager.privacySettings.requireExplicitConsent) {
            // Check if user has given consent for this purpose
            const hasConsent = complianceManager.hasValidConsent(userId, purpose);
            
            if (!hasConsent) {
                return res.status(403).json({
                    error: 'Consent required for data processing',
                    purpose,
                    dataCategories,
                    code: 'CONSENT_REQUIRED'
                });
            }
        }
        
        next();
    };
};

/**
 * Data retention cleanup job
 */
const scheduleDataRetentionCleanup = () => {
    const complianceManager = new PrivacyComplianceManager();
    
    // Run cleanup daily at 2 AM
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    setInterval(async () => {
        try {
            logger.info('Starting data retention cleanup');
            
            const compliance = await complianceManager.checkDataRetentionCompliance();
            
            if (!compliance.compliant) {
                const result = await complianceManager.anonymizeExpiredData();
                logger.info('Data retention cleanup completed', result);
            }
            
        } catch (error) {
            logger.error('Data retention cleanup failed:', error);
        }
    }, cleanupInterval);
};

module.exports = {
    PrivacyComplianceManager,
    privacyComplianceMiddleware,
    dataProcessingConsentMiddleware,
    scheduleDataRetentionCleanup,
    PrivacyRights,
    ProcessingPurposes,
    DataCategories,
    LegalBases
};