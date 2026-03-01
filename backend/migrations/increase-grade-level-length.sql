-- Migration: Increase grade_level field length to accommodate Barbados education system
-- Current limit: VARCHAR(10) 
-- New limit: VARCHAR(20) to handle "Fourth Form", "Upper Sixth", etc.

-- Update students table
ALTER TABLE school_system.students 
ALTER COLUMN grade_level TYPE VARCHAR(20);

-- Update classes table  
ALTER TABLE school_system.classes 
ALTER COLUMN grade_level TYPE VARCHAR(20);

-- Verify the changes
SELECT 
    table_name, 
    column_name, 
    data_type, 
    character_maximum_length 
FROM information_schema.columns 
WHERE table_schema = 'school_system' 
AND column_name = 'grade_level';