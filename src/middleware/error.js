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

/**
 * Safe callback query answering
 */
export async function safeAnswer(ctx, text = '', showAlert = false) {
    try {
        if (ctx.callbackQuery && !ctx.callbackQuery.answered) {
            await ctx.answerCallbackQuery(text, { show_alert: showAlert });
        }
    } catch (error) {
        // Only log if it's not already answered
        if (!error.message?.includes('query is too old')) {
            logger.warn('Failed to answer callback query', error);
        }
    }
}
