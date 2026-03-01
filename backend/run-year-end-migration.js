/**
 * Migration script to add year_end_status fields to students table
 * Run with: node run-year-end-migration.js
 */

require('dotenv').config();
const { sequelize } = require('./config/database');

async function runMigration() {
    console.log('Starting year_end_status migration...\n');

    try {
        // Test connection
        await sequelize.authenticate();
        console.log('Database connection established.\n');

        // Create ENUM type if it doesn't exist
        console.log('Creating enum_students_year_end_status type...');
        try {
            await sequelize.query(`
                DO $$ BEGIN
                    CREATE TYPE enum_students_year_end_status AS ENUM ('promoted', 'stop_down', 'graduated');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            console.log('  ENUM type created or already exists.\n');
        } catch (err) {
            console.log('  ENUM type already exists.\n');
        }

        // Add year_end_status column
        console.log('Adding year_end_status column...');
        try {
            await sequelize.query(`
                ALTER TABLE school_system.students
                ADD COLUMN IF NOT EXISTS year_end_status enum_students_year_end_status DEFAULT NULL;
            `);
            console.log('  year_end_status column added.\n');
        } catch (err) {
            console.log('  Column may already exist:', err.message, '\n');
        }

        // Add year_end_status_date column
        console.log('Adding year_end_status_date column...');
        try {
            await sequelize.query(`
                ALTER TABLE school_system.students
                ADD COLUMN IF NOT EXISTS year_end_status_date DATE DEFAULT NULL;
            `);
            console.log('  year_end_status_date column added.\n');
        } catch (err) {
            console.log('  Column may already exist:', err.message, '\n');
        }

        // Add year_end_status_set_by column
        console.log('Adding year_end_status_set_by column...');
        try {
            await sequelize.query(`
                ALTER TABLE school_system.students
                ADD COLUMN IF NOT EXISTS year_end_status_set_by UUID DEFAULT NULL;
            `);
            console.log('  year_end_status_set_by column added.\n');
        } catch (err) {
            console.log('  Column may already exist:', err.message, '\n');
        }

        // Add year_end_notes column
        console.log('Adding year_end_notes column...');
        try {
            await sequelize.query(`
                ALTER TABLE school_system.students
                ADD COLUMN IF NOT EXISTS year_end_notes TEXT DEFAULT NULL;
            `);
            console.log('  year_end_notes column added.\n');
        } catch (err) {
            console.log('  Column may already exist:', err.message, '\n');
        }

        // Add index
        console.log('Adding index on year_end_status...');
        try {
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_students_year_end_status
                ON school_system.students(year_end_status);
            `);
            console.log('  Index created.\n');
        } catch (err) {
            console.log('  Index may already exist:', err.message, '\n');
        }

        console.log('Migration completed successfully!');
        console.log('\nYou can now restart the backend server.');

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

runMigration();
