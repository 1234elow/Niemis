const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

let sequelize;
const databaseUrl = process.env.DATABASE_URL;
const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
const isDevelopment = process.env.NODE_ENV === 'development';
const shouldLogConnectionLifecycle = isDevelopment && !isTest;
const hasPostgresConfig = Boolean(databaseUrl || process.env.DB_HOST);
const allowSqliteFallback = process.env.ALLOW_SQLITE_FALLBACK === 'true';
const shouldUsePostgres = process.env.FORCE_POSTGRES === 'true'
    || process.env.NODE_ENV === 'production'
    || hasPostgresConfig
    || !allowSqliteFallback;

if (shouldUsePostgres) {
    // Use PostgreSQL by default (SQLite fallback only when ALLOW_SQLITE_FALLBACK=true)
    if (databaseUrl) {
        // Use connection URL if provided (Render.com format)
        sequelize = new Sequelize(databaseUrl, {
            dialect: 'postgres',
            schema: 'school_system',
            logging: isDevelopment ? console.log : false,
            define: {
                underscored: true,
                freezeTableName: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at',
                schema: 'school_system'
            },
            pool: {
                max: parseInt(process.env.DB_POOL_MAX) || 10,
                min: parseInt(process.env.DB_POOL_MIN) || 2,
                acquire: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT) || 30000,
                idle: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 10000,
                evict: 1000,
                handleDisconnects: true
            },
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                },
                keepAlive: true,
                statement_timeout: 30000,
                query_timeout: 30000,
                idle_in_transaction_session_timeout: 30000
            },
            retry: {
                max: 3,
                match: [
                    /ETIMEDOUT/,
                    /EHOSTUNREACH/,
                    /ECONNRESET/,
                    /ECONNREFUSED/,
                    /ENOTFOUND/,
                    /SequelizeConnectionError/,
                    /SequelizeConnectionRefusedError/,
                    /SequelizeHostNotFoundError/,
                    /SequelizeHostNotReachableError/,
                    /SequelizeInvalidConnectionError/,
                    /SequelizeConnectionTimedOutError/
                ]
            },
            benchmark: isDevelopment,
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
            hooks: {
                beforeConnect: (config) => {
                    if (shouldLogConnectionLifecycle) {
                        console.log('Connecting to PostgreSQL database...');
                    }
                },
                afterConnect: (connection, config) => {
                    if (shouldLogConnectionLifecycle) {
                        console.log('Successfully connected to PostgreSQL database');
                    }
                },
                beforeDisconnect: (connection) => {
                    if (shouldLogConnectionLifecycle) {
                        console.log('Disconnecting from PostgreSQL database...');
                    }
                }
            }
        });
    } else {
        if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || typeof process.env.DB_PASSWORD === 'undefined') {
            throw new Error(
                'Missing PostgreSQL env configuration. Set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD (or DATABASE_URL). ' +
                'If you intentionally want local SQLite, set ALLOW_SQLITE_FALLBACK=true.'
            );
        }

        // Use individual parameters
        sequelize = new Sequelize({
            dialect: 'postgres',
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME,
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            schema: 'school_system',
            logging: isDevelopment ? console.log : false,
            define: {
                underscored: true,
                freezeTableName: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at',
                schema: 'school_system'
            },
            pool: {
                max: parseInt(process.env.DB_POOL_MAX) || 10,
                min: parseInt(process.env.DB_POOL_MIN) || 2,
                acquire: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT) || 30000,
                idle: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 10000,
                evict: 1000,
                handleDisconnects: true
            },
            dialectOptions: {
                ssl: process.env.DB_HOST && (process.env.DB_HOST.includes('render.com') || process.env.NODE_ENV === 'production') ? {
                    require: true,
                    rejectUnauthorized: false
                } : false,
                keepAlive: true,
                statement_timeout: 30000,
                query_timeout: 30000,
                idle_in_transaction_session_timeout: 30000
            },
            retry: {
                max: 3,
                match: [
                    /ETIMEDOUT/,
                    /EHOSTUNREACH/,
                    /ECONNRESET/,
                    /ECONNREFUSED/,
                    /ENOTFOUND/,
                    /SequelizeConnectionError/,
                    /SequelizeConnectionRefusedError/,
                    /SequelizeHostNotFoundError/,
                    /SequelizeHostNotReachableError/,
                    /SequelizeInvalidConnectionError/,
                    /SequelizeConnectionTimedOutError/
                ]
            },
            benchmark: isDevelopment,
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
            hooks: {
                beforeConnect: (config) => {
                    if (shouldLogConnectionLifecycle) {
                        console.log('Connecting to PostgreSQL database...');
                    }
                },
                afterConnect: (connection, config) => {
                    if (shouldLogConnectionLifecycle) {
                        console.log('Successfully connected to PostgreSQL database');
                    }
                },
                beforeDisconnect: (connection) => {
                    if (shouldLogConnectionLifecycle) {
                        console.log('Disconnecting from PostgreSQL database...');
                    }
                }
            }
        });
    }
} else {
    // Use SQLite for development
    const dbPath = path.join(__dirname, '..', 'niemis_demo.db');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: isDevelopment ? console.log : false,
        define: {
            underscored: true,
            freezeTableName: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        dialectOptions: {
            timeout: 20000
        },
        retry: {
            max: 3
        }
    });
}

module.exports = { sequelize };
