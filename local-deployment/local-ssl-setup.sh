#!/bin/bash

# ==============================================
# NiEMIS Local SSL Certificate Setup Script
# ==============================================
# This script generates self-signed SSL certificates for local HTTPS development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CERT_DIR="./ssl-certs"
CERT_NAME="localhost"
CERT_KEY="${CERT_DIR}/${CERT_NAME}.key"
CERT_CRT="${CERT_DIR}/${CERT_NAME}.crt"
CERT_CSR="${CERT_DIR}/${CERT_NAME}.csr"
CERT_EXT="${CERT_DIR}/${CERT_NAME}.ext"

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}  NiEMIS Local SSL Certificate Setup${NC}"
echo -e "${BLUE}===============================================${NC}"

# Create certificate directory
create_cert_directory() {
    echo -e "${YELLOW}Creating certificate directory...${NC}"
    mkdir -p "$CERT_DIR"
    echo -e "${GREEN}Certificate directory created: $CERT_DIR${NC}"
}

# Generate private key
generate_private_key() {
    echo -e "${YELLOW}Generating private key...${NC}"
    openssl genrsa -out "$CERT_KEY" 2048
    echo -e "${GREEN}Private key generated: $CERT_KEY${NC}"
}

# Create certificate signing request
create_csr() {
    echo -e "${YELLOW}Creating certificate signing request...${NC}"
    
    # Create config for CSR
    cat > "$CERT_CSR.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = BB
ST = Saint Michael
L = Bridgetown
O = Ministry of Educational Transformation
OU = IT Department
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = niemis.local
DNS.3 = *.niemis.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    openssl req -new -key "$CERT_KEY" -out "$CERT_CSR" -config "$CERT_CSR.conf"
    echo -e "${GREEN}Certificate signing request created: $CERT_CSR${NC}"
}

# Create certificate extensions
create_extensions() {
    echo -e "${YELLOW}Creating certificate extensions...${NC}"
    
    cat > "$CERT_EXT" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = niemis.local
DNS.3 = *.niemis.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    echo -e "${GREEN}Certificate extensions created: $CERT_EXT${NC}"
}

# Generate self-signed certificate
generate_certificate() {
    echo -e "${YELLOW}Generating self-signed certificate...${NC}"
    
    openssl x509 -req -in "$CERT_CSR" -signkey "$CERT_KEY" -out "$CERT_CRT" -days 365 -extensions v3_req -extfile "$CERT_EXT"
    
    echo -e "${GREEN}Self-signed certificate generated: $CERT_CRT${NC}"
}

# Set proper permissions
set_permissions() {
    echo -e "${YELLOW}Setting certificate permissions...${NC}"
    
    chmod 600 "$CERT_KEY"
    chmod 644 "$CERT_CRT"
    
    echo -e "${GREEN}Certificate permissions set${NC}"
}

# Verify certificate
verify_certificate() {
    echo -e "${YELLOW}Verifying certificate...${NC}"
    
    echo -e "${BLUE}Certificate details:${NC}"
    openssl x509 -in "$CERT_CRT" -text -noout | grep -A 5 "Subject:"
    
    echo -e "${BLUE}Certificate validity:${NC}"
    openssl x509 -in "$CERT_CRT" -noout -dates
    
    echo -e "${BLUE}Certificate subject alternative names:${NC}"
    openssl x509 -in "$CERT_CRT" -noout -text | grep -A 10 "Subject Alternative Name"
    
    echo -e "${GREEN}Certificate verification completed${NC}"
}

