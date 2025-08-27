import { logger } from '../utils/logger.js';

/**
 * Global error handling middleware
 */
export function errorMiddleware() {
    return async (ctx, next) => {
        try {
            await next();
        } catch (error) {
            logger.error('Bot error occurred', error);

            // Try to send error message to user
            try {
                if (ctx.callbackQuery) {
                    await ctx.answerCallbackQuery('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
                } else {
                    await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
                }
            } catch (sendError) {
                logger.error('Failed to send error message to user', sendError);
            }
        }
    };
}

/**
 * Safe message editing function
 */
export async function safeEdit(ctx, text, options = {}) {
    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, options);
        } else {
            await ctx.reply(text, options);
        }
    } catch (error) {
        logger.warn('Failed to edit message', error);
        
        // Fallback: try to send new message
        try {
            await ctx.reply(text, options);
        } catch (fallbackError) {
            logger.error('Fallback message send also failed', fallbackError);
            throw fallbackError;
        }
    }
}

// Track answered callbacks manually
const answeredCallbacks = new Set();

/**
 * Safe callback query answering
 */
export async function safeAnswer(ctx, text = '', showAlert = false) {
    try {
        if (ctx.callbackQuery) {
            const callbackId = ctx.callbackQuery.id;
            
            // Check if we've already answered this callback
            if (answeredCallbacks.has(callbackId)) {
                return;
            }
            
            await ctx.answerCallbackQuery(text, { show_alert: showAlert });
            
            // Mark as answered
            answeredCallbacks.add(callbackId);
            
            // Clean up old entries (keep only last 1000)
            if (answeredCallbacks.size > 1000) {
                const entries = Array.from(answeredCallbacks);
                answeredCallbacks.clear();
                entries.slice(-500).forEach(id => answeredCallbacks.add(id));
            }
        }
    } catch (error) {
        // Only log if it's not a "query is too old" or "already answered" error
        if (!error.message?.includes('query is too old') && 
            !error.message?.includes('already answered')) {
            logger.warn('Failed to answer callback query', error);
        }
    }
}
