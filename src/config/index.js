import 'dotenv/config';

export const config = {
    // Bot configuration
    BOT_TOKEN: process.env.BOT_TOKEN,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATA_FILE: process.env.DATA_FILE || './tasks.json',
    
    // Features
    features: {
        prayer_times: true,
        teams: true,
        templates: true,
        notifications: true,
        attachments: true
    },
    
    // Limits
    limits: {
        max_tasks_per_user: 1000,
        max_team_members: 50,
        max_callback_storage: 1000,
        callback_cleanup_interval: 60 * 60 * 1000, // 1 hour
        max_attachment_size: 20 * 1024 * 1024 // 20MB
    },
    
    // Timeouts
    timeouts: {
        user_state_timeout: 30 * 60 * 1000, // 30 minutes
        callback_timeout: 24 * 60 * 60 * 1000 // 24 hours
    },
    
    // Default settings
    defaults: {
        timezone: 'Asia/Tashkent',
        language: 'uz',
        prayer_region: 'Toshkent'
    }
};

// Validation
if (!config.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required!');
    process.exit(1);
}
