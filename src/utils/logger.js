/**
 * Simple logging utility for the bot
 */

class Logger {
    constructor() {
        this.isDev = process.env.NODE_ENV === 'development';
    }

    info(message, data = null) {
        console.log(`ℹ️  ${new Date().toISOString()} [INFO] ${message}`);
        if (data && this.isDev) {
            console.log('   Data:', JSON.stringify(data, null, 2));
        }
    }

    error(message, error = null) {
        console.error(`❌ ${new Date().toISOString()} [ERROR] ${message}`);
        if (error) {
            console.error('   Error:', error);
            if (this.isDev && error.stack) {
                console.error('   Stack:', error.stack);
            }
        }
    }

    warn(message, data = null) {
        console.warn(`⚠️  ${new Date().toISOString()} [WARN] ${message}`);
        if (data && this.isDev) {
            console.warn('   Data:', JSON.stringify(data, null, 2));
        }
    }

    debug(message, data = null) {
        if (this.isDev) {
            console.log(`🐛 ${new Date().toISOString()} [DEBUG] ${message}`);
            if (data) {
                console.log('   Data:', JSON.stringify(data, null, 2));
            }
        }
    }

    callback(action, userId, data = null) {
        this.debug(`Callback: ${action} from user ${userId}`, data);
    }

    command(command, userId) {
        this.info(`Command: /${command} from user ${userId}`);
    }
}

export const logger = new Logger();
