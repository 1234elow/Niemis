# NiEMIS Comprehensive Local Development Setup Guide

## Overview

This guide provides a complete setup for running the NiEMIS (National Integrated Education Management Information System) locally on Windows with PostgreSQL. The setup includes development tools, monitoring, debugging, and production-like configurations.

## Prerequisites

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/windows/)
- **Git** - [Download](https://git-scm.com/downloads)
- **npm** or **yarn** (comes with Node.js)

### Optional Software
- **Docker Desktop** (for containerized setup)
- **nginx** (for reverse proxy)
- **Visual Studio Code** (recommended IDE)

## Quick Start (5 Minutes)

### 1. Automated Setup
```bash
# Navigate to the project directory
cd /mnt/c/Users/SamuelLowe/NiEMIS

# Install root dependencies
npm install

# Run automated PostgreSQL setup
cd local-deployment
./setup-postgresql.sh

# Start development environment
cd ..
npm run dev
```

### 2. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Network Access**: http://[YOUR_IP]:3000

## Detailed Setup Instructions

### Step 1: Environment Setup

#### A. PostgreSQL Database Setup
```bash
# Option 1: Automated setup (recommended)
cd local-deployment
./setup-postgresql.sh

# Option 2: Manual setup
# Create database and user in PostgreSQL
psql -U postgres
CREATE DATABASE niemis_local;
CREATE USER niemis_user WITH PASSWORD 'local_password123';
GRANT ALL PRIVILEGES ON DATABASE niemis_local TO niemis_user;
```

#### B. Environment Configuration
```bash
# Backend environment
cp local-deployment/.env.local.example backend/.env

# Frontend environment
cp local-deployment/.env.frontend.local.example frontend/.env.local

# Edit configurations as needed
# backend/.env - Database connection, JWT secrets
# frontend/.env.local - API URLs, feature flags
```

### Step 2: Install Dependencies
```bash
# Install all dependencies
npm run install:all

# Or install individually
cd backend && npm install
cd ../frontend && npm install
```

### Step 3: Database Setup
```bash
# Run database migrations
npm run db:migrate

# Seed with demo data
npm run db:seed

# Test database connection
npm run test:connection
```

### Step 4: Start Development Servers
```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:backend    # Backend only
npm run dev:frontend   # Frontend only
```

## Development Commands Reference

### Core Commands
```bash
# Setup and management
npm run setup          # Complete initial setup
npm run dev           # Start development servers
npm run start         # Start production-like servers
npm run stop          # Stop all services
npm run health        # Run health checks

# Database operations
npm run db:migrate    # Run database migrations
npm run db:seed       # Seed database with demo data
npm run db:reset      # Reset database completely
npm run db:backup     # Backup database
npm run db:restore    # Restore database from backup

# Quality and testing
npm run test:all      # Run all tests
npm run test:backend  # Run backend tests
npm run test:frontend # Run frontend tests
npm run format        # Format code
npm run lint          # Lint code
npm run pre-commit    # Run pre-commit checks

# Build and production
npm run build         # Build for production
npm run start:production # Start in production mode
```

### Advanced Commands
```bash
# Docker operations
npm run docker:local    # Start with Docker
npm run docker:stop     # Stop Docker containers
npm run docker:rebuild  # Rebuild Docker containers

# SSL/HTTPS setup
npm run ssl:setup      # Generate SSL certificates

# Performance monitoring
node local-deployment/performance-monitoring.js once
node local-deployment/performance-monitoring.js continuous
```

## Configuration Options

### Backend Configuration (backend/.env)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=niemis_local
DB_USER=niemis_user
DB_PASSWORD=local_password123

# Server
NODE_ENV=development
PORT=5000

# Security
JWT_SECRET=your_jwt_secret_here
CORS_ORIGINS=http://localhost:3000

# Features
FEATURE_RFID_ENABLED=true
FEATURE_SMS_NOTIFICATIONS=false
DB_LOGGING=true
```

### Frontend Configuration (frontend/.env.local)
```bash
# API Configuration
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000/api

# Features
VITE_FEATURE_RFID_ENABLED=true
VITE_FEATURE_DARK_MODE_ENABLED=true
VITE_DEBUG=true

# Performance
VITE_CACHE_ENABLED=true
VITE_DEFAULT_PAGE_SIZE=25
```

## Local Network Access

### Configuration for Network Access
The system is pre-configured to allow access from other devices on your local network:

1. **Backend**: Binds to `0.0.0.0:5000` (all interfaces)
2. **Frontend**: Vite dev server configured with `host: true`
3. **CORS**: Configured to allow local network origins

### Access URLs
- **Same Machine**: http://localhost:3000
- **Other Devices**: http://[YOUR_IP]:3000
- **Find Your IP**: `ipconfig` (Windows) or `ifconfig` (Linux/Mac)

### Network Security
- Firewall rules may need adjustment
- Router port forwarding not required for local network
- Only devices on same network can access

## HTTPS/SSL Setup

### Generate SSL Certificates
```bash
# Generate self-signed certificates
npm run ssl:setup

# This creates:
# - local-deployment/ssl-certs/localhost.key
# - local-deployment/ssl-certs/localhost.crt
```

### Install Certificates
1. **Chrome/Edge**: Settings → Security → Manage certificates
2. **Firefox**: Settings → Certificates → View Certificates
3. **System**: Import to "Trusted Root Certification Authorities"

### Enable HTTPS
```bash
# Update backend/.env
HTTPS_ENABLED=true
HTTPS_PORT=8443

# Update frontend/.env.local
VITE_API_URL=https://localhost:8443
VITE_HTTPS_ENABLED=true
```

## Production-Like Setup

### Run in Production Mode
```bash
# Build for production
npm run build

# Start in production mode
npm run start:production
```

### Production Configuration
- Minified and optimized frontend build
- Enhanced security headers
- Stricter CORS policies
- Performance optimizations
- Production logging

### Docker Setup
```bash
# Start with Docker (production-like)
npm run docker:local

# Services included:
# - PostgreSQL database
# - Redis cache
# - Backend API
# - Frontend app
# - Nginx reverse proxy
# - Adminer (database management)

# Access points:
# - App: http://localhost:80
# - Database: http://localhost:8080 (Adminer)
# - API: http://localhost:5000
```

## Monitoring and Debugging

### Health Monitoring
```bash
# Check system health
npm run health

# Performance monitoring
node local-deployment/performance-monitoring.js once
node local-deployment/performance-monitoring.js continuous

# Health check endpoints
curl http://localhost:5000/health
curl http://localhost:5000/api/health
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=niemis:* npm run dev

# Enable SQL query logging
echo "DB_LOGGING=true" >> backend/.env

# Frontend debug mode
echo "VITE_DEBUG=true" >> frontend/.env.local
```

### Log Files
- **Backend**: `backend/logs/combined.log`
- **Errors**: `backend/logs/error.log`
- **Security**: `backend/logs/security.log`
- **Frontend**: Browser console

## Testing

### Manual Testing
```bash
# Test database connection
npm run test:connection

# Test API endpoints
curl http://localhost:5000/api/health
curl http://localhost:5000/api/schools

# Test authentication
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  http://localhost:5000/api/auth/login
```

### Automated Testing
```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:backend
npm run test:frontend

# Run with coverage
cd backend && npm run test:coverage
cd frontend && npm run test:coverage
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL service is running
   - Verify credentials in .env file
   - Test with `psql -U niemis_user -d niemis_local`

2. **Port Already in Use**
   - Check: `netstat -ano | findstr :3000`
   - Kill process: `taskkill /PID <PID> /F`
   - Or use: `npm run stop`

3. **Module Not Found**
   - Clean install: `npm run clean && npm run install:all`
   - Clear cache: `npm cache clean --force`

4. **CORS Errors**
   - Check CORS_ORIGINS in backend/.env
   - Verify API_URL in frontend/.env.local
   - Check browser console for details

### Debug Tools
```bash
# Check system status
npm run health

# Monitor performance
node local-deployment/performance-monitoring.js once

# Check logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### Getting Help
- Check [troubleshooting.md](troubleshooting.md) for detailed solutions
- Review log files for error messages
- Use debug mode for detailed output
- Check browser console for frontend issues

## Advanced Features

### Reverse Proxy (Nginx)
```bash
# Copy nginx configuration
cp local-deployment/local-nginx.conf /etc/nginx/sites-available/niemis

# Enable site
ln -s /etc/nginx/sites-available/niemis /etc/nginx/sites-enabled/

# Restart nginx
systemctl restart nginx

# Access through nginx
http://localhost:80
```

### Performance Optimization
```bash
# Enable query performance logging
echo "QUERY_PERFORMANCE_LOGGING=true" >> backend/.env

# Monitor database performance
node local-deployment/performance-monitoring.js database

# Optimize frontend bundle
cd frontend && npm run build:analyze
```

### Custom Configuration
- Edit configuration files in `local-deployment/`
- Modify environment variables as needed
- Adjust port numbers if conflicts occur
- Enable/disable features via environment flags

## Security Considerations

### Development Security
- Use strong JWT secrets
- Enable CORS for trusted origins only
- Use HTTPS in production-like testing
- Regular security audits: `npm audit`

### Data Protection
- Demo data only in development
- Secure database credentials
- Enable audit logging
- Regular backups

## Maintenance

### Regular Tasks
- Update dependencies: `npm audit fix`
- Backup database: `npm run db:backup`
- Check logs for errors
- Monitor performance metrics
- Run health checks

### Updates
```bash
# Update all dependencies
npm update
cd backend && npm update
cd ../frontend && npm update

# Check for security vulnerabilities
npm audit
```

## Support

### Documentation
- [README.md](README.md) - Quick start guide
- [troubleshooting.md](troubleshooting.md) - Detailed problem solving
- [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md) - API reference
- [SECURITY_GUIDE.md](../backend/docs/SECURITY_GUIDE.md) - Security information

### Getting Help
1. Check troubleshooting guide
2. Review log files
3. Run health checks
4. Check GitHub issues
5. Contact development team

This comprehensive setup guide should enable you to run the NiEMIS system locally with full development capabilities, network access, and production-like features. The system is designed to be flexible and scalable for various development needs.