const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

let sequelize;

if (process.env.NODE_ENV === 'production' || process.env.DB_HOST || process.env.DATABASE_URL) {
    // Use PostgreSQL for production or when DB_HOST/DATABASE_URL is specified
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
        // Use connection URL if provided (Render.com format)
        sequelize = new Sequelize(databaseUrl, {
            dialect: 'postgres',
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
            define: {
                underscored: true,
                freezeTableName: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at'
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
            benchmark: process.env.NODE_ENV === 'development',
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
            hooks: {
                beforeConnect: (config) => {
                    console.log('Connecting to PostgreSQL database...');
                },
                afterConnect: (connection, config) => {
                    console.log('Successfully connected to PostgreSQL database');
                },
                beforeDisconnect: (connection) => {
                    console.log('Disconnecting from PostgreSQL database...');
                }
            }
        });
    } else {
        // Use individual parameters
        sequelize = new Sequelize({
            dialect: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'niemis_production',
            username: process.env.DB_USER || 'niemis_user',
            password: process.env.DB_PASSWORD || 'secure_password123',
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
            define: {
                underscored: true,
                freezeTableName: true,
                timestamps: true,
                createdAt: 'created_at',
                updatedAt: 'updated_at'
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
            benchmark: process.env.NODE_ENV === 'development',
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
            hooks: {
                beforeConnect: (config) => {
                    console.log('Connecting to PostgreSQL database...');
                },
                afterConnect: (connection, config) => {
                    console.log('Successfully connected to PostgreSQL database');
                },
                beforeDisconnect: (connection) => {
                    console.log('Disconnecting from PostgreSQL database...');
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
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
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