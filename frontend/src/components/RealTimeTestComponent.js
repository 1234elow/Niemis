import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button, TextField, Box, Chip, Alert } from '@mui/material';
import { useRealTimeUpdates, useStudentRealTime, useConnectionStatus } from '../hooks/useRealTimeUpdates';

const RealTimeTestComponent = () => {
    const [testStudentId, setTestStudentId] = useState('123');
    const [testGrade, setTestGrade] = useState('A');
    const [testSubject, setTestSubject] = useState('Math');
    const [updates, setUpdates] = useState([]);

    // Connection status
    const { status, isConnected, retryCount } = useConnectionStatus();

    // Student-specific real-time updates
    const {
        connected,
        error,
        lastUpdate,
        studentData,
        grades,
        version,
        updateStudent,
        updateGrade
    } = useStudentRealTime(testStudentId, {
        onStudentUpdate: (data) => {
            setUpdates(prev => [{
                type: 'Student Update',
                data: data,
                timestamp: new Date().toLocaleTimeString()
            }, ...prev.slice(0, 9)]);
        },
        onGradeUpdate: (data) => {
            setUpdates(prev => [{
                type: 'Grade Update',
                data: data,
                timestamp: new Date().toLocaleTimeString()
            }, ...prev.slice(0, 9)]);
        },
        onError: (err) => {
            console.error('Real-time error:', err);
        }
    });

    const handleUpdateStudent = () => {
        try {
            updateStudent({
                name: 'Test Student Updated',
                lastActive: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to update student:', error);
        }
    };

    const handleUpdateGrade = () => {
        try {
            updateGrade(testSubject, testGrade, {
                updatedBy: 'Teacher Test',
                comment: 'Real-time grade update test'
            });
        } catch (error) {
            console.error('Failed to update grade:', error);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'connected': return 'success';
            case 'reconnecting': return 'warning';
            case 'disconnected': return 'default';
            case 'failed': return 'error';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Real-Time System Test
            </Typography>

            {/* Connection Status */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Connection Status
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Chip 
                            label={`Status: ${status}`}
                            color={getStatusColor(status)}
                            variant="outlined"
                        />
                        <Chip 
                            label={`Connected: ${isConnected ? 'Yes' : 'No'}`}
                            color={isConnected ? 'success' : 'error'}
                            variant="outlined"
                        />
                        {retryCount > 0 && (
                            <Chip 
                                label={`Retries: ${retryCount}`}
                                color="warning"
                                variant="outlined"
                            />
                        )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        WebSocket Status: {connected ? 'Connected' : 'Disconnected'}
                    </Typography>
                    {error && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                            {error}
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Test Controls */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Test Controls
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <TextField
                            label="Student ID"
                            value={testStudentId}
                            onChange={(e) => setTestStudentId(e.target.value)}
                            size="small"
                        />
                        <TextField
                            label="Subject"
                            value={testSubject}
                            onChange={(e) => setTestSubject(e.target.value)}
                            size="small"
                        />
                        <TextField
                            label="Grade"
                            value={testGrade}
                            onChange={(e) => setTestGrade(e.target.value)}
                            size="small"
                        />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button 
                            variant="contained" 
                            onClick={handleUpdateStudent}
                            disabled={!connected}
                        >
                            Update Student
                        </Button>
                        <Button 
                            variant="contained" 
                            onClick={handleUpdateGrade}
                            disabled={!connected}
                        >
                            Update Grade
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Current Data */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Current Data (Version: {version})
                    </Typography>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                        Student Data: {JSON.stringify(studentData, null, 2)}
                    </Typography>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                        Grades: {JSON.stringify(Object.fromEntries(grades), null, 2)}
                    </Typography>
                </CardContent>
            </Card>

            {/* Real-Time Updates Log */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Real-Time Updates Log
                    </Typography>
                    {lastUpdate && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Last Update: {lastUpdate.type} at {lastUpdate.timestamp.toLocaleTimeString()}
                        </Alert>
                    )}
                    <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {updates.length === 0 ? (
                            <Typography color="text.secondary">No updates received yet</Typography>
                        ) : (
                            updates.map((update, index) => (
                                <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                    <Typography variant="body2" fontWeight="bold">
                                        {update.type} - {update.timestamp}
                                    </Typography>
                                    <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem' }}>
                                        {JSON.stringify(update.data, null, 2)}
                                    </Typography>
                                </Box>
                            ))
                        )}
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default RealTimeTestComponent;