# Update backend configuration
update_backend_config() {
    echo -e "${YELLOW}Updating backend SSL configuration...${NC}"
    
    # Update the backend .env file to use SSL
    BACKEND_ENV="../backend/.env"
    
    if [ -f "$BACKEND_ENV" ]; then
        # Update or add SSL settings
        if grep -q "HTTPS_ENABLED" "$BACKEND_ENV"; then
            sed -i 's/HTTPS_ENABLED=.*/HTTPS_ENABLED=true/' "$BACKEND_ENV"
        else
            echo "HTTPS_ENABLED=true" >> "$BACKEND_ENV"
        fi
        
        if grep -q "SSL_CERT_PATH" "$BACKEND_ENV"; then
            sed -i "s|SSL_CERT_PATH=.*|SSL_CERT_PATH=./local-deployment/ssl-certs/${CERT_NAME}.crt|" "$BACKEND_ENV"
        else
            echo "SSL_CERT_PATH=./local-deployment/ssl-certs/${CERT_NAME}.crt" >> "$BACKEND_ENV"
        fi
        
        if grep -q "SSL_KEY_PATH" "$BACKEND_ENV"; then
            sed -i "s|SSL_KEY_PATH=.*|SSL_KEY_PATH=./local-deployment/ssl-certs/${CERT_NAME}.key|" "$BACKEND_ENV"
        else
            echo "SSL_KEY_PATH=./local-deployment/ssl-certs/${CERT_NAME}.key" >> "$BACKEND_ENV"
        fi
        
        echo -e "${GREEN}Backend SSL configuration updated${NC}"
    else
        echo -e "${YELLOW}Backend .env file not found, skipping configuration update${NC}"
    fi
}

# Update frontend configuration
update_frontend_config() {
    echo -e "${YELLOW}Updating frontend SSL configuration...${NC}"
    
    # Update the frontend .env.local file to use HTTPS
    FRONTEND_ENV="../frontend/.env.local"
    
    if [ -f "$FRONTEND_ENV" ]; then
        # Update API URL to use HTTPS
        if grep -q "VITE_API_URL" "$FRONTEND_ENV"; then
            sed -i 's|VITE_API_URL=.*|VITE_API_URL=https://localhost:8443|' "$FRONTEND_ENV"
        else
            echo "VITE_API_URL=https://localhost:8443" >> "$FRONTEND_ENV"
        fi
        
        if grep -q "VITE_HTTPS_ENABLED" "$FRONTEND_ENV"; then
            sed -i 's/VITE_HTTPS_ENABLED=.*/VITE_HTTPS_ENABLED=true/' "$FRONTEND_ENV"
        else
            echo "VITE_HTTPS_ENABLED=true" >> "$FRONTEND_ENV"
        fi
        
        echo -e "${GREEN}Frontend SSL configuration updated${NC}"
    else
        echo -e "${YELLOW}Frontend .env.local file not found, skipping configuration update${NC}"
    fi
}

