const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisManager {
    constructor() {
        this.client = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    async connect() {
        try {
            const config = {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: process.env.REDIS_DB || 0,
                
                // Connection options
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                connectTimeout: 10000,
                
                // Retry strategy
                retryStrategy: (times) => {
                    if (times > this.maxReconnectAttempts) {
                        logger.error('Redis: Max reconnection attempts reached');
                        return null;
                    }
                    const delay = Math.min(times * 50, 2000);
                    logger.warn(`Redis: Attempting to reconnect in ${delay}ms (attempt ${times})`);
                    return delay;
                }
            };

            this.client = new Redis(config);

            // Event handlers
            this.client.on('connect', () => {
                logger.info('Redis: Connected successfully');
                this.connected = true;
                this.reconnectAttempts = 0;
            });

            this.client.on('ready', () => {
                logger.info('Redis: Ready to accept commands');
            });

            this.client.on('error', (error) => {
                logger.error('Redis: Connection error:', error);
                this.connected = false;
            });

            this.client.on('close', () => {
                logger.warn('Redis: Connection closed');
                this.connected = false;
            });

            this.client.on('reconnecting', () => {
                this.reconnectAttempts++;
                logger.info(`Redis: Reconnecting... (attempt ${this.reconnectAttempts})`);
            });

            // Connect to Redis
            await this.client.connect();
            
            // Test connection
            await this.client.ping();
            logger.info('Redis: Connection test successful');

            return this.client;

        } catch (error) {
            logger.error('Redis: Failed to connect:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            this.connected = false;
            logger.info('Redis: Disconnected');
        }
    }

    isConnected() {
        return this.connected && this.client && this.client.status === 'ready';
    }

    getClient() {
        return this.client;
    }

    // Cache utility methods
    async set(key, value, ttl = 3600) {
        if (!this.isConnected()) {
            logger.warn('Redis: Not connected, skipping set operation');
            return false;
        }

        try {
            const serialized = JSON.stringify(value);
            await this.client.setex(key, ttl, serialized);
            return true;
        } catch (error) {
            logger.error('Redis: Error setting key:', error);
            return false;
        }
    }

    async get(key) {
        if (!this.isConnected()) {
            logger.warn('Redis: Not connected, skipping get operation');
            return null;
        }

        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Redis: Error getting key:', error);
            return null;
        }
    }

    async del(key) {
        if (!this.isConnected()) {
            logger.warn('Redis: Not connected, skipping delete operation');
            return false;
        }

        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Redis: Error deleting key:', error);
            return false;
        }
    }

    // Session management
    async setSession(sessionId, userData, ttl = 86400) {
        return await this.set(`session:${sessionId}`, userData, ttl);
    }

    async getSession(sessionId) {
        return await this.get(`session:${sessionId}`);
    }

    async deleteSession(sessionId) {
        return await this.del(`session:${sessionId}`);
    }

    // Real-time data caching
    async cacheStudentData(studentId, data, ttl = 1800) {
        return await this.set(`student:${studentId}`, data, ttl);
    }

    async getCachedStudentData(studentId) {
        return await this.get(`student:${studentId}`);
    }

    async cacheGradeData(studentId, subjectId, gradeData, ttl = 3600) {
        return await this.set(`grade:${studentId}:${subjectId}`, gradeData, ttl);
    }

    async getCachedGradeData(studentId, subjectId) {
        return await this.get(`grade:${studentId}:${subjectId}`);
    }

    // Rate limiting
    async checkRateLimit(userId, windowMs = 60000, maxRequests = 100) {
        if (!this.isConnected()) {
            return true; // Allow if Redis is down
        }

        try {
            const key = `rate_limit:${userId}`;
            const current = await this.client.incr(key);
            
            if (current === 1) {
                await this.client.expire(key, Math.ceil(windowMs / 1000));
            }
            
            return current <= maxRequests;
        } catch (error) {
            logger.error('Redis: Error checking rate limit:', error);
            return true; // Allow if error occurs
        }
    }

    // Pub/Sub helpers
    async publish(channel, message) {
        if (!this.isConnected()) {
            logger.warn('Redis: Not connected, skipping publish operation');
            return false;
        }

        try {
            await this.client.publish(channel, JSON.stringify(message));
            return true;
        } catch (error) {
            logger.error('Redis: Error publishing message:', error);
            return false;
        }
    }

    // Health check
    async healthCheck() {
        try {
            if (!this.isConnected()) {
                return { status: 'unhealthy', message: 'Not connected' };
            }

            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;

            return {
                status: 'healthy',
                latency: `${latency}ms`,
                connected: this.connected,
                reconnectAttempts: this.reconnectAttempts
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message,
                connected: false
            };
        }
    }
}

module.exports = new RedisManager();