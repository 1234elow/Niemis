const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Secrets Management System for NiEMIS
 * Handles encryption, decryption, and secure storage of sensitive data
 */

class SecretsManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
        this.secretsPath = path.join(__dirname, '../secrets');
        this.masterKey = this.getMasterKey();
        this.secrets = new Map();
        this.initialized = false;
    }

    /**
     * Initialize secrets manager
     */
    async initialize() {
        try {
            // Create secrets directory if it doesn't exist
            if (!fs.existsSync(this.secretsPath)) {
                fs.mkdirSync(this.secretsPath, { recursive: true, mode: 0o700 });
            }

            // Load existing secrets
            await this.loadSecrets();
            this.initialized = true;
            
            logger.info('Secrets manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize secrets manager:', error);
            throw error;
        }
    }

    /**
     * Get or generate master key
     */
    getMasterKey() {
        const masterKeyPath = path.join(this.secretsPath, '.master.key');
        
        // Try to get master key from environment first
        if (process.env.MASTER_ENCRYPTION_KEY) {
            return Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'hex');
        }

        // Try to load from file
        if (fs.existsSync(masterKeyPath)) {
            try {
                const keyData = fs.readFileSync(masterKeyPath, 'utf8');
                return Buffer.from(keyData, 'hex');
            } catch (error) {
                logger.warn('Failed to read master key file:', error);
            }
        }

        // Generate new master key
        const masterKey = crypto.randomBytes(this.keyLength);
        
        try {
            fs.writeFileSync(masterKeyPath, masterKey.toString('hex'), { mode: 0o600 });
            logger.info('Generated new master encryption key');
        } catch (error) {
            logger.error('Failed to save master key:', error);
        }

        return masterKey;
    }

    /**
     * Encrypt data
     */
    encrypt(data) {
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipher(this.algorithm, this.masterKey);
            cipher.setAAD(Buffer.from('niemis-secrets'));

            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const tag = cipher.getAuthTag();

            return {
                iv: iv.toString('hex'),
                encrypted,
                tag: tag.toString('hex')
            };
        } catch (error) {
            logger.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt data
     */
    decrypt(encryptedData) {
        try {
            const { iv, encrypted, tag } = encryptedData;
            const decipher = crypto.createDecipher(this.algorithm, this.masterKey);
            
            decipher.setAAD(Buffer.from('niemis-secrets'));
            decipher.setAuthTag(Buffer.from(tag, 'hex'));

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (error) {
            logger.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Store secret
     */
    async setSecret(key, value, options = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const secretData = {
                value,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                version: 1,
                metadata: options.metadata || {},
                expiresAt: options.expiresAt || null
            };

            // Check if secret already exists
            if (this.secrets.has(key)) {
                const existing = this.secrets.get(key);
                secretData.version = existing.version + 1;
                secretData.created = existing.created;
            }

            // Encrypt the secret
            const encrypted = this.encrypt(secretData);
            
            // Store in memory
            this.secrets.set(key, secretData);
            
            // Store encrypted version to file
            const secretPath = path.join(this.secretsPath, `${key}.secret`);
            fs.writeFileSync(secretPath, JSON.stringify(encrypted), { mode: 0o600 });
            
            logger.info(`Secret '${key}' stored successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to store secret '${key}':`, error);
            throw error;
        }
    }

    /**
     * Retrieve secret
     */
    async getSecret(key) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Check memory first
            if (this.secrets.has(key)) {
                const secret = this.secrets.get(key);
                
                // Check if expired
                if (secret.expiresAt && new Date() > new Date(secret.expiresAt)) {
                    await this.deleteSecret(key);
                    return null;
                }
                
                return secret.value;
            }

            // Try to load from file
            const secretPath = path.join(this.secretsPath, `${key}.secret`);
            if (fs.existsSync(secretPath)) {
                const encryptedData = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
                const decrypted = this.decrypt(encryptedData);
                
                // Check if expired
                if (decrypted.expiresAt && new Date() > new Date(decrypted.expiresAt)) {
                    await this.deleteSecret(key);
                    return null;
                }
                
                // Store in memory for future access
                this.secrets.set(key, decrypted);
                return decrypted.value;
            }

            return null;
        } catch (error) {
            logger.error(`Failed to retrieve secret '${key}':`, error);
            throw error;
        }
    }

    /**
     * Delete secret
     */
    async deleteSecret(key) {
        try {
            // Remove from memory
            this.secrets.delete(key);
            
            // Remove file
            const secretPath = path.join(this.secretsPath, `${key}.secret`);
            if (fs.existsSync(secretPath)) {
                fs.unlinkSync(secretPath);
            }
            
            logger.info(`Secret '${key}' deleted successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete secret '${key}':`, error);
            throw error;
        }
    }

    /**
     * List all secrets (names only)
     */
    async listSecrets() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            return Array.from(this.secrets.keys());
        } catch (error) {
            logger.error('Failed to list secrets:', error);
            throw error;
        }
    }

    /**
     * Load secrets from files
     */
    async loadSecrets() {
        try {
            if (!fs.existsSync(this.secretsPath)) {
                return;
            }

            const files = fs.readdirSync(this.secretsPath);
            const secretFiles = files.filter(file => file.endsWith('.secret'));
            
            for (const file of secretFiles) {
                const key = file.replace('.secret', '');
                const secretPath = path.join(this.secretsPath, file);
                
                try {
                    const encryptedData = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
                    const decrypted = this.decrypt(encryptedData);
                    
                    // Check if expired
                    if (decrypted.expiresAt && new Date() > new Date(decrypted.expiresAt)) {
                        fs.unlinkSync(secretPath);
                        continue;
                    }
                    
                    this.secrets.set(key, decrypted);
                } catch (error) {
                    logger.error(`Failed to load secret '${key}':`, error);
                }
            }
            
            logger.info(`Loaded ${this.secrets.size} secrets`);
        } catch (error) {
            logger.error('Failed to load secrets:', error);
            throw error;
        }
    }

    /**
     * Rotate encryption key
     */
    async rotateEncryptionKey() {
        try {
            const oldKey = this.masterKey;
            const newKey = crypto.randomBytes(this.keyLength);
            
            // Decrypt all secrets with old key
            const decryptedSecrets = new Map();
            for (const [key, secret] of this.secrets.entries()) {
                decryptedSecrets.set(key, secret);
            }
            
            // Update master key
            this.masterKey = newKey;
            
            // Re-encrypt all secrets with new key
            for (const [key, secret] of decryptedSecrets.entries()) {
                await this.setSecret(key, secret.value, {
                    metadata: secret.metadata,
                    expiresAt: secret.expiresAt
                });
            }
            
            // Save new master key
            const masterKeyPath = path.join(this.secretsPath, '.master.key');
            fs.writeFileSync(masterKeyPath, newKey.toString('hex'), { mode: 0o600 });
            
            logger.info('Encryption key rotated successfully');
            return true;
        } catch (error) {
            logger.error('Failed to rotate encryption key:', error);
            throw error;
        }
    }

    /**
     * Backup secrets
     */
    async backupSecrets(backupPath) {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                secrets: {}
            };
            
            for (const [key, secret] of this.secrets.entries()) {
                backup.secrets[key] = this.encrypt(secret);
            }
            
            fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), { mode: 0o600 });
            logger.info(`Secrets backed up to ${backupPath}`);
            return true;
        } catch (error) {
            logger.error('Failed to backup secrets:', error);
            throw error;
        }
    }

    /**
     * Restore secrets from backup
     */
    async restoreSecrets(backupPath) {
        try {
            const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            
            for (const [key, encryptedSecret] of Object.entries(backup.secrets)) {
                const decrypted = this.decrypt(encryptedSecret);
                this.secrets.set(key, decrypted);
                
                // Save to file
                const secretPath = path.join(this.secretsPath, `${key}.secret`);
                fs.writeFileSync(secretPath, JSON.stringify(encryptedSecret), { mode: 0o600 });
            }
            
            logger.info(`Secrets restored from ${backupPath}`);
            return true;
        } catch (error) {
            logger.error('Failed to restore secrets:', error);
            throw error;
        }
    }
}

