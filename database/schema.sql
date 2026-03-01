-- National Integrated Education Management Information System (NiEMIS)
-- PostgreSQL Database Schema

-- Create database if not exists
-- CREATE DATABASE niemis_db;

-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'teacher', 'parent', 'student')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zones and Parishes
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE parishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schools
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    school_type VARCHAR(20) NOT NULL CHECK (school_type IN ('pre_primary', 'primary', 'secondary')),
    offers_sixth_form BOOLEAN DEFAULT false,
    zone_id UUID REFERENCES zones(id),
    parish_id UUID REFERENCES parishes(id),
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    principal_name VARCHAR(100),
    established_date DATE,
    capacity INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- School Day Policies (used by timetable break/lunch validation)
CREATE TABLE school_day_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL UNIQUE REFERENCES schools(id),
    school_day_start TIME NOT NULL DEFAULT '08:00:00',
    school_day_end TIME NOT NULL DEFAULT '15:30:00',
    break_start TIME NOT NULL DEFAULT '10:00:00',
    break_end TIME NOT NULL DEFAULT '10:20:00',
    lunch_start TIME NOT NULL DEFAULT '12:00:00',
    lunch_end TIME NOT NULL DEFAULT '12:45:00',
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grading policy table (national defaults + optional school overrides)
CREATE TABLE grading_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    policy_name VARCHAR(120) NOT NULL,
    grade_band VARCHAR(30) NOT NULL CHECK (
        grade_band IN ('pre_primary', 'primary', 'lower_secondary', 'upper_secondary', 'sixth_form')
    ),
    school_type VARCHAR(40),
    continuous_assessment_weight DECIMAL(5,2) NOT NULL DEFAULT 70 CHECK (
        continuous_assessment_weight >= 0 AND continuous_assessment_weight <= 100
    ),
    end_term_exam_weight DECIMAL(5,2) NOT NULL DEFAULT 30 CHECK (
        end_term_exam_weight >= 0 AND end_term_exam_weight <= 100
    ),
    pass_mark DECIMAL(5,2) NOT NULL DEFAULT 50 CHECK (
        pass_mark >= 0 AND pass_mark <= 100
    ),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff/Teachers
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10),
    phone VARCHAR(20),
    address TEXT,
    position VARCHAR(50) NOT NULL,
    department VARCHAR(50),
    hire_date DATE NOT NULL,
    salary DECIMAL(10,2),
    qualifications TEXT,
    certifications TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    student_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10),
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    rfid_tag VARCHAR(50) UNIQUE,
    enrollment_date DATE NOT NULL,
    grade_level VARCHAR(20) NOT NULL,
    class_section VARCHAR(10),
    photo_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parents/Guardians
CREATE TABLE parents_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    relationship VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    occupation VARCHAR(100),
    education_level VARCHAR(50),
    is_emergency_contact BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student-Parent relationships
CREATE TABLE student_parent_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    parent_id UUID REFERENCES parents_guardians(id),
    relationship_type VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student Health Information
CREATE TABLE student_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    medical_conditions TEXT,
    allergies TEXT,
    medications TEXT,
    immunization_records JSONB,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    blood_type VARCHAR(5),
    doctor_name VARCHAR(100),
    doctor_phone VARCHAR(20),
    last_physical_exam DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family Social Needs Assessment
CREATE TABLE family_social_assessment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    household_income_range VARCHAR(20),
    housing_type VARCHAR(50),
    number_of_dependents INTEGER,
    single_parent_household BOOLEAN DEFAULT false,
    foster_care BOOLEAN DEFAULT false,
    homeless BOOLEAN DEFAULT false,
    has_electricity BOOLEAN DEFAULT true,
    has_internet BOOLEAN DEFAULT false,
    food_insecurity_level VARCHAR(20),
    free_meal_eligible BOOLEAN DEFAULT false,
    social_worker_assigned BOOLEAN DEFAULT false,
    social_worker_name VARCHAR(100),
    notes TEXT,
    assessment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Disability Support System
CREATE TABLE disability_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    disability_type VARCHAR(100),
    severity_level VARCHAR(20) CHECK (severity_level IN ('mild', 'moderate', 'severe')),
    disability_index_score INTEGER,
    accommodations_needed TEXT,
    support_services TEXT,
    iep_status BOOLEAN DEFAULT false,
    iep_document_url VARCHAR(255),
    assessment_date DATE,
    next_review_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Athletic Pursuits
