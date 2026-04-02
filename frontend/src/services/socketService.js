import { io } from 'socket.io-client';
import { authService } from './authService';

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.eventHandlers = new Map();
        this.roomSubscriptions = new Set();
        this.updateQueue = new Map();
        this.debounceTimeout = 300; // ms
    }

    /**
     * Connect to WebSocket server
     */
    async connect() {
        try {
            const token = authService.getToken();
            if (!token) {
                throw new Error('No authentication token available');
            }

            const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL;
            const configuredApiUrl = import.meta.env.VITE_API_URL;
            const serverUrl = configuredSocketUrl
                || (configuredApiUrl ? configuredApiUrl.replace(/\/api\/?$/, '') : window.location.origin);
            
            this.socket = io(serverUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
                timeout: 10000,
                autoConnect: false
            });

            this.setupEventHandlers();
            this.socket.connect();

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.socket.on('connected', (data) => {
                    clearTimeout(timeout);
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    console.log('WebSocket connected:', data);
                    resolve(data);
                });

                this.socket.on('connect_error', (error) => {
                    clearTimeout(timeout);
                    console.error('WebSocket connection error:', error);
                    reject(error);
                });
            });

        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            throw error;
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.roomSubscriptions.clear();
            console.log('WebSocket disconnected');
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        this.socket.on('connect', () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            console.log('WebSocket connected');
            this.triggerEvent('connected', { timestamp: new Date() });
        });

        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            console.log('WebSocket disconnected:', reason);
            this.triggerEvent('disconnected', { reason, timestamp: new Date() });
        });

        this.socket.on('reconnect', (attemptNumber) => {
            this.connected = true;
            this.reconnectAttempts = 0;
            console.log('WebSocket reconnected after', attemptNumber, 'attempts');
            this.triggerEvent('reconnected', { attemptNumber, timestamp: new Date() });
        });

        this.socket.on('reconnect_error', (error) => {
            this.reconnectAttempts++;
            console.error('WebSocket reconnection error:', error);
            this.triggerEvent('reconnect_error', { error, attempts: this.reconnectAttempts });
        });

        this.socket.on('reconnect_failed', () => {
            console.error('WebSocket reconnection failed');
            this.triggerEvent('reconnect_failed', { attempts: this.reconnectAttempts });
        });

        // Real-time data handlers
        this.socket.on('student_updated', (data) => {
            console.log('Student updated:', data);
            this.triggerEvent('student_updated', data);
        });

        this.socket.on('grade_updated', (data) => {
            console.log('Grade updated:', data);
            this.triggerEvent('grade_updated', data);
        });

        this.socket.on('school_updated', (data) => {
            console.log('School updated:', data);
            this.triggerEvent('school_updated', data);
        });

        // Error handlers
        this.socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.triggerEvent('error', error);
        });

        this.socket.on('rate_limited', (data) => {
            console.warn('Rate limited:', data);
            this.triggerEvent('rate_limited', data);
        });

        this.socket.on('validation_error', (data) => {
            console.error('Validation error:', data);
            this.triggerEvent('validation_error', data);
        });

        // Room management
        this.socket.on('joined_student_room', (data) => {
            console.log('Joined student room:', data);
            this.roomSubscriptions.add(data.roomName);
            this.triggerEvent('joined_student_room', data);
        });
    }

    /**
     * Join a student room for real-time updates
     */
    joinStudentRoom(studentId) {
        if (!this.connected) {
            console.warn('WebSocket not connected, cannot join room');
            return;
        }

        this.socket.emit('join_student_room', studentId);
    }

    /**
     * Leave a student room
     */
    leaveStudentRoom(studentId) {
        if (!this.connected) {
            return;
        }

        this.socket.emit('leave_student_room', studentId);
    }

    /**
     * Send student update
     */
    updateStudent(studentId, updates, version = 1) {
        if (!this.connected) {
            console.warn('WebSocket not connected, cannot send update');
            return;
        }

        const updateData = {
            studentId,
            updates,
            version,
            timestamp: new Date().toISOString()
        };

        this.socket.emit('student_update', updateData);
    }

    /**
     * Send grade update
     */
    updateGrade(studentId, subjectId, grade, version = 1, additionalData = {}) {
        if (!this.connected) {
            console.warn('WebSocket not connected, cannot send grade update');
            return;
        }

        const updateData = {
            studentId,
            subjectId,
            grade,
            version,
            timestamp: new Date().toISOString(),
            ...additionalData
        };

        this.socket.emit('grade_update', updateData);
    }

    /**
     * Send bulk grade updates
     */
    bulkUpdateGrades(grades) {
        if (!this.connected) {
            console.warn('WebSocket not connected, cannot send bulk update');
            return;
        }

        const updateData = {
            grades,
            timestamp: new Date().toISOString()
        };

        this.socket.emit('bulk_grade_update', updateData);
    }

    /**
     * Debounced update function
     */
    debouncedUpdate(key, updateFn, delay = this.debounceTimeout) {
        // Clear existing timeout
        if (this.updateQueue.has(key)) {
            clearTimeout(this.updateQueue.get(key));
        }

        // Set new timeout
        const timeoutId = setTimeout(() => {
            updateFn();
            this.updateQueue.delete(key);
        }, delay);

        this.updateQueue.set(key, timeoutId);
    }

    /**
     * Debounced student update
     */
    debouncedStudentUpdate(studentId, updates, version = 1) {
        const key = `student_${studentId}`;
        this.debouncedUpdate(key, () => {
            this.updateStudent(studentId, updates, version);
        });
    }

    /**
     * Debounced grade update
     */
    debouncedGradeUpdate(studentId, subjectId, grade, version = 1, additionalData = {}) {
        const key = `grade_${studentId}_${subjectId}`;
        this.debouncedUpdate(key, () => {
            this.updateGrade(studentId, subjectId, grade, version, additionalData);
        });
    }

    /**
     * Register event handler
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);

        // Return unsubscribe function
        return () => {
            this.off(event, handler);
        };
    }

    /**
     * Unregister event handler
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }
    }

    /**
     * Trigger event handlers
     */
    triggerEvent(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Error in event handler:', error);
                }
            });
        }
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }

    /**
     * Get connection info
     */
    getConnectionInfo() {
        return {
            connected: this.connected,
            reconnectAttempts: this.reconnectAttempts,
            roomSubscriptions: Array.from(this.roomSubscriptions),
            socketId: this.socket?.id,
            transport: this.socket?.io?.engine?.transport?.name
        };
    }

    /**
     * Force reconnection
     */
    forceReconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket.connect();
        }
    }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
export { socketService };
