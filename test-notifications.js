#!/usr/bin/env node

/**
 * Notification Testing Script
 * Test notification functionality locally before deployment
 */

import 'dotenv/config';
import { Bot } from 'grammy';
import { config } from './src/config/index.js';
import { logger } from './src/utils/logger.js';
import { NotificationService } from './src/services/notification.js';
import { db } from './src/services/database.js';

async function testNotifications() {
    console.log('🧪 Testing Notification System...\n');

    if (!config.BOT_TOKEN) {
        console.error('❌ BOT_TOKEN is required for testing');
        process.exit(1);
    }

    try {
        // Initialize bot and services
        const bot = new Bot(config.BOT_TOKEN);
        const notificationService = new NotificationService(bot);
        
        await db.init();
        console.log('✅ Database initialized');

        // Test notification service startup
        notificationService.start();
        console.log('✅ Notification service started');

        // Get notification stats
        const stats = await notificationService.getNotificationStats();
        if (stats) {
            console.log('✅ Notification stats retrieved:');
            console.log(`   - Total users: ${stats.totalUsers}`);
            console.log(`   - Active users: ${stats.activeUsers}`);
            console.log(`   - Blocked users: ${stats.blockedUsers}`);
            console.log(`   - Task notifications enabled: ${stats.tasksEnabled}`);
            console.log(`   - Prayer notifications enabled: ${stats.prayerEnabled}`);
            console.log(`   - System running: ${stats.systemRunning}`);
        } else {
            console.log('⚠️  Could not retrieve notification stats');
        }

        // Test error handling methods
        console.log('\n🔧 Testing error handling...');
        
        const testError1 = new Error('Forbidden: bot was blocked by the user');
        const testError2 = new Error('Too Many Requests: retry after 30');
        const testError3 = new Error('Some other error');

        console.log(`   - Block error detection: ${notificationService.isUserBlockedError(testError1) ? '✅' : '❌'}`);
        console.log(`   - Retryable error detection: ${notificationService.isRetryableError(testError2) ? '✅' : '❌'}`);
        console.log(`   - Other error handling: ${!notificationService.isUserBlockedError(testError3) && !notificationService.isRetryableError(testError3) ? '✅' : '❌'}`);

        // Stop notification service
        notificationService.stop();
        console.log('✅ Notification service stopped');

        console.log('\n🎉 Notification system test completed successfully!');
        console.log('\nRecommendations:');
        console.log('1. Deploy to Railway and monitor logs');
        console.log('2. Test with real users using /start and /notifications commands');
        console.log('3. Check that blocked users are properly handled');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testNotifications();
