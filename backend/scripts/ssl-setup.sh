#!/bin/bash

# ==============================================================================
# SSL/TLS Setup Script for NiEMIS Backend
# ==============================================================================
# This script sets up SSL/TLS certificates for the NiEMIS backend server
# Supports both development (self-signed) and production (CA-signed) certificates
# ==============================================================================

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$BACKEND_DIR/certs"
LOGS_DIR="$BACKEND_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment detection
NODE_ENV=${NODE_ENV:-development}
DOMAIN=${DOMAIN:-localhost}
CERT_EMAIL=${CERT_EMAIL:-admin@niemis.gov.bb}

# Certificate paths
CERT_PATH="$CERTS_DIR/cert.pem"
KEY_PATH="$CERTS_DIR/key.pem"
CA_PATH="$CERTS_DIR/ca.pem"
DHPARAM_PATH="$CERTS_DIR/dhparam.pem"
CSR_PATH="$CERTS_DIR/cert.csr"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        warn "Running as root. This is not recommended for security reasons."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    # Check for OpenSSL
    if ! command -v openssl &> /dev/null; then
        error "OpenSSL is not installed. Please install OpenSSL first."
        exit 1
    fi
    
    # Check for curl (for Let's Encrypt)
    if ! command -v curl &> /dev/null; then
        warn "curl is not installed. Some features may not work."
    fi
    
    # Check for certbot (for Let's Encrypt)
    if ! command -v certbot &> /dev/null; then
        warn "certbot is not installed. Let's Encrypt certificates will not be available."
    fi
    
    log "Dependencies check completed"
}

# Create certificates directory
create_certs_directory() {
    log "Creating certificates directory..."
    
    if [[ ! -d "$CERTS_DIR" ]]; then
        mkdir -p "$CERTS_DIR"
        chmod 700 "$CERTS_DIR"
        log "Created certificates directory: $CERTS_DIR"
    else
        log "Certificates directory already exists: $CERTS_DIR"
    fi
    
    if [[ ! -d "$LOGS_DIR" ]]; then
        mkdir -p "$LOGS_DIR"
        chmod 755 "$LOGS_DIR"
        log "Created logs directory: $LOGS_DIR"
    fi
}

# Generate DH parameters
generate_dhparam() {
    log "Generating DH parameters (this may take a while)..."
    
    if [[ ! -f "$DHPARAM_PATH" ]]; then
        openssl dhparam -out "$DHPARAM_PATH" 2048
        chmod 600 "$DHPARAM_PATH"
        log "DH parameters generated: $DHPARAM_PATH"
    else
        log "DH parameters already exist: $DHPARAM_PATH"
    fi
}

# Generate self-signed certificate for development
generate_self_signed() {
    log "Generating self-signed certificate for development..."
    
    # Create OpenSSL configuration for SAN
    cat > "$CERTS_DIR/openssl.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = BB
ST = Barbados
L = Bridgetown
O = NiEMIS Development
CN = $DOMAIN

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    # Generate private key
    openssl genpkey -algorithm RSA -out "$KEY_PATH" -pkcs8 -aes256 -pass pass:development || \
    openssl genpkey -algorithm RSA -out "$KEY_PATH" -pkcs8
    
    # Generate certificate signing request
    openssl req -new -key "$KEY_PATH" -out "$CSR_PATH" -config "$CERTS_DIR/openssl.conf"
    
    # Generate self-signed certificate
    openssl x509 -req -days 365 -in "$CSR_PATH" -signkey "$KEY_PATH" -out "$CERT_PATH" \
        -extensions v3_req -extfile "$CERTS_DIR/openssl.conf"
    
    # Set proper permissions
    chmod 600 "$KEY_PATH" "$CERT_PATH"
    
    # Clean up
    rm -f "$CSR_PATH" "$CERTS_DIR/openssl.conf"
    
    log "Self-signed certificate generated successfully"
    log "Certificate: $CERT_PATH"
    log "Private key: $KEY_PATH"
    
    # Display certificate information
    info "Certificate information:"
    openssl x509 -in "$CERT_PATH" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After :|DNS:|IP Address:)"
}

# Generate certificate signing request for production
generate_csr() {
    log "Generating Certificate Signing Request (CSR) for production..."
    
    # Create OpenSSL configuration
    cat > "$CERTS_DIR/openssl.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = BB
ST = Barbados
L = Bridgetown
O = Ministry of Educational Transformation
OU = Information Technology Division
CN = $DOMAIN
emailAddress = $CERT_EMAIL

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
DNS.3 = api.$DOMAIN
EOF

    # Generate private key
    openssl genpkey -algorithm RSA -out "$KEY_PATH" -pkcs8 -aes256
    
    # Generate certificate signing request
    openssl req -new -key "$KEY_PATH" -out "$CSR_PATH" -config "$CERTS_DIR/openssl.conf"
    
    # Set proper permissions
    chmod 600 "$KEY_PATH" "$CSR_PATH"
    
    log "CSR generated successfully"
    log "Private key: $KEY_PATH"
    log "CSR: $CSR_PATH"
    
    info "Submit the CSR to your Certificate Authority:"
    cat "$CSR_PATH"
    
    # Clean up
    rm -f "$CERTS_DIR/openssl.conf"
}