CREATE TABLE student_athletics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    sport_name VARCHAR(50) NOT NULL,
    skill_level VARCHAR(20) CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
    participation_start_date DATE,
    coach_name VARCHAR(100),
    coach_evaluation TEXT,
    competitions_attended INTEGER DEFAULT 0,
    achievements TEXT,
    fitness_score INTEGER,
    health_clearance BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Records
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    school_id UUID REFERENCES schools(id),
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
    rfid_entry_time TIMESTAMP,
    rfid_exit_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Academic Records
CREATE TABLE academic_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    school_year VARCHAR(10) NOT NULL,
    term VARCHAR(20) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    grade VARCHAR(5),
    grade_points DECIMAL(3,2),
    teacher_id UUID REFERENCES staff(id),
    assignment_scores JSONB,
    exam_scores JSONB,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student Transfers
CREATE TABLE student_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    from_school_id UUID REFERENCES schools(id),
    to_school_id UUID REFERENCES schools(id),
    transfer_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    approved_by UUID REFERENCES staff(id),
    parent_consent BOOLEAN DEFAULT false,
    documents_transferred BOOLEAN DEFAULT false,
    transcript_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Facilities Management
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    facility_name VARCHAR(100) NOT NULL,
    facility_type VARCHAR(50) NOT NULL,
    room_number VARCHAR(20),
    capacity INTEGER,
    area_sqm DECIMAL(8,2),
    condition_status VARCHAR(20) DEFAULT 'good' CHECK (condition_status IN ('excellent', 'good', 'fair', 'poor')),
    accessibility_features TEXT,
    last_maintenance DATE,
    next_maintenance DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Management
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    facility_id UUID REFERENCES facilities(id),
    item_name VARCHAR(100) NOT NULL,
    item_category VARCHAR(50),
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10,2),
    purchase_date DATE,
    condition_status VARCHAR(20) DEFAULT 'good',
    supplier VARCHAR(100),
    warranty_expiry DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teacher Performance Evaluations
CREATE TABLE teacher_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES staff(id),
    evaluator_id UUID REFERENCES staff(id),
    evaluation_period VARCHAR(20),
    evaluation_date DATE NOT NULL,
    teaching_effectiveness INTEGER CHECK (teaching_effectiveness BETWEEN 1 AND 5),
    classroom_management INTEGER CHECK (classroom_management BETWEEN 1 AND 5),
    student_engagement INTEGER CHECK (student_engagement BETWEEN 1 AND 5),
    professional_development INTEGER CHECK (professional_development BETWEEN 1 AND 5),
    overall_score DECIMAL(3,2),
    comments TEXT,
    improvement_areas TEXT,
    goals_next_period TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'approved')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Professional Development Tracking
CREATE TABLE professional_development (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff(id),
    course_name VARCHAR(200) NOT NULL,
    provider VARCHAR(100),
    course_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    hours_completed INTEGER,
    certificate_earned BOOLEAN DEFAULT false,
    certificate_url VARCHAR(255),
    cost DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RFID Devices and Readers
CREATE TABLE rfid_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    device_id VARCHAR(50) UNIQUE NOT NULL,
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('gate_reader', 'classroom_reader', 'mobile_reader')),
    location VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_attendance_student_date ON attendance_records(student_id, attendance_date);
CREATE INDEX idx_academic_records_student ON academic_records(student_id, school_year, term);
CREATE INDEX idx_staff_school_id ON staff(school_id);
CREATE INDEX idx_school_day_policies_school_id ON school_day_policies(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_student_transfers_status ON student_transfers(status);
CREATE INDEX idx_facilities_school_id ON facilities(school_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Add some sample data for parishes and zones
INSERT INTO parishes (name, code) VALUES 
('Christ Church', 'CC'),
('St. Andrew', 'SA'),
('St. George', 'SG'),
('St. James', 'SJ'),
('St. John', 'SJN'),
('St. Joseph', 'SJO'),
('St. Lucy', 'SL'),
('St. Michael', 'SM'),
('St. Peter', 'SP'),
('St. Philip', 'SPH'),
('St. Thomas', 'ST');

INSERT INTO zones (name, description) VALUES 
('Zone 1 - North', 'Northern parishes including St. Lucy, St. Peter'),
('Zone 2 - East', 'Eastern parishes including St. John, St. Joseph'),
('Zone 3 - South', 'Southern parishes including Christ Church, St. Philip'),
('Zone 4 - West', 'Western parishes including St. James, St. Thomas'),
('Zone 5 - Central', 'Central parishes including St. Michael, St. George');
