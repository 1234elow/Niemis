-- NiEMIS Local Database Initialization Script
-- This script initializes the PostgreSQL database for local development

-- Create the main database and test database
CREATE DATABASE niemis_local;
CREATE DATABASE niemis_test;

-- Create the user with appropriate permissions
-- Note: This is only for local development
CREATE USER niemis_user WITH PASSWORD 'local_password123';

-- Grant all privileges on the databases
GRANT ALL PRIVILEGES ON DATABASE niemis_local TO niemis_user;
GRANT ALL PRIVILEGES ON DATABASE niemis_test TO niemis_user;

-- Make the user a superuser for local development convenience
ALTER USER niemis_user CREATEDB;

-- Switch to the main database
\c niemis_local;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO niemis_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO niemis_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO niemis_user;

-- Create extensions that might be needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Switch to the test database
\c niemis_test;

-- Grant schema privileges for test database
GRANT ALL ON SCHEMA public TO niemis_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO niemis_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO niemis_user;

-- Create extensions for test database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Switch back to the main database
\c niemis_local;

-- Create the same function in the main database
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create some indexes that might be useful
-- These will be created by migrations but having them here ensures they exist

-- Print success message
SELECT 'Database initialization completed successfully!' AS message;