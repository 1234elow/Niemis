const { sequelize } = require('../config/database');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Production-ready database backup and recovery procedures
 * Supports both PostgreSQL and SQLite databases
 */
class DatabaseBackupManager {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.maxBackups = 7; // Keep last 7 backups
        this.backupResults = {
            success: false,
            backup_file: null,
            timestamp: new Date().toISOString(),
            size_bytes: 0,
            duration_ms: 0,
            errors: []
        };
    }

    /**
     * Resolve normalized DB config from active Sequelize instance
     */
    resolveDatabaseConfig() {
        const dialect = typeof sequelize.getDialect === 'function'
            ? sequelize.getDialect()
            : sequelize?.options?.dialect;
        const options = sequelize?.options || {};

        return {
            dialect,
            host: options.host,
            port: options.port,
            database: options.database,
            username: options.username || options.user,
            password: options.password,
            storage: options.storage
        };
    }

    /**
     * Main backup function
     */
    async createBackup() {
        const startTime = Date.now();
        
        try {
            logger.info('Starting database backup...');
            
            // Ensure backup directory exists
            await this.ensureBackupDirectory();
            
            // Determine database type and create backup
            const dbConfig = this.resolveDatabaseConfig();
            const backupFile = await this.createDatabaseBackup(dbConfig);
            
            // Cleanup old backups
            await this.cleanupOldBackups();
            
            // Generate backup statistics
            const stats = await fs.stat(backupFile);
            this.backupResults.backup_file = backupFile;
            this.backupResults.size_bytes = stats.size;
            this.backupResults.duration_ms = Date.now() - startTime;
            this.backupResults.success = true;
            
            logger.info('Database backup completed successfully:', this.backupResults);
            return this.backupResults;
            
        } catch (error) {
            this.backupResults.errors.push(error.message);
            this.backupResults.duration_ms = Date.now() - startTime;
            logger.error('Database backup failed:', error);
            throw error;
        }
    }

    /**
     * Ensure backup directory exists
     */
    async ensureBackupDirectory() {
        try {
            await fs.access(this.backupDir);
        } catch {
            await fs.mkdir(this.backupDir, { recursive: true });
            logger.info(`Created backup directory: ${this.backupDir}`);
        }
    }

    /**
     * Create database backup based on database type
     */
    async createDatabaseBackup(dbConfig) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        if (dbConfig.dialect === 'postgres') {
            return await this.createPostgreSQLBackup(dbConfig, timestamp);
        } else if (dbConfig.dialect === 'sqlite') {
            return await this.createSQLiteBackup(dbConfig, timestamp);
        } else {
            throw new Error(`Unsupported database dialect: ${dbConfig.dialect}`);
        }
    }

    /**
     * Create PostgreSQL backup using pg_dump
     */
    async createPostgreSQLBackup(dbConfig, timestamp) {
        const backupFile = path.join(this.backupDir, `niemis_backup_${timestamp}.sql`);
        const pgDumpPath = this.resolvePgDumpPath();

        if (!pgDumpPath) {
            logger.warn('pg_dump not found in PATH. Falling back to JSON logical backup.');
            return this.createPostgreSQLJsonBackup(timestamp);
        }
        
        // Use DATABASE_URL if available, otherwise construct from config
        const databaseUrl = process.env.DATABASE_URL || 
            `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
        
        const pgDumpArgs = [
            '--verbose',
            '--clean',
            '--no-owner',
            '--no-privileges',
            '--format=plain',
            '--file=' + backupFile,
            databaseUrl
        ];
        
        logger.info('Creating PostgreSQL backup with pg_dump...');
        
        return new Promise((resolve, reject) => {
            const pgDump = spawn(pgDumpPath, pgDumpArgs);
            
            let stderr = '';
            
            pgDump.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            pgDump.on('close', (code) => {
                if (code === 0) {
                    logger.info(`PostgreSQL backup created successfully: ${backupFile}`);
                    resolve(backupFile);
                } else {
                    logger.error('pg_dump failed:', stderr);
                    reject(new Error(`pg_dump failed with code ${code}: ${stderr}`));
                }
            });
            
            pgDump.on('error', (error) => {
                logger.error('pg_dump error:', error);
                reject(error);
            });
        });
    }

    /**
     * Resolve pg_dump executable path
     */
    resolvePgDumpPath() {
        if (process.env.PG_DUMP_PATH) {
            return process.env.PG_DUMP_PATH;
        }

        const whichCommand = process.platform === 'win32' ? 'where' : 'which';
        const lookup = spawnSync(whichCommand, ['pg_dump'], { encoding: 'utf8' });
        if (lookup.status === 0 && lookup.stdout) {
            const candidate = lookup.stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean);
            if (candidate) {
                return candidate;
            }
        }

        if (process.platform === 'win32') {
            const commonVersions = ['17', '16', '15', '14', '13', '12'];
            for (const version of commonVersions) {
                const candidate = `C:\\Program Files\\PostgreSQL\\${version}\\bin\\pg_dump.exe`;
                if (require('fs').existsSync(candidate)) {
                    return candidate;
                }
            }
        }

        return null;
    }

    /**
     * Fallback logical backup for PostgreSQL when pg_dump is unavailable
     */
    async createPostgreSQLJsonBackup(timestamp) {
        const backupFile = path.join(this.backupDir, `niemis_backup_${timestamp}.json`);

        const [tables] = await sequelize.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
              AND table_schema IN ('school_system', 'public')
              AND table_name <> 'SequelizeMeta'
            ORDER BY table_schema, table_name
        `);

        const payload = {
            backup_type: 'postgres_json_fallback',
            generated_at: new Date().toISOString(),
            table_count: tables.length,
            tables: {}
        };

        for (const table of tables) {
            const schema = table.table_schema;
            const tableName = table.table_name;
            const key = `${schema}.${tableName}`;
            const [rows] = await sequelize.query(`SELECT * FROM "${schema}"."${tableName}"`);
            payload.tables[key] = rows;
        }

        await fs.writeFile(backupFile, JSON.stringify(payload, null, 2), 'utf8');
        logger.info(`PostgreSQL JSON fallback backup created successfully: ${backupFile}`);
        return backupFile;
    }

    /**
     * Create SQLite backup by copying database file
     */
    async createSQLiteBackup(dbConfig, timestamp) {
        const backupFile = path.join(this.backupDir, `niemis_backup_${timestamp}.db`);
        const sourceFile = dbConfig.storage;
        
        logger.info('Creating SQLite backup...');
        
        try {
            await fs.copyFile(sourceFile, backupFile);
            logger.info(`SQLite backup created successfully: ${backupFile}`);
            return backupFile;
        } catch (error) {
            logger.error('SQLite backup failed:', error);
            throw error;
        }
    }

    /**
     * Clean up old backups to save space
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('niemis_backup_'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    mtime: fs.stat(path.join(this.backupDir, file)).then(stats => stats.mtime)
                }));
            
            // Wait for all stat operations to complete
            for (const file of backupFiles) {
                file.mtime = await file.mtime;
            }
            
            // Sort by modification time (newest first)
            backupFiles.sort((a, b) => b.mtime - a.mtime);
            
            // Remove old backups
            const filesToRemove = backupFiles.slice(this.maxBackups);
            for (const file of filesToRemove) {
                await fs.unlink(file.path);
                logger.info(`Removed old backup: ${file.name}`);
            }
            
            logger.info(`Cleanup completed. Kept ${Math.min(backupFiles.length, this.maxBackups)} backups`);
            
        } catch (error) {
            logger.warn('Error during backup cleanup:', error);
        }
    }

    /**
     * Restore database from backup
     */
    async restoreFromBackup(backupFile) {
        try {
            logger.info(`Starting database restore from: ${backupFile}`);
            
            // Verify backup file exists
            await fs.access(backupFile);
            
            const dbConfig = this.resolveDatabaseConfig();
            
            if (dbConfig.dialect === 'postgres') {
                await this.restorePostgreSQLBackup(backupFile, dbConfig);
            } else if (dbConfig.dialect === 'sqlite') {
                await this.restoreSQLiteBackup(backupFile, dbConfig);
            } else {
                throw new Error(`Unsupported database dialect: ${dbConfig.dialect}`);
            }
            
            logger.info('Database restore completed successfully');
            return { success: true, restored_from: backupFile };
            
        } catch (error) {
            logger.error('Database restore failed:', error);
            throw error;
        }
    }

    /**
     * Restore PostgreSQL database from backup
     */
    async restorePostgreSQLBackup(backupFile, dbConfig) {
        const databaseUrl = process.env.DATABASE_URL || 
            `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
        
        const psqlArgs = [
            '--verbose',
            '--single-transaction',
            '--file=' + backupFile,
            databaseUrl
        ];
        
        logger.info('Restoring PostgreSQL database with psql...');
        
        return new Promise((resolve, reject) => {
            const psql = spawn('psql', psqlArgs);
            
            let stderr = '';
            
            psql.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            psql.on('close', (code) => {
                if (code === 0) {
                    logger.info('PostgreSQL restore completed successfully');
                    resolve();
                } else {
                    logger.error('psql restore failed:', stderr);
                    reject(new Error(`psql failed with code ${code}: ${stderr}`));
                }
            });
            
            psql.on('error', (error) => {
                logger.error('psql error:', error);
                reject(error);
            });
        });
    }

    /**
     * Restore SQLite database from backup
     */
    async restoreSQLiteBackup(backupFile, dbConfig) {
        const targetFile = dbConfig.storage;
        
        logger.info('Restoring SQLite database...');
        
        try {
            // Create backup of current database
            const currentBackup = targetFile + '.restore_backup';
            await fs.copyFile(targetFile, currentBackup);
            
            // Restore from backup
            await fs.copyFile(backupFile, targetFile);
            
            logger.info('SQLite restore completed successfully');
        } catch (error) {
            logger.error('SQLite restore failed:', error);
            throw error;
        }
    }

    /**
     * List available backups
     */
    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = [];
            
            for (const file of files) {
                if (file.startsWith('niemis_backup_')) {
                    const filePath = path.join(this.backupDir, file);
                    const stats = await fs.stat(filePath);
                    
                    backupFiles.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }
            
            // Sort by creation time (newest first)
            backupFiles.sort((a, b) => b.created - a.created);
            
            return backupFiles;
            
        } catch (error) {
            logger.error('Error listing backups:', error);
            throw error;
        }
    }

    /**
     * Create backup schedule configuration
     */
    createBackupSchedule() {
        return {
            daily: {
                cron: '0 2 * * *', // Daily at 2 AM
                retention: 7,
                enabled: true
            },
            weekly: {
                cron: '0 3 * * 0', // Weekly on Sunday at 3 AM
                retention: 4,
                enabled: true
            },
            monthly: {
                cron: '0 4 1 * *', // Monthly on 1st at 4 AM
                retention: 12,
                enabled: true
            }
        };
    }
}

/**
 * CLI functions
 */
async function runBackup() {
    const backupManager = new DatabaseBackupManager();
    
    try {
        const results = await backupManager.createBackup();
        console.log('✅ Database backup completed successfully!');
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Database backup failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

async function runRestore() {
    const backupFile = process.argv[3];
    
    if (!backupFile) {
        console.error('Please provide backup file path: npm run restore <backup-file>');
        process.exit(1);
    }
    
    const backupManager = new DatabaseBackupManager();
    
    try {
        const results = await backupManager.restoreFromBackup(backupFile);
        console.log('✅ Database restore completed successfully!');
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Database restore failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

async function listBackups() {
    const backupManager = new DatabaseBackupManager();
    
    try {
        const backups = await backupManager.listBackups();
        console.log('📋 Available backups:');
        console.log(JSON.stringify(backups, null, 2));
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error listing backups:', error.message);
        process.exit(1);
    }
}

// CLI execution
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'backup':
            runBackup();
            break;
        case 'restore':
            runRestore();
            break;
        case 'list':
            listBackups();
            break;
        default:
            console.log('Usage: node backup-database.js [backup|restore|list]');
            process.exit(1);
    }
}

module.exports = DatabaseBackupManager;
