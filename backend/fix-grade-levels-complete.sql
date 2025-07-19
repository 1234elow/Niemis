-- Step 1: Increase field length to accommodate longer grade level names
ALTER TABLE school_system.students 
ALTER COLUMN grade_level TYPE VARCHAR(20);

-- Step 2: Update existing grade levels to proper Barbados format
UPDATE school_system.students 
SET grade_level = CASE 
    WHEN grade_level = '4th Form' THEN 'Fourth Form'
    WHEN grade_level = '5th Form' THEN 'Fifth Form'
    WHEN grade_level = 'Form 1' THEN 'First Form'
    WHEN grade_level = 'Form 2' THEN 'Second Form'
    WHEN grade_level = 'Form 3' THEN 'Third Form'
    WHEN grade_level = 'Form 4' THEN 'Fourth Form'
    WHEN grade_level = 'Form 5' THEN 'Fifth Form'
    WHEN grade_level = 'Form 6' THEN 'Sixth Form'
    ELSE grade_level
END
WHERE grade_level IN ('4th Form', '5th Form', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6');

-- Step 3: Check results
SELECT grade_level, COUNT(*) as count 
FROM school_system.students 
GROUP BY grade_level 
ORDER BY grade_level;