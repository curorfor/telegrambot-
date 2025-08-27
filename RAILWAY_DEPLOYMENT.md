# Railway Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Railway Setup
1. Go to [Railway.app](https://railway.app)
2. Sign up/Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `telegrambot` repository

### 2. Environment Variables
Set these environment variables in Railway dashboard:

**Required:**
```
BOT_TOKEN=your_telegram_bot_token_here
NODE_ENV=production
```

**Optional:**
```
DATA_FILE=/app/data/tasks.json
```

### 3. Deployment Configuration
Railway will automatically detect the Dockerfile and deploy. The deployment includes:

- ✅ Node.js 20 Alpine Linux
- ✅ Production dependencies only
- ✅ Data persistence in `/app/data`
- ✅ Automatic restarts on failure
- ✅ Health monitoring

### 4. Verification
After deployment:
1. Check the deployment logs for "Bot started successfully"
2. Test your bot in Telegram
3. Monitor Railway dashboard for any errors

## 🔧 Files Added for Railway

- `Dockerfile` - Updated for Railway compatibility
- `railway.toml` - Railway configuration
- `.railwayignore` - Files to ignore during deployment

## 🛠 Troubleshooting

### Bot Token Issues
```bash
# Check if BOT_TOKEN is set correctly in Railway dashboard
# Make sure there are no extra spaces or characters
```

### Deployment Failures
- Railway uses the updated Dockerfile without user creation commands
- All file permissions are handled automatically
- No manual Docker user setup required

### Data Persistence
- Tasks are saved to `/app/data/tasks.json`
- Railway provides persistent storage for this directory
- Data survives deployments and restarts

## 🔄 Redeployment
Railway automatically redeploys when you push to your main branch.

Manual redeployment:
1. Go to Railway dashboard
2. Click your project
3. Click "Deploy" button

## 📊 Monitoring
- View logs in Railway dashboard
- Check deployment status
- Monitor resource usage
- Set up custom domains if needed
