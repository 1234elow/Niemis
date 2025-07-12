# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NiEMIS (National Integrated Education Management Information System) is a comprehensive education management platform for Barbados supporting 106 schools across pre-primary, primary, and secondary education levels. The system handles sensitive student data and implements strict role-based access control for administrators, teachers, parents, and students.

## Architecture

### Technology Stack
- **Backend**: Node.js/Express.js with SQLite (development) and PostgreSQL (production)
- **Frontend**: React.js with Vite build system and Material-UI components
- **Database**: Sequelize ORM with comprehensive education data models
- **Authentication**: JWT with role-based access control (5 roles)
- **Build System**: Vite with ES modules, replacing Create React App

### Critical Architecture Patterns

#### Role-Based Dashboard Routing
The system implements strict role-based dashboard separation:
- **Students**: Personal dashboard (`StudentDashboard.js`) showing only their own data
- **Admin/Teachers**: System dashboard (`DashboardPage.js`) with administrative data
- **Security Critical**: Students must never see system-wide statistics or other students' data

#### Authentication Context Architecture
`AuthContext.js` manages authentication state with:
- JWT token persistence in localStorage
- User role determination for dashboard routing
- Automatic token refresh and logout handling
- Critical security: Role validation must happen client and server-side

#### Database Dual Environment Setup
- **Development**: SQLite database (`niemis_demo.db`) with 106 imported Barbados schools
- **Production**: PostgreSQL with identical schema via Sequelize migrations
- **Data Seeding**: Comprehensive school data from Barbados education system

## Development Commands

### Frontend (Vite-based, from /frontend directory)
```bash
npm start           # Start Vite dev server (port 3000)
npm run build       # Production build with code splitting
npm test            # Run Vitest tests
npm run preview     # Preview production build
npx prettier --write .  # Format code (required before commits)
```

### Backend (from /backend directory)
```bash
npm run dev         # Start with nodemon for development
npm start           # Production server
npm test            # Jest test suite
npm run migrate     # Run Sequelize migrations
npm run seed        # Seed database with sample data
```

### Full System Development
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend  
cd frontend && npm start

# Access: http://localhost:3000 (proxies API to :5000)
```

## Critical Security Implementation

### Role-Based Access Control
The system implements 5 user roles with strict data isolation:
- **super_admin**: Full system access across all schools
- **admin**: School-level administration and reporting
- **teacher**: Student and class management within assigned school
- **parent**: Access only to their children's information
- **student**: Personal dashboard with own academic data only

### Student Data Protection
- Students can only access their personal information
- Cross-school data access is prevented at middleware level
- Student dashboards show individual profiles, not system statistics
- Parent access is limited to their children's records only

### Authentication Flow Security
1. JWT tokens include user role and school associations
2. Backend middleware validates permissions on every request
3. Frontend routing prevents unauthorized dashboard access
4. Token expiration triggers automatic logout

## Database Architecture

### Core Education Models
- **Schools**: 106 Barbados schools with zone/parish organization
- **Students**: Comprehensive SPIS (Student Profile Information System) data
- **Staff**: Teacher profiles with evaluations and professional development
- **Attendance**: RFID-based tracking with device management
- **Academic Records**: Grades, assessments, and progress tracking
- **Health/Family**: Sensitive student wellness and family data

### Key Model Relationships
```javascript
// School-centric data organization
School -> hasMany(Students, Staff, Classes, RFIDDevices)
Student -> belongsTo(School), hasMany(AttendanceRecords, AcademicRecords)
Staff -> belongsTo(School), hasMany(TeacherEvaluations)
Parent -> belongsToMany(Students) // Through StudentParentRelationship
```

### Data Seeding and Imports
- `backend/createDemoStudents.js`: Creates demo student accounts for testing
- School data imported from `schools.txt` (105 schools successfully imported)
- Demo student accounts linked to Alexandra and Alleyne secondary schools

## API Architecture

### Authentication Endpoints
```bash
POST /api/auth/login     # JWT token generation
POST /api/auth/register  # User account creation
GET  /api/auth/profile   # Current user profile
PUT  /api/auth/change-password  # Password updates
```

### Core Domain Endpoints
```bash
# School Management
GET    /api/schools           # List schools (filtered by user permissions)
GET    /api/schools/:id       # School details
POST   /api/schools           # Create school (admin only)