# Setup Let's Encrypt certificate
setup_letsencrypt() {
    log "Setting up Let's Encrypt certificate..."
    
    if ! command -v certbot &> /dev/null; then
        error "certbot is not installed. Please install certbot first."
        return 1
    fi
    
    # Stop any running server
    if pgrep -f "node.*server.js" > /dev/null; then
        warn "Node.js server is running. Please stop it before continuing."
        return 1
    fi
    
    # Generate certificate
    certbot certonly --standalone \
        --email "$CERT_EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN" \
        --cert-path "$CERT_PATH" \
        --key-path "$KEY_PATH" \
        --fullchain-path "$CA_PATH"
    
    # Set proper permissions
    chmod 600 "$KEY_PATH" "$CERT_PATH" "$CA_PATH"
    
    log "Let's Encrypt certificate setup completed"
    
    # Setup auto-renewal
    setup_auto_renewal
}

# Setup certificate auto-renewal
setup_auto_renewal() {
    log "Setting up certificate auto-renewal..."
    
    # Create renewal script
    cat > "$SCRIPT_DIR/renew-cert.sh" << 'EOF'
#!/bin/bash
# Certificate renewal script for NiEMIS

BACKEND_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
CERTS_DIR="$BACKEND_DIR/certs"
LOGS_DIR="$BACKEND_DIR/logs"

# Renew certificate
certbot renew --quiet --cert-path "$CERTS_DIR/cert.pem" --key-path "$CERTS_DIR/key.pem"

# Restart server if certificate was renewed
if [ $? -eq 0 ]; then
    echo "$(date): Certificate renewed successfully" >> "$LOGS_DIR/cert-renewal.log"
    # Restart NiEMIS server
    pkill -f "node.*server.js" && sleep 2 && cd "$BACKEND_DIR" && npm start >> "$LOGS_DIR/server.log" 2>&1 &
else
    echo "$(date): Certificate renewal failed" >> "$LOGS_DIR/cert-renewal.log"
fi
EOF

    chmod +x "$SCRIPT_DIR/renew-cert.sh"
    
    # Add to crontab (run twice daily)
    (crontab -l 2>/dev/null || echo "") | grep -v "renew-cert.sh" | \
    { cat; echo "0 2,14 * * * $SCRIPT_DIR/renew-cert.sh"; } | crontab -
    
    log "Auto-renewal setup completed"
}

# Validate existing certificates
validate_certificates() {
    log "Validating existing certificates..."
    
    local valid=true
    
    # Check certificate file
    if [[ -f "$CERT_PATH" ]]; then
        if openssl x509 -in "$CERT_PATH" -text -noout > /dev/null 2>&1; then
            local expiry=$(openssl x509 -in "$CERT_PATH" -noout -enddate | cut -d= -f2)
            local expiry_epoch=$(date -d "$expiry" +%s)
            local now_epoch=$(date +%s)
            local days_until_expiry=$(( (expiry_epoch - now_epoch) / 86400 ))
            
            if [[ $days_until_expiry -lt 0 ]]; then
                error "Certificate has expired"
                valid=false
            elif [[ $days_until_expiry -lt 30 ]]; then
                warn "Certificate expires in $days_until_expiry days"
            else
                log "Certificate is valid for $days_until_expiry days"
            fi
        else
            error "Certificate file is invalid"
            valid=false
        fi
    else
        error "Certificate file not found: $CERT_PATH"
        valid=false
    fi
    
    # Check private key file
    if [[ -f "$KEY_PATH" ]]; then
        if openssl rsa -in "$KEY_PATH" -check -noout > /dev/null 2>&1 || \
           openssl pkey -in "$KEY_PATH" -check -noout > /dev/null 2>&1; then
            log "Private key is valid"
        else
            error "Private key is invalid"
            valid=false
        fi
    else
        error "Private key file not found: $KEY_PATH"
        valid=false
    fi
    
    # Check key-certificate match
    if [[ -f "$CERT_PATH" && -f "$KEY_PATH" ]]; then
        local cert_md5=$(openssl x509 -noout -modulus -in "$CERT_PATH" | openssl md5)
        local key_md5=$(openssl rsa -noout -modulus -in "$KEY_PATH" 2>/dev/null | openssl md5 || \
                        openssl pkey -noout -modulus -in "$KEY_PATH" 2>/dev/null | openssl md5)
        
        if [[ "$cert_md5" == "$key_md5" ]]; then
            log "Certificate and private key match"
        else
            error "Certificate and private key do not match"
            valid=false
        fi
    fi
    
    if [[ "$valid" == "true" ]]; then
        log "Certificate validation passed"
        return 0
    else
        error "Certificate validation failed"
        return 1
    fi
}

