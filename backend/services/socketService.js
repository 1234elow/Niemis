const { Server } = require('socket.io');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class SocketService {
    constructor() {
        this.io = null;
        this.redis = null;
        this.redisPub = null;
        this.redisSub = null;
        this.connectedUsers = new Map(); // userId -> socket mapping
        this.userSessions = new Map(); // socketId -> user info
        this.roomSubscriptions = new Map(); // room -> Set of userIds
        
        // Rate limiting for updates
        this.updateQueue = new Map(); // userId -> last update time
        this.RATE_LIMIT_MS = 100; // Min time between updates (100ms)
    }

    async initialize(server) {
        try {
            // Initialize Socket.IO
            this.io = new Server(server, {
                cors: {
                    origin: process.env.CLIENT_URL || "http://localhost:3000",
                    methods: ["GET", "POST"],
                    credentials: true
                },
                transports: ['websocket', 'polling'],
                upgradeTimeout: 10000,
                pingTimeout: 5000,
                pingInterval: 25000
            });

            // Initialize Redis connections
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true
            };

            this.redis = new Redis(redisConfig);
            this.redisPub = new Redis(redisConfig);
            this.redisSub = new Redis(redisConfig);

            // Connect to Redis
            await this.redis.connect();
            await this.redisPub.connect();
            await this.redisSub.connect();

            // Setup Redis pub/sub for horizontal scaling
            this.redisSub.subscribe('student_updates', 'school_updates', 'grade_updates');
            this.redisSub.on('message', (channel, message) => {
                this.handleRedisMessage(channel, message);
            });

            // Setup Socket.IO event handlers
            this.setupSocketHandlers();

            logger.info('Socket.IO and Redis initialized successfully');
            return true;

        } catch (error) {
            logger.error('Failed to initialize Socket service:', error);
            return false;
        }
    }

    setupSocketHandlers() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.query.token;
                
                if (!token) {
                    throw new Error('No authentication token provided');
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await this.getUserFromToken(decoded);
                
                if (!user) {
                    throw new Error('Invalid user');
                }

                socket.userId = user.id;
                socket.userRole = user.role;
                socket.schoolId = user.school_id;
                socket.userData = user;

                next();
            } catch (error) {
                logger.warn('Socket authentication failed:', error.message);
                next(new Error('Authentication failed'));
            }
        });

        // Connection handler
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }

    handleConnection(socket) {
        const userId = socket.userId;
        const userRole = socket.userRole;
        const schoolId = socket.schoolId;

        // Track connected user
        this.connectedUsers.set(userId, socket);
        this.userSessions.set(socket.id, {
            userId,
            userRole,
            schoolId,
            connectedAt: new Date()
        });

        // Join appropriate rooms based on role
        this.joinUserRooms(socket);

        logger.info(`User ${userId} (${userRole}) connected via Socket.IO`);

        // Socket event handlers
        socket.on('join_student_room', (studentId) => {
            this.handleJoinStudentRoom(socket, studentId);
        });

        socket.on('leave_student_room', (studentId) => {
            this.handleLeaveStudentRoom(socket, studentId);
        });

        socket.on('student_update', (data) => {
            this.handleStudentUpdate(socket, data);
        });

        socket.on('grade_update', (data) => {
            this.handleGradeUpdate(socket, data);
        });

        socket.on('bulk_grade_update', (data) => {
            this.handleBulkGradeUpdate(socket, data);
        });

        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });

        socket.on('error', (error) => {
            logger.error(`Socket error for user ${userId}:`, error);
        });

        // Send initial connection confirmation
        socket.emit('connected', {
            userId,
            userRole,
            schoolId,
            timestamp: new Date().toISOString()
        });
    }

    joinUserRooms(socket) {
        const { userId, userRole, schoolId } = socket;

        // All users join their personal room
        socket.join(`user_${userId}`);

        // Role-based room joining
        switch (userRole) {
            case 'super_admin':
                socket.join('super_admin_room');
                socket.join('all_schools');
                break;
            case 'admin':
            case 'teacher':
                if (schoolId) {
                    socket.join(`school_${schoolId}`);
                }
                break;
            case 'student':
                if (schoolId) {
                    socket.join(`school_${schoolId}`);
                    socket.join(`student_${userId}`);
                }
                break;
            case 'parent':
                // Parents join rooms for their children
                socket.join(`parent_${userId}`);
                break;
        }
    }

    handleJoinStudentRoom(socket, studentId) {
        const { userRole, schoolId } = socket;
        
        // Verify permission to access student data
        if (!this.canAccessStudent(socket.userData, studentId)) {
            socket.emit('error', { message: 'Permission denied to access student data' });
            return;
        }

        const roomName = `student_${studentId}`;
        socket.join(roomName);

        // Track room subscriptions
        if (!this.roomSubscriptions.has(roomName)) {
            this.roomSubscriptions.set(roomName, new Set());
        }
        this.roomSubscriptions.get(roomName).add(socket.userId);

        logger.info(`User ${socket.userId} joined student room ${studentId}`);
        
        socket.emit('joined_student_room', { studentId, roomName });
    }

    handleLeaveStudentRoom(socket, studentId) {
        const roomName = `student_${studentId}`;
        socket.leave(roomName);

        // Update room subscriptions
        if (this.roomSubscriptions.has(roomName)) {
            this.roomSubscriptions.get(roomName).delete(socket.userId);
        }

        logger.info(`User ${socket.userId} left student room ${studentId}`);
    }

    async handleStudentUpdate(socket, data) {
        try {
            // Rate limiting
            if (!this.checkRateLimit(socket.userId)) {
                socket.emit('rate_limited', { message: 'Too many updates, please slow down' });
                return;
            }

            // Validate and sanitize data
            const validatedData = this.validateStudentUpdate(data);
            if (!validatedData) {
                socket.emit('validation_error', { message: 'Invalid update data' });
                return;
            }

            // Check permissions
            if (!this.canAccessStudent(socket.userData, validatedData.studentId)) {
                socket.emit('error', { message: 'Permission denied' });
                return;
            }

            // Add metadata
            const updateData = {
                ...validatedData,
                updatedBy: socket.userId,
                updatedAt: new Date().toISOString(),
                version: data.version || 1
            };

            // Broadcast to Redis for horizontal scaling
            await this.redisPub.publish('student_updates', JSON.stringify(updateData));

            // Broadcast to local clients
            this.broadcastStudentUpdate(updateData);

            logger.info(`Student update by user ${socket.userId}:`, updateData);

        } catch (error) {
            logger.error('Error handling student update:', error);
            socket.emit('error', { message: 'Failed to process update' });
        }
    }

    async handleGradeUpdate(socket, data) {
        try {
            // Rate limiting
            if (!this.checkRateLimit(socket.userId)) {
                socket.emit('rate_limited', { message: 'Too many updates, please slow down' });
                return;
            }

            // Validate grade update data
            const validatedData = this.validateGradeUpdate(data);
            if (!validatedData) {
                socket.emit('validation_error', { message: 'Invalid grade data' });
                return;
            }

            // Check permissions
            if (!this.canUpdateGrades(socket.userData, validatedData.studentId)) {
                socket.emit('error', { message: 'Permission denied to update grades' });
                return;
            }

            // Add metadata
            const updateData = {
                ...validatedData,
                updatedBy: socket.userId,
                updatedAt: new Date().toISOString(),
                version: data.version || 1
            };

            // Broadcast to Redis
            await this.redisPub.publish('grade_updates', JSON.stringify(updateData));

            // Broadcast to local clients
            this.broadcastGradeUpdate(updateData);

            logger.info(`Grade update by user ${socket.userId}:`, updateData);

        } catch (error) {
            logger.error('Error handling grade update:', error);
            socket.emit('error', { message: 'Failed to process grade update' });
        }
    }

    async handleBulkGradeUpdate(socket, data) {
        try {
            // Validate bulk update
            if (!data.grades || !Array.isArray(data.grades) || data.grades.length > 50) {
                socket.emit('validation_error', { message: 'Invalid bulk grade data' });
                return;
            }

            // Process each grade update
            for (const gradeData of data.grades) {
                await this.handleGradeUpdate(socket, gradeData);
            }

        } catch (error) {
            logger.error('Error handling bulk grade update:', error);
            socket.emit('error', { message: 'Failed to process bulk update' });
        }
    }

    handleDisconnect(socket) {
        const userId = socket.userId;
        
        // Clean up tracking
        this.connectedUsers.delete(userId);
        this.userSessions.delete(socket.id);
        
        // Clean up room subscriptions
        for (const [roomName, userIds] of this.roomSubscriptions.entries()) {
            userIds.delete(userId);
            if (userIds.size === 0) {
                this.roomSubscriptions.delete(roomName);
            }
        }

        logger.info(`User ${userId} disconnected from Socket.IO`);
    }

    handleRedisMessage(channel, message) {
        try {
            const data = JSON.parse(message);
            
            switch (channel) {
                case 'student_updates':
                    this.broadcastStudentUpdate(data);
                    break;
                case 'grade_updates':
                    this.broadcastGradeUpdate(data);
                    break;
                case 'school_updates':
                    this.broadcastSchoolUpdate(data);
                    break;
            }
        } catch (error) {
            logger.error('Error handling Redis message:', error);
        }
    }

    broadcastStudentUpdate(data) {
        const roomName = `student_${data.studentId}`;
        
        this.io.to(roomName).emit('student_updated', {
            studentId: data.studentId,
            updates: data.updates,
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt,
            version: data.version
        });

        // Also broadcast to school room
        if (data.schoolId) {
            this.io.to(`school_${data.schoolId}`).emit('student_updated', data);
        }
    }

    broadcastGradeUpdate(data) {
        const roomName = `student_${data.studentId}`;
        
        this.io.to(roomName).emit('grade_updated', {
            studentId: data.studentId,
            subjectId: data.subjectId,
            grade: data.grade,
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt,
            version: data.version
        });

        // Also broadcast to school room for teachers
        if (data.schoolId) {
            this.io.to(`school_${data.schoolId}`).emit('grade_updated', data);
        }
    }

    broadcastSchoolUpdate(data) {
        this.io.to(`school_${data.schoolId}`).emit('school_updated', data);
    }

    checkRateLimit(userId) {
        const now = Date.now();
        const lastUpdate = this.updateQueue.get(userId) || 0;
        
        if (now - lastUpdate < this.RATE_LIMIT_MS) {
            return false;
        }
        
        this.updateQueue.set(userId, now);
        return true;
    }

    validateStudentUpdate(data) {
        // Basic validation - expand as needed
        if (!data.studentId || !data.updates) {
            return null;
        }

        // Sanitize updates object
        const allowedFields = ['first_name', 'last_name', 'grade_level', 'address', 'phone'];
        const sanitizedUpdates = {};
        
        for (const field of allowedFields) {
            if (data.updates[field] !== undefined) {
                sanitizedUpdates[field] = data.updates[field];
            }
        }

        return {
            studentId: data.studentId,
            updates: sanitizedUpdates,
            version: data.version
        };
    }

    validateGradeUpdate(data) {
        // Basic validation for grade updates
        if (!data.studentId || !data.subjectId || data.grade === undefined) {
            return null;
        }

        // Validate grade value (0-100)
        const grade = parseFloat(data.grade);
        if (isNaN(grade) || grade < 0 || grade > 100) {
            return null;
        }

        return {
            studentId: data.studentId,
            subjectId: data.subjectId,
            grade: grade,
            termId: data.termId,
            classId: data.classId,
            version: data.version
        };
    }

    canAccessStudent(userData, studentId) {
        // Implement permission logic based on user role
        switch (userData.role) {
            case 'super_admin':
                return true;
            case 'admin':
            case 'teacher':
                // Check if student belongs to user's school
                return userData.school_id; // Simplified - should check actual student school
            case 'student':
                return userData.id === studentId;
            case 'parent':
                // Check if student is user's child
                return false; // Implement parent-child relationship check
            default:
                return false;
        }
    }

    canUpdateGrades(userData, studentId) {
        // Only teachers and admins can update grades
        return ['teacher', 'admin', 'super_admin'].includes(userData.role);
    }

    async getUserFromToken(decoded) {
        // Implement user lookup from token
        // This should integrate with your existing user authentication
        return {
            id: decoded.userId || decoded.id,
            role: decoded.role,
            school_id: decoded.schoolId || decoded.school_id,
            // Add other user properties as needed
        };
    }

    // Utility methods
    getConnectedUserCount() {
        return this.connectedUsers.size;
    }

    getUsersInRoom(roomName) {
        return this.roomSubscriptions.get(roomName) || new Set();
    }

    async broadcastToRole(role, event, data) {
        const roomName = `${role}_room`;
        this.io.to(roomName).emit(event, data);
    }

    async broadcastToSchool(schoolId, event, data) {
        const roomName = `school_${schoolId}`;
        this.io.to(roomName).emit(event, data);
    }

    async shutdown() {
        if (this.redis) await this.redis.quit();
        if (this.redisPub) await this.redisPub.quit();
        if (this.redisSub) await this.redisSub.quit();
        if (this.io) this.io.close();
        logger.info('Socket service shutdown complete');
    }
}

module.exports = new SocketService();