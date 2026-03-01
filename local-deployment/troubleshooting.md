# NiEMIS Local Development Troubleshooting Guide

This guide provides solutions to common issues encountered during local development of the NiEMIS system.

## Common Issues and Solutions

### 1. Database Connection Issues

#### Problem: "Database connection failed"
**Symptoms:**
- Backend fails to start
- Error: "ECONNREFUSED" or "Connection refused"
- Database health check fails

**Solutions:**
```bash
# Check if PostgreSQL is running
# Windows: Check Windows Services for PostgreSQL
# Or use Task Manager to look for postgres.exe

# Test connection manually
psql -U niemis_user -h localhost -p 5432 -d niemis_local

# If connection fails, check:
# 1. PostgreSQL service is running
# 2. Database and user exist
# 3. Correct credentials in .env file
```

**Fix PostgreSQL Issues:**
```bash
# Windows: Start PostgreSQL service
net start postgresql-x64-14

# Create database if missing
psql -U postgres -c "CREATE DATABASE niemis_local;"
psql -U postgres -c "CREATE USER niemis_user WITH PASSWORD 'local_password123';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE niemis_local TO niemis_user;"
```

### 2. Port Already in Use

#### Problem: "Port 3000/5000 is already in use"
**Symptoms:**
- Development server fails to start
- Error: "EADDRINUSE"
- Cannot bind to port

**Solutions:**
```bash
# Find process using the port
# Windows:
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use the npm script
npm run stop

# Alternative: Use different ports
export PORT=5001  # Backend
export VITE_PORT=3001  # Frontend
```

### 3. Node Modules Issues

#### Problem: "Module not found" or dependency errors
**Symptoms:**
- Import/require errors
- Missing dependencies
- Version conflicts

**Solutions:**
```bash
# Clean and reinstall all dependencies
npm run clean
npm run install:all

# If still having issues, delete node_modules manually
rm -rf node_modules backend/node_modules frontend/node_modules
rm -f package-lock.json backend/package-lock.json frontend/package-lock.json
npm run install:all

# Clear npm cache
npm cache clean --force
```

### 4. Environment Configuration Issues

#### Problem: Environment variables not loading
**Symptoms:**
- Default values being used
- Configuration not applied
- API endpoints not connecting

**Solutions:**
```bash
# Check environment files exist
ls -la backend/.env
ls -la frontend/.env.local

# Copy from examples if missing
cp local-deployment/.env.local.example backend/.env
cp local-deployment/.env.frontend.local.example frontend/.env.local

# Verify environment variables are loaded
# In backend: console.log(process.env.DB_HOST)
# In frontend: console.log(import.meta.env.VITE_API_URL)
```

### 5. Database Migration Issues

#### Problem: Migration fails or tables missing
**Symptoms:**
- Table doesn't exist errors
- Migration timeout
- Schema mismatch

**Solutions:**
```bash
# Check migration status
cd backend
npx sequelize-cli db:migrate:status

# Run migrations manually
npm run migrate

# Reset database if needed
npm run db:reset

# Check database tables
psql -U niemis_user -d niemis_local -c "\dt"
```

### 6. CORS Issues

#### Problem: Cross-origin request blocked
**Symptoms:**
- API calls fail from frontend
- CORS error in browser console
- Network tab shows blocked requests

**Solutions:**
```bash
# Check CORS configuration in backend/.env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Verify backend CORS middleware is configured
# Check backend/config/cors.js

# Test API directly
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:5000/api/health
```

### 7. Frontend Build Issues

#### Problem: Build fails or assets not loading
**Symptoms:**
- Vite build errors
- Missing assets in production
- JavaScript/CSS not loading

**Solutions:**
```bash
# Clean build directory
rm -rf frontend/build

# Check for syntax errors
npm run lint

# Build with verbose output
cd frontend
npm run build -- --verbose

# Check for missing dependencies
npm audit

# Test production build locally
npm run preview
```

### 8. SSL/HTTPS Issues

#### Problem: Self-signed certificate errors
**Symptoms:**
- Browser security warnings
- SSL connection errors
- Certificate not trusted

