#!/bin/bash

# ==============================================
# NiEMIS PostgreSQL Local Setup Script
# ==============================================
# This script sets up a local PostgreSQL database for NiEMIS development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="niemis_local"
DB_USER="niemis_user"
DB_PASSWORD="local_password123"
DB_HOST="localhost"
DB_PORT="5432"

# Test database
TEST_DB_NAME="niemis_test"

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}  NiEMIS PostgreSQL Local Setup Script${NC}"
echo -e "${BLUE}===============================================${NC}"

# Check if PostgreSQL is installed
check_postgresql() {
    echo -e "${YELLOW}Checking PostgreSQL installation...${NC}"
    
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}PostgreSQL is not installed or not in PATH${NC}"
        echo -e "${YELLOW}Please install PostgreSQL first:${NC}"
        echo -e "${YELLOW}  - Download from: https://www.postgresql.org/download/windows/${NC}"
        echo -e "${YELLOW}  - Or use package manager: winget install PostgreSQL.PostgreSQL${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}PostgreSQL found!${NC}"
}

# Check if PostgreSQL service is running
check_postgresql_service() {
    echo -e "${YELLOW}Checking PostgreSQL service...${NC}"
    
    # For Windows, check if PostgreSQL service is running
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        if ! sc query postgresql-x64-14 | grep -q "RUNNING"; then
            echo -e "${RED}PostgreSQL service is not running${NC}"
            echo -e "${YELLOW}Please start PostgreSQL service:${NC}"
            echo -e "${YELLOW}  - Windows Services: Start 'postgresql-x64-14' service${NC}"
            echo -e "${YELLOW}  - Or run: net start postgresql-x64-14${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}PostgreSQL service is running!${NC}"
}

# Create database and user
create_database() {
    echo -e "${YELLOW}Creating database and user...${NC}"
    
    # Create user and databases
    psql -U postgres -h $DB_HOST -p $DB_PORT -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
        echo -e "${YELLOW}User $DB_USER already exists, updating password...${NC}"
        psql -U postgres -h $DB_HOST -p $DB_PORT -c "ALTER USER $DB_USER PASSWORD '$DB_PASSWORD';"
    }
    
    psql -U postgres -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || {
        echo -e "${YELLOW}Database $DB_NAME already exists${NC}"
    }
    
    psql -U postgres -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $TEST_DB_NAME OWNER $DB_USER;" 2>/dev/null || {
        echo -e "${YELLOW}Test database $TEST_DB_NAME already exists${NC}"
    }
    
    # Grant privileges
    psql -U postgres -h $DB_HOST -p $DB_PORT -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    psql -U postgres -h $DB_HOST -p $DB_PORT -c "GRANT ALL PRIVILEGES ON DATABASE $TEST_DB_NAME TO $DB_USER;"
    
    echo -e "${GREEN}Database setup completed!${NC}"
}

# Test database connection
test_connection() {
    echo -e "${YELLOW}Testing database connection...${NC}"
    
    export PGPASSWORD=$DB_PASSWORD
    psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "SELECT version();" > /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Database connection successful!${NC}"
    else
        echo -e "${RED}Database connection failed!${NC}"
        exit 1
    fi
}

# Setup environment file
setup_environment() {
    echo -e "${YELLOW}Setting up environment configuration...${NC}"
    
    # Copy environment file if it doesn't exist
    if [ ! -f "../backend/.env" ]; then
        cp ".env.local.example" "../backend/.env"
        echo -e "${GREEN}Environment file created at backend/.env${NC}"
    else
        echo -e "${YELLOW}Environment file already exists at backend/.env${NC}"
    fi
    
    # Copy frontend environment file if it doesn't exist
    if [ ! -f "../frontend/.env.local" ]; then
        cp ".env.frontend.local.example" "../frontend/.env.local"
        echo -e "${GREEN}Frontend environment file created at frontend/.env.local${NC}"
    else
        echo -e "${YELLOW}Frontend environment file already exists at frontend/.env.local${NC}"
    fi
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing dependencies...${NC}"
    
    # Install backend dependencies
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd ../backend
    npm install
    
    # Install frontend dependencies
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd ../frontend
    npm install
    
    cd ../local-deployment
    echo -e "${GREEN}Dependencies installed!${NC}"
}

# Run database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    
    cd ../backend
    npm run migrate
    
    cd ../local-deployment
    echo -e "${GREEN}Database migrations completed!${NC}"
}

# Seed database with demo data
seed_database() {
    echo -e "${YELLOW}Seeding database with demo data...${NC}"
    
    cd ../backend
    npm run seed:production
    
    cd ../local-deployment
    echo -e "${GREEN}Database seeding completed!${NC}"
}

# Create development scripts
create_scripts() {
    echo -e "${YELLOW}Creating development scripts...${NC}"
    
    # Create start script
    cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "Starting NiEMIS Development Environment..."

# Start backend in background
cd backend
npm run dev &
BACKEND_PID=$!

# Start frontend in background
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
EOF
    
    chmod +x start-dev.sh
    echo -e "${GREEN}Development scripts created!${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}Starting PostgreSQL setup...${NC}"
    
    check_postgresql
    check_postgresql_service
    create_database
    test_connection
    setup_environment
    install_dependencies
    run_migrations
    seed_database
    create_scripts
    
    echo -e "${GREEN}===============================================${NC}"
    echo -e "${GREEN}  Setup completed successfully!${NC}"
    echo -e "${GREEN}===============================================${NC}"
    echo -e "${GREEN}Database Details:${NC}"
    echo -e "${GREEN}  Host: $DB_HOST${NC}"
    echo -e "${GREEN}  Port: $DB_PORT${NC}"
    echo -e "${GREEN}  Database: $DB_NAME${NC}"
    echo -e "${GREEN}  User: $DB_USER${NC}"
    echo -e "${GREEN}  Password: $DB_PASSWORD${NC}"
    echo -e "${GREEN}===============================================${NC}"
    echo -e "${GREEN}Next Steps:${NC}"
    echo -e "${GREEN}  1. Start development: ./start-dev.sh${NC}"
    echo -e "${GREEN}  2. Open browser: http://localhost:3000${NC}"
    echo -e "${GREEN}  3. Login with demo credentials${NC}"
    echo -e "${GREEN}===============================================${NC}"
}

# Handle errors
trap 'echo -e "${RED}An error occurred. Setup failed.${NC}"; exit 1' ERR

# Run main function
main

exit 0