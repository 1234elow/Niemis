#!/bin/bash

# NiEMIS Security Setup Script
# This script configures security settings for the NiEMIS backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"
SECRETS_DIR="$PROJECT_ROOT/secrets"
CERTS_DIR="$PROJECT_ROOT/certs"
LOGS_DIR="$PROJECT_ROOT/logs"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("node" "npm" "openssl" "curl")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install missing dependencies and run again"
        exit 1
    fi
    
    log_success "All dependencies found"
}

# Create necessary directories
create_directories() {
    log_info "Creating security directories..."
    
    # Create directories with proper permissions
    mkdir -p "$SECRETS_DIR" && chmod 700 "$SECRETS_DIR"
    mkdir -p "$CERTS_DIR" && chmod 700 "$CERTS_DIR"
    mkdir -p "$LOGS_DIR" && chmod 755 "$LOGS_DIR"
    
    # Create subdirectories
    mkdir -p "$LOGS_DIR/security" && chmod 755 "$LOGS_DIR/security"
    mkdir -p "$LOGS_DIR/audit" && chmod 755 "$LOGS_DIR/audit"
    
    log_success "Security directories created"
}

# Generate secure secrets
generate_secrets() {
    log_info "Generating secure secrets..."
    
    # Generate JWT secret (64 characters)
    JWT_SECRET=$(openssl rand -hex 32)
    
    # Generate JWT refresh secret (different from JWT secret)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    
    # Generate session secret
    SESSION_SECRET=$(openssl rand -hex 32)
    
    # Generate master encryption key
    MASTER_ENCRYPTION_KEY=$(openssl rand -hex 32)
    
    # Generate database encryption key
    DB_ENCRYPTION_KEY=$(openssl rand -hex 32)
    
    log_success "Secrets generated successfully"
}

# Create environment file
create_env_file() {
    log_info "Creating environment configuration..."
    
    if [[ -f "$ENV_FILE" ]]; then
        log_warning "Environment file already exists. Creating backup..."
        cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    cat > "$ENV_FILE" << EOF
# NiEMIS Security Configuration
# Generated on $(date)

# Application
NODE_ENV=development
PORT=5000
APP_NAME=NiEMIS
FRONTEND_URL=http://localhost:3000

# Database
DB_DIALECT=sqlite
DB_STORAGE=./niemis_demo.db

# JWT/Authentication
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=24h

# Session
SESSION_SECRET=${SESSION_SECRET}
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=lax

# Encryption
MASTER_ENCRYPTION_KEY=${MASTER_ENCRYPTION_KEY}
DB_ENCRYPTION_KEY=${DB_ENCRYPTION_KEY}

# Security Features
ENABLE_RATE_LIMITING=true
ENABLE_CORS_CREDENTIALS=true
ENABLE_REQUEST_LOGGING=true
ENABLE_SUSPICIOUS_ACTIVITY_DETECTION=true
FEATURE_AUDIT_LOGGING=true
SECURITY_MONITORING_ENABLED=true
PRIVACY_COMPLIANCE_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# File Upload
UPLOAD_MAX_FILE_SIZE=10mb
UPLOAD_MAX_FILES=5
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,application/pdf

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_FILE_MAX_SIZE=5242880
LOG_FILE_MAX_FILES=5

# Security Headers
HELMET_HSTS_MAX_AGE=31536000
HELMET_HSTS_INCLUDE_SUBDOMAINS=true
HELMET_CSP_REPORT_ONLY=false

# Alert Configuration
SECURITY_ALERT_COOLDOWN=300000
ALERT_AUTH_FAILURES_THRESHOLD=5
ALERT_SUSPICIOUS_IP_THRESHOLD=10
ALERT_STUDENT_DATA_THRESHOLD=50

# Privacy Settings
PRIVACY_REQUIRE_EXPLICIT_CONSENT=true
PRIVACY_ENABLE_DATA_PORTABILITY=true
PRIVACY_ENABLE_RIGHT_TO_ERASURE=true
PRIVACY_ANONYMIZE_AFTER_RETENTION=true

# Data Retention (in months)
RETENTION_STUDENT_RECORDS=84
RETENTION_ACADEMIC_RECORDS=60
RETENTION_AUDIT_LOGS=60
RETENTION_SECURITY_LOGS=84

# Development Settings
DEV_ENABLE_SWAGGER=true
DEV_ENABLE_DEBUG_ROUTES=false
DEV_MOCK_EXTERNAL_SERVICES=false
EOF

    # Set secure permissions
    chmod 600 "$ENV_FILE"
    
    log_success "Environment file created with secure permissions"
}

