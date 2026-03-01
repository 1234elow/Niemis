# NiEMIS Deployment Guide

## Backend API Configuration for Render.com

This guide covers the deployment of the NiEMIS backend API to Render.com with production-ready configurations.

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (provided by Render.com)
- Environment variables configured

### Environment Variables

Create these environment variables in your Render.com dashboard:

#### Required Variables
```
NODE_ENV=production
JWT_SECRET=your_secure_jwt_secret_minimum_32_characters
DB_DIALECT=postgres
DATABASE_URL=postgres://user:pass@host:port/dbname
```

#### Optional Variables (with defaults)
```
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
LOG_LEVEL=info
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=true
ENABLE_CORS_CREDENTIALS=true
ENABLE_HELMET_SECURITY=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
UPLOAD_MAX_FILE_SIZE=10485760
HELMET_HSTS_MAX_AGE=31536000
HELMET_HSTS_INCLUDE_SUBDOMAINS=true
FRONTEND_URL=https://your-frontend-domain.com
```

### Deployment Steps

1. **Database Setup**
   - Create PostgreSQL database service on Render.com
   - Note the connection string

2. **Backend Deployment**
   - Connect your GitHub repository to Render.com
   - Set build command: `cd backend && npm install && npm run build`
   - Set start command: `cd backend && npm run render:start`
   - Configure environment variables listed above

3. **Database Migration**
   - After deployment, run: `npm run migrate`
   - Import school data: `npm run import:schools`
   - Create demo students: `npm run create:demo`

### Features Implemented

#### Security
- ✅ JWT authentication with refresh tokens
- ✅ Rate limiting (configurable per role)
- ✅ CORS protection for production
- ✅ Helmet security headers
- ✅ Request validation with express-validator
- ✅ SQL injection protection via Sequelize ORM
- ✅ Student data access protection

#### Performance
- ✅ Request compression
- ✅ Connection pooling
- ✅ Structured logging with Winston
- ✅ Performance monitoring
- ✅ Graceful shutdown handling

#### Monitoring
- ✅ Health check endpoints
- ✅ Liveness/readiness probes
- ✅ Database health monitoring
- ✅ System metrics endpoint
- ✅ Comprehensive error logging

#### Education Domain
- ✅ 5-tier role-based access control
- ✅ School-based data isolation
- ✅ Student data protection
- ✅ RFID attendance integration
- ✅ Support for 106 Barbados schools

### API Endpoints

#### Health & Monitoring
```
GET /health                 - Basic health check
GET /health/detailed        - Detailed health check
GET /health/liveness        - Liveness probe
GET /health/readiness       - Readiness probe
GET /health/database        - Database health check
GET /api/health/metrics     - System metrics
GET /api/health/status      - API status
```

#### Authentication
```
POST /api/auth/login        - User login
POST /api/auth/register     - User registration
POST /api/auth/refresh      - Token refresh
PUT /api/auth/change-password - Change password
```

#### Core Features
```
GET /api/schools            - List schools
GET /api/students           - List students
GET /api/teachers           - List teachers
GET /api/attendance         - Attendance records
GET /api/reports            - Generate reports
POST /api/rfid/scan         - RFID attendance scan
```

### Security Considerations

1. **Role-Based Access Control**
   - Students can only access their own data
   - Teachers can access students in their school
   - Admins can access school-wide data
   - Super admins have system-wide access

2. **Data Protection**
   - All student data access is logged
   - Cross-school data access is prevented
   - Rate limiting prevents abuse
   - Input validation prevents injection attacks

3. **Token Security**
   - JWT tokens include role and school information
   - Refresh tokens for secure token rotation
   - Token expiration configurable
   - Role validation on every request

### Monitoring & Logging

1. **Structured Logging**
   - Winston logger with JSON format
   - Separate log files (error, combined, security)
   - Log rotation (5MB files, 5 files retained)
   - Security event logging

2. **Performance Monitoring**
   - Request duration tracking
   - Database query performance
   - Memory usage monitoring
   - CPU usage tracking

3. **Error Handling**
   - Comprehensive error classification
   - Unique error IDs for tracking
   - Sensitive data exclusion in production
   - Graceful degradation

### Database Configuration

#### Development (SQLite)
```javascript
{
  "development": {
    "dialect": "sqlite",
    "storage": "niemis_demo.db",
    "logging": console.log
  }
}
```

#### Production (PostgreSQL)
```javascript
{
  "production": {
    "use_env_variable": "DATABASE_URL",
    "dialect": "postgres",
    "dialectOptions": {
      "ssl": {
        "require": true,
        "rejectUnauthorized": false
      }
    },
    "logging": false
  }
}
```

### Testing

Run tests with:
```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage
npm run test:watch    # Watch mode
```

### Maintenance

#### Database Backup
```bash
npm run backup        # Create backup
npm run backup:list   # List backups
npm run restore       # Restore backup
```

#### Health Checks
```bash
npm run health:check  # Database health check
npm run validate:deployment # Validate deployment
```

#### Security Audits
```bash
npm run security:audit # Security audit
npm run security:fix   # Fix security issues
```

### Troubleshooting

1. **Database Connection Issues**
   - Check DATABASE_URL environment variable
   - Verify PostgreSQL service is running
   - Check SSL configuration

2. **Authentication Errors**
   - Verify JWT_SECRET is set and secure
   - Check token expiration settings
   - Validate user roles in database

3. **Performance Issues**
   - Check database connection pool settings
   - Monitor memory usage via `/api/health/metrics`
   - Review rate limiting configuration

4. **CORS Issues**
   - Verify FRONTEND_URL is set correctly
   - Check CORS origin configuration
   - Ensure credentials are enabled if needed

### Support

For issues or questions:
1. Check health endpoints for system status
2. Review logs in `/logs/` directory
3. Run `npm run validate:deployment` for deployment issues
4. Contact system administrators for critical issues

---

**Last Updated**: July 2025
**Version**: 1.0.0
**Environment**: Production Ready