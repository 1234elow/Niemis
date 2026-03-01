#!/usr/bin/env node

/**
 * NiEMIS Local Development Performance Monitoring
 * This script monitors the performance of the local development environment
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

const execAsync = promisify(exec);

class PerformanceMonitor {
    constructor() {
        this.config = {
            backend: {
                url: 'http://localhost:5000',
                healthPath: '/health',
                apiPath: '/api/health'
            },
            frontend: {
                url: 'http://localhost:3000',
                healthPath: '/'
            },
            database: {
                host: 'localhost',
                port: 5432,
                database: 'niemis_local',
                user: 'niemis_user'
            }
        };
        this.metrics = {
            timestamp: new Date().toISOString(),
            system: {},
            backend: {},
            frontend: {},
            database: {}
        };
        this.isWindows = os.platform() === 'win32';
    }

    /**
     * Get system metrics
     */
    async getSystemMetrics() {
        console.log('📊 Collecting system metrics...');
        
        this.metrics.system = {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            loadAverage: os.loadavg(),
            networkInterfaces: Object.keys(os.networkInterfaces()).length
        };

        // Get detailed CPU and memory usage
        try {
            if (this.isWindows) {
                const { stdout: cpuInfo } = await execAsync('wmic cpu get loadpercentage /value');
                const cpuMatch = cpuInfo.match(/LoadPercentage=(\d+)/);
                if (cpuMatch) {
                    this.metrics.system.cpuUsage = parseInt(cpuMatch[1]);
                }

                const { stdout: memInfo } = await execAsync('wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value');
                const totalMatch = memInfo.match(/TotalVisibleMemorySize=(\d+)/);
                const freeMatch = memInfo.match(/FreePhysicalMemory=(\d+)/);
                if (totalMatch && freeMatch) {
                    const total = parseInt(totalMatch[1]) * 1024;
                    const free = parseInt(freeMatch[1]) * 1024;
                    this.metrics.system.memoryUsage = ((total - free) / total) * 100;
                }
            }
        } catch (error) {
            console.warn('Could not get detailed system metrics:', error.message);
        }

        console.log('✅ System metrics collected');
    }

    /**
     * Test HTTP endpoint performance
     */
    async testEndpoint(url, name) {
        console.log(`🔍 Testing ${name} endpoint: ${url}`);
        
        const startTime = Date.now();
        
        try {
            const response = await fetch(url);
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            return {
                status: response.status,
                responseTime,
                success: response.ok,
                size: response.headers.get('content-length') || 0,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            return {
                status: 0,
                responseTime,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Monitor backend performance
     */
    async monitorBackend() {
        console.log('🔧 Monitoring backend performance...');
        
        const healthCheck = await this.testEndpoint(
            `${this.config.backend.url}${this.config.backend.healthPath}`,
            'Backend Health'
        );
        
        const apiCheck = await this.testEndpoint(
            `${this.config.backend.url}${this.config.backend.apiPath}`,
            'Backend API'
        );

        // Check if backend process is running
        let processInfo = null;
        try {
            if (this.isWindows) {
                const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
                const lines = stdout.split('\n');
                const nodeProcesses = lines.filter(line => line.includes('node.exe'));
                processInfo = {
                    running: nodeProcesses.length > 0,
                    processCount: nodeProcesses.length
                };
            }
        } catch (error) {
            console.warn('Could not check backend process:', error.message);
        }

        // Check backend logs for errors
        let logMetrics = null;
        try {
            const logPath = path.join(__dirname, '..', 'backend', 'logs', 'combined.log');
            if (fs.existsSync(logPath)) {
                const logContent = fs.readFileSync(logPath, 'utf8');
                const logLines = logContent.split('\n');
                const recentLines = logLines.slice(-100); // Last 100 lines
                
                logMetrics = {
                    totalLines: logLines.length,
                    recentErrors: recentLines.filter(line => line.includes('ERROR')).length,
                    recentWarnings: recentLines.filter(line => line.includes('WARN')).length,
                    lastLogTime: logLines[logLines.length - 2] || null
                };
            }
        } catch (error) {
            console.warn('Could not analyze backend logs:', error.message);
        }

        this.metrics.backend = {
            health: healthCheck,
            api: apiCheck,
            process: processInfo,
            logs: logMetrics
        };

        console.log('✅ Backend performance monitoring completed');
    }

    /**
     * Monitor frontend performance
     */
    async monitorFrontend() {
        console.log('🎨 Monitoring frontend performance...');
        
        const healthCheck = await this.testEndpoint(
            `${this.config.frontend.url}${this.config.frontend.healthPath}`,
            'Frontend'
        );

        // Check if frontend process is running
        let processInfo = null;
        try {
            if (this.isWindows) {
                const { stdout } = await execAsync('netstat -ano | findstr :3000');
                processInfo = {
                    running: stdout.trim().length > 0,
                    details: stdout.trim()
                };
            }
        } catch (error) {
            console.warn('Could not check frontend process:', error.message);
        }

        // Check frontend build status
        let buildInfo = null;
        try {
            const buildPath = path.join(__dirname, '..', 'frontend', 'build');
            if (fs.existsSync(buildPath)) {
                const stats = fs.statSync(buildPath);
                buildInfo = {
                    exists: true,
                    lastModified: stats.mtime.toISOString(),
                    size: this.getDirectorySize(buildPath)
                };
            } else {
                buildInfo = { exists: false };
            }
        } catch (error) {
            console.warn('Could not check frontend build:', error.message);
        }

        this.metrics.frontend = {
            health: healthCheck,
            process: processInfo,
            build: buildInfo
        };

        console.log('✅ Frontend performance monitoring completed');
    }

    /**
     * Monitor database performance
     */
    async monitorDatabase() {
        console.log('🗄️ Monitoring database performance...');
        
        let connectionTest = null;
        let queryPerformance = null;
        let databaseStats = null;

        try {
            // Test database connection
            const startTime = Date.now();
            const { stdout } = await execAsync(`psql -U ${this.config.database.user} -h ${this.config.database.host} -p ${this.config.database.port} -d ${this.config.database.database} -c "SELECT 1;"`);
            const endTime = Date.now();
            
            connectionTest = {
                success: stdout.includes('1'),
                responseTime: endTime - startTime,
                timestamp: new Date().toISOString()
            };

            // Get database statistics
            const statsQuery = `
                SELECT 
                    schemaname,
                    tablename,
                    attname,
                    n_distinct,
                    correlation
                FROM pg_stats 
                WHERE schemaname = 'public' 
                LIMIT 10;
            `;
            
            const { stdout: statsOutput } = await execAsync(`psql -U ${this.config.database.user} -h ${this.config.database.host} -p ${this.config.database.port} -d ${this.config.database.database} -c "${statsQuery}"`);
            
            databaseStats = {
                tablesAnalyzed: (statsOutput.match(/\n/g) || []).length - 3, // Subtract header lines
                timestamp: new Date().toISOString()
            };

            // Test query performance
            const perfQuery = `
                SELECT 
                    COUNT(*) as total_schools,
                    (SELECT COUNT(*) FROM students) as total_students,
                    (SELECT COUNT(*) FROM staff) as total_staff
                FROM schools;
            `;
            
            const queryStart = Date.now();
            const { stdout: perfOutput } = await execAsync(`psql -U ${this.config.database.user} -h ${this.config.database.host} -p ${this.config.database.port} -d ${this.config.database.database} -c "${perfQuery}"`);
            const queryEnd = Date.now();
            
            queryPerformance = {
                responseTime: queryEnd - queryStart,
                success: perfOutput.includes('total_schools'),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.warn('Database monitoring failed:', error.message);
            connectionTest = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }

        this.metrics.database = {
            connection: connectionTest,
            performance: queryPerformance,
            stats: databaseStats
        };

        console.log('✅ Database performance monitoring completed');
    }

    /**
     * Get directory size recursively
     */
    getDirectorySize(dirPath) {
        let totalSize = 0;
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    totalSize += this.getDirectorySize(filePath);
                } else {
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            console.warn(`Could not calculate size for ${dirPath}:`, error.message);
        }
        return totalSize;
    }

    /**
     * Generate performance report
     */
    generateReport() {
        console.log('\n📊 Performance Report');
        console.log('=====================');
        
        // System metrics
        console.log('\n🖥️  System Metrics:');
        console.log(`Platform: ${this.metrics.system.platform} (${this.metrics.system.arch})`);
        console.log(`CPUs: ${this.metrics.system.cpus}`);
        console.log(`Memory: ${Math.round(this.metrics.system.freeMemory / 1024 / 1024)}MB free / ${Math.round(this.metrics.system.totalMemory / 1024 / 1024)}MB total`);
        if (this.metrics.system.cpuUsage) {
            console.log(`CPU Usage: ${this.metrics.system.cpuUsage}%`);
        }
        if (this.metrics.system.memoryUsage) {
            console.log(`Memory Usage: ${Math.round(this.metrics.system.memoryUsage)}%`);
        }
        
        // Backend metrics
        console.log('\n🔧 Backend Metrics:');
        if (this.metrics.backend.health) {
            console.log(`Health Check: ${this.metrics.backend.health.success ? '✅' : '❌'} (${this.metrics.backend.health.responseTime}ms)`);
        }
        if (this.metrics.backend.api) {
            console.log(`API Response: ${this.metrics.backend.api.success ? '✅' : '❌'} (${this.metrics.backend.api.responseTime}ms)`);
        }
        if (this.metrics.backend.process) {
            console.log(`Process: ${this.metrics.backend.process.running ? '✅ Running' : '❌ Not Running'}`);
        }
        if (this.metrics.backend.logs) {
            console.log(`Recent Errors: ${this.metrics.backend.logs.recentErrors}`);
            console.log(`Recent Warnings: ${this.metrics.backend.logs.recentWarnings}`);
        }
        
        // Frontend metrics
        console.log('\n🎨 Frontend Metrics:');
        if (this.metrics.frontend.health) {
            console.log(`Health Check: ${this.metrics.frontend.health.success ? '✅' : '❌'} (${this.metrics.frontend.health.responseTime}ms)`);
        }
        if (this.metrics.frontend.process) {
            console.log(`Process: ${this.metrics.frontend.process.running ? '✅ Running' : '❌ Not Running'}`);
        }
        if (this.metrics.frontend.build) {
            console.log(`Build: ${this.metrics.frontend.build.exists ? '✅ Present' : '❌ Missing'}`);
            if (this.metrics.frontend.build.exists) {
                console.log(`Build Size: ${Math.round(this.metrics.frontend.build.size / 1024 / 1024)}MB`);
            }
        }
        
        // Database metrics
        console.log('\n🗄️  Database Metrics:');
        if (this.metrics.database.connection) {
            console.log(`Connection: ${this.metrics.database.connection.success ? '✅' : '❌'} (${this.metrics.database.connection.responseTime || 'N/A'}ms)`);
        }
        if (this.metrics.database.performance) {
            console.log(`Query Performance: ${this.metrics.database.performance.success ? '✅' : '❌'} (${this.metrics.database.performance.responseTime}ms)`);
        }
        
        // Overall health
        console.log('\n🏥 Overall Health:');
        const issues = [];
        if (this.metrics.backend.health && !this.metrics.backend.health.success) issues.push('Backend');
        if (this.metrics.frontend.health && !this.metrics.frontend.health.success) issues.push('Frontend');
        if (this.metrics.database.connection && !this.metrics.database.connection.success) issues.push('Database');
        
        if (issues.length === 0) {
            console.log('✅ All systems operational');
        } else {
            console.log(`❌ Issues detected: ${issues.join(', ')}`);
        }
        
        console.log('\n=====================\n');
    }

    /**
     * Save metrics to file
     */
    saveMetrics() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `performance-${timestamp}.json`;
        const filepath = path.join(__dirname, 'metrics', filename);
        
        // Ensure metrics directory exists
        const metricsDir = path.dirname(filepath);
        if (!fs.existsSync(metricsDir)) {
            fs.mkdirSync(metricsDir, { recursive: true });
        }
        
        fs.writeFileSync(filepath, JSON.stringify(this.metrics, null, 2));
        console.log(`📊 Metrics saved to: ${filepath}`);
    }

    /**
     * Run continuous monitoring
     */
    async startContinuousMonitoring(interval = 30000) {
        console.log(`🔄 Starting continuous monitoring (${interval/1000}s intervals)`);
        console.log('Press Ctrl+C to stop');
        
        const monitor = async () => {
            try {
                await this.runMonitoring();
                console.log(`⏱️  Next check in ${interval/1000} seconds...\n`);
            } catch (error) {
                console.error('❌ Monitoring error:', error);
            }
        };
        
        // Initial run
        await monitor();
        
        // Set up interval
        const intervalId = setInterval(monitor, interval);
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            clearInterval(intervalId);
            console.log('\n🛑 Monitoring stopped');
            process.exit(0);
        });
    }

    /**
     * Run full monitoring suite
     */
    async runMonitoring() {
        console.log('🚀 Starting NiEMIS Performance Monitoring');
        console.log('=========================================');
        
        await this.getSystemMetrics();
        await this.monitorBackend();
        await this.monitorFrontend();
        await this.monitorDatabase();
        
        this.generateReport();
        this.saveMetrics();
        
        return this.metrics;
    }
}

