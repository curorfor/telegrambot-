import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { db } from './database.js';
import { prayerService } from './prayer.js';

/**
 * Notification Service
 * Handles task reminders and prayer time notifications
 */
class NotificationService {
    constructor(bot) {
        this.bot = bot;
        this.isRunning = false;
        this.taskIntervals = [
            { id: '1day', name: '1 kun oldin', minutes: 24 * 60 },
            { id: '1hour', name: '1 soat oldin', minutes: 60 },
            { id: '15min', name: '15 daqiqa oldin', minutes: 15 },
            { id: 'due', name: 'Vaqti keldi', minutes: 0 }
        ];
        
        this.prayerIntervals = [
            { id: 'prayer_15min', name: '15 daqiqa oldin', minutes: 15 },
            { id: 'prayer_5min', name: '5 daqiqa oldin', minutes: 5 }
        ];
    }

    /**
     * Start notification system
     */
    start() {
        if (this.isRunning) {
            logger.warn('Notification system is already running');
            return;
        }

        logger.info('🔔 Starting notification system...');
        
        // Check every minute for notifications
        this.cronJob = cron.schedule('* * * * *', async () => {
            await this.checkNotifications();
        }, {
            scheduled: false
        });

        this.cronJob.start();
        this.isRunning = true;
        logger.info('✅ Notification system started - checking every minute');
    }

    /**
     * Stop notification system
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            // Note: destroy() method may not exist in all node-cron versions
            if (typeof this.cronJob.destroy === 'function') {
                this.cronJob.destroy();
            }
        }
        this.isRunning = false;
        logger.info('🔕 Notification system stopped');
    }

    /**
     * Main notification check function
     */
    async checkNotifications() {
        const now = new Date();
        logger.debug(`⏰ Checking notifications at: ${now.toLocaleString('uz-UZ')}`);
        
        let totalTasks = 0;
        let notificationsSent = 0;

        try {
            // Get all users
            const allUsers = db.getAllUsers();
            
            for (const [userId, user] of Object.entries(allUsers)) {
                // Skip users who have blocked the bot
                if (user.activity?.blockedBot) {
                    logger.debug(`Skipping notifications for blocked user ${userId}`);
                    continue;
                }

                // Skip users with notifications disabled
                if (user.preferences?.notifications?.tasks === false && 
                    user.preferences?.notifications?.prayer === false) {
                    logger.debug(`Skipping notifications for user ${userId} - all notifications disabled`);
                    continue;
                }

                // Check task notifications
                const taskNotifications = await this.checkTaskNotifications(userId, user, now);
                notificationsSent += taskNotifications;
                totalTasks += user.tasks?.length || 0;

                // Check prayer notifications
                const prayerNotifications = await this.checkPrayerNotifications(userId, user, now);
                notificationsSent += prayerNotifications;
            }

            if (notificationsSent > 0) {
                await db.saveData();
                logger.info(`📬 Sent ${notificationsSent} notifications`);
            }

            logger.debug(`📊 Notification check complete: ${totalTasks} total tasks, ${notificationsSent} notifications sent`);

        } catch (error) {
            logger.error('Error in notification check:', error);
        }
    }