# Student Management  
GET    /api/students          # List students (filtered by user school)
GET    /api/students/profile  # Student's own profile (students only)
POST   /api/students          # Create student record
PUT    /api/students/:id      # Update student

# RFID Attendance
POST   /api/rfid/scan         # Process RFID attendance scan
GET    /api/rfid/devices      # List RFID devices
POST   /api/rfid/devices      # Register new device

# Reporting
GET    /api/reports/attendance    # Attendance reports
GET    /api/reports/performance   # Academic performance
GET    /api/demo/*              # Public demo endpoints (no auth)
```

## Frontend Architecture

### Vite Configuration Critical Settings
The system uses Vite with specific configurations for education system requirements:
- **ES Modules**: `"type": "module"` in package.json for modern JS
- **JSX in .js files**: Custom esbuild config allows JSX in .js extensions
- **API Proxy**: `/api` requests proxied to backend on port 5000
- **Build Optimization**: Manual chunks for vendor libraries and Material-UI

### Component Architecture Patterns

#### Dashboard Routing Logic (App.js)
```javascript
// Critical: Role-based dashboard routing
{user?.role === 'student' ? <StudentDashboard /> : <DashboardPage />}
```

#### Protected Route Patterns
All routes except login require authentication. Role-based conditional rendering ensures appropriate access.

#### Student Dashboard Components
- `StudentDashboard.js`: Personal student interface
- Shows individual academic progress, attendance, school information
- **Never shows**: System statistics, other students' data, administrative functions

### State Management Architecture
- **AuthContext**: Centralized authentication and user state
- **React Query**: API state management and caching
- **Local State**: Component-specific form and UI state
- **Material-UI Theme**: Consistent design system across components

## Environment Configuration

### Backend Environment Variables
```bash
# Database (SQLite for dev, PostgreSQL for prod)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=niemis_production
DB_USER=niemis_user
DB_PASSWORD=secure_password

# Authentication
JWT_SECRET=complex_secret_key_for_jwt_signing
NODE_ENV=development|production
PORT=5000

# External Services
TWILIO_ACCOUNT_SID=account_sid
TWILIO_AUTH_TOKEN=auth_token
EMAIL_SERVICE_CONFIG=smtp_settings
```

### Frontend Environment Variables
```bash
# API Configuration (Vite prefix required)
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=NiEMIS
```

## Testing Strategy

### Backend Testing
- **Jest**: API endpoint testing with Supertest
- **Database**: Test database isolation with transaction rollbacks
- **Authentication**: Token validation and role-based access testing
- **RFID Integration**: Mock RFID device scanning scenarios

### Frontend Testing
- **Vitest**: Component testing replacing Jest for Vite compatibility
- **React Testing Library**: User interaction and accessibility testing
- **Dashboard Testing**: Critical role-based routing and data display validation
- **Authentication Flow**: Login, logout, and protected route testing

## Deployment Architecture

### Development Environment
- SQLite database with full school dataset
- Vite dev server with hot module replacement
- Express server with nodemon auto-restart
- CORS enabled for cross-origin development

### Production Environment (Render.com)
- PostgreSQL database with identical schema
- Vite production build with optimized chunks
- Express server with security headers and rate limiting
- Environment-specific CORS and security configurations

## Performance Considerations

### Database Optimization
- Indexed queries for frequently accessed student/school lookups
- Sequelize connection pooling for concurrent users
- Efficient pagination for large datasets (24,750+ students across 106 schools)

### Frontend Performance
- Vite build system with tree shaking and code splitting
- Material-UI component lazy loading
- React Query caching for repeated API calls
- Image optimization for school and student photos

## Critical Development Notes

### Code Quality Requirements
- **Prettier formatting**: Must run before commits
- **Role-based testing**: Always test with different user roles
- **Security validation**: Verify students cannot access admin data
- **Database migrations**: Use Sequelize CLI for schema changes

### Common Development Issues
- **JSX in .js files**: Vite configuration allows this, don't rename to .jsx
- **Role routing bugs**: Always test dashboard routing with actual user tokens
- **Environment variables**: Use VITE_ prefix for frontend, standard names for backend
- **SQLite vs PostgreSQL**: Test with both databases before production deployment

### Barbados Education Context
- **106 schools**: System handles real Barbados school directory
- **5 geographic zones**: Performance tracking by regional areas
- **SPIS compliance**: Student profiles follow Caribbean education standards
- **RFID integration**: Real hardware integration for attendance tracking