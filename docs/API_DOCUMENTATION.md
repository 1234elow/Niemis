# NiEMIS API Documentation

## Base URL
```
Production: https://niemis.education.gov.bb/api
Development: http://localhost:5000/api
```

## Authentication
All API endpoints (except authentication) require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Authentication Endpoints

### POST /auth/login
Login to the system.

**Request Body:**
```json
{
  "login": "username_or_email",
  "password": "password"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@education.gov.bb",
    "role": "teacher",
    "last_login": "2024-01-15T10:30:00Z"
  }
}
```

### POST /auth/register
Register a new user (Admin only).

**Request Body:**
```json
{
  "username": "new_user",
  "email": "user@education.gov.bb",
  "password": "secure_password",
  "role": "teacher",
  "profile_data": {
    "first_name": "John",
    "last_name": "Doe",
    "school_id": "school_uuid"
  }
}
```

### GET /auth/profile
Get current user profile.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@education.gov.bb",
    "role": "teacher",
    "is_active": true
  }
}
```

## Schools Endpoints

### GET /schools
Get all schools with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `school_type` (string): Filter by type (pre_primary, primary, secondary)
- `zone_id` (uuid): Filter by zone
- `parish_id` (uuid): Filter by parish
- `search` (string): Search by name or principal

**Response:**
```json
{
  "schools": [
    {
      "id": "uuid",
      "name": "St. Michael Primary School",
      "school_type": "primary",
      "zone_id": "zone_uuid",
      "parish_id": "parish_uuid",
      "address": "123 School Street, St. Michael",
      "phone": "+1-246-123-4567",
      "email": "info@stmichael.edu.bb",
      "principal_name": "Dr. Jane Smith",
      "capacity": 500,
      "is_active": true,
      "Zone": {
        "id": "zone_uuid",
        "name": "Zone 5 - Central"
      },
      "Parish": {
        "id": "parish_uuid",
        "name": "St. Michael",
        "code": "SM"
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_count": 106,
    "per_page": 20
  }
}
```

### GET /schools/:id
Get school details with statistics.

**Response:**
```json
{
  "school": {
    "id": "uuid",
    "name": "St. Michael Primary School",
    "school_type": "primary",
    "statistics": {
      "total_staff": 25,
      "total_students": 450,
      "total_facilities": 12,
      "students_by_grade": {
        "Grade 1": 75,
        "Grade 2": 80,
        "Grade 3": 70
      }
    }
  }
}
```

### POST /schools
Create a new school (Admin only).

**Request Body:**
```json
{
  "name": "New Primary School",
  "school_type": "primary",
  "zone_id": "zone_uuid",
  "parish_id": "parish_uuid",
  "address": "456 Education Ave",
  "phone": "+1-246-987-6543",
  "email": "info@newschool.edu.bb",
  "principal_name": "Mr. John Doe",
  "capacity": 400
}
```

## Students Endpoints

### GET /students
Get all students with filtering.

**Query Parameters:**
- `page`, `limit`: Pagination
- `school_id` (uuid): Filter by school
- `grade_level` (string): Filter by grade
- `search` (string): Search by name or student ID

**Response:**
```json
{
  "students": [
    {
      "id": "uuid",
      "student_id": "STU001234",
      "first_name": "John",
      "last_name": "Smith",
      "date_of_birth": "2010-05-15",
      "gender": "male",
      "grade_level": "Grade 5",
      "class_section": "5A",
      "enrollment_date": "2020-09-01",
      "is_active": true,
      "School": {
        "id": "school_uuid",
        "name": "St. Michael Primary",
        "school_type": "primary"
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 124,
    "total_count": 2480,
    "per_page": 20
  }
}
```

### GET /students/:id
Get detailed student information.

**Response:**
```json
{
  "student": {
    "id": "uuid",
    "student_id": "STU001234",
    "first_name": "John",
    "last_name": "Smith",
    "School": {
      "name": "St. Michael Primary"
    },
    "Parents": [
      {
        "id": "parent_uuid",
        "first_name": "Jane",
        "last_name": "Smith",
        "phone": "+1-246-123-4567",
        "StudentParentRelationship": {
          "relationship_type": "mother",
          "is_primary": true
        }
      }
    ],
    "StudentHealth": {
      "medical_conditions": "Asthma",
      "allergies": "Peanuts",
      "emergency_contact_name": "Jane Smith",
      "emergency_contact_phone": "+1-246-123-4567"
    },
    "FamilySocialAssessment": {
      "household_income_range": "middle",
      "has_internet": true,
      "free_meal_eligible": false
    }
  }
}
```

### GET /students/:id/attendance
Get student attendance summary.

**Query Parameters:**
- `start_date` (date): Start date for range
- `end_date` (date): End date for range

**Response:**
```json
{
  "attendance_summary": {
    "total_days": 180,
    "present_days": 171,
    "absent_days": 5,
    "late_days": 4,
    "excused_days": 0,
    "attendance_rate": 95
  },
  "recent_attendance": [
    {
      "attendance_date": "2024-01-15",
      "status": "present",
      "check_in_time": "08:15:00",
      "check_out_time": "15:30:00"
    }
  ]
}
```

## Attendance Endpoints

### POST /attendance/rfid
Record attendance via RFID scan.

**Request Body:**
```json
{
  "rfid_tag": "RF123456789",
  "device_id": "GATE_001_ST_MICHAEL",
  "timestamp": "2024-01-15T08:15:00Z"
}
```

**Response:**
```json
{
  "message": "Attendance recorded",
  "attendance": {
    "id": "uuid",
    "student_id": "student_uuid",
    "attendance_date": "2024-01-15",
    "status": "present",
    "rfid_entry_time": "2024-01-15T08:15:00Z"
  }
}
```

### GET /attendance
Get attendance records.

**Query Parameters:**
- `school_id` (uuid): Filter by school
- `date` (date): Filter by specific date
- `start_date`, `end_date` (date): Date range

## Reports Endpoints

### GET /reports/school-summary/:school_id
Get comprehensive school summary report.

**Response:**
```json
{
  "report": {
    "school_info": {
      "name": "St. Michael Primary",
      "school_type": "primary"
    },
    "total_students": 450,
    "total_staff": 25,
    "capacity_utilization": 90
  }
}
```

### GET /reports/attendance
Get attendance report data.

**Query Parameters:**
- `school_id` (uuid): Specific school
- `start_date`, `end_date` (date): Date range

## RFID Management Endpoints

### POST /rfid/devices
Register new RFID device (Admin only).

**Request Body:**
```json
{
  "device_id": "GATE_002_CHRIST_CHURCH",
  "school_id": "school_uuid",
  "device_type": "gate_reader",
  "location": "Main Entrance"
}
```

### POST /rfid/scan
Process RFID scan for attendance.

**Request Body:**
```json
{
  "rfid_tag": "RF123456789",
  "device_id": "GATE_001_ST_MICHAEL"
}
```

**Response:**
```json
{
  "message": "RFID scan processed",
  "student": {
    "name": "John Smith",
    "grade": "Grade 5"
  },
  "attendance": {
    "status": "present",
    "time": "2024-01-15T08:15:00Z"
  }
}
```

## Error Responses

### Standard Error Format
```json
{
  "error": "Error message",
  "details": [
    {
      "field": "field_name",
      "message": "Specific validation error"
    }
  ]
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

## Rate Limiting
- API requests are limited to 1000 requests per hour per user
- RFID scan endpoints have higher limits (10,000 per hour)
- Rate limit headers are included in responses

## Data Privacy
- All student health and family data is encrypted
- Audit logs track all data access and modifications
- GDPR/local privacy law compliant data handling

## SDK and Integration

### JavaScript/Node.js Example
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://niemis.education.gov.bb/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Get schools
const schools = await api.get('/schools');

// Record attendance
const attendance = await api.post('/attendance/rfid', {
  rfid_tag: 'RF123456789',
  device_id: 'GATE_001'
});
```

---

For technical support or API issues, contact: api-support@education.gov.bb