#!/usr/bin/env node

/**
 * Environment Validation Script
 * Run this script to validate your Railway deployment environment
 */

import 'dotenv/config';
import { config } from './src/config/index.js';
import { logger } from './src/utils/logger.js';

console.log('🔍 Validating Railway Environment Configuration...\n');

// Check BOT_TOKEN
if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN environment variable is missing!');
    console.log('   Add your bot token to Railway environment variables:');
    console.log('   BOT_TOKEN=your_bot_token_here\n');
    process.exit(1);
} else {
    console.log('✅ BOT_TOKEN is set');
    const tokenPreview = process.env.BOT_TOKEN.substring(0, 10) + '...';
    console.log(`   Preview: ${tokenPreview}\n`);
}

// Check NODE_ENV
console.log(`📍 NODE_ENV: ${process.env.NODE_ENV || 'not set (defaults to development)'}`);

// Check DATA_FILE path
console.log(`💾 Data file path: ${config.DATA_FILE}`);

// Check if we can import database
try {
    const { db } = await import('./src/services/database.js');
    console.log('✅ Database service can be imported');
} catch (error) {
    console.error('❌ Failed to import database service:', error.message);
}

// Check if we can import notification service
try {
    const { NotificationService } = await import('./src/services/notification.js');
    console.log('✅ Notification service can be imported');
} catch (error) {
    console.error('❌ Failed to import notification service:', error.message);
}

// Check if we can import bot
try {
    const { TodoBot } = await import('./bot.js');
    console.log('✅ Bot can be imported');
} catch (error) {
    console.error('❌ Failed to import bot:', error.message);
}

// Test logger
try {
    logger.info('Testing logger functionality...');
    console.log('✅ Logger is working');
} catch (error) {
    console.error('❌ Logger test failed:', error.message);
}

console.log('\n🎯 Environment validation complete!');
console.log('\nNext steps:');
console.log('1. If there are errors, fix them in Railway environment variables');
console.log('2. Deploy to Railway and check logs');
console.log('3. Test bot by sending /start command');
console.log('4. Check notifications with /notifications command');