# Generate self-signed certificates for development
generate_dev_certificates() {
    log_info "Generating development SSL certificates..."
    
    local cert_file="$CERTS_DIR/cert.pem"
    local key_file="$CERTS_DIR/key.pem"
    
    if [[ -f "$cert_file" && -f "$key_file" ]]; then
        log_warning "Certificates already exist. Skipping generation..."
        return 0
    fi
    
    # Generate private key
    openssl genrsa -out "$key_file" 2048
    
    # Generate certificate
    openssl req -new -x509 -key "$key_file" -out "$cert_file" -days 365 -subj "/C=BB/ST=Barbados/L=Bridgetown/O=NiEMIS/CN=localhost"
    
    # Set secure permissions
    chmod 600 "$key_file"
    chmod 644 "$cert_file"
    
    log_success "Development certificates generated"
}

# Set up security logging
setup_security_logging() {
    log_info "Setting up security logging..."
    
    # Create log files with proper permissions
    touch "$LOGS_DIR/security.log" && chmod 640 "$LOGS_DIR/security.log"
    touch "$LOGS_DIR/audit.log" && chmod 640 "$LOGS_DIR/audit.log"
    touch "$LOGS_DIR/error.log" && chmod 640 "$LOGS_DIR/error.log"
    touch "$LOGS_DIR/combined.log" && chmod 640 "$LOGS_DIR/combined.log"
    
    # Create logrotate configuration
    cat > "$PROJECT_ROOT/logrotate.conf" << EOF
$LOGS_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        # Signal the application to reopen log files
        pkill -USR1 -f "node.*server.js" || true
    endscript
}
EOF
    
    log_success "Security logging configured"
}

# Install security dependencies
install_security_deps() {
    log_info "Installing security dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Install additional security packages
    npm install --save \
        helmet \
        express-rate-limit \
        express-validator \
        bcryptjs \
        jsonwebtoken \
        cors \
        compression \
        morgan \
        winston \
        validator \
        isomorphic-dompurify \
        nodemailer \
        axios
    
    # Install development security tools
    npm install --save-dev \
        supertest \
        jest \
        eslint \
        eslint-plugin-security
    
    log_success "Security dependencies installed"
}

# Create security configuration files
create_security_configs() {
    log_info "Creating security configuration files..."
    
    # Create security policy file
    cat > "$PROJECT_ROOT/SECURITY_POLICY.md" << EOF
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities to security@niemis.gov.bb

### What to include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fixes (if any)

### Response Timeline:
- **Acknowledgment**: Within 24 hours
- **Initial Assessment**: Within 72 hours
- **Fix Development**: Within 7 days (critical), 30 days (non-critical)
- **Disclosure**: After fix is deployed

## Security Contact

- **Email**: security@niemis.gov.bb
- **Emergency**: +1-246-XXX-XXXX
EOF

    # Create .gitignore security entries
    cat >> "$PROJECT_ROOT/.gitignore" << EOF

# Security files
.env
.env.local
.env.production
secrets/
certs/
*.pem
*.key
*.p12
*.jks
*.log
logrotate.conf
EOF

    log_success "Security configuration files created"
}

# Run security audit
run_security_audit() {
    log_info "Running security audit..."
    
    cd "$PROJECT_ROOT"
    
    # Run npm audit
    if npm audit --audit-level moderate; then
        log_success "npm audit passed"
    else
        log_warning "npm audit found vulnerabilities. Run 'npm audit fix' to resolve."
    fi
    
    # Check for common security issues
    log_info "Checking for common security issues..."
    
    # Check for hardcoded secrets
    if grep -r "password\|secret\|key" --include="*.js" --include="*.json" "$PROJECT_ROOT" | grep -v node_modules | grep -v ".git" | grep -E "(=|:)\s*['\"][^'\"]*['\"]"; then
        log_warning "Potential hardcoded secrets found. Please review."
    fi
    
    # Check file permissions
    find "$PROJECT_ROOT" -name "*.js" -perm /o+w -exec ls -la {} \; | head -10
    
    log_success "Security audit completed"
}

# Create security monitoring script
create_monitoring_script() {
    log_info "Creating security monitoring script..."
    
    cat > "$PROJECT_ROOT/scripts/security-monitor.sh" << 'EOF'
#!/bin/bash

# NiEMIS Security Monitoring Script
# Monitors security events and sends alerts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$PROJECT_ROOT/logs"

# Monitor failed login attempts
check_failed_logins() {
    local count=$(grep -c "auth.login.failure" "$LOGS_DIR/security.log" 2>/dev/null || echo 0)
    if [[ $count -gt 10 ]]; then
        echo "WARNING: $count failed login attempts detected"
        # Send alert (implement your alerting mechanism)
    fi
}

# Monitor suspicious activity
check_suspicious_activity() {
    local count=$(grep -c "suspicious" "$LOGS_DIR/security.log" 2>/dev/null || echo 0)
    if [[ $count -gt 5 ]]; then
        echo "WARNING: $count suspicious activities detected"
        # Send alert
    fi
}

# Monitor disk usage
check_disk_usage() {
    local usage=$(df "$PROJECT_ROOT" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $usage -gt 90 ]]; then
        echo "WARNING: Disk usage is ${usage}%"
        # Send alert
    fi
}

