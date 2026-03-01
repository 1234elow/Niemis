# NiEMIS Local Development Setup Guide

This guide provides comprehensive instructions for running the NiEMIS education management system locally on your Windows machine with PostgreSQL.

## Prerequisites

1. **Node.js** (version 18 or higher)
2. **PostgreSQL** (version 12 or higher) running locally
3. **npm** or **yarn** package manager
4. **Git** for version control

## Quick Start

1. **Set up PostgreSQL database**:
   ```bash
   # Run the database setup script
   npm run setup:db
   ```

2. **Start the development servers**:
   ```bash
   # Start both backend and frontend in development mode
   npm run dev
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Network access: http://[YOUR_IP]:3000

## Detailed Setup Instructions

### 1. Database Setup

#### Option A: Automated Setup
```bash
# Run the automated PostgreSQL setup script
cd local-deployment
./setup-postgresql.sh
```

#### Option B: Manual Setup
```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE niemis_local;
CREATE USER niemis_user WITH PASSWORD 'local_password123';
GRANT ALL PRIVILEGES ON DATABASE niemis_local TO niemis_user;
```

### 2. Environment Configuration

#### Backend Environment (.env)
```bash
# Copy the local environment template
cp local-deployment/.env.local.example backend/.env
```

#### Frontend Environment (.env.local)
```bash
# Copy the frontend environment template
cp local-deployment/.env.frontend.local.example frontend/.env.local
```

### 3. Installation and Database Migration

```bash
# Install dependencies
npm run install:all

# Set up database schema and seed data
npm run setup:db

# Verify setup
npm run test:connection
```

### 4. Development Commands

#### Start Development Servers
```bash
# Start both backend and frontend
npm run dev

# Start backend only
npm run dev:backend

# Start frontend only
npm run dev:frontend

# Start in production mode locally
npm run start:production
```

#### Database Operations
```bash
# Run migrations
npm run db:migrate

# Seed with demo data
npm run db:seed

# Reset database
npm run db:reset

# Backup database
npm run db:backup

# Restore database
npm run db:restore
```

#### Testing and Quality
```bash
# Run all tests
npm run test

# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Format code
npm run format

# Lint code
npm run lint
```

## Local Network Access

To access the application from other devices on your local network:

1. **Backend Configuration**: The backend is configured to accept connections from all interfaces
2. **Frontend Configuration**: Vite dev server is configured with `host: true`
3. **Access URLs**:
   - Same machine: http://localhost:3000
   - Other devices: http://[YOUR_IP]:3000

### Find Your IP Address
```bash
# Windows
ipconfig

# Look for IPv4 Address under your network adapter
```

## Security Configuration

### Development Security
- CORS is configured to allow local development
- HTTPS is optional in development mode
- JWT tokens have longer expiration for development

### Production-like Security
When running in production mode locally:
- SSL/HTTPS is enabled
- Stricter CORS policies
- Enhanced security headers
- Rate limiting enabled

## Performance Monitoring

### Built-in Monitoring
- Health check endpoints: http://localhost:5000/health
- API metrics: http://localhost:5000/api/metrics
- Database performance: http://localhost:5000/api/db-health

### Debug Mode
```bash
# Enable debug logging
DEBUG=niemis:* npm run dev

# Enable SQL query logging
DB_LOGGING=true npm run dev
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**:
   ```bash
   # Check PostgreSQL service
   # Windows: Check Windows Services
   # Verify connection settings in .env
   ```

2. **Port Already in Use**:
   ```bash
   # Kill processes on ports 3000 and 5000
   npx kill-port 3000 5000
   ```

3. **Node Modules Issues**:
   ```bash
   # Clean and reinstall
   npm run clean
   npm run install:all
   ```

### Logs and Debugging
- Backend logs: `backend/logs/`
- Frontend logs: Browser console
- Database logs: PostgreSQL logs

## Development Workflow

### Daily Development
1. Start with `npm run dev`
2. Make changes to code
3. Hot reload automatically refreshes
4. Run tests before committing
5. Use `npm run format` before commits

### Before Committing
```bash
# Run full quality checks
npm run pre-commit

# This runs:
# - Format code
# - Lint code
# - Run tests
# - Type checking
```

## Production Deployment Testing

To test production deployment locally:

```bash
# Build for production
npm run build

# Start production server
npm run start:production

# Test production build
npm run test:production
```

## Additional Resources

- [Backend API Documentation](../docs/API_DOCUMENTATION.md)
- [Frontend Component Guide](../frontend/README.md)
- [Database Schema](../database/schema.sql)
- [Security Guide](../backend/docs/SECURITY_GUIDE.md)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review application logs
3. Check the GitHub issues
4. Contact the development team