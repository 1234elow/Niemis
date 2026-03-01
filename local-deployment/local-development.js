#!/usr/bin/env node

/**
 * NiEMIS Local Development Server Manager
 * This script manages the local development environment for NiEMIS
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LocalDevelopmentManager {
    constructor() {
        this.processes = [];
        this.config = {
            backend: {
                cwd: path.join(__dirname, '..', 'backend'),
                script: 'npm run dev',
                port: 5000,
                name: 'Backend API'
            },
            frontend: {
                cwd: path.join(__dirname, '..', 'frontend'),
                script: 'npm run dev',
                port: 3000,
                name: 'Frontend App'
            }
        };
        this.isWindows = os.platform() === 'win32';
        this.networkIP = this.getNetworkIP();
    }

    /**
     * Get local network IP address
     */
    getNetworkIP() {
        const interfaces = os.networkInterfaces();
        for (const name in interfaces) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return 'localhost';
    }

    /**
     * Check if a port is available
     */
    async checkPort(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => resolve(true));
                server.close();
            });
            
            server.on('error', () => resolve(false));
        });
    }

    /**
     * Kill process on port
     */
    async killPort(port) {
        return new Promise((resolve) => {
            const command = this.isWindows 
                ? `netstat -ano | findstr :${port}` 
                : `lsof -ti:${port}`;
            
            exec(command, (error, stdout) => {
                if (error) {
                    resolve();
                    return;
                }
                
                if (this.isWindows) {
                    const lines = stdout.trim().split('\n');
                    const pid = lines[0]?.split(/\s+/).pop();
                    if (pid) {
                        exec(`taskkill /PID ${pid} /F`, () => resolve());
                    } else {
                        resolve();
                    }
                } else {
                    const pids = stdout.trim().split('\n');
                    if (pids.length > 0 && pids[0]) {
                        exec(`kill -9 ${pids.join(' ')}`, () => resolve());
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    /**
     * Check if database is ready
     */
    async checkDatabase() {
        return new Promise((resolve) => {
            const testScript = path.join(__dirname, '..', 'backend', 'test-connection.js');
            
            if (!fs.existsSync(testScript)) {
                console.log('⚠️  Database test script not found, skipping check');
                resolve(true);
                return;
            }
            
            const child = spawn('node', [testScript], {
                cwd: path.join(__dirname, '..', 'backend'),
                stdio: 'inherit'
            });
            
            child.on('exit', (code) => {
                resolve(code === 0);
            });
        });
    }

    /**
     * Start a service
     */
    async startService(serviceName) {
        const service = this.config[serviceName];
        if (!service) {
            console.error(`❌ Unknown service: ${serviceName}`);
            return false;
        }

        console.log(`🚀 Starting ${service.name}...`);

        // Check if port is available
        const isPortAvailable = await this.checkPort(service.port);
        if (!isPortAvailable) {
            console.log(`⚠️  Port ${service.port} is in use, attempting to free it...`);
            await this.killPort(service.port);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Start the service
        const [command, ...args] = service.script.split(' ');
        const child = spawn(command, args, {
            cwd: service.cwd,
            stdio: 'inherit',
            shell: true,
            env: {
                ...process.env,
                NODE_ENV: 'development',
                PORT: service.port.toString(),
                FORCE_COLOR: '1'
            }
        });

        // Store process reference
        this.processes.push({
            name: service.name,
            process: child,
            port: service.port
        });

        child.on('exit', (code) => {
            console.log(`💀 ${service.name} exited with code ${code}`);
            this.processes = this.processes.filter(p => p.process !== child);
        });

        child.on('error', (error) => {
            console.error(`❌ ${service.name} error:`, error);
        });

        return true;
    }

    /**
     * Setup environment files
     */
    setupEnvironment() {
        const backendEnv = path.join(__dirname, '..', 'backend', '.env');
        const frontendEnv = path.join(__dirname, '..', 'frontend', '.env.local');
        
        // Copy backend environment if it doesn't exist
        if (!fs.existsSync(backendEnv)) {
            const exampleEnv = path.join(__dirname, '.env.local.example');
            if (fs.existsSync(exampleEnv)) {
                fs.copyFileSync(exampleEnv, backendEnv);
                console.log('✅ Backend environment file created');
            }
        }
        
        // Copy frontend environment if it doesn't exist
        if (!fs.existsSync(frontendEnv)) {
            const exampleEnv = path.join(__dirname, '.env.frontend.local.example');
            if (fs.existsSync(exampleEnv)) {
                fs.copyFileSync(exampleEnv, frontendEnv);
                console.log('✅ Frontend environment file created');
            }
        }
    }

    /**
     * Install dependencies
     */
    async installDependencies() {
        console.log('📦 Installing dependencies...');
        
        // Install backend dependencies
        await new Promise((resolve) => {
            const child = spawn('npm', ['install'], {
                cwd: this.config.backend.cwd,
                stdio: 'inherit',
                shell: true
            });
            child.on('exit', resolve);
        });
        
        // Install frontend dependencies
        await new Promise((resolve) => {
            const child = spawn('npm', ['install'], {
                cwd: this.config.frontend.cwd,
                stdio: 'inherit',
                shell: true
            });
            child.on('exit', resolve);
        });
        
        console.log('✅ Dependencies installed');
    }

    /**
     * Run database migrations
     */
    async runMigrations() {
        console.log('🗄️  Running database migrations...');
        
        await new Promise((resolve) => {
            const child = spawn('npm', ['run', 'migrate'], {
                cwd: this.config.backend.cwd,
                stdio: 'inherit',
                shell: true
            });
            child.on('exit', resolve);
        });
        
        console.log('✅ Database migrations completed');
    }

    /**
     * Seed database
     */
    async seedDatabase() {
        console.log('🌱 Seeding database...');
        
        await new Promise((resolve) => {
            const child = spawn('npm', ['run', 'seed:production'], {
                cwd: this.config.backend.cwd,
                stdio: 'inherit',
                shell: true
            });
            child.on('exit', resolve);
        });
        
        console.log('✅ Database seeding completed');
    }

    /**
     * Start development environment
     */
    async startDevelopment() {
        console.log('🎯 Starting NiEMIS Local Development Environment');
        console.log('===============================================');
        
        // Setup environment
        this.setupEnvironment();
        
        // Check database connection
        console.log('🔍 Checking database connection...');
        const dbReady = await this.checkDatabase();
        if (!dbReady) {
            console.error('❌ Database connection failed. Please check your PostgreSQL setup.');
            process.exit(1);
        }
        console.log('✅ Database connection successful');
        
        // Start services
        const backendStarted = await this.startService('backend');
        if (!backendStarted) {
            console.error('❌ Failed to start backend service');
            process.exit(1);
        }
        
        // Wait a bit for backend to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const frontendStarted = await this.startService('frontend');
        if (!frontendStarted) {
            console.error('❌ Failed to start frontend service');
            process.exit(1);
        }
        
        // Display access information
        console.log('\n🎉 Development environment started successfully!');
        console.log('===============================================');
        console.log(`📱 Frontend: http://localhost:3000`);
        console.log(`🔗 Backend API: http://localhost:5000`);
        console.log(`🌐 Network Access: http://${this.networkIP}:3000`);
        console.log('===============================================');
        console.log('📚 Documentation: /local-deployment/README.md');
        console.log('🔧 Health Check: http://localhost:5000/health');
        console.log('📊 API Status: http://localhost:5000/api/status');
        console.log('===============================================');
        console.log('Press Ctrl+C to stop all services');
        console.log('===============================================\n');
    }

    /**
     * Setup initial environment
     */
    async setup() {
        console.log('⚙️  Setting up local development environment...');
        
        this.setupEnvironment();
        await this.installDependencies();
        
        // Check database connection
        const dbReady = await this.checkDatabase();
        if (!dbReady) {
            console.log('⚠️  Database not ready. Please run the PostgreSQL setup script first.');
            console.log('   ./setup-postgresql.sh');
            process.exit(1);
        }
        
        await this.runMigrations();
        await this.seedDatabase();
        
        console.log('✅ Setup completed successfully!');
        console.log('Run "npm run dev" to start the development servers');
    }

    /**
     * Stop all services
     */
    stop() {
        console.log('\n🛑 Stopping all services...');
        
        this.processes.forEach(({ name, process }) => {
            console.log(`💀 Stopping ${name}...`);
            process.kill('SIGTERM');
        });
        
        // Force kill after timeout
        setTimeout(() => {
            this.processes.forEach(({ name, process }) => {
                if (!process.killed) {
                    console.log(`💀 Force killing ${name}...`);
                    process.kill('SIGKILL');
                }
            });
            process.exit(0);
        }, 5000);
    }

    /**
     * Health check
     */
    async healthCheck() {
        console.log('🏥 Running health check...');
        
        // Check database
        const dbReady = await this.checkDatabase();
        console.log(`Database: ${dbReady ? '✅ Ready' : '❌ Not Ready'}`);
        
        // Check ports
        const backendPort = await this.checkPort(this.config.backend.port);
        const frontendPort = await this.checkPort(this.config.frontend.port);
        
        console.log(`Backend Port ${this.config.backend.port}: ${backendPort ? '✅ Available' : '❌ In Use'}`);
        console.log(`Frontend Port ${this.config.frontend.port}: ${frontendPort ? '✅ Available' : '❌ In Use'}`);
        
        // Check environment files
        const backendEnv = fs.existsSync(path.join(__dirname, '..', 'backend', '.env'));
        const frontendEnv = fs.existsSync(path.join(__dirname, '..', 'frontend', '.env.local'));
        
        console.log(`Backend Environment: ${backendEnv ? '✅ Configured' : '❌ Missing'}`);
        console.log(`Frontend Environment: ${frontendEnv ? '✅ Configured' : '❌ Missing'}`);
        
        console.log(`Network IP: ${this.networkIP}`);
    }
}

// Handle command line arguments
const manager = new LocalDevelopmentManager();

// Graceful shutdown
process.on('SIGINT', () => {
    manager.stop();
});

process.on('SIGTERM', () => {
    manager.stop();
});

// Command line interface
const command = process.argv[2];

switch (command) {
    case 'setup':
        manager.setup();
        break;
    case 'start':
    case 'dev':
        manager.startDevelopment();
        break;
    case 'health':
        manager.healthCheck();
        break;
    case 'stop':
        manager.stop();
        break;
    default:
        console.log('Usage: node local-development.js <command>');
        console.log('Commands:');
        console.log('  setup  - Set up local development environment');
        console.log('  start  - Start development servers');
        console.log('  health - Run health check');
        console.log('  stop   - Stop all services');
        break;
}

module.exports = LocalDevelopmentManager;