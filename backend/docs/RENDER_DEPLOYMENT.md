# Render.com Deployment Guide for NiEMIS

This document provides comprehensive instructions for deploying the NiEMIS backend to Render.com with proper SSL/TLS configuration and security settings.

## Prerequisites

- [Render.com](https://render.com) account
- GitHub repository with NiEMIS code
- PostgreSQL database (Render PostgreSQL or external)
- Domain name (optional, for custom domains)

## Environment Variables Configuration

### Required Environment Variables

Set these in your Render.com web service settings:

```bash
# Application
NODE_ENV=production
PORT=10000
APP_NAME=NiEMIS
FRONTEND_URL=https://your-frontend-domain.com

# Database (PostgreSQL)
DATABASE_URL=postgresql://username:password@hostname:port/database
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# JWT/Authentication
JWT_SECRET=your-super-secure-jwt-secret-min-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=24h
JWT_REFRESH_SECRET=different-secure-refresh-secret

# Security
ENABLE_RATE_LIMITING=true
RATE_LIMIT_MAX_REQUESTS=50
HELMET_HSTS_MAX_AGE=31536000
HELMET_HSTS_INCLUDE_SUBDOMAINS=true

# Email (Gmail example)
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@niemis.gov.bb

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-phone

# File Storage (AWS S3)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=niemis-production-files

# Monitoring
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
FEATURE_AUDIT_LOGGING=true
```

## SSL/TLS Configuration

### Automatic SSL (Recommended)

Render.com provides automatic SSL certificates for all deployments:

1. **Free SSL**: Automatically enabled for `*.onrender.com` domains
2. **Custom Domain SSL**: Free Let's Encrypt certificates for custom domains
3. **SSL Termination**: Handled at the edge, no server-side configuration needed

### SSL Security Headers

The application automatically configures security headers for HTTPS:

```javascript
// Configured in config/ssl.js
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## Deployment Steps

### 1. Create Render Web Service

1. Log in to [Render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `niemis-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main` or `production`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run render:start`

### 2. Configure Environment Variables

In the Render dashboard:

1. Go to your web service
2. Navigate to "Environment" tab
3. Add all required environment variables (see list above)
4. Set `NODE_ENV=production`

### 3. Database Setup

#### Option A: Render PostgreSQL (Recommended)

1. Create a new PostgreSQL database on Render
2. Copy the connection string
3. Set `DATABASE_URL` environment variable

#### Option B: External Database

1. Use your preferred PostgreSQL provider
2. Ensure SSL is enabled
3. Set connection parameters in environment variables

### 4. Custom Domain Configuration

If using a custom domain:

1. Go to "Settings" → "Custom Domains"
2. Add your domain (e.g., `api.niemis.gov.bb`)
3. Update DNS records as instructed
4. SSL certificate will be provisioned automatically

### 5. Health Checks

Render will automatically monitor these endpoints:

- `GET /health` - Basic health check
- `GET /health/readiness` - Readiness probe
- `GET /health/liveness` - Liveness probe

## Security Configuration

### CSP (Content Security Policy)

Configure CSP headers for additional security:

```javascript
// In server.js
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"]
        }
    }
}));
```

### Rate Limiting

Production rate limits are automatically configured:

- **General API**: 50 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **Student Data**: 20 requests per 5 minutes
- **RFID Scanning**: 30 requests per minute

### CORS Configuration

Configure CORS for your frontend domain:

```javascript
// In server.js
const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
```

## Monitoring and Logging

### Application Logs

View logs in real-time:
```bash
# In Render dashboard
Services → Your Service → Logs
```

### Health Monitoring

Monitor application health:
- `https://your-app.onrender.com/health`
- `https://your-app.onrender.com/health/detailed`
- `https://your-app.onrender.com/api/health/metrics`

### Security Monitoring

Security events are logged to:
- `logs/security.log`
- `logs/combined.log`
- Render dashboard logs

## Backup and Disaster Recovery

### Database Backups

```bash
# Automated daily backups (configure in environment)
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=niemis-production-backups
```

### File Storage Backups

Configure S3 bucket with:
- Versioning enabled
- Cross-region replication
- Lifecycle policies for cost optimization

## Performance Optimization

### Database Optimization

```javascript
// Connection pooling
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000
```

### Caching

Configure Redis for session storage:
```bash
REDIS_URL=redis://your-redis-instance
```

## Security Checklist

- [ ] Environment variables configured
- [ ] Database SSL enabled
- [ ] Strong JWT secrets (32+ characters)
- [ ] HTTPS enforced (automatic on Render)
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] File upload restrictions in place
- [ ] Debug features disabled
- [ ] Audit logging enabled
- [ ] Database backups configured
- [ ] Monitoring and alerting set up

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Check SSL settings
   - Ensure database allows connections

2. **JWT Token Issues**
   - Verify `JWT_SECRET` is set
   - Check token expiration settings
   - Ensure secrets are different for access/refresh tokens

3. **CORS Errors**
   - Verify `FRONTEND_URL` matches your frontend domain
   - Check CORS origin configuration
   - Ensure credentials are properly configured

4. **Rate Limit Issues**
   - Review rate limiting settings
   - Check user role configurations
   - Monitor logs for rate limit violations

### Log Analysis

```bash
# Search for security events
grep "Security Event" logs/security.log

# Check authentication failures
grep "Authentication Event" logs/combined.log

# Monitor performance issues
grep "Slow Operation" logs/combined.log
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review security logs
2. **Monthly**: Update dependencies
3. **Quarterly**: Rotate JWT secrets
4. **Annually**: Review and update SSL certificates (if custom)

### Monitoring Alerts

Set up alerts for:
- High error rates
- Database connection failures
- Security violations
- Performance degradation

### Contact Information

For technical support:
- Email: support@niemis.gov.bb
- Documentation: https://docs.niemis.gov.bb
- GitHub Issues: https://github.com/your-org/niemis/issues

## Additional Resources

- [Render.com Documentation](https://render.com/docs)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)