**Solutions:**
```bash
# Generate new certificates
npm run ssl:setup

# Install certificate in browser
# Chrome: Settings > Privacy > Security > Manage certificates
# Firefox: Settings > Privacy > Certificates > View Certificates

# Test HTTPS connection
curl -k https://localhost:8443/health

# Skip SSL verification for testing (not recommended for production)
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

### 9. Performance Issues

#### Problem: Slow application response
**Symptoms:**
- Long loading times
- High CPU/memory usage
- Timeouts

**Solutions:**
```bash
# Check system resources
# Windows: Task Manager
# Monitor PostgreSQL performance

# Optimize database queries
# Check backend/logs/combined.log for slow queries

# Enable query logging
echo "DB_LOGGING=true" >> backend/.env

# Monitor API performance
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:5000/api/health"

# Check frontend bundle size
cd frontend
npm run build:analyze
```

### 10. Authentication Issues

#### Problem: Login fails or token issues
**Symptoms:**
- Login always fails
- Token expired immediately
- Authentication middleware errors

**Solutions:**
```bash
# Check JWT secret is set
grep JWT_SECRET backend/.env

# Verify user exists in database
psql -U niemis_user -d niemis_local -c "SELECT * FROM users LIMIT 5;"

# Test authentication endpoint
curl -X POST -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"password"}' \
     http://localhost:5000/api/auth/login

# Check token validation
# Look at backend/middleware/auth.js logs
```

## Debugging Tools

### 1. Backend Debugging
```bash
# Enable debug logging
DEBUG=niemis:* npm run dev

# Check logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Database debugging
echo "DB_LOGGING=true" >> backend/.env
```

### 2. Frontend Debugging
```bash
# Enable verbose logging
echo "VITE_LOG_LEVEL=debug" >> frontend/.env.local

# Check browser console
# Use React Developer Tools
# Use Network tab to inspect API calls
```

### 3. Network Debugging
```bash
# Test API endpoints
curl -v http://localhost:5000/api/health

# Check port connectivity
telnet localhost 5000

# Monitor network traffic
# Use browser DevTools Network tab
```

## Health Check Scripts

### 1. System Health Check
```bash
# Run comprehensive health check
npm run health

# Check individual components
npm run test:connection
curl http://localhost:5000/health
curl http://localhost:3000
```

### 2. Database Health Check
```bash
# Check database connection
cd backend
node test-connection.js

# Check database schema
psql -U niemis_user -d niemis_local -c "\d"

# Check sample data
psql -U niemis_user -d niemis_local -c "SELECT COUNT(*) FROM schools;"
```

## Getting Help

### 1. Log Files
- Backend: `backend/logs/combined.log`
- Backend errors: `backend/logs/error.log`
- Frontend: Browser console
- Database: PostgreSQL logs

### 2. Debug Information
```bash
# System information
node --version
npm --version
psql --version

# Environment information
echo $NODE_ENV
echo $PORT
env | grep VITE_
```

### 3. Reset Everything
```bash
# Nuclear option: Reset everything
npm run stop
npm run clean
npm run setup
npm run dev
```

## Prevention Tips

1. **Regular Health Checks**: Run `npm run health` regularly
2. **Keep Dependencies Updated**: Run `npm audit` weekly
3. **Monitor Logs**: Check logs for warnings/errors
4. **Backup Database**: Run `npm run db:backup` before major changes
5. **Use Version Control**: Commit working states frequently
6. **Test After Changes**: Run tests after configuration changes

## Performance Optimization

### 1. Database Optimization
```bash
# Analyze slow queries
grep "slow query" backend/logs/combined.log

# Optimize PostgreSQL settings
# Edit postgresql.conf for better performance
```

### 2. Frontend Optimization
```bash
# Analyze bundle size
cd frontend
npm run build:analyze

# Optimize images and assets
# Use appropriate image formats
# Enable compression
```

### 3. System Optimization
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Optimize PostgreSQL memory settings
# Edit postgresql.conf
```

This troubleshooting guide should help resolve most common issues encountered during local development. If problems persist, check the application logs and consider resetting the entire development environment.