import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/socketService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for real-time updates
 */
export const useRealTimeUpdates = (options = {}) => {
    const { user } = useAuth();
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const connectionAttempted = useRef(false);

    const {
        autoConnect = true,
        onStudentUpdate,
        onGradeUpdate,
        onSchoolUpdate,
        onError,
        onConnected,
        onDisconnected
    } = options;

    // Connect to WebSocket
    const connect = useCallback(async () => {
        if (!user || connectionAttempted.current) {
            return;
        }

        connectionAttempted.current = true;
        
        try {
            await socketService.connect();
            setConnected(true);
            setError(null);
            onConnected?.();
        } catch (err) {
            setError(err.message);
            setConnected(false);
            onError?.(err);
            connectionAttempted.current = false;
        }
    }, [user, onConnected, onError]);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        socketService.disconnect();
        setConnected(false);
        setError(null);
        connectionAttempted.current = false;
        onDisconnected?.();
    }, [onDisconnected]);

    // Setup event handlers
    useEffect(() => {
        if (!connected) return;

        const unsubscribers = [];

        // Connection events
        unsubscribers.push(
            socketService.on('connected', () => {
                setConnected(true);
                setError(null);
                onConnected?.();
            })
        );

        unsubscribers.push(
            socketService.on('disconnected', (data) => {
                setConnected(false);
                setError(data.reason);
                onDisconnected?.(data);
            })
        );

        unsubscribers.push(
            socketService.on('reconnected', () => {
                setConnected(true);
                setError(null);
                onConnected?.();
            })
        );

        // Data update events
        unsubscribers.push(
            socketService.on('student_updated', (data) => {
                setLastUpdate({ type: 'student', data, timestamp: new Date() });
                onStudentUpdate?.(data);
            })
        );

        unsubscribers.push(
            socketService.on('grade_updated', (data) => {
                setLastUpdate({ type: 'grade', data, timestamp: new Date() });
                onGradeUpdate?.(data);
            })
        );

        unsubscribers.push(
            socketService.on('school_updated', (data) => {
                setLastUpdate({ type: 'school', data, timestamp: new Date() });
                onSchoolUpdate?.(data);
            })
        );

        // Error events
        unsubscribers.push(
            socketService.on('error', (err) => {
                setError(err.message);
                onError?.(err);
            })
        );

        unsubscribers.push(
            socketService.on('rate_limited', (data) => {
                setError('Rate limited: ' + data.message);
                onError?.(new Error(data.message));
            })
        );

        unsubscribers.push(
            socketService.on('validation_error', (data) => {
                setError('Validation error: ' + data.message);
                onError?.(new Error(data.message));
            })
        );

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }, [connected, onStudentUpdate, onGradeUpdate, onSchoolUpdate, onError, onConnected, onDisconnected]);

    // Auto-connect when user is available
    useEffect(() => {
        if (autoConnect && user && !connected && !connectionAttempted.current) {
            connect();
        }
    }, [autoConnect, user, connected, connect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        connected,
        error,
        lastUpdate,
        connect,
        disconnect,
        connectionInfo: socketService.getConnectionInfo()
    };
};

/**
 * Hook for student-specific real-time updates
 */
export const useStudentRealTime = (studentId, options = {}) => {
    const [studentData, setStudentData] = useState(null);
    const [grades, setGrades] = useState(new Map());
    const [version, setVersion] = useState(1);
    const joinedRoom = useRef(false);

    const {
        onStudentUpdate = (data) => {
            if (data.studentId === studentId) {
                setStudentData(prev => ({ ...prev, ...data.updates }));
                setVersion(data.version || version + 1);
            }
        },
        onGradeUpdate = (data) => {
            if (data.studentId === studentId) {
                setGrades(prev => new Map(prev).set(data.subjectId, {
                    grade: data.grade,
                    updatedAt: data.updatedAt,
                    updatedBy: data.updatedBy
                }));
            }
        },
        ...otherOptions
    } = options;

    const realTimeUpdates = useRealTimeUpdates({
        onStudentUpdate,
        onGradeUpdate,
        ...otherOptions
    });

    // Join student room when connected
    useEffect(() => {
        if (realTimeUpdates.connected && studentId && !joinedRoom.current) {
            socketService.joinStudentRoom(studentId);
            joinedRoom.current = true;
        }
    }, [realTimeUpdates.connected, studentId]);

    // Leave room on cleanup
    useEffect(() => {
        return () => {
            if (studentId && joinedRoom.current) {
                socketService.leaveStudentRoom(studentId);
                joinedRoom.current = false;
            }
        };
    }, [studentId]);

    // Update student data
    const updateStudent = useCallback((updates) => {
        if (!realTimeUpdates.connected) {
            throw new Error('WebSocket not connected');
        }
        
        socketService.debouncedStudentUpdate(studentId, updates, version);
    }, [realTimeUpdates.connected, studentId, version]);

    // Update grade
    const updateGrade = useCallback((subjectId, grade, additionalData = {}) => {
        if (!realTimeUpdates.connected) {
            throw new Error('WebSocket not connected');
        }
        
        socketService.debouncedGradeUpdate(studentId, subjectId, grade, version, additionalData);
    }, [realTimeUpdates.connected, studentId, version]);

    return {
        ...realTimeUpdates,
        studentData,
        grades,
        version,
        updateStudent,
        updateGrade
    };
};

