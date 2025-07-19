const logger = require('../utils/logger');
const redisManager = require('../config/redis');

class ConflictResolver {
    constructor() {
        this.lockTimeout = 30000; // 30 seconds
        this.retryAttempts = 3;
        this.retryDelay = 100; // ms
    }

    /**
     * Acquire a distributed lock for a resource
     * @param {string} resourceType - Type of resource (student, grade, etc.)
     * @param {string} resourceId - ID of the resource
     * @param {string} userId - ID of the user acquiring the lock
     * @param {number} timeout - Lock timeout in milliseconds
     * @returns {Promise<string|null>} Lock token if successful, null if failed
     */
    async acquireLock(resourceType, resourceId, userId, timeout = this.lockTimeout) {
        const lockKey = `lock:${resourceType}:${resourceId}`;
        const lockToken = `${userId}:${Date.now()}:${Math.random()}`;
        const expiryTime = Math.ceil(timeout / 1000);

        try {
            // Use Redis SET with NX (only if not exists) and EX (expiry)
            const result = await redisManager.getClient().set(
                lockKey, 
                lockToken, 
                'PX', 
                timeout, 
                'NX'
            );

            if (result === 'OK') {
                logger.info(`Lock acquired for ${resourceType}:${resourceId} by user ${userId}`);
                return lockToken;
            }

            // Check who has the lock
            const currentLock = await redisManager.getClient().get(lockKey);
            const currentUserId = currentLock ? currentLock.split(':')[0] : 'unknown';
            
            logger.warn(`Lock conflict: ${resourceType}:${resourceId} already locked by user ${currentUserId}`);
            return null;

        } catch (error) {
            logger.error('Error acquiring lock:', error);
            return null;
        }
    }

    /**
     * Release a distributed lock
     * @param {string} resourceType - Type of resource
     * @param {string} resourceId - ID of the resource
     * @param {string} lockToken - Token returned when lock was acquired
     * @returns {Promise<boolean>} True if released successfully
     */
    async releaseLock(resourceType, resourceId, lockToken) {
        const lockKey = `lock:${resourceType}:${resourceId}`;

        try {
            // Lua script to atomically check and delete lock
            const luaScript = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;

            const result = await redisManager.getClient().eval(
                luaScript,
                1,
                lockKey,
                lockToken
            );

            if (result === 1) {
                logger.info(`Lock released for ${resourceType}:${resourceId}`);
                return true;
            } else {
                logger.warn(`Failed to release lock for ${resourceType}:${resourceId} - token mismatch`);
                return false;
            }

        } catch (error) {
            logger.error('Error releasing lock:', error);
            return false;
        }
    }

