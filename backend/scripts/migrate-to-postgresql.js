#!/usr/bin/env node

/**
 * NiEMIS SQLite to PostgreSQL Migration Script
 * Migrates data from SQLite development database to local PostgreSQL
 */

const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Configuration
const SQLITE_DB_PATH = path.join(__dirname, '..', 'niemis_demo.db');
const POSTGRES_CONFIG = {
    host: 'localhost',
    port: 5432,
    database: 'niemis_local',
    user: 'niemis_admin',
    password: 'NiEMIS_Admin_2024!',
};

// Migration utilities
class DatabaseMigrator {
    constructor() {
        this.sqliteDb = null;
        this.pgClient = null;
    }

    async connect() {
        // Connect to SQLite
        this.sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
            if (err) {
                console.error('Error opening SQLite database:', err);
                process.exit(1);
            }
            console.log('Connected to SQLite database');
        });

        // Connect to PostgreSQL
        this.pgClient = new Client(POSTGRES_CONFIG);
        await this.pgClient.connect();
        console.log('Connected to PostgreSQL database');
    }

    async disconnect() {
        if (this.sqliteDb) {
            this.sqliteDb.close();
            console.log('Disconnected from SQLite database');
        }
        if (this.pgClient) {
            await this.pgClient.end();
            console.log('Disconnected from PostgreSQL database');
        }
    }

    async runSQLiteQuery(query) {
        return new Promise((resolve, reject) => {
            this.sqliteDb.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async runPostgresQuery(query, params = []) {
        try {
            const result = await this.pgClient.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('PostgreSQL query error:', error);
            throw error;
        }
    }

    async getTableNames() {
        const query = `
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%' 
            AND name NOT IN ('SequelizeMeta')
            ORDER BY name;
        `;
        return await this.runSQLiteQuery(query);
    }

    async getTableSchema(tableName) {
        const query = `PRAGMA table_info(${tableName});`;
        return await this.runSQLiteQuery(query);
    }

    async getTableData(tableName) {
        const query = `SELECT * FROM ${tableName};`;
        return await this.runSQLiteQuery(query);
    }

    async clearPostgresTable(tableName) {
        try {
            await this.runPostgresQuery(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE;`);
            console.log(`Cleared PostgreSQL table: ${tableName}`);
        } catch (error) {
            console.log(`Table ${tableName} doesn't exist or cannot be cleared:`, error.message);
        }
    }

    convertSQLiteToPostgresValue(value, sqliteType) {
        if (value === null || value === undefined) return null;

        switch (sqliteType.toLowerCase()) {
            case 'boolean':
                return value === 1 || value === 'true' || value === true;
            case 'datetime':
            case 'timestamp':
                if (typeof value === 'string') {
                    return new Date(value);
                }
                return value;
            case 'json':
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    } catch (e) {
                        return value;
                    }
                }
                return value;
            default:
                return value;
        }
    }

    async migrateTable(tableName) {
        console.log(`\n--- Migrating table: ${tableName} ---`);

        try {
            // Get table schema and data from SQLite
            const schema = await this.getTableSchema(tableName);
            const data = await this.getTableData(tableName);

            console.log(`Found ${data.length} rows in ${tableName}`);

            if (data.length === 0) {
                console.log(`No data to migrate for table ${tableName}`);
                return;
            }

            // Clear existing data in PostgreSQL
            await this.clearPostgresTable(tableName);

            // Prepare column names and placeholders
            const columns = schema.map(col => col.name);
            const placeholders = columns.map((_, index) => `$${index + 1}`);
            const insertQuery = `
                INSERT INTO ${tableName} (${columns.join(', ')}) 
                VALUES (${placeholders.join(', ')})
            `;

            // Insert data in batches
            const batchSize = 100;
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                
                for (const row of batch) {
                    try {
                        const values = columns.map(col => {
                            const schemaCol = schema.find(s => s.name === col);
                            return this.convertSQLiteToPostgresValue(row[col], schemaCol?.type || 'text');
                        });

                        await this.runPostgresQuery(insertQuery, values);
                        successCount++;
                    } catch (error) {
                        errorCount++;
                        console.error(`Error inserting row ${i + 1} in ${tableName}:`, error.message);
                        console.error('Row data:', row);
                    }
                }

                console.log(`Processed ${Math.min(i + batchSize, data.length)}/${data.length} rows`);
            }

            console.log(`Table ${tableName} migration completed: ${successCount} success, ${errorCount} errors`);

        } catch (error) {
            console.error(`Error migrating table ${tableName}:`, error);
        }
    }

    async updateSequences() {
        console.log('\n--- Updating PostgreSQL sequences ---');

        try {
            const sequenceQuery = `
                SELECT schemaname, sequencename, last_value 
                FROM pg_sequences 
                WHERE schemaname = 'public';
            `;
            
            const sequences = await this.runPostgresQuery(sequenceQuery);

            for (const seq of sequences) {
                const tableName = seq.sequencename.replace('_id_seq', '');
                
                try {
                    const maxIdQuery = `SELECT MAX(id) as max_id FROM ${tableName}`;
                    const result = await this.runPostgresQuery(maxIdQuery);
                    const maxId = result[0]?.max_id || 0;

                    if (maxId > 0) {
                        const updateSeqQuery = `SELECT setval('${seq.sequencename}', ${maxId});`;
                        await this.runPostgresQuery(updateSeqQuery);
                        console.log(`Updated sequence ${seq.sequencename} to ${maxId}`);
                    }
                } catch (error) {
                    console.error(`Error updating sequence ${seq.sequencename}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error updating sequences:', error);
        }
    }

    async verifyMigration() {
        console.log('\n--- Verifying migration ---');

        try {
            const tables = await this.getTableNames();
            const verification = [];

            for (const table of tables) {
                const sqliteCount = await this.runSQLiteQuery(`SELECT COUNT(*) as count FROM ${table.name}`);
                const pgCount = await this.runPostgresQuery(`SELECT COUNT(*) as count FROM ${table.name}`);

                verification.push({
                    table: table.name,
                    sqlite: sqliteCount[0].count,
                    postgres: pgCount[0].count,
                    match: sqliteCount[0].count === pgCount[0].count
                });
            }

            console.log('\nMigration Verification Results:');
            console.log('Table                 | SQLite | PostgreSQL | Match');
            console.log('--------------------------------------------------');
            
            verification.forEach(v => {
                const status = v.match ? '✓' : '✗';
                console.log(`${v.table.padEnd(20)} | ${v.sqlite.toString().padEnd(6)} | ${v.postgres.toString().padEnd(10)} | ${status}`);
            });

            const allMatch = verification.every(v => v.match);
            console.log(`\nOverall migration status: ${allMatch ? 'SUCCESS' : 'PARTIAL'}`);

        } catch (error) {
            console.error('Error verifying migration:', error);
        }
    }

    async migrate() {
        console.log('Starting NiEMIS SQLite to PostgreSQL migration...');
        console.log('================================================');

        try {
            await this.connect();

            // Get all tables to migrate
            const tables = await this.getTableNames();
            console.log(`Found ${tables.length} tables to migrate`);

            // Migration order (dependencies first)
            const migrationOrder = [
                'zones', 'parishes', 'schools', 'users', 'staff', 'parents', 
                'students', 'student_parent_relationships', 'student_health',
                'family_social_assessments', 'disability_assessments', 
                'student_athletics', 'facilities', 'inventory_items',
                'subjects', 'terms', 'classes', 'rfid_devices',
                'attendance_records', 'academic_records', 'grades',
                'report_cards', 'student_transfers', 'teacher_evaluations',
                'professional_development', 'audit_logs'
            ];

            // Migrate tables in order
            for (const tableName of migrationOrder) {
                const tableExists = tables.find(t => t.name === tableName);
                if (tableExists) {
                    await this.migrateTable(tableName);
                }
            }

            // Migrate any remaining tables
            const remainingTables = tables.filter(t => !migrationOrder.includes(t.name));
            for (const table of remainingTables) {
                await this.migrateTable(table.name);
            }

            // Update sequences
            await this.updateSequences();

            // Verify migration
            await this.verifyMigration();

            console.log('\n================================================');
            console.log('Migration completed successfully!');

        } catch (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }
}

// Main execution
if (require.main === module) {
    const migrator = new DatabaseMigrator();
    migrator.migrate().catch(console.error);
}

module.exports = DatabaseMigrator;