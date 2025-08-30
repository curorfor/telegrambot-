# PM2 Process Manager

The bot is now managed by PM2 for:
- Auto-restart on crash
- Auto-start on system reboot
- Process monitoring
- Log management

## Commands:
- `pm2 list` - Check status
- `pm2 restart telegram-bot` - Restart after code changes
- `pm2 logs telegram-bot` - View logs
- `pm2 monit` - Real-time monitoring

Bot is running with long polling and 52 callback handlers.