// Command line interface
const command = process.argv[2];
const monitor = new PerformanceMonitor();

switch (command) {
    case 'once':
        monitor.runMonitoring();
        break;
    case 'continuous':
        const interval = parseInt(process.argv[3]) || 30000;
        monitor.startContinuousMonitoring(interval);
        break;
    case 'system':
        monitor.getSystemMetrics().then(() => {
            console.log(JSON.stringify(monitor.metrics.system, null, 2));
        });
        break;
    case 'backend':
        monitor.monitorBackend().then(() => {
            console.log(JSON.stringify(monitor.metrics.backend, null, 2));
        });
        break;
    case 'frontend':
        monitor.monitorFrontend().then(() => {
            console.log(JSON.stringify(monitor.metrics.frontend, null, 2));
        });
        break;
    case 'database':
        monitor.monitorDatabase().then(() => {
            console.log(JSON.stringify(monitor.metrics.database, null, 2));
        });
        break;
    default:
        console.log('Usage: node performance-monitoring.js <command>');
        console.log('Commands:');
        console.log('  once       - Run monitoring once');
        console.log('  continuous - Run continuous monitoring');
        console.log('  system     - Monitor system metrics only');
        console.log('  backend    - Monitor backend only');
        console.log('  frontend   - Monitor frontend only');
        console.log('  database   - Monitor database only');
        break;
}

module.exports = PerformanceMonitor;