# Update Vite configuration for HTTPS
update_vite_config() {
    echo -e "${YELLOW}Updating Vite configuration for HTTPS...${NC}"
    
    VITE_CONFIG="../frontend/vite.config.js"
    
    if [ -f "$VITE_CONFIG" ]; then
        # Create a backup
        cp "$VITE_CONFIG" "$VITE_CONFIG.backup"
        
        # Add HTTPS configuration to Vite config
        cat > "$VITE_CONFIG.https" << EOF
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from 'fs';

// Load existing config
const existingConfig = JSON.parse(fs.readFileSync('./vite.config.js.backup', 'utf8'));

// https://vitejs.dev/config/
export default defineConfig({
  ...existingConfig,
  server: {
    ...existingConfig.server,
    https: {
      key: fs.readFileSync('./local-deployment/ssl-certs/localhost.key'),
      cert: fs.readFileSync('./local-deployment/ssl-certs/localhost.crt'),
    },
    proxy: {
      "/api": {
        target: "https://localhost:8443",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
EOF
        
        echo -e "${GREEN}Vite HTTPS configuration created${NC}"
        echo -e "${YELLOW}To use HTTPS, replace vite.config.js with vite.config.js.https${NC}"
    else
        echo -e "${YELLOW}Vite config file not found, skipping HTTPS configuration${NC}"
    fi
}

# Create installation instructions
create_instructions() {
    echo -e "${YELLOW}Creating installation instructions...${NC}"
    
    cat > "$CERT_DIR/README.md" << EOF
# NiEMIS Local SSL Certificates

This directory contains self-signed SSL certificates for local HTTPS development.

## Files

- \`localhost.key\` - Private key
- \`localhost.crt\` - Self-signed certificate
- \`localhost.csr\` - Certificate signing request
- \`localhost.ext\` - Certificate extensions

## Installation

### Chrome/Edge
1. Open Chrome/Edge
2. Go to Settings > Privacy and Security > Security > Manage certificates
3. Click "Trusted Root Certification Authorities" tab
4. Click "Import" and select \`localhost.crt\`
5. Restart browser

### Firefox
1. Open Firefox
2. Go to Settings > Privacy & Security > Certificates > View Certificates
3. Click "Authorities" tab
4. Click "Import" and select \`localhost.crt\`
5. Check "Trust this CA to identify websites"
6. Restart browser

### macOS System
\`\`\`bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain localhost.crt
\`\`\`

### Windows System
1. Double-click \`localhost.crt\`
2. Click "Install Certificate"
3. Choose "Local Machine"
4. Select "Place all certificates in the following store"
5. Click "Browse" and select "Trusted Root Certification Authorities"
6. Click "Next" and "Finish"

## Usage

### Backend (Express.js)
The backend server will automatically use HTTPS when:
- \`HTTPS_ENABLED=true\` in .env
- Certificate paths are configured

### Frontend (Vite)
To use HTTPS in development:
1. Replace \`vite.config.js\` with \`vite.config.js.https\`
2. Or add HTTPS configuration to your Vite config

### Access URLs
- HTTP: http://localhost:3000
- HTTPS: https://localhost:3000
- Backend API: https://localhost:8443

## Security Note

These certificates are for local development only. Never use self-signed certificates in production.
EOF

    echo -e "${GREEN}Installation instructions created: $CERT_DIR/README.md${NC}"
}

# Clean up temporary files
cleanup() {
    echo -e "${YELLOW}Cleaning up temporary files...${NC}"
    
    rm -f "$CERT_CSR"
    rm -f "$CERT_CSR.conf"
    rm -f "$CERT_EXT"
    
    echo -e "${GREEN}Cleanup completed${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}Starting SSL certificate setup...${NC}"
    
    # Check if OpenSSL is installed
    if ! command -v openssl &> /dev/null; then
        echo -e "${RED}OpenSSL is not installed. Please install OpenSSL first.${NC}"
        exit 1
    fi
    
    create_cert_directory
    generate_private_key
    create_csr
    create_extensions
    generate_certificate
    set_permissions
    verify_certificate
    update_backend_config
    update_frontend_config
    update_vite_config
    create_instructions
    cleanup
    
    echo -e "${GREEN}===============================================${NC}"
    echo -e "${GREEN}  SSL Certificate Setup Completed!${NC}"
    echo -e "${GREEN}===============================================${NC}"
    echo -e "${GREEN}Certificate files created in: $CERT_DIR${NC}"
    echo -e "${GREEN}Certificate valid for: 365 days${NC}"
    echo -e "${GREEN}===============================================${NC}"
    echo -e "${GREEN}Next Steps:${NC}"
    echo -e "${GREEN}  1. Install the certificate in your browser${NC}"
    echo -e "${GREEN}  2. See instructions in: $CERT_DIR/README.md${NC}"
    echo -e "${GREEN}  3. Restart your development servers${NC}"
    echo -e "${GREEN}  4. Access: https://localhost:3000${NC}"
    echo -e "${GREEN}===============================================${NC}"
}

# Handle errors
trap 'echo -e "${RED}An error occurred. SSL setup failed.${NC}"; exit 1' ERR

# Run main function
main

exit 0