# Monitor log file sizes
check_log_sizes() {
    find "$LOGS_DIR" -name "*.log" -size +100M -exec ls -lh {} \; | while read -r line; do
        echo "WARNING: Large log file detected: $line"
        # Send alert
    done
}

# Main monitoring loop
main() {
    echo "$(date): Starting security monitoring..."
    
    check_failed_logins
    check_suspicious_activity
    check_disk_usage
    check_log_sizes
    
    echo "$(date): Security monitoring completed"
}

# Run monitoring
main "$@"
EOF

    chmod +x "$PROJECT_ROOT/scripts/security-monitor.sh"
    
    log_success "Security monitoring script created"
}

# Set up cron jobs for security tasks
setup_cron_jobs() {
    log_info "Setting up security cron jobs..."
    
    # Create cron job script
    cat > "$PROJECT_ROOT/scripts/security-cron.sh" << 'EOF'
#!/bin/bash

# NiEMIS Security Cron Jobs
# Run security maintenance tasks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Log rotation
/usr/sbin/logrotate -f "$PROJECT_ROOT/logrotate.conf"

# Security monitoring
"$SCRIPT_DIR/security-monitor.sh"

# Cleanup old log files
find "$PROJECT_ROOT/logs" -name "*.log.*" -mtime +30 -delete

# Check for updates
cd "$PROJECT_ROOT" && npm audit --audit-level moderate
EOF

    chmod +x "$PROJECT_ROOT/scripts/security-cron.sh"
    
    log_info "Add the following to your crontab (crontab -e):"
    echo "# NiEMIS Security Tasks"
    echo "0 2 * * * $PROJECT_ROOT/scripts/security-cron.sh"
    echo "*/15 * * * * $PROJECT_ROOT/scripts/security-monitor.sh"
    
    log_success "Security cron jobs configured"
}

# Validate security configuration
validate_security_config() {
    log_info "Validating security configuration..."
    
    local validation_errors=0
    
    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file not found"
        ((validation_errors++))
    else
        # Check for required variables
        local required_vars=("JWT_SECRET" "JWT_REFRESH_SECRET" "SESSION_SECRET" "MASTER_ENCRYPTION_KEY")
        for var in "${required_vars[@]}"; do
            if ! grep -q "^${var}=" "$ENV_FILE"; then
                log_error "Required variable $var not found in environment file"
                ((validation_errors++))
            fi
        done
    fi
    
    # Check directory permissions
    if [[ ! -d "$SECRETS_DIR" ]] || [[ $(stat -c %a "$SECRETS_DIR") != "700" ]]; then
        log_error "Secrets directory has incorrect permissions"
        ((validation_errors++))
    fi
    
    # Check log directory
    if [[ ! -d "$LOGS_DIR" ]]; then
        log_error "Logs directory not found"
        ((validation_errors++))
    fi
    
    if [[ $validation_errors -eq 0 ]]; then
        log_success "Security configuration validation passed"
    else
        log_error "Security configuration validation failed with $validation_errors errors"
        exit 1
    fi
}

# Display security summary
display_security_summary() {
    log_info "Security Setup Summary:"
    echo ""
    echo "✓ Security directories created with proper permissions"
    echo "✓ Secure secrets generated"
    echo "✓ Environment file configured"
    echo "✓ Development certificates generated"
    echo "✓ Security logging configured"
    echo "✓ Security dependencies installed"
    echo "✓ Security monitoring script created"
    echo "✓ Security policies documented"
    echo ""
    log_info "Next steps:"
    echo "1. Review the generated .env file"
    echo "2. Set up production environment variables"
    echo "3. Configure alerting endpoints"
    echo "4. Set up monitoring cron jobs"
    echo "5. Review SECURITY_GUIDE.md"
    echo ""
    log_warning "Important security reminders:"
    echo "• Never commit .env files to version control"
    echo "• Rotate secrets regularly"
    echo "• Monitor security logs daily"
    echo "• Keep dependencies updated"
    echo "• Use strong passwords for all accounts"
    echo ""
}

# Main execution
main() {
    log_info "Starting NiEMIS Security Setup..."
    
    check_root
    check_dependencies
    create_directories
    generate_secrets
    create_env_file
    generate_dev_certificates
    setup_security_logging
    install_security_deps
    create_security_configs
    create_monitoring_script
    setup_cron_jobs
    validate_security_config
    run_security_audit
    display_security_summary
    
    log_success "Security setup completed successfully!"
}

# Run main function
main "$@"
EOF