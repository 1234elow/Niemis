#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, 'server.pid');

function writePid(pid) {
    fs.writeFileSync(PID_FILE, pid.toString());
}

function readPid() {
    try {
        return fs.readFileSync(PID_FILE, 'utf8').trim();
    } catch (err) {
        return null;
    }
}

function deletePid() {
    try {
        fs.unlinkSync(PID_FILE);
    } catch (err) {
        // Ignore if file doesn't exist
    }
}

function stopServer() {
    const pid = readPid();
    if (pid) {
        try {
            process.kill(pid, 'SIGTERM');
            console.log(`Server with PID ${pid} stopped successfully`);
            deletePid();
            return true;
        } catch (err) {
            console.log(`Server with PID ${pid} not found or already stopped`);
            deletePid();
            return false;
        }
    } else {
        console.log('No server PID found');
        return false;
    }
}

function startServer() {
    // First, try to stop any existing server
    stopServer();
    
    const { spawn } = require('child_process');
    
    console.log('Starting NiEMIS Backend Server...');
    const server = spawn('node', ['server.js'], {
        cwd: __dirname,
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore']
    });
    
    server.unref();
    writePid(server.pid);
    
    console.log(`Server started with PID: ${server.pid}`);
    console.log('Use "node server-manager.js stop" to stop the server');
}

function serverStatus() {
    const pid = readPid();
    if (pid) {
        try {
            process.kill(pid, 0); // Test if process exists
            console.log(`Server is running with PID: ${pid}`);
            return true;
        } catch (err) {
            console.log(`Server PID ${pid} found but process not running`);
            deletePid();
            return false;
        }
    } else {
        console.log('Server is not running');
        return false;
    }
}

const command = process.argv[2];

switch (command) {
    case 'start':
        startServer();
        break;
    case 'stop':
        stopServer();
        break;
    case 'restart':
        stopServer();
        setTimeout(startServer, 1000);
        break;
    case 'status':
        serverStatus();
        break;
    default:
        console.log('Usage: node server-manager.js [start|stop|restart|status]');
        console.log('  start   - Start the server');
        console.log('  stop    - Stop the server');
        console.log('  restart - Restart the server');
        console.log('  status  - Check server status');
}