const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Simple test server for real-time functionality
const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Mock user for testing
const mockUser = {
    id: 1,
    username: 'testuser',
    role: 'teacher',
    schoolId: 1
};

// Simple authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
        return next(new Error('No token provided'));
    }
    
    try {
        // For testing, we'll just validate the token exists
        // In production, this would verify the JWT
        socket.user = mockUser;
        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
});

// Connection handler
io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected with socket ID: ${socket.id}`);
    
    // Send welcome message
    socket.emit('connected', {
        message: 'Connected to real-time server',
        userId: socket.user.id,
        timestamp: new Date().toISOString()
    });
    
    // Join user to their school room
    socket.join(`school_${socket.user.schoolId}`);
    
    // Handle student room joining
    socket.on('join_student_room', (studentId) => {
        const roomName = `student_${studentId}`;
        socket.join(roomName);
        console.log(`User ${socket.user.username} joined room: ${roomName}`);
        
        socket.emit('joined_student_room', {
            roomName,
            studentId,
            timestamp: new Date().toISOString()
        });
    });
    
    // Handle student room leaving
    socket.on('leave_student_room', (studentId) => {
        const roomName = `student_${studentId}`;
        socket.leave(roomName);
        console.log(`User ${socket.user.username} left room: ${roomName}`);
    });
    
    // Handle student updates
    socket.on('student_update', (data) => {
        console.log('Received student update:', data);
        
        // Simulate processing and broadcast to relevant rooms
        const roomName = `student_${data.studentId}`;
        const updateData = {
            ...data,
            updatedBy: socket.user.username,
            processedAt: new Date().toISOString()
        };
        
        // Broadcast to all clients in the student room
        io.to(roomName).emit('student_updated', updateData);
        
        // Also broadcast to school room
        io.to(`school_${socket.user.schoolId}`).emit('student_updated', updateData);
        
        console.log(`Broadcasted student update to room: ${roomName}`);
    });
    
    // Handle grade updates
    socket.on('grade_update', (data) => {
        console.log('Received grade update:', data);
        
        const roomName = `student_${data.studentId}`;
        const updateData = {
            ...data,
            updatedBy: socket.user.username,
            processedAt: new Date().toISOString()
        };
        
        // Broadcast to all clients in the student room
        io.to(roomName).emit('grade_updated', updateData);
        
        // Also broadcast to school room
        io.to(`school_${socket.user.schoolId}`).emit('grade_updated', updateData);
        
        console.log(`Broadcasted grade update to room: ${roomName}`);
    });
    
    // Handle bulk grade updates
    socket.on('bulk_grade_update', (data) => {
        console.log('Received bulk grade update:', data.grades.length, 'grades');
        
        data.grades.forEach(grade => {
            const roomName = `student_${grade.studentId}`;
            const updateData = {
                ...grade,
                updatedBy: socket.user.username,
                processedAt: new Date().toISOString()
            };
            
            // Broadcast to student room
            io.to(roomName).emit('grade_updated', updateData);
        });
        
        // Broadcast bulk update notification to school
        io.to(`school_${socket.user.schoolId}`).emit('bulk_update_completed', {
            count: data.grades.length,
            updatedBy: socket.user.username,
            timestamp: new Date().toISOString()
        });
        
        console.log(`Broadcasted bulk grade update: ${data.grades.length} grades`);
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log(`User ${socket.user.username} disconnected: ${reason}`);
    });
    
    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`Real-time test server running on port ${PORT}`);
    console.log('WebSocket server ready for connections');
    console.log('Connect from frontend using: http://localhost:3000');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down real-time test server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Simulate some real-time updates for testing
setInterval(() => {
    // Simulate a random student update
    const studentId = Math.floor(Math.random() * 10) + 1;
    const roomName = `student_${studentId}`;
    
    io.to(roomName).emit('student_updated', {
        studentId,
        updates: {
            lastActive: new Date().toISOString(),
            onlineStatus: Math.random() > 0.5 ? 'online' : 'offline'
        },
        updatedBy: 'system',
        timestamp: new Date().toISOString(),
        version: Math.floor(Math.random() * 100)
    });
    
    console.log(`Sent automated update to student ${studentId}`);
}, 10000); // Every 10 seconds