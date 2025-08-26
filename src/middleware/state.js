import { logger } from '../utils/logger.js';

/**
 * Enhanced user state management
 */
class StateManager {
    constructor() {
        this.userStates = new Map();
        this.startCleanup();
    }

    /**
     * Set user state
     */
    setState(userId, state, data = {}) {
        const stateData = {
            state,
            data,
            timestamp: Date.now()
        };
        
        this.userStates.set(userId.toString(), stateData);
        logger.debug(`State set for user ${userId}`, stateData);
    }

    /**
     * Get user state
     */
    getState(userId) {
        const stateData = this.userStates.get(userId.toString());
        
        if (!stateData) {
            return { state: 'idle', data: {} };
        }

        // Check if state is expired (30 minutes)
        if (Date.now() - stateData.timestamp > 30 * 60 * 1000) {
            this.clearState(userId);
            return { state: 'idle', data: {} };
        }

        return stateData;
    }

    /**
     * Clear user state
     */
    clearState(userId) {
        this.userStates.delete(userId.toString());
        logger.debug(`State cleared for user ${userId}`);
    }

    /**
     * Check if user is in specific state
     */
    isInState(userId, state) {
        const userState = this.getState(userId);
        return userState.state === state;
    }

    /**
     * Update state data without changing state
     */
    updateData(userId, newData) {
        const current = this.getState(userId);
        this.setState(userId, current.state, { ...current.data, ...newData });
    }

    /**
     * Start cleanup process for expired states
     */
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            const expiredUsers = [];

            for (const [userId, stateData] of this.userStates.entries()) {
                if (now - stateData.timestamp > 30 * 60 * 1000) {
                    expiredUsers.push(userId);
                }
            }

            expiredUsers.forEach(userId => this.userStates.delete(userId));
            
            if (expiredUsers.length > 0) {
                logger.info(`Cleaned up ${expiredUsers.length} expired user states`);
            }
        }, 10 * 60 * 1000); // Every 10 minutes
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            active_states: this.userStates.size,
            states_by_type: this.getStatesByType()
        };
    }

    getStatesByType() {
        const stats = {};
        for (const stateData of this.userStates.values()) {
            stats[stateData.state] = (stats[stateData.state] || 0) + 1;
        }
        return stats;
    }
}

// Global state manager
export const stateManager = new StateManager();

/**
 * State middleware
 */
export function stateMiddleware() {
    return async (ctx, next) => {
        const userId = ctx.from?.id;
        
        if (userId) {
            // Add state methods to context
            ctx.state = {
                set: (state, data) => stateManager.setState(userId, state, data),
                get: () => stateManager.getState(userId),
                clear: () => stateManager.clearState(userId),
                is: (state) => stateManager.isInState(userId, state),
                update: (data) => stateManager.updateData(userId, data)
            };
        }

        await next();
    };
}

/**
 * State validation middleware
 */
export function requireState(requiredState) {
    return async (ctx, next) => {
        if (!ctx.state.is(requiredState)) {
            await ctx.reply('❌ Noto\'g\'ri holat. Iltimos, qaytadan boshlang.');
            return;
        }
        await next();
    };
}