// Singleton instance
const secretsManager = new SecretsManager();

/**
 * Environment variable wrapper with secrets support
 */
const getEnvVar = async (key, fallback = null) => {
    try {
        // Check environment variable first
        if (process.env[key]) {
            return process.env[key];
        }
        
        // Check secrets manager
        const secret = await secretsManager.getSecret(key);
        if (secret) {
            return secret;
        }
        
        return fallback;
    } catch (error) {
        logger.error(`Failed to get environment variable '${key}':`, error);
        return fallback;
    }
};

/**
 * Set environment variable in secrets manager
 */
const setEnvVar = async (key, value, options = {}) => {
    try {
        await secretsManager.setSecret(key, value, options);
        return true;
    } catch (error) {
        logger.error(`Failed to set environment variable '${key}':`, error);
        return false;
    }
};

/**
 * Initialize secrets on startup
 */
const initializeSecrets = async () => {
    try {
        await secretsManager.initialize();
        
        // Store critical secrets if they don't exist
        const criticalSecrets = [
            'JWT_SECRET',
            'JWT_REFRESH_SECRET',
            'DATABASE_URL',
            'MASTER_ENCRYPTION_KEY'
        ];
        
        for (const secret of criticalSecrets) {
            if (process.env[secret] && !(await secretsManager.getSecret(secret))) {
                await secretsManager.setSecret(secret, process.env[secret]);
            }
        }
        
        return true;
    } catch (error) {
        logger.error('Failed to initialize secrets:', error);
        return false;
    }
};

/**
 * Middleware to inject secrets into process.env
 */
const secretsMiddleware = async (req, res, next) => {
    try {
        // This middleware runs once per request cycle
        // In production, you might want to cache this
        const requiredSecrets = [
            'JWT_SECRET',
            'JWT_REFRESH_SECRET',
            'DATABASE_URL'
        ];
        
        for (const secret of requiredSecrets) {
            if (!process.env[secret]) {
                const value = await secretsManager.getSecret(secret);
                if (value) {
                    process.env[secret] = value;
                }
            }
        }
        
        next();
    } catch (error) {
        logger.error('Secrets middleware error:', error);
        next(); // Continue even if secrets fail
    }
};

module.exports = {
    secretsManager,
    getEnvVar,
    setEnvVar,
    initializeSecrets,
    secretsMiddleware
};