/**
 * Hook for bulk grade updates
 */
export const useBulkGradeUpdates = (options = {}) => {
    const [pendingUpdates, setPendingUpdates] = useState(new Map());
    const [lastSync, setLastSync] = useState(null);
    const syncTimeout = useRef(null);

    const realTimeUpdates = useRealTimeUpdates(options);

    // Add grade to pending updates
    const addGradeUpdate = useCallback((studentId, subjectId, grade, additionalData = {}) => {
        setPendingUpdates(prev => {
            const key = `${studentId}_${subjectId}`;
            const newUpdates = new Map(prev);
            newUpdates.set(key, {
                studentId,
                subjectId,
                grade,
                ...additionalData,
                timestamp: new Date().toISOString()
            });
            return newUpdates;
        });

        // Auto-sync after delay
        if (syncTimeout.current) {
            clearTimeout(syncTimeout.current);
        }
        
        syncTimeout.current = setTimeout(() => {
            syncUpdates();
        }, 1000); // Sync after 1 second of inactivity
    }, []);

    // Sync all pending updates
    const syncUpdates = useCallback(() => {
        if (!realTimeUpdates.connected || pendingUpdates.size === 0) {
            return;
        }

        const updates = Array.from(pendingUpdates.values());
        socketService.bulkUpdateGrades(updates);
        
        setPendingUpdates(new Map());
        setLastSync(new Date());
        
        if (syncTimeout.current) {
            clearTimeout(syncTimeout.current);
            syncTimeout.current = null;
        }
    }, [realTimeUpdates.connected, pendingUpdates]);

    // Force sync
    const forcSync = useCallback(() => {
        syncUpdates();
    }, [syncUpdates]);

    // Clear pending updates
    const clearPending = useCallback(() => {
        setPendingUpdates(new Map());
        if (syncTimeout.current) {
            clearTimeout(syncTimeout.current);
            syncTimeout.current = null;
        }
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            if (syncTimeout.current) {
                clearTimeout(syncTimeout.current);
            }
        };
    }, []);

    return {
        ...realTimeUpdates,
        pendingUpdates: Array.from(pendingUpdates.values()),
        pendingCount: pendingUpdates.size,
        lastSync,
        addGradeUpdate,
        syncUpdates: forcSync,
        clearPending
    };
};

/**
 * Hook for connection status indicator
 */
export const useConnectionStatus = () => {
    const [status, setStatus] = useState('disconnected');
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        const unsubscribers = [];

        unsubscribers.push(
            socketService.on('connected', () => {
                setStatus('connected');
                setRetryCount(0);
            })
        );

        unsubscribers.push(
            socketService.on('disconnected', () => {
                setStatus('disconnected');
            })
        );

        unsubscribers.push(
            socketService.on('reconnected', () => {
                setStatus('connected');
                setRetryCount(0);
            })
        );

        unsubscribers.push(
            socketService.on('reconnect_error', (data) => {
                setStatus('reconnecting');
                setRetryCount(data.attempts);
            })
        );

        unsubscribers.push(
            socketService.on('reconnect_failed', () => {
                setStatus('failed');
            })
        );

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }, []);

    return {
        status,
        retryCount,
        isConnected: status === 'connected',
        isConnecting: status === 'reconnecting',
        connectionInfo: socketService.getConnectionInfo()
    };
};