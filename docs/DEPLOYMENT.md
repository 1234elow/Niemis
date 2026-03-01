# NiEMIS Deployment Guide

## Overview
This guide covers the deployment of the National Integrated Education Management Information System (NiEMIS) for the Ministry of Educational Transformation in Barbados.

## Prerequisites

### System Requirements
- **Server**: Linux/Windows Server with minimum 8GB RAM, 4 CPU cores
- **Database**: PostgreSQL 15+ 
- **Runtime**: Node.js 18+ for backend
- **Web Server**: Nginx (recommended) or Apache
- **Docker**: Docker and Docker Compose (recommended deployment method)

### Network Requirements
- **Ports**: 80 (HTTP), 443 (HTTPS), 5432 (PostgreSQL), 5000 (API)
- **Firewall**: Configure to allow RFID device connections
- **SSL Certificate**: Required for production deployment

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

#### Step 1: Clone Repository
```bash
git clone <repository-url>
cd NiEMIS
```

#### Step 2: Environment Configuration
```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit configuration
nano backend/.env
```

Required environment variables:
```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=niemis_db
DB_USER=niemis_user
DB_PASSWORD=your_secure_password

JWT_SECRET=your_jwt_secret_min_32_characters
JWT_EXPIRES_IN=24h

EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your_email@domain.com
EMAIL_PASSWORD=your_app_password

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
```

#### Step 3: Deploy with Docker Compose
```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
```

#### Step 4: Initialize Database
```bash
# Run database migrations
docker-compose exec backend npm run migrate

# Seed initial data
docker-compose exec backend npm run seed
```

#### Step 5: Create Admin User
```bash
# Access backend container
docker-compose exec backend node -e "
const bcrypt = require('bcryptjs');
const { User } = require('./models');

async function createAdmin() {
  const password_hash = await bcrypt.hash('admin123', 12);
  const admin = await User.create({
    username: 'admin',
    email: 'admin@education.gov.bb',
    password_hash,
    role: 'super_admin'
  });
  console.log('Admin user created:', admin.username);
}
createAdmin();
"
```

### Method 2: Manual Deployment

#### Backend Setup
```bash
cd backend
npm install
npm start
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run build

# Serve with nginx or apache
sudo cp -r build/* /var/www/html/
```

#### Database Setup
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE niemis_db;
CREATE USER niemis_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE niemis_db TO niemis_user;

# Import schema
psql -U niemis_user -d niemis_db -f database/schema.sql
```

## SSL/HTTPS Configuration

### Nginx SSL Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.edu.bb;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.edu.bb;
    return 301 https://$server_name$request_uri;
}
```

## RFID System Integration

### Hardware Setup
1. **RFID Readers**: Configure gate and classroom readers
2. **Network**: Ensure readers can reach the API endpoint
3. **Device Registration**: Register each device via admin panel

### RFID Configuration
```bash
# Register RFID device
curl -X POST http://your-domain/api/rfid/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "GATE_001_ST_MICHAEL",
    "school_id": "school-uuid",
    "device_type": "gate_reader",
    "location": "Main Gate"
  }'
```

## Backup and Recovery

### Database Backup
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec postgres pg_dump -U niemis_user niemis_db > backup_$DATE.sql

# Keep last 30 days
find /backup/path -name "backup_*.sql" -mtime +30 -delete
```

### File Backup
```bash
# Backup uploads and logs
tar -czf backup_files_$DATE.tar.gz backend/uploads backend/logs
```

## Monitoring and Maintenance

### Health Checks
```bash
# API health check
curl http://localhost:5000/health

# Database connection test
docker-compose exec postgres pg_isready -U niemis_user
```

### Log Monitoring
```bash
# View application logs
docker-compose logs -f backend

# Monitor database logs
docker-compose logs -f postgres
```

### Performance Monitoring
- Monitor CPU and memory usage
- Track database query performance
- Monitor RFID device connectivity
- Review API response times

## Security Considerations

### Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw deny 5432   # Database (internal only)
ufw deny 5000   # API (internal only)
```

### Database Security
- Use strong passwords
- Enable SSL for database connections
- Regular security updates
- Limit database access to application servers only

### Application Security
- Regular dependency updates
- Enable audit logging
- Implement rate limiting
- Regular security audits

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   # Check database status
   docker-compose ps postgres
   
   # Check connection
   docker-compose exec backend npm run test-db
   ```

2. **RFID Device Not Connecting**
   - Verify network connectivity
   - Check device registration
   - Review API logs for errors

3. **Frontend Not Loading**
   ```bash
   # Check build process
   docker-compose logs frontend
   
   # Verify nginx configuration
   nginx -t
   ```

### Performance Issues
- Check database query performance
- Monitor memory usage
- Review nginx access logs
- Optimize database indexes

## Maintenance Schedule

### Daily
- Monitor system health
- Check backup completion
- Review error logs

### Weekly
- Update system packages
- Review user activity
- Performance optimization

### Monthly
- Security updates
- Database maintenance
- Capacity planning review

## Support and Documentation

### Technical Support
- **Primary Contact**: IT Department - Ministry of Education
- **Email**: it-support@education.gov.bb
- **Phone**: +1-246-XXX-XXXX

### Documentation Resources
- User manuals in `/docs/user-guides/`
- API documentation: `/docs/api/`
- Training materials: `/docs/training/`

---

**Important**: This system contains sensitive student and educational data. Ensure all security protocols are followed and access is limited to authorized personnel only.