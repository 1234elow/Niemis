-- Migration: Add year_end_status fields to students table
-- Run this SQL against your PostgreSQL database

-- Create the ENUM type for year_end_status
DO $$ BEGIN
    CREATE TYPE enum_students_year_end_status AS ENUM ('promoted', 'stop_down', 'graduated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add year_end_status column
ALTER TABLE school_system.students
ADD COLUMN IF NOT EXISTS year_end_status enum_students_year_end_status DEFAULT NULL;

-- Add year_end_status_date column
ALTER TABLE school_system.students
ADD COLUMN IF NOT EXISTS year_end_status_date DATE DEFAULT NULL;

-- Add year_end_status_set_by column (references users)
ALTER TABLE school_system.students
ADD COLUMN IF NOT EXISTS year_end_status_set_by UUID DEFAULT NULL;

-- Add year_end_notes column
ALTER TABLE school_system.students
ADD COLUMN IF NOT EXISTS year_end_notes TEXT DEFAULT NULL;

-- Add foreign key constraint for year_end_status_set_by
DO $$ BEGIN
    ALTER TABLE school_system.students
    ADD CONSTRAINT fk_students_year_end_status_set_by
    FOREIGN KEY (year_end_status_set_by)
    REFERENCES school_system.users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add index for year_end_status
CREATE INDEX IF NOT EXISTS idx_students_year_end_status
ON school_system.students(year_end_status);

-- Add comments
COMMENT ON COLUMN school_system.students.year_end_status IS 'Year-end progression status: promoted, stop_down (retained), or graduated';
COMMENT ON COLUMN school_system.students.year_end_status_date IS 'Date when year-end status was set';
COMMENT ON COLUMN school_system.students.year_end_status_set_by IS 'User who set the year-end status';
COMMENT ON COLUMN school_system.students.year_end_notes IS 'Additional notes about year-end status decision';
