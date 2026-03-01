-- Update incorrect grade levels to match Barbados education system
-- Fix existing students with wrong grade level format

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
    WHEN grade_level = 'Form 6L' THEN 'Sixth Form'
    WHEN grade_level = 'Form 6U' THEN 'Upper Sixth'
    WHEN grade_level = 'Reception' THEN 'Reception'
    WHEN grade_level = 'Class 1' THEN 'Class 1'
    WHEN grade_level = 'Class 2' THEN 'Class 2'
    WHEN grade_level = 'Class 3' THEN 'Class 3'
    WHEN grade_level = 'Class 4' THEN 'Class 4'
    WHEN grade_level = 'Class 5' THEN 'Class 5'
    WHEN grade_level = 'Class 6' THEN 'Class 4'  -- Map Class 5/6 to Class 4 as primary ends at Class 4
    ELSE grade_level
END
WHERE grade_level IN (
    '4th Form', '5th Form', 'Form 1', 'Form 2', 'Form 3', 
    'Form 4', 'Form 5', 'Form 6', 'Form 6L', 'Form 6U',
    'Class 5', 'Class 6'
);

-- Also update classes table if it exists
UPDATE school_system.classes 
SET grade_level = CASE 
    WHEN grade_level = '4th Form' THEN 'Fourth Form'
    WHEN grade_level = '5th Form' THEN 'Fifth Form'
    WHEN grade_level = 'Form 1' THEN 'First Form'
    WHEN grade_level = 'Form 2' THEN 'Second Form'
    WHEN grade_level = 'Form 3' THEN 'Third Form'
    WHEN grade_level = 'Form 4' THEN 'Fourth Form'
    WHEN grade_level = 'Form 5' THEN 'Fifth Form'
    WHEN grade_level = 'Form 6' THEN 'Sixth Form'
    WHEN grade_level = 'Form 6L' THEN 'Sixth Form'
    WHEN grade_level = 'Form 6U' THEN 'Upper Sixth'
    WHEN grade_level = 'Reception' THEN 'Reception'
    WHEN grade_level = 'Class 1' THEN 'Class 1'
    WHEN grade_level = 'Class 2' THEN 'Class 2'
    WHEN grade_level = 'Class 3' THEN 'Class 3'
    WHEN grade_level = 'Class 4' THEN 'Class 4'
    WHEN grade_level = 'Class 5' THEN 'Class 4'  -- Map Class 5/6 to Class 4
    WHEN grade_level = 'Class 6' THEN 'Class 4'
    ELSE grade_level
END
WHERE grade_level IN (
    '4th Form', '5th Form', 'Form 1', 'Form 2', 'Form 3', 
    'Form 4', 'Form 5', 'Form 6', 'Form 6L', 'Form 6U',
    'Class 5', 'Class 6'
);

-- Check the results
SELECT grade_level, COUNT(*) as student_count 
FROM school_system.students 
GROUP BY grade_level 
ORDER BY 
    CASE 
        WHEN grade_level = 'Reception' THEN 1
        WHEN grade_level = 'Infants A' THEN 2
        WHEN grade_level = 'Infants B' THEN 3
        WHEN grade_level = 'Class 1' THEN 4
        WHEN grade_level = 'Class 2' THEN 5
        WHEN grade_level = 'Class 3' THEN 6
        WHEN grade_level = 'Class 4' THEN 7
        WHEN grade_level = 'First Form' THEN 8
        WHEN grade_level = 'Second Form' THEN 9
        WHEN grade_level = 'Third Form' THEN 10
        WHEN grade_level = 'Fourth Form' THEN 11
        WHEN grade_level = 'Fifth Form' THEN 12
        WHEN grade_level = 'Sixth Form' THEN 13
        WHEN grade_level = 'Upper Sixth' THEN 14
        ELSE 99
    END;