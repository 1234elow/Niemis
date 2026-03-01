-- Fix missing columns in staff table for teachers functionality
ALTER TABLE school_system.staff ADD COLUMN IF NOT EXISTS role_level VARCHAR(50) DEFAULT 'teacher';
ALTER TABLE school_system.staff ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE school_system.staff ADD COLUMN IF NOT EXISTS qualification_level VARCHAR(100);
ALTER TABLE school_system.staff ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0;
ALTER TABLE school_system.staff ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;