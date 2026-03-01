-- Fix missing updated_at column in audit_logs table
ALTER TABLE school_system.audit_logs ADD COLUMN updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;

-- Also ensure all tables have proper timestamps
ALTER TABLE school_system.users ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE school_system.students ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE school_system.staff ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE school_system.parents ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;