    /**
     * Extend an existing lock
     * @param {string} resourceType - Type of resource
     * @param {string} resourceId - ID of the resource
     * @param {string} lockToken - Current lock token
     * @param {number} timeout - New timeout in milliseconds
     * @returns {Promise<boolean>} True if extended successfully
     */
    async extendLock(resourceType, resourceId, lockToken, timeout = this.lockTimeout) {
        const lockKey = `lock:${resourceType}:${resourceId}`;

        try {
            // Lua script to atomically check and extend lock
            const luaScript = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("pexpire", KEYS[1], ARGV[2])
                else
                    return 0
                end
            `;

            const result = await redisManager.getClient().eval(
                luaScript,
                1,
                lockKey,
                lockToken,
                timeout
            );

            return result === 1;

        } catch (error) {
            logger.error('Error extending lock:', error);
            return false;
        }
    }

    /**
     * Check if a resource is currently locked
     * @param {string} resourceType - Type of resource
     * @param {string} resourceId - ID of the resource
     * @returns {Promise<object|null>} Lock info if locked, null if not locked
     */
    async checkLock(resourceType, resourceId) {
        const lockKey = `lock:${resourceType}:${resourceId}`;

        try {
            const lockToken = await redisManager.getClient().get(lockKey);
            
            if (!lockToken) {
                return null;
            }

            const [userId, timestamp] = lockToken.split(':');
            const ttl = await redisManager.getClient().pttl(lockKey);

            return {
                userId,
                lockedAt: new Date(parseInt(timestamp)),
                expiresIn: ttl,
                token: lockToken
            };

        } catch (error) {
            logger.error('Error checking lock:', error);
            return null;
        }
    }

    /**
     * Execute a function with distributed lock
     * @param {string} resourceType - Type of resource
     * @param {string} resourceId - ID of the resource
     * @param {string} userId - ID of the user
     * @param {Function} fn - Function to execute
     * @param {number} timeout - Lock timeout
     * @returns {Promise<any>} Result of the function
     */
    async executeWithLock(resourceType, resourceId, userId, fn, timeout = this.lockTimeout) {
        const lockToken = await this.acquireLock(resourceType, resourceId, userId, timeout);
        
        if (!lockToken) {
            throw new Error(`Cannot acquire lock for ${resourceType}:${resourceId}`);
        }

        try {
            const result = await fn();
            return result;
        } finally {
            await this.releaseLock(resourceType, resourceId, lockToken);
        }
    }

    /**
     * Implement optimistic locking with version control
     * @param {string} resourceType - Type of resource
     * @param {string} resourceId - ID of the resource
     * @param {number} expectedVersion - Expected version number
     * @param {object} updateData - Data to update
     * @param {Function} updateFn - Function to perform the update
     * @returns {Promise<object>} Update result with new version
     */
    async optimisticUpdate(resourceType, resourceId, expectedVersion, updateData, updateFn) {
        const versionKey = `version:${resourceType}:${resourceId}`;
        
        try {
            // Get current version
            const currentVersion = await redisManager.getClient().get(versionKey);
            const currentVersionNum = currentVersion ? parseInt(currentVersion) : 0;

            // Check version conflict
            if (expectedVersion !== currentVersionNum) {
                return {
                    success: false,
                    conflict: true,
                    currentVersion: currentVersionNum,
                    expectedVersion: expectedVersion,
                    message: `Version conflict: expected ${expectedVersion}, current ${currentVersionNum}`
                };
            }

            // Perform the update
            const result = await updateFn(updateData);
            
            // Increment version
            const newVersion = currentVersionNum + 1;
            await redisManager.getClient().set(versionKey, newVersion.toString());

            return {
                success: true,
                conflict: false,
                newVersion: newVersion,
                data: result,
                message: 'Update successful'
            };

        } catch (error) {
            logger.error('Error in optimistic update:', error);
            return {
                success: false,
                conflict: false,
                error: error.message,
                message: 'Update failed'
            };
        }
    }

    /**
     * Merge conflicting updates using a merge strategy
     * @param {object} baseData - Original data
     * @param {object} userUpdate - User's update
     * @param {object} conflictingUpdate - Conflicting update from another user
     * @param {string} strategy - Merge strategy ('last-write-wins', 'field-level', 'user-prompt')
     * @returns {object} Merged data
     */
    async mergeConflicts(baseData, userUpdate, conflictingUpdate, strategy = 'field-level') {
        switch (strategy) {
            case 'last-write-wins':
                return this.lastWriteWinsMerge(baseData, userUpdate, conflictingUpdate);
            
            case 'field-level':
                return this.fieldLevelMerge(baseData, userUpdate, conflictingUpdate);
            
            case 'user-prompt':
                return this.createMergePrompt(baseData, userUpdate, conflictingUpdate);
            
            default:
                throw new Error(`Unknown merge strategy: ${strategy}`);
        }
    }

    /**
     * Last-write-wins merge strategy
     */
    lastWriteWinsMerge(baseData, userUpdate, conflictingUpdate) {
        // Determine which update is newer
        const userTimestamp = userUpdate.updatedAt || 0;
        const conflictingTimestamp = conflictingUpdate.updatedAt || 0;

        const winner = userTimestamp > conflictingTimestamp ? userUpdate : conflictingUpdate;
        const loser = userTimestamp > conflictingTimestamp ? conflictingUpdate : userUpdate;

        return {
            mergedData: { ...baseData, ...winner.data },
            strategy: 'last-write-wins',
            winner: winner.updatedBy,
            loser: loser.updatedBy,
            conflicts: this.findConflicts(userUpdate.data, conflictingUpdate.data)
        };
    }

    /**
     * Field-level merge strategy
     */
    fieldLevelMerge(baseData, userUpdate, conflictingUpdate) {
        const merged = { ...baseData };
        const conflicts = [];

        // Get all fields that were updated
        const userFields = Object.keys(userUpdate.data || {});
        const conflictingFields = Object.keys(conflictingUpdate.data || {});
        const allFields = [...new Set([...userFields, ...conflictingFields])];

        for (const field of allFields) {
            const userValue = userUpdate.data?.[field];
            const conflictingValue = conflictingUpdate.data?.[field];

            if (userValue !== undefined && conflictingValue !== undefined) {
                if (userValue !== conflictingValue) {
                    // Field conflict - use timestamp to decide
                    const userTime = userUpdate.updatedAt || 0;
                    const conflictingTime = conflictingUpdate.updatedAt || 0;
                    
                    merged[field] = userTime > conflictingTime ? userValue : conflictingValue;
                    conflicts.push({
                        field,
                        userValue,
                        conflictingValue,
                        resolvedValue: merged[field],
                        resolvedBy: userTime > conflictingTime ? userUpdate.updatedBy : conflictingUpdate.updatedBy
                    });
                } else {
                    // Same value, no conflict
                    merged[field] = userValue;
                }
            } else if (userValue !== undefined) {
                merged[field] = userValue;
            } else if (conflictingValue !== undefined) {
                merged[field] = conflictingValue;
            }
        }

        return {
            mergedData: merged,
            strategy: 'field-level',
            conflicts: conflicts,
            conflictCount: conflicts.length
        };
    }

    /**
     * Create merge prompt for user resolution
     */
    createMergePrompt(baseData, userUpdate, conflictingUpdate) {
        const conflicts = this.findConflicts(userUpdate.data, conflictingUpdate.data);
        
        return {
            requiresUserInput: true,
            strategy: 'user-prompt',
            baseData: baseData,
            userUpdate: userUpdate,
            conflictingUpdate: conflictingUpdate,
            conflicts: conflicts,
            options: conflicts.map(conflict => ({
                field: conflict.field,
                options: [
                    { value: conflict.userValue, label: `Your value: ${conflict.userValue}` },
                    { value: conflict.conflictingValue, label: `Their value: ${conflict.conflictingValue}` },
                    { value: baseData[conflict.field], label: `Original value: ${baseData[conflict.field]}` }
                ]
            }))
        };
    }

    /**
     * Find conflicts between two updates
     */
    findConflicts(update1, update2) {
        const conflicts = [];
        const fields1 = Object.keys(update1 || {});
        const fields2 = Object.keys(update2 || {});
        const commonFields = fields1.filter(field => fields2.includes(field));

        for (const field of commonFields) {
            if (update1[field] !== update2[field]) {
                conflicts.push({
                    field,
                    userValue: update1[field],
                    conflictingValue: update2[field]
                });
            }
        }

        return conflicts;
    }

    /**
     * Get lock statistics
     */
    async getLockStats() {
        try {
            const lockPattern = 'lock:*';
            const lockKeys = await redisManager.getClient().keys(lockPattern);
            
            const stats = {
                totalLocks: lockKeys.length,
                locksByType: {},
                locksByUser: {}
            };

            for (const key of lockKeys) {
                const lockToken = await redisManager.getClient().get(key);
                if (lockToken) {
                    const [userId] = lockToken.split(':');
                    const resourceType = key.split(':')[1];
                    
                    stats.locksByType[resourceType] = (stats.locksByType[resourceType] || 0) + 1;
                    stats.locksByUser[userId] = (stats.locksByUser[userId] || 0) + 1;
                }
            }

            return stats;
        } catch (error) {
            logger.error('Error getting lock stats:', error);
            return null;
        }
    }
}

module.exports = new ConflictResolver();