#!/bin/bash

# NiEMIS PostgreSQL Setup Script
# This script sets up the PostgreSQL database for local development

set -e

echo "🚀 Setting up NiEMIS PostgreSQL Database"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="niemis_local"
DB_USER="niemis_admin"
if command -v openssl >/dev/null 2>&1; then
    GENERATED_DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
else
    GENERATED_DB_PASSWORD="$(date +%s%N | sha256sum | head -c 24)"
fi
DB_PASSWORD="${DB_PASSWORD:-$GENERATED_DB_PASSWORD}"
POSTGRES_USER="postgres"
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"

# Check if PostgreSQL is running
echo -e "${YELLOW}Checking PostgreSQL service...${NC}"
if ! pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER; then
    echo -e "${RED}ERROR: PostgreSQL is not running on $POSTGRES_HOST:$POSTGRES_PORT${NC}"
    echo "Please start PostgreSQL and try again."
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Create database and user
echo -e "${YELLOW}Creating database and user...${NC}"
psql -U $POSTGRES_USER -h $POSTGRES_HOST -p $POSTGRES_PORT << EOF
-- Drop existing database if it exists
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create database
CREATE DATABASE $DB_NAME
    WITH 
    OWNER = $POSTGRES_USER
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    TEMPLATE = template0;

-- Create user
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Connect to the database to set default privileges
\c $DB_NAME

-- Grant privileges on schema
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $DB_USER;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

\q
EOF

echo -e "${GREEN}✓ Database and user created successfully${NC}"

# Set up environment file
echo -e "${YELLOW}Creating environment configuration...${NC}"
cat > .env.local << EOF
# NiEMIS Local PostgreSQL Configuration
NODE_ENV=development
PORT=5000
APP_NAME=NiEMIS
APP_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_SSL=false

# Connection Pool Configuration
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_POOL_ACQUIRE_TIMEOUT=30000
DB_POOL_IDLE_TIMEOUT=10000

# JWT Configuration
JWT_SECRET=niemis_local_jwt_secret_key_min_32_characters_long_for_security
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_REFRESH_SECRET=niemis_local_refresh_secret_different_from_jwt_secret

# Security Configuration
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:3000

# Logging Configuration
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
LOG_TO_FILE=true

# Feature Flags
FEATURE_RFID_ENABLED=true
FEATURE_SMS_NOTIFICATIONS=false
FEATURE_EMAIL_NOTIFICATIONS=false
FEATURE_AUDIT_LOGGING=true
FEATURE_ANALYTICS=true
EOF

echo -e "${GREEN}✓ Environment configuration created${NC}"

# Install required dependencies
echo -e "${YELLOW}Installing required dependencies...${NC}"
npm install sqlite3 pg

# Run Sequelize migrations
echo -e "${YELLOW}Running database migrations...${NC}"
npx sequelize-cli db:migrate --config config/sequelize.json --env development

echo -e "${GREEN}✓ Database migrations completed${NC}"

# Run data migration from SQLite
echo -e "${YELLOW}Migrating data from SQLite to PostgreSQL...${NC}"
if [ -f "niemis_demo.db" ]; then
    node scripts/migrate-to-postgresql.js
    echo -e "${GREEN}✓ Data migration completed${NC}"
else
    echo -e "${YELLOW}⚠ SQLite database not found, skipping data migration${NC}"
fi

# Test database connection
echo -e "${YELLOW}Testing database connection...${NC}"
node << EOF
const { sequelize } = require('./config/database');

async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✓ Database connection successful');
        
        // Test some basic queries
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log(\`✓ Found \${tables.length} tables in database\`);
        
        process.exit(0);
    } catch (error) {
        console.error('✗ Database connection failed:', error);
        process.exit(1);
    }
}

testConnection();
EOF

echo -e "${GREEN}✓ Database connection test successful${NC}"

# Create backup script
echo -e "${YELLOW}Creating backup script...${NC}"
cat > scripts/backup-postgresql.sh << 'EOF'
#!/bin/bash

# NiEMIS PostgreSQL Backup Script
BACKUP_DIR="../backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/niemis_local_backup_$DATE.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
echo "Creating backup: $BACKUP_FILE"
pg_dump -h localhost -U niemis_admin -d niemis_local > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

echo "Backup completed: $BACKUP_FILE.gz"

# Clean up old backups (keep last 10)
find $BACKUP_DIR -name "niemis_local_backup_*.sql.gz" -type f -mtime +10 -delete
EOF

chmod +x scripts/backup-postgresql.sh

echo -e "${GREEN}✓ Backup script created${NC}"

echo ""
echo -e "${GREEN}🎉 PostgreSQL setup completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Copy .env.local to .env: cp .env.local .env"
echo "2. Start the application: npm run dev"
echo "3. Test the application at: http://localhost:5000"
echo ""
echo "Database Details:"
echo "- Database: $DB_NAME"
echo "- User: $DB_USER"
echo "- Host: $POSTGRES_HOST:$POSTGRES_PORT"
echo ""
echo "To create a backup: ./scripts/backup-postgresql.sh"
echo "To restore from backup: psql -h localhost -U $DB_USER -d $DB_NAME < backup_file.sql"