# Backup existing certificates
backup_certificates() {
    log "Backing up existing certificates..."
    
    local backup_dir="$CERTS_DIR/backup/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    for file in "$CERT_PATH" "$KEY_PATH" "$CA_PATH" "$DHPARAM_PATH"; do
        if [[ -f "$file" ]]; then
            cp "$file" "$backup_dir/"
            log "Backed up: $(basename "$file")"
        fi
    done
    
    log "Backup completed: $backup_dir"
}

# Install CA certificate
install_ca_certificate() {
    log "Installing CA certificate..."
    
    if [[ -f "$CA_PATH" ]]; then
        local ca_file="$CA_PATH"
    else
        read -p "Enter path to CA certificate file: " ca_file
        if [[ ! -f "$ca_file" ]]; then
            error "CA certificate file not found: $ca_file"
            return 1
        fi
    fi
    
    cp "$ca_file" "$CA_PATH"
    chmod 644 "$CA_PATH"
    
    log "CA certificate installed: $CA_PATH"
}

# Test SSL configuration
test_ssl_configuration() {
    log "Testing SSL configuration..."
    
    local test_domain=${1:-$DOMAIN}
    local test_port=${2:-443}
    
    info "Testing SSL connection to $test_domain:$test_port"
    
    # Test SSL connection
    if openssl s_client -connect "$test_domain:$test_port" -servername "$test_domain" < /dev/null 2>/dev/null | \
       openssl x509 -noout -text > /dev/null 2>&1; then
        log "SSL connection test passed"
    else
        error "SSL connection test failed"
        return 1
    fi
    
    # Test cipher suites
    info "Testing cipher suites..."
    local strong_ciphers=("ECDHE-RSA-AES256-GCM-SHA384" "ECDHE-RSA-AES128-GCM-SHA256")
    
    for cipher in "${strong_ciphers[@]}"; do
        if openssl s_client -connect "$test_domain:$test_port" -cipher "$cipher" -servername "$test_domain" < /dev/null 2>/dev/null | \
           grep -q "Cipher is $cipher"; then
            log "Cipher $cipher is supported"
        else
            warn "Cipher $cipher is not supported"
        fi
    done
    
    # Test TLS version
    info "Testing TLS versions..."
    local tls_versions=("1.2" "1.3")
    
    for version in "${tls_versions[@]}"; do
        if openssl s_client -connect "$test_domain:$test_port" -tls$version -servername "$test_domain" < /dev/null 2>/dev/null | \
           grep -q "Protocol.*TLSv$version"; then
            log "TLS v$version is supported"
        else
            warn "TLS v$version is not supported"
        fi
    done
}

# Main menu
show_menu() {
    echo
    echo "=============================================="
    echo "  NiEMIS SSL/TLS Certificate Setup Script"
    echo "=============================================="
    echo
    echo "Environment: $NODE_ENV"
    echo "Domain: $DOMAIN"
    echo "Certificates directory: $CERTS_DIR"
    echo
    echo "1. Generate self-signed certificate (development)"
    echo "2. Generate CSR for production certificate"
    echo "3. Setup Let's Encrypt certificate"
    echo "4. Install CA certificate"
    echo "5. Validate existing certificates"
    echo "6. Backup existing certificates"
    echo "7. Test SSL configuration"
    echo "8. Generate DH parameters"
    echo "9. Exit"
    echo
}

# Main function
main() {
    log "Starting SSL/TLS setup for NiEMIS Backend"
    
    check_root
    check_dependencies
    create_certs_directory
    
    if [[ $# -eq 0 ]]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Please select an option (1-9): " choice
            
            case $choice in
                1)
                    generate_self_signed
                    ;;
                2)
                    generate_csr
                    ;;
                3)
                    setup_letsencrypt
                    ;;
                4)
                    install_ca_certificate
                    ;;
                5)
                    validate_certificates
                    ;;
                6)
                    backup_certificates
                    ;;
                7)
                    read -p "Enter domain to test (default: $DOMAIN): " test_domain
                    test_domain=${test_domain:-$DOMAIN}
                    read -p "Enter port to test (default: 443): " test_port
                    test_port=${test_port:-443}
                    test_ssl_configuration "$test_domain" "$test_port"
                    ;;
                8)
                    generate_dhparam
                    ;;
                9)
                    log "Exiting..."
                    exit 0
                    ;;
                *)
                    error "Invalid option. Please select 1-9."
                    ;;
            esac
            
            echo
            read -p "Press Enter to continue..."
        done
    else
        # Command line mode
        case $1 in
            "self-signed")
                generate_self_signed
                ;;
            "csr")
                generate_csr
                ;;
            "letsencrypt")
                setup_letsencrypt
                ;;
            "validate")
                validate_certificates
                ;;
            "backup")
                backup_certificates
                ;;
            "test")
                test_ssl_configuration "${2:-$DOMAIN}" "${3:-443}"
                ;;
            "dhparam")
                generate_dhparam
                ;;
            *)
                error "Invalid command. Usage: $0 {self-signed|csr|letsencrypt|validate|backup|test|dhparam}"
                exit 1
                ;;
        esac
    fi
}

# Trap signals
trap 'error "Script interrupted"; exit 1' INT TERM

# Run main function
main "$@"