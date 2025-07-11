const logger = require('../utils/logger');
const { AuditLog } = require('../models');
const { Op } = require('sequelize');

/**
 * Security Monitoring and Alerting System for NiEMIS
 * Real-time security monitoring with automated threat detection and alerting
 */

class SecurityMonitor {
    constructor() {
        this.enabled = process.env.SECURITY_MONITORING_ENABLED === 'true';
        this.alertThresholds = this.loadAlertThresholds();
        this.alertChannels = this.loadAlertChannels();
        this.monitoringInterval = parseInt(process.env.SECURITY_MONITORING_INTERVAL) || 60000; // 1 minute
        this.alertCooldown = parseInt(process.env.SECURITY_ALERT_COOLDOWN) || 300000; // 5 minutes
        this.recentAlerts = new Map();
        this.metrics = {
            totalAlerts: 0,
            criticalAlerts: 0,
            highAlerts: 0,
            mediumAlerts: 0,
            lowAlerts: 0,
            falsePositives: 0,
            lastAlertTime: null,
            monitoringStartTime: new Date()
        };
        
        if (this.enabled) {
            this.startMonitoring();
        }
    }

    /**
     * Load alert thresholds from environment
     */
    loadAlertThresholds() {
        return {
            // Authentication failures
            authFailures: {
                threshold: parseInt(process.env.ALERT_AUTH_FAILURES_THRESHOLD) || 5,
                timeWindow: parseInt(process.env.ALERT_AUTH_FAILURES_WINDOW) || 300000, // 5 minutes
                severity: 'high'
            },
            
            // Suspicious IP activity
            suspiciousIp: {
                threshold: parseInt(process.env.ALERT_SUSPICIOUS_IP_THRESHOLD) || 10,
                timeWindow: parseInt(process.env.ALERT_SUSPICIOUS_IP_WINDOW) || 600000, // 10 minutes
                severity: 'medium'
            },
            
            // Student data access anomalies
            studentDataAccess: {
                threshold: parseInt(process.env.ALERT_STUDENT_DATA_THRESHOLD) || 50,
                timeWindow: parseInt(process.env.ALERT_STUDENT_DATA_WINDOW) || 3600000, // 1 hour
                severity: 'medium'
            },
            
            // Mass data operations
            massDataOps: {
                threshold: parseInt(process.env.ALERT_MASS_DATA_THRESHOLD) || 100,
                timeWindow: parseInt(process.env.ALERT_MASS_DATA_WINDOW) || 1800000, // 30 minutes
                severity: 'high'
            },
            
            // Failed authorization attempts
            authzFailures: {
                threshold: parseInt(process.env.ALERT_AUTHZ_FAILURES_THRESHOLD) || 20,
                timeWindow: parseInt(process.env.ALERT_AUTHZ_FAILURES_WINDOW) || 600000, // 10 minutes
                severity: 'high'
            },
            
            // Privilege escalation attempts
            privilegeEscalation: {
                threshold: parseInt(process.env.ALERT_PRIVILEGE_ESCALATION_THRESHOLD) || 3,
                timeWindow: parseInt(process.env.ALERT_PRIVILEGE_ESCALATION_WINDOW) || 300000, // 5 minutes
                severity: 'critical'
            },
            
            // Bulk file operations
            bulkFileOps: {
                threshold: parseInt(process.env.ALERT_BULK_FILE_THRESHOLD) || 20,
                timeWindow: parseInt(process.env.ALERT_BULK_FILE_WINDOW) || 1800000, // 30 minutes
                severity: 'medium'
            }
        };
    }

    /**
     * Load alert channels configuration
     */
    loadAlertChannels() {
        return {
            email: {
                enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
                recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
                smtp: {
                    host: process.env.EMAIL_HOST,
                    port: parseInt(process.env.EMAIL_PORT) || 587,
                    secure: process.env.EMAIL_SECURE === 'true',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                }
            },
            
            slack: {
                enabled: process.env.ALERT_SLACK_ENABLED === 'true',
                webhookUrl: process.env.SLACK_WEBHOOK_URL,
                channel: process.env.SLACK_ALERT_CHANNEL || '#security-alerts'
            },
            
            webhook: {
                enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
                url: process.env.ALERT_WEBHOOK_URL,
                secret: process.env.ALERT_WEBHOOK_SECRET
            },
            
            discord: {
                enabled: process.env.ALERT_DISCORD_ENABLED === 'true',
                webhookUrl: process.env.DISCORD_WEBHOOK_URL
            }
        };
    }

    /**
     * Start monitoring
     */
    startMonitoring() {
        logger.info('Security monitoring started');
        
        // Start periodic monitoring
        this.monitoringTimer = setInterval(async () => {
            await this.runSecurityChecks();
        }, this.monitoringInterval);

        // Monitor for immediate threats
        this.startRealTimeMonitoring();
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        logger.info('Security monitoring stopped');
    }

    /**
     * Start real-time monitoring
     */
    startRealTimeMonitoring() {
        // This would integrate with your audit logging system
        // to monitor events as they happen
        logger.info('Real-time security monitoring started');
    }

    /**
     * Run all security checks
     */
    async runSecurityChecks() {
        try {
            const checks = [
                this.checkAuthenticationFailures(),
                this.checkSuspiciousIpActivity(),
                this.checkStudentDataAccessAnomalies(),
                this.checkMassDataOperations(),
                this.checkAuthorizationFailures(),
                this.checkPrivilegeEscalation(),
                this.checkBulkFileOperations(),
                this.checkSystemAnomalies()
            ];

            const results = await Promise.allSettled(checks);
            
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    logger.error(`Security check ${index} failed:`, result.reason);
                }
            });
        } catch (error) {
            logger.error('Error running security checks:', error);
        }
    }

    /**
     * Check for authentication failures
     */
    async checkAuthenticationFailures() {
        const threshold = this.alertThresholds.authFailures;
        const timeWindow = new Date(Date.now() - threshold.timeWindow);

        const failures = await AuditLog.findAll({
            where: {
                event_type: 'auth.login.failure',
                timestamp: { [Op.gte]: timeWindow },
                success: false
            },
            attributes: ['ip_address', 'user_email', 'timestamp'],
            order: [['timestamp', 'DESC']]
        });

        // Group by IP address
        const ipFailures = failures.reduce((acc, failure) => {
            const ip = failure.ip_address;
            if (!acc[ip]) acc[ip] = [];
            acc[ip].push(failure);
            return acc;
        }, {});

        // Check for IPs exceeding threshold
        for (const [ip, ipFailuresList] of Object.entries(ipFailures)) {
            if (ipFailuresList.length >= threshold.threshold) {
                await this.sendAlert('Authentication Failure Threshold Exceeded', {
                    severity: threshold.severity,
                    details: {
                        ip,
                        failureCount: ipFailuresList.length,
                        timeWindow: threshold.timeWindow / 1000 / 60, // minutes
                        recentFailures: ipFailuresList.slice(0, 5)
                    },
                    recommendation: 'Consider blocking this IP address and investigating the source'
                });
            }
        }
    }

    /**
     * Check for suspicious IP activity
     */
    async checkSuspiciousIpActivity() {
        const threshold = this.alertThresholds.suspiciousIp;
        const timeWindow = new Date(Date.now() - threshold.timeWindow);

        const suspiciousEvents = await AuditLog.findAll({
            where: {
                event_type: {
                    [Op.in]: [
                        'security.suspicious.activity',
                        'security.unauthorized.access',
                        'security.policy.violation'
                    ]
                },
                timestamp: { [Op.gte]: timeWindow }
            },
            attributes: ['ip_address', 'event_type', 'timestamp', 'details'],
            order: [['timestamp', 'DESC']]
        });

        // Group by IP address
        const ipActivity = suspiciousEvents.reduce((acc, event) => {
            const ip = event.ip_address;
            if (!acc[ip]) acc[ip] = [];
            acc[ip].push(event);
            return acc;
        }, {});

        // Check for IPs exceeding threshold
        for (const [ip, events] of Object.entries(ipActivity)) {
            if (events.length >= threshold.threshold) {
                await this.sendAlert('Suspicious IP Activity Detected', {
                    severity: threshold.severity,
                    details: {
                        ip,
                        eventCount: events.length,
                        timeWindow: threshold.timeWindow / 1000 / 60, // minutes
                        eventTypes: [...new Set(events.map(e => e.event_type))],
                        recentEvents: events.slice(0, 5)
                    },
                    recommendation: 'Review activity from this IP address and consider temporary blocking'
                });
            }
        }
    }

    /**
     * Check for student data access anomalies
     */
    async checkStudentDataAccessAnomalies() {
        const threshold = this.alertThresholds.studentDataAccess;
        const timeWindow = new Date(Date.now() - threshold.timeWindow);

        const dataAccess = await AuditLog.findAll({
            where: {
                event_type: {
                    [Op.in]: [
                        'student.profile.viewed',
                        'student.health.accessed',
                        'student.family.accessed',
                        'student.grades.accessed'
                    ]
                },
                timestamp: { [Op.gte]: timeWindow }
            },
            attributes: ['user_id', 'user_role', 'event_type', 'timestamp', 'target_id'],
            order: [['timestamp', 'DESC']]
        });

        // Group by user
        const userAccess = dataAccess.reduce((acc, access) => {
            const userId = access.user_id;
            if (!acc[userId]) acc[userId] = [];
            acc[userId].push(access);
            return acc;
        }, {});

        // Check for users exceeding threshold
        for (const [userId, accesses] of Object.entries(userAccess)) {
            if (accesses.length >= threshold.threshold) {
                const uniqueStudents = new Set(accesses.map(a => a.target_id)).size;
                
                await this.sendAlert('Excessive Student Data Access', {
                    severity: threshold.severity,
                    details: {
                        userId,
                        userRole: accesses[0].user_role,
                        accessCount: accesses.length,
                        uniqueStudents,
                        timeWindow: threshold.timeWindow / 1000 / 60, // minutes
                        accessTypes: [...new Set(accesses.map(a => a.event_type))]
                    },
                    recommendation: 'Review this user\'s access pattern and verify legitimate business need'
                });
            }
        }
    }

    /**
     * Check for mass data operations
     */
    async checkMassDataOperations() {
        const threshold = this.alertThresholds.massDataOps;
        const timeWindow = new Date(Date.now() - threshold.timeWindow);

        const massOps = await AuditLog.findAll({
            where: {
                event_type: {
                    [Op.in]: [
                        'security.bulk.operation',
                        'security.data.export',
                        'student.created',
                        'student.updated',
                        'student.deleted'
                    ]
                },
                timestamp: { [Op.gte]: timeWindow }
            },
            attributes: ['user_id', 'user_role', 'event_type', 'timestamp', 'details'],
            order: [['timestamp', 'DESC']]
        });

        // Group by user
        const userOps = massOps.reduce((acc, op) => {
            const userId = op.user_id;
            if (!acc[userId]) acc[userId] = [];
            acc[userId].push(op);
            return acc;
        }, {});

        // Check for users exceeding threshold
        for (const [userId, ops] of Object.entries(userOps)) {
            if (ops.length >= threshold.threshold) {
                await this.sendAlert('Mass Data Operations Detected', {
                    severity: threshold.severity,
                    details: {
                        userId,
                        userRole: ops[0].user_role,
                        operationCount: ops.length,
                        timeWindow: threshold.timeWindow / 1000 / 60, // minutes
                        operationTypes: [...new Set(ops.map(o => o.event_type))]
                    },
                    recommendation: 'Verify these operations are authorized and legitimate'
                });
            }
        }
    }

    /**
     * Check for authorization failures
     */
    async checkAuthorizationFailures() {
        const threshold = this.alertThresholds.authzFailures;
        const timeWindow = new Date(Date.now() - threshold.timeWindow);

        const authzFailures = await AuditLog.findAll({
            where: {
                event_type: 'security.unauthorized.access',
                timestamp: { [Op.gte]: timeWindow },
                success: false
            },
            attributes: ['user_id', 'user_role', 'ip_address', 'timestamp', 'request_url'],
            order: [['timestamp', 'DESC']]
        });

        // Group by user
        const userFailures = authzFailures.reduce((acc, failure) => {
            const userId = failure.user_id || 'anonymous';
            if (!acc[userId]) acc[userId] = [];
            acc[userId].push(failure);
            return acc;
        }, {});

        // Check for users exceeding threshold
        for (const [userId, failures] of Object.entries(userFailures)) {
            if (failures.length >= threshold.threshold) {
                await this.sendAlert('Authorization Failure Threshold Exceeded', {
                    severity: threshold.severity,
                    details: {
                        userId: userId !== 'anonymous' ? userId : null,
                        userRole: failures[0].user_role,
                        failureCount: failures.length,
                        timeWindow: threshold.timeWindow / 1000 / 60, // minutes
                        attemptedResources: [...new Set(failures.map(f => f.request_url))]
                    },
                    recommendation: 'Review user permissions and investigate potential privilege escalation attempts'
                });
            }
        }
    }

    /**
     * Check for privilege escalation attempts
     */
    async checkPrivilegeEscalation() {
        const threshold = this.alertThresholds.privilegeEscalation;
        const timeWindow = new Date(Date.now() - threshold.timeWindow);

        const escalationEvents = await AuditLog.findAll({
            where: {
                event_type: {
                    [Op.in]: [
                        'user.role.changed',
                        'security.unauthorized.access'
                    ]
                },
                timestamp: { [Op.gte]: timeWindow }
            },
            attributes: ['user_id', 'user_role', 'event_type', 'timestamp', 'details'],
            order: [['timestamp', 'DESC']]
        });

        // Look for patterns indicating privilege escalation
        const suspiciousPatterns = escalationEvents.filter(event => {
            const details = event.details || {};
            
            // Check for role changes to higher privileges
            if (event.event_type === 'user.role.changed') {
                const oldRole = details.oldRole;
                const newRole = details.newRole;
                const roleHierarchy = ['student', 'parent', 'teacher', 'admin', 'super_admin'];
                
                if (roleHierarchy.indexOf(newRole) > roleHierarchy.indexOf(oldRole)) {
                    return true;
                }
            }
            
            // Check for unauthorized access to admin functions
            if (event.event_type === 'security.unauthorized.access') {
                const url = details.requestUrl || '';
                if (url.includes('/admin') || url.includes('/super_admin')) {
                    return true;
                }
            }
            
            return false;
        });

        if (suspiciousPatterns.length >= threshold.threshold) {
            await this.sendAlert('Potential Privilege Escalation Detected', {
                severity: threshold.severity,
                details: {
                    eventCount: suspiciousPatterns.length,
                    timeWindow: threshold.timeWindow / 1000 / 60, // minutes
                    suspiciousEvents: suspiciousPatterns.slice(0, 5)
                },
                recommendation: 'IMMEDIATE ACTION REQUIRED: Review and verify all role changes and admin access attempts'
            });
        }
    }

    /**
     * Check for bulk file operations
     */
    async checkBulkFileOperations() {
        const threshold = this.alertThresholds.bulkFileOps;
        const timeWindow = new Date(Date.now() - threshold.timeWindow);

        const fileOps = await AuditLog.findAll({
            where: {
                event_type: {
                    [Op.in]: [
                        'file.uploaded',
                        'file.downloaded',
                        'file.deleted'
                    ]
                },
                timestamp: { [Op.gte]: timeWindow }
            },
            attributes: ['user_id', 'user_role', 'event_type', 'timestamp', 'details'],
            order: [['timestamp', 'DESC']]
        });

        // Group by user
        const userFileOps = fileOps.reduce((acc, op) => {
            const userId = op.user_id;
            if (!acc[userId]) acc[userId] = [];
            acc[userId].push(op);
            return acc;
        }, {});

        // Check for users exceeding threshold
        for (const [userId, ops] of Object.entries(userFileOps)) {
            if (ops.length >= threshold.threshold) {
                await this.sendAlert('Bulk File Operations Detected', {
                    severity: threshold.severity,
                    details: {
                        userId,
                        userRole: ops[0].user_role,
                        operationCount: ops.length,
                        timeWindow: threshold.timeWindow / 1000 / 60, // minutes
                        operationTypes: [...new Set(ops.map(o => o.event_type))]
                    },
                    recommendation: 'Review file operations for potential data exfiltration'
                });
            }
        }
    }

    /**
     * Check for system anomalies
     */
    async checkSystemAnomalies() {
        const timeWindow = new Date(Date.now() - 300000); // 5 minutes

        const systemEvents = await AuditLog.findAll({
            where: {
                event_type: {
                    [Op.in]: [
                        'system.error',
                        'system.maintenance.mode',
                        'security.breach.detected'
                    ]
                },
                timestamp: { [Op.gte]: timeWindow }
            },
            attributes: ['event_type', 'timestamp', 'details', 'severity'],
            order: [['timestamp', 'DESC']]
        });

        // Alert on critical system events
        const criticalEvents = systemEvents.filter(event => 
            event.severity === 'critical' || event.event_type === 'security.breach.detected'
        );

        if (criticalEvents.length > 0) {
            await this.sendAlert('Critical System Events Detected', {
                severity: 'critical',
                details: {
                    eventCount: criticalEvents.length,
                    events: criticalEvents.slice(0, 5)
                },
                recommendation: 'IMMEDIATE ACTION REQUIRED: Review critical system events'
            });
        }
    }

    /**
     * Send security alert
     */
    async sendAlert(title, alertData) {
        const alertKey = `${title}-${JSON.stringify(alertData.details)}`;
        
        // Check cooldown
        if (this.recentAlerts.has(alertKey)) {
            const lastAlert = this.recentAlerts.get(alertKey);
            if (Date.now() - lastAlert < this.alertCooldown) {
                return; // Skip duplicate alert within cooldown period
            }
        }

        // Update metrics
        this.metrics.totalAlerts++;
        this.metrics[`${alertData.severity}Alerts`]++;
        this.metrics.lastAlertTime = new Date();

        // Record alert
        this.recentAlerts.set(alertKey, Date.now());

        // Log alert
        logger.warn('Security Alert', {
            title,
            severity: alertData.severity,
            details: alertData.details,
            recommendation: alertData.recommendation
        });

        // Send to configured channels
        const promises = [];
        
        if (this.alertChannels.email.enabled) {
            promises.push(this.sendEmailAlert(title, alertData));
        }
        
        if (this.alertChannels.slack.enabled) {
            promises.push(this.sendSlackAlert(title, alertData));
        }
        
        if (this.alertChannels.webhook.enabled) {
            promises.push(this.sendWebhookAlert(title, alertData));
        }
        
        if (this.alertChannels.discord.enabled) {
            promises.push(this.sendDiscordAlert(title, alertData));
        }

        await Promise.allSettled(promises);
    }

    /**
     * Send email alert
     */
    async sendEmailAlert(title, alertData) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransporter(this.alertChannels.email.smtp);
            
            const html = `
                <h2>🚨 NiEMIS Security Alert</h2>
                <h3>${title}</h3>
                <p><strong>Severity:</strong> ${alertData.severity.toUpperCase()}</p>
                <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                <h4>Details:</h4>
                <pre>${JSON.stringify(alertData.details, null, 2)}</pre>
                <h4>Recommendation:</h4>
                <p>${alertData.recommendation}</p>
            `;

            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: this.alertChannels.email.recipients.join(', '),
                subject: `🚨 NiEMIS Security Alert: ${title}`,
                html
            });
        } catch (error) {
            logger.error('Failed to send email alert:', error);
        }
    }

    /**
     * Send Slack alert
     */
    async sendSlackAlert(title, alertData) {
        try {
            const axios = require('axios');
            
            const payload = {
                channel: this.alertChannels.slack.channel,
                username: 'NiEMIS Security Monitor',
                icon_emoji: ':rotating_light:',
                attachments: [{
                    color: this.getSeverityColor(alertData.severity),
                    title: `🚨 ${title}`,
                    text: alertData.recommendation,
                    fields: [
                        {
                            title: 'Severity',
                            value: alertData.severity.toUpperCase(),
                            short: true
                        },
                        {
                            title: 'Time',
                            value: new Date().toISOString(),
                            short: true
                        },
                        {
                            title: 'Details',
                            value: `\`\`\`${JSON.stringify(alertData.details, null, 2)}\`\`\``,
                            short: false
                        }
                    ]
                }]
            };

            await axios.post(this.alertChannels.slack.webhookUrl, payload);
        } catch (error) {
            logger.error('Failed to send Slack alert:', error);
        }
    }

    /**
     * Send webhook alert
     */
    async sendWebhookAlert(title, alertData) {
        try {
            const axios = require('axios');
            const crypto = require('crypto');
            
            const payload = {
                title,
                severity: alertData.severity,
                timestamp: new Date().toISOString(),
                details: alertData.details,
                recommendation: alertData.recommendation,
                source: 'niemis-security-monitor'
            };

            const headers = {
                'Content-Type': 'application/json'
            };

            // Add signature if secret is configured
            if (this.alertChannels.webhook.secret) {
                const signature = crypto
                    .createHmac('sha256', this.alertChannels.webhook.secret)
                    .update(JSON.stringify(payload))
                    .digest('hex');
                headers['X-Signature'] = `sha256=${signature}`;
            }

            await axios.post(this.alertChannels.webhook.url, payload, { headers });
        } catch (error) {
            logger.error('Failed to send webhook alert:', error);
        }
    }

    /**
     * Send Discord alert
     */
    async sendDiscordAlert(title, alertData) {
        try {
            const axios = require('axios');
            
            const payload = {
                embeds: [{
                    title: `🚨 ${title}`,
                    description: alertData.recommendation,
                    color: this.getSeverityColorCode(alertData.severity),
                    timestamp: new Date().toISOString(),
                    fields: [
                        {
                            name: 'Severity',
                            value: alertData.severity.toUpperCase(),
                            inline: true
                        },
                        {
                            name: 'Details',
                            value: `\`\`\`json\n${JSON.stringify(alertData.details, null, 2)}\`\`\``,
                            inline: false
                        }
                    ]
                }]
            };

            await axios.post(this.alertChannels.discord.webhookUrl, payload);
        } catch (error) {
            logger.error('Failed to send Discord alert:', error);
        }
    }

    /**
     * Get severity color for Slack
     */
    getSeverityColor(severity) {
        const colors = {
            low: 'good',
            medium: 'warning',
            high: 'danger',
            critical: '#ff0000'
        };
        return colors[severity] || '#000000';
    }

    /**
     * Get severity color code for Discord
     */
    getSeverityColorCode(severity) {
        const colors = {
            low: 0x00ff00,
            medium: 0xffff00,
            high: 0xff9900,
            critical: 0xff0000
        };
        return colors[severity] || 0x000000;
    }

    /**
     * Get monitoring metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.monitoringStartTime.getTime(),
            alertChannels: Object.keys(this.alertChannels).filter(channel => 
                this.alertChannels[channel].enabled
            )
        };
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        this.stopMonitoring();
        this.recentAlerts.clear();
    }
}

// Singleton instance
const securityMonitor = new SecurityMonitor();

// Graceful shutdown
process.on('SIGTERM', () => {
    securityMonitor.shutdown();
});

process.on('SIGINT', () => {
    securityMonitor.shutdown();
});

module.exports = {
    securityMonitor,
    SecurityMonitor
};