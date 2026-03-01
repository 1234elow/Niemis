# NiEMIS Frontend - Vercel Deployment Guide

## Quick Start Deployment

### 1. Connect Repository to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from the frontend directory
cd frontend
vercel --prod
```

### 2. Automatic Deployment Setup
1. Go to [vercel.com](https://vercel.com)
2. Import the NiEMIS repository
3. Set root directory to `frontend`
4. Framework preset will auto-detect as **Vite**
5. Configure environment variables (see below)

## Environment Variables Configuration

Configure these in Vercel Dashboard under **Settings > Environment Variables**:

### Production Environment Variables
```env
# API Configuration
VITE_API_URL=https://niemis-backend.onrender.com/api

# Application Settings
VITE_APP_NAME=NiEMIS
VITE_APP_VERSION=1.0.0
NODE_ENV=production
VITE_NODE_ENV=production

# Vercel Optimizations
VITE_VERCEL_ENV=production
VITE_ENABLE_VERCEL_ANALYTICS=true
VITE_ENABLE_VERCEL_SPEED_INSIGHTS=true

# Security Settings
VITE_ENABLE_CSP=true
VITE_STRICT_MODE=true
VITE_DEBUG_MODE=false

# Education System Settings
VITE_SCHOOL_SYSTEM_NAME=Barbados Education System
VITE_DEFAULT_LANGUAGE=en
VITE_TIMEZONE=America/Barbados

# Student Data Protection
VITE_ENABLE_STUDENT_DATA_ENCRYPTION=true
VITE_STUDENT_SESSION_TIMEOUT=1800000

# RFID Integration
VITE_ENABLE_RFID_SCANNING=true
VITE_RFID_SCAN_INTERVAL=5000
```

## Build Configuration

### Vercel Settings
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `build`
- **Install Command**: `npm ci`
- **Node.js Version**: 18.x

### Custom Build Configuration
The project includes optimized build settings in `vercel.json`:
- API proxy to backend on Render.com
- Static asset caching (1 year for immutable assets)
- Security headers (CSP, HSTS, etc.)
- SPA routing support
- Service worker configuration

## Domain and DNS Setup

### Custom Domain Configuration
1. **Add Domain** in Vercel Dashboard
2. **Configure DNS** records:
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   
   Type: A
   Name: @
   Value: 76.76.19.61
   ```

### SSL Certificate
- Vercel automatically provisions SSL certificates
- Force HTTPS redirects are configured in `vercel.json`

## Performance Optimizations

### Vercel Edge Network
- **Global CDN**: Static assets served from edge locations
- **Edge Functions**: API routing optimized for low latency
- **Incremental Static Regeneration**: For dynamic content caching

### Build Optimizations
- **Code Splitting**: Vendor libraries separated for better caching
- **Tree Shaking**: Unused code elimination
- **Asset Optimization**: Images, fonts, and CSS minified
- **Preloading**: Critical resources preloaded for faster initial loads

### Caching Strategy
```
Static Assets (JS/CSS/Images): 1 year
HTML Files: 1 hour with revalidation
Service Worker: 1 hour with revalidation
API Responses: No cache (proxied)
```

## Monitoring and Analytics

### Vercel Analytics
Enable in dashboard for:
- **Core Web Vitals** monitoring
- **Real User Metrics** (RUM)
- **Performance scoring**
- **Error tracking**

### Custom Monitoring
The app includes:
- **Service Worker** for offline functionality
- **Error boundaries** for component failure handling
- **Loading states** for better UX
- **Authentication flow** monitoring

## Security Configuration

### Content Security Policy
Configured in `vercel.json` with:
- Script sources: Self + Vercel analytics
- Style sources: Self + Google Fonts
- Image sources: Self + AWS S3/external APIs
- Connect sources: Backend API + Vercel services

### Security Headers
- **HSTS**: Force HTTPS connections
- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME sniffing
- **Referrer Policy**: Control referrer information

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and rebuild
vercel --force

# Check build logs
vercel logs [deployment-url]
```

#### API Connection Issues
1. Verify `VITE_API_URL` environment variable
2. Check CORS configuration on backend
3. Ensure backend is deployed and accessible

#### Environment Variable Issues
1. Prefix all variables with `VITE_`
2. Set variables in Vercel Dashboard, not `.env` files
3. Redeploy after changing environment variables

#### Routing Issues
1. Verify `vercel.json` rewrites configuration
2. Check React Router setup in `App.js`
3. Ensure all routes redirect to `index.html`

### Performance Issues
1. **Bundle Size**: Use `npm run build:analyze` to check
2. **Loading Speed**: Enable Vercel Speed Insights
3. **Memory Usage**: Monitor in Vercel Functions tab

## Deployment Pipeline

### Automatic Deployments
- **Production**: Triggered by pushes to `main` branch
- **Preview**: Created for pull requests and feature branches
- **Development**: Manual deployments via CLI

### CI/CD Integration
```yaml
# GitHub Actions example
name: Deploy to Vercel
on:
  push:
    branches: [main]
    paths: ['frontend/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
        working-directory: ./frontend
      - run: npm run test:ci
        working-directory: ./frontend
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./frontend
```

## Post-Deployment Checklist

### Functionality Testing
- [ ] Login/authentication flow
- [ ] Student vs admin dashboard routing
- [ ] API connectivity to backend
- [ ] Role-based access control
- [ ] RFID scanning functionality
- [ ] Responsive design on mobile devices

### Performance Testing
- [ ] Core Web Vitals scores
- [ ] Loading time < 3 seconds
- [ ] Interactive time < 5 seconds
- [ ] Service worker registration
- [ ] Offline functionality

### Security Testing
- [ ] HTTPS redirect working
- [ ] CSP headers present
- [ ] No console errors in production
- [ ] JWT token handling secure
- [ ] Student data isolation working

## Support and Maintenance

### Monitoring
- **Vercel Dashboard**: Deployments and performance metrics
- **Browser DevTools**: Client-side debugging
- **Backend Logs**: API connectivity issues

### Updates
1. Test locally with `npm run preview:prod`
2. Deploy to preview environment first
3. Verify all functionality works
4. Promote to production

### Backup Strategy
- Git repository serves as source backup
- Vercel maintains deployment history
- Database backups handled by backend service

---

For additional support, contact the development team or refer to the main project documentation.