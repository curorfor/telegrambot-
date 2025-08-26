import { InlineKeyboard } from 'grammy';
import { logger } from './logger.js';

/**
 * Enhanced Keyboard Builder with better callback handling
 */
export class KeyboardBuilder {
    constructor() {
        this.keyboard = new InlineKeyboard();
        this.callbackStorage = new Map();
        this.callbackCounter = 1;
        this.startCleanup();
    }

    /**
     * Add a button with automatic callback encoding
     */
    button(text, action, data = {}) {
        const callbackData = this.encodeCallback(action, data);
        this.keyboard.text(text, callbackData);
        return this;
    }

    /**
     * Add a URL button
     */
    url(text, url) {
        this.keyboard.url(text, url);
        return this;
    }

    /**
     * Start a new row
     */
    row() {
        this.keyboard.row();
        return this;
    }

    /**
     * Get the built keyboard
     */
    build() {
        return this.keyboard;
    }

    /**
     * Encode callback data efficiently
     */
    encodeCallback(action, data = {}) {
        // For simple actions without data, use direct encoding
        if (!data || Object.keys(data).length === 0) {
            if (action.length <= 64) {
                return action;
            }
        }

        // For small data, try compact JSON encoding
        try {
            const compactData = JSON.stringify({ a: action, d: data });
            if (compactData.length <= 64) {
                return compactData;
            }
        } catch (e) {
            logger.warn('Failed to JSON encode callback data', { action, data });
        }

        // For larger data, try shortened JSON
        try {
            // Use shorter keys to save space
            const shortData = JSON.stringify({ 
                a: action, 
                d: this.compressData(data) 
            });
            if (shortData.length <= 64) {
                return shortData;
            }
        } catch (e) {
            // Continue to storage fallback
        }

        // For very large data, use storage (last resort)
        const id = `cb_${this.callbackCounter++}`;
        this.callbackStorage.set(id, {
            action,
            data,
            timestamp: Date.now()
        });

        logger.debug(`Stored callback: ${id} -> ${action}`, data);
        return id;
    }

    /**
     * Compress data by using shorter keys
     */
    compressData(data) {
        if (!data || typeof data !== 'object') return data;
        
        const compressed = {};
        for (const [key, value] of Object.entries(data)) {
            // Use shorter keys for common properties
            const shortKey = {
                'taskId': 'tId',
                'taskName': 'tName', 
                'date': 'd',
                'time': 't',
                'category': 'cat',
                'priority': 'pri',
                'userId': 'uId',
                'teamId': 'tmId'
            }[key] || key.substring(0, 3);
            
            compressed[shortKey] = value;
        }
        return compressed;
    }

    /**
     * Decompress data by restoring original keys
     */
    decompressData(data) {
        if (!data || typeof data !== 'object') return data;
        
        const decompressed = {};
        for (const [key, value] of Object.entries(data)) {
            // Restore original keys
            const originalKey = {
                'tId': 'taskId',
                'tName': 'taskName',
                'd': 'date', 
                't': 'time',
                'cat': 'category',
                'pri': 'priority', 
                'uId': 'userId',
                'tmId': 'teamId'
            }[key] || key;
            
            decompressed[originalKey] = value;
        }
        return decompressed;
    }

    /**
     * Decode callback data
     */
    decodeCallback(callbackData) {
        // Try direct action
        if (!callbackData.startsWith('{') && !callbackData.startsWith('cb_')) {
            return { action: callbackData, data: {} };
        }

        // Try JSON decode
        if (callbackData.startsWith('{')) {
            try {
                const parsed = JSON.parse(callbackData);
                const data = parsed.d ? this.decompressData(parsed.d) : {};
                return { action: parsed.a, data };
            } catch (e) {
                logger.warn('Failed to parse JSON callback', { callbackData });
                // Don't return null immediately, try storage fallback
            }
        }

        // Try storage lookup
        if (callbackData.startsWith('cb_')) {
            const stored = this.callbackStorage.get(callbackData);
            if (!stored) {
                logger.warn('Callback data not found in storage', { callbackData });
                // Return a graceful fallback instead of null
                return { action: 'callback_expired', data: { originalCallback: callbackData } };
            }

            // Check if callback is expired (24 hours)
            if (Date.now() - stored.timestamp > 24 * 60 * 60 * 1000) {
                this.callbackStorage.delete(callbackData);
                logger.warn('Callback data expired', { callbackData });
                return { action: 'callback_expired', data: { originalCallback: callbackData } };
            }

            logger.debug(`Retrieved callback: ${callbackData} -> ${stored.action}`, stored.data);
            return { action: stored.action, data: stored.data };
        }

        logger.warn('Unknown callback format', { callbackData });
        // Return graceful fallback
        return { action: 'unknown_callback', data: { originalCallback: callbackData } };
    }

    /**
     * Start cleanup process for old callbacks
     */
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            const expiredKeys = [];

            for (const [key, value] of this.callbackStorage.entries()) {
                if (now - value.timestamp > 24 * 60 * 60 * 1000) {
                    expiredKeys.push(key);
                }
            }

            expiredKeys.forEach(key => this.callbackStorage.delete(key));
            
            if (expiredKeys.length > 0) {
                logger.info(`Cleaned up ${expiredKeys.length} expired callbacks`);
            }
        }, 60 * 60 * 1000); // Every hour
    }

    /**
     * Get storage stats
     */
    getStats() {
        return {
            stored_callbacks: this.callbackStorage.size,
            next_counter: this.callbackCounter
        };
    }
}

// Create a global instance
export const keyboardBuilder = new KeyboardBuilder();

/**
 * Quick keyboard builders for common patterns
 */
export const kb = {
    /**
     * Back button
     */
    back(action = 'back', data = {}) {
        return new KeyboardBuilder().button('⬅️ Orqaga', action, data).build();
    },

    /**
     * Cancel button
     */
    cancel(action = 'cancel', data = {}) {
        return new KeyboardBuilder().button('❌ Bekor qilish', action, data).build();
    },

    /**
     * Confirm/Cancel buttons
     */
    confirm(confirmAction, cancelAction = 'cancel', confirmData = {}, cancelData = {}) {
        return new KeyboardBuilder()
            .button('✅ Tasdiqlash', confirmAction, confirmData)
            .button('❌ Bekor qilish', cancelAction, cancelData)
            .build();
    },

    /**
     * Simple menu with back button
     */
    menu(buttons, backAction = 'back', backData = {}) {
        const builder = new KeyboardBuilder();
        
        buttons.forEach(btn => {
            if (typeof btn === 'string') {
                builder.button(btn, btn.toLowerCase().replace(/\s+/g, '_')).row();
            } else {
                builder.button(btn.text, btn.action, btn.data || {}).row();
            }
        });

        return builder.button('⬅️ Orqaga', backAction, backData).build();
    }
};