    /**
     * Check task notifications for a user
     */
    async checkTaskNotifications(userId, user, now) {
        let notificationsSent = 0;
        const tasks = user.tasks || [];

        // Check if task notifications are enabled
        if (user.preferences?.notifications?.tasks === false) {
            return 0;
        }

        for (const task of tasks) {
            if (task.completed) continue;

            const taskTime = new Date(task.date);
            const timeDiff = taskTime.getTime() - now.getTime();
            const minutesUntilDue = Math.floor(timeDiff / (1000 * 60));

            // Initialize notifications object if not exists
            if (!task.notifications) {
                task.notifications = {
                    sent1Day: false,
                    sent1Hour: false,
                    sent15Min: false,
                    sentDue: false
                };
            }

            // Check each notification interval
            for (const interval of this.taskIntervals) {
                if (this.shouldSendTaskNotification(task, interval, minutesUntilDue)) {
                    try {
                        const message = this.getTaskNotificationMessage(task, interval, minutesUntilDue);
                        
                        await this.bot.api.sendMessage(userId, message, { 
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '✅ Bajarildi', callback_data: `complete_task_${task.id}` },
                                    { text: '📋 Vazifalar', callback_data: 'back_to_main_tasks' }
                                ]]
                            }
                        });
                        
                        // Mark notification as sent
                        const notificationKey = this.getNotificationKey(interval.id);
                        task.notifications[notificationKey] = true;
                        
                        notificationsSent++;
                        logger.info(`📤 Task notification sent to user ${userId}: "${task.name}" (${interval.name})`);
                        
                    } catch (error) {
                        if (this.isUserBlockedError(error)) {
                            logger.warn(`User ${userId} has blocked the bot, marking user as inactive`);
                            await this.markUserAsBlocked(userId);
                        } else if (this.isRetryableError(error)) {
                            logger.warn(`Retryable error for user ${userId}, will try again later:`, error.message);
                        } else {
                            logger.error(`Failed to send task notification to user ${userId}:`, error);
                        }
                    }
                }
            }
        }

        return notificationsSent;
    }

    /**
     * Check prayer notifications for a user
     */
    async checkPrayerNotifications(userId, user, now) {
        let notificationsSent = 0;

        // Check if user has prayer notifications enabled
        const prayerRegion = user.preferences?.prayerRegion || user.prayerRegion;
        const prayerNotificationsEnabled = user.preferences?.notifications?.prayer !== false; // Default enabled

        if (!prayerRegion || !prayerNotificationsEnabled) {
            return 0;
        }

        try {
            const prayerTimes = await prayerService.getPrayerTimes(prayerRegion);
            if (!prayerTimes) return 0;

            // Initialize prayer notifications if not exists
            if (!user.prayerNotifications) {
                user.prayerNotifications = {};
            }

            const today = now.toISOString().split('T')[0];
            if (!user.prayerNotifications[today]) {
                user.prayerNotifications[today] = {};
            }

            const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            
            for (const prayer of prayers) {
                const prayerTime = prayerTimes[prayer];
                if (!prayerTime) continue;

                const prayerDateTime = this.parsePrayerTime(prayerTime, now);
                const timeDiff = prayerDateTime.getTime() - now.getTime();
                const minutesUntilPrayer = Math.floor(timeDiff / (1000 * 60));

                // Check each prayer notification interval
                for (const interval of this.prayerIntervals) {
                    if (this.shouldSendPrayerNotification(user, prayer, interval, minutesUntilPrayer, today)) {
                        try {
                            const message = this.getPrayerNotificationMessage(prayer, prayerTime, interval, prayerRegion);
                            
                            await this.bot.api.sendMessage(userId, message, { 
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [[
                                        { text: '🕌 Namaz vaqtlari', callback_data: 'show_prayer_times' },
                                        { text: '🔕 O\'chirish', callback_data: 'disable_prayer_notifications' }
                                    ]]
                                }
                            });
                            
                            // Mark notification as sent
                            const notificationKey = `${prayer}_${interval.id}`;
                            user.prayerNotifications[today][notificationKey] = true;
                            
                            notificationsSent++;
                            logger.info(`🕌 Prayer notification sent to user ${userId}: ${prayer} in ${interval.minutes} minutes`);
                            
                        } catch (error) {
                            if (this.isUserBlockedError(error)) {
                                logger.warn(`User ${userId} has blocked the bot, marking user as inactive`);
                                await this.markUserAsBlocked(userId);
                            } else if (this.isRetryableError(error)) {
                                logger.warn(`Retryable error for user ${userId}, will try again later:`, error.message);
                            } else {
                                logger.error(`Failed to send prayer notification to user ${userId}:`, error);
                            }
                        }
                    }
                }
            }

        } catch (error) {
            logger.error(`Error checking prayer notifications for user ${userId}:`, error);
        }

        return notificationsSent;
    }

    /**
     * Check if task notification should be sent
     */
    shouldSendTaskNotification(task, interval, minutesUntilDue) {
        const targetMinutes = interval.minutes;
        const isTimeForNotification = minutesUntilDue <= targetMinutes && minutesUntilDue > (targetMinutes - 5);
        
        if (!isTimeForNotification) return false;
        
        const notificationKey = this.getNotificationKey(interval.id);
        return !task.notifications[notificationKey];
    }

    /**
     * Check if prayer notification should be sent
     */
    shouldSendPrayerNotification(user, prayer, interval, minutesUntilPrayer, today) {
        const targetMinutes = interval.minutes;
        const isTimeForNotification = minutesUntilPrayer <= targetMinutes && minutesUntilPrayer > (targetMinutes - 2);
        
        if (!isTimeForNotification) return false;
        
        const notificationKey = `${prayer}_${interval.id}`;
        return !user.prayerNotifications[today]?.[notificationKey];
    }

    /**
     * Check if error indicates user has blocked the bot
     */
    isUserBlockedError(error) {
        if (!error || !error.message) return false;
        
        const blockedMessages = [
            'bot was blocked by the user',
            'user is deactivated',
            'chat not found',
            'bot is not a member'
        ];
        
        return blockedMessages.some(msg => 
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        if (!error || !error.message) return false;
        
        const retryableMessages = [
            'too many requests',
            'network error',
            'timeout',
            'temporarily unavailable'
        ];
        
        return retryableMessages.some(msg => 
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    /**
     * Mark user as blocked/inactive
     */
    async markUserAsBlocked(userId) {
        try {
            const { db } = await import('./database.js');
            const user = db.getUser(userId);
            
            if (!user.preferences) user.preferences = {};
            if (!user.preferences.notifications) user.preferences.notifications = {};
            
            // Disable all notifications for blocked users
            user.preferences.notifications.tasks = false;
            user.preferences.notifications.prayer = false;
            user.preferences.notifications.reminders = false;
            
            // Add blocked status
            user.activity.blockedBot = true;
            user.activity.blockedAt = new Date().toISOString();
            
            await db.saveData();
            logger.info(`User ${userId} marked as blocked and notifications disabled`);
            
        } catch (error) {
            logger.error(`Failed to mark user ${userId} as blocked:`, error);
        }
    }

    /**
     * Reset user blocked status (for admin/testing)
     */
    async resetUserBlockedStatus(userId) {
        try {
            const { db } = await import('./database.js');
            const user = db.getUser(userId);
            
            if (user.activity?.blockedBot) {
                user.activity.blockedBot = false;
                user.activity.unblockedAt = new Date().toISOString();
                
                // Re-enable notifications
                if (!user.preferences) user.preferences = {};
                if (!user.preferences.notifications) user.preferences.notifications = {};
                
                user.preferences.notifications.tasks = true;
                user.preferences.notifications.prayer = true;
                user.preferences.notifications.reminders = true;
                
                await db.saveData();
                logger.info(`User ${userId} unblocked and notifications re-enabled`);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Failed to reset blocked status for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Get notification statistics
     */
    async getNotificationStats() {
        try {
            const { db } = await import('./database.js');
            const allUsers = db.getAllUsers();
            
            let totalUsers = 0;
            let blockedUsers = 0;
            let tasksEnabled = 0;
            let prayerEnabled = 0;
            
            for (const user of Object.values(allUsers)) {
                totalUsers++;
                
                if (user.activity?.blockedBot) {
                    blockedUsers++;
                } else {
                    if (user.preferences?.notifications?.tasks !== false) tasksEnabled++;
                    if (user.preferences?.notifications?.prayer !== false) prayerEnabled++;
                }
            }
            
            return {
                totalUsers,
                blockedUsers,
                activeUsers: totalUsers - blockedUsers,
                tasksEnabled,
                prayerEnabled,
                systemRunning: this.isRunning
            };
        } catch (error) {
            logger.error('Failed to get notification stats:', error);
            return null;
        }
    }

    /**
     * Get task notification message
     */
    getTaskNotificationMessage(task, interval, minutesUntilDue) {
        const timeRemaining = this.formatTimeRemaining(Math.max(0, minutesUntilDue));
        const priority = this.getPriorityEmoji(task.priority);
        
        if (interval.id === 'due') {
            return `⏰ **VAZIFA VAQTI KELDI!**\n\n` +
                   `${priority} **${task.name}**\n\n` +
                   `📅 **Sana:** ${this.formatDate(new Date(task.date))}\n` +
                   `📁 **Kategoriya:** ${task.category || 'Umumiy'}\n\n` +
                   `🎯 Hozir bajarish vaqti!`;
        } else {
            return `⏰ **VAZIFA ESLATMASI**\n\n` +
                   `${priority} **${task.name}**\n\n` +
                   `📅 **Sana:** ${this.formatDate(new Date(task.date))}\n` +
                   `⏳ **Qolgan vaqt:** ${timeRemaining}\n` +
                   `📁 **Kategoriya:** ${task.category || 'Umumiy'}\n\n` +
                   `💡 Tayyorgarlik ko'ring!`;
        }
    }

    /**
     * Get prayer notification message
     */
    getPrayerNotificationMessage(prayer, prayerTime, interval, region) {
        const prayerNames = {
            'Fajr': '🌅 Bomdod',
            'Dhuhr': '🌞 Peshin', 
            'Asr': '🌇 Asr',
            'Maghrib': '🌆 Shom',
            'Isha': '🌃 Xufton'
        };

        const prayerName = prayerNames[prayer] || prayer;
        
        return `🕌 **NAMAZ VAQTI ESLATMASI**\n\n` +
               `${prayerName} namazi ${interval.minutes} daqiqadan keyin\n\n` +
               `⏰ **Vaqt:** ${prayerTime}\n` +
               `📍 **Hudud:** ${region}\n\n` +
               `🤲 Tahorat oling va tayyorgarlik ko'ring!`;
    }

    /**
     * Parse prayer time string to Date object
     */
    parsePrayerTime(timeStr, baseDate) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    /**
     * Get notification key for task
     */
    getNotificationKey(intervalId) {
        const keyMap = {
            '1day': 'sent1Day',
            '1hour': 'sent1Hour', 
            '15min': 'sent15Min',
            'due': 'sentDue'
        };
        return keyMap[intervalId] || 'sentUnknown';
    }

    /**
     * Format time remaining
     */
    formatTimeRemaining(minutes) {
        if (minutes <= 0) return 'Vaqt tugadi';
        if (minutes < 60) return `${minutes} daqiqa`;
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours < 24) {
            return remainingMinutes > 0 ? `${hours} soat ${remainingMinutes} daqiqa` : `${hours} soat`;
        }
        
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days} kun ${remainingHours} soat` : `${days} kun`;
    }

    /**
     * Get priority emoji
     */
    getPriorityEmoji(priority) {
        const priorityEmojis = {
            'high': '🔴',
            'medium': '🟡', 
            'low': '🟢'
        };
        return priorityEmojis[priority] || '⚪';
    }

    /**
     * Format date
     */
    formatDate(date) {
        return date.toLocaleDateString('uz-UZ', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

export { NotificationService };
