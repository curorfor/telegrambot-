import { Bot, InlineKeyboard, InputFile } from 'grammy';
import fs from 'fs/promises';
import cron from 'node-cron';
import path from 'path';

// Bot token
const BOT_TOKEN = '8495849276:AAFZhSLduCvLNULD6oZsmMz_bt80Wd5KNP0';

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Data file path - use environment variable or default
const DATA_FILE = process.env.DATA_FILE || './tasks.json';

// Initialize data structure
let userData = {};
let userStates = {}; // Track conversation states

// Load data from file
async function loadData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        userData = JSON.parse(data);
        
        // Convert date strings back to Date objects
        for (const userId in userData) {
            if (userData[userId].tasks) {
                userData[userId].tasks.forEach(task => {
                    if (task.date && typeof task.date === 'string') {
                        task.date = new Date(task.date);
                    }
                    if (task.createdAt && typeof task.createdAt === 'string') {
                        task.createdAt = new Date(task.createdAt);
                    }
                    if (task.completedAt && typeof task.completedAt === 'string') {
                        task.completedAt = new Date(task.completedAt);
                    }
                });
            }
        }
    } catch (error) {
        userData = {};
    }
}

// Save data to file
async function saveData() {
    await fs.writeFile(DATA_FILE, JSON.stringify(userData, null, 2));
}

// Initialize user data if not exists
function initUser(userId) {
    if (!userData[userId]) {
        userData[userId] = {
            tasks: [],
            nextTaskId: 1
        };
    }
}

// Set user conversation state
function setUserState(userId, state, data = {}) {
    userStates[userId] = { state, data };
}

// Get user conversation state
function getUserState(userId) {
    return userStates[userId] || { state: 'idle', data: {} };
}

// Clear user conversation state
function clearUserState(userId) {
    delete userStates[userId];
}

// Parse date and time
function parseDateTime(dateTimeStr) {
    const regex = /^(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/;
    const match = dateTimeStr.match(regex);
    
    if (!match) {
        return null;
    }
    
    const [, day, month, year, hour, minute] = match;
    const fullYear = 2000 + parseInt(year);
    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    
    return date;
}

// Format date for display
function formatDate(date) {
    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear().toString().slice(-2);
    const hour = dateObj.getHours().toString().padStart(2, '0');
    const minute = dateObj.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year} ${hour}:${minute}`;
}

// Get priority emoji
function getPriorityEmoji(priority) {
    switch (priority) {
        case 'high': return '🔴';
        case 'medium': return '🟡';
        case 'low': return '🟢';
        default: return '⚪';
    }
}

// Get status emoji
function getStatusEmoji(completed) {
    return completed ? '✅' : '⏳';
}

// Start command
bot.command('start', async (ctx) => {
    const welcomeMessage = `
🤖 **Telegram To-Do Bot**ga xush kelibsiz!

📝 **Mavjud buyruqlar:**
/add - Yangi vazifa qo'shish
/tasks - Barcha vazifalar ro'yxati
/complete - Vazifani bajarilgan deb belgilash
/delete - Vazifani o'chirish

💡 **Qo'llanma:**
• Vazifa qo'shish uchun /add buyrug'ini ishlating
• Vaqt formati: kk.oo.yy ss:dd (masalan: 21.07.25 14:30)
• Darajalar: low, medium, high
    `;
    
    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
});

// Add command
bot.command('add', async (ctx) => {
    const userId = ctx.from.id.toString();
    initUser(userId);
    
    setUserState(userId, 'waiting_task_name');
    await ctx.reply('📝 Vazifa nomini kiriting:');
});

// Tasks command
bot.command('tasks', async (ctx) => {
    const userId = ctx.from.id.toString();
    initUser(userId);
    clearUserState(userId); // Clear any ongoing conversation
    
    const tasks = userData[userId].tasks;
    
    if (tasks.length === 0) {
        await ctx.reply('📋 Sizda hozircha vazifalar yo\'q.\n\nYangi vazifa qo\'shish uchun /add buyrug\'ini ishlating.');
        return;
    }
    
    let message = '📋 **Sizning vazifalaringiz:**\n\n';
    
    tasks.forEach((task, index) => {
        const status = getStatusEmoji(task.completed);
        const priority = getPriorityEmoji(task.priority);
        const statusText = task.completed ? 'Bajarilgan' : 'Faol';
        
        message += `${index + 1}. ${status} **${task.name}**\n`;
        message += `   ⏰ ${formatDate(task.date)}\n`;
        message += `   📊 ${priority} ${task.priority.toUpperCase()}\n`;
        message += `   📌 ${statusText}\n\n`;
    });
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Complete command
bot.command('complete', async (ctx) => {
    const userId = ctx.from.id.toString();
    initUser(userId);
    clearUserState(userId); // Clear any ongoing conversation
    
    const incompleteTasks = userData[userId].tasks.filter(task => !task.completed);
    
    if (incompleteTasks.length === 0) {
        await ctx.reply('✅ Barcha vazifalar bajarilgan yoki vazifalar yo\'q.');
        return;
    }
    
    let message = '✅ **Qaysi vazifani bajarilgan deb belgilamoqchisiz?**\n\n';
    const keyboard = new InlineKeyboard();
    
    incompleteTasks.forEach((task, index) => {
        const priority = getPriorityEmoji(task.priority);
        message += `${index + 1}. ${priority} ${task.name}\n`;
        message += `   ⏰ ${formatDate(task.date)}\n\n`;
        
        keyboard.text(`${index + 1}. ${task.name}`, `complete_${task.id}`).row();
    });
    
    await ctx.reply(message, { reply_markup: keyboard, parse_mode: 'Markdown' });
});

// Handle task completion
bot.callbackQuery(/^complete_(\d+)$/, async (ctx) => {
    const userId = ctx.from.id.toString();
    const taskId = parseInt(ctx.match[1]);
    
    const task = userData[userId].tasks.find(t => t.id === taskId);
    
    if (!task) {
        await ctx.answerCallbackQuery('❌ Vazifa topilmadi.');
        return;
    }
    
    task.completed = true;
    task.completedAt = new Date();
    
    await saveData();
    
    await ctx.editMessageText(`✅ **Vazifa bajarilgan deb belgilandi!**\n\n📝 ${task.name}`, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery('✅ Vazifa bajarildi!');
});

// Delete command
bot.command('delete', async (ctx) => {
    const userId = ctx.from.id.toString();
    initUser(userId);
    clearUserState(userId); // Clear any ongoing conversation
    
    const tasks = userData[userId].tasks;
    
    if (tasks.length === 0) {
        await ctx.reply('📋 Sizda o\'chiriladigan vazifalar yo\'q.');
        return;
    }
    
    let message = '🗑️ **Qaysi vazifani o\'chirmoqchisiz?**\n\n';
    const keyboard = new InlineKeyboard();
    
    tasks.forEach((task, index) => {
        const status = getStatusEmoji(task.completed);
        const priority = getPriorityEmoji(task.priority);
        
        message += `${index + 1}. ${status} ${priority} ${task.name}\n`;
        message += `   ⏰ ${formatDate(task.date)}\n\n`;
        
        keyboard.text(`${index + 1}. ${task.name}`, `delete_${task.id}`).row();
    });
    
    await ctx.reply(message, { reply_markup: keyboard, parse_mode: 'Markdown' });
});

// Handle task deletion
bot.callbackQuery(/^delete_(\d+)$/, async (ctx) => {
    const userId = ctx.from.id.toString();
    const taskId = parseInt(ctx.match[1]);
    
    const taskIndex = userData[userId].tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
        await ctx.answerCallbackQuery('❌ Vazifa topilmadi.');
        return;
    }
    
    const task = userData[userId].tasks[taskIndex];
    userData[userId].tasks.splice(taskIndex, 1);
    
    await saveData();
    
    await ctx.editMessageText(`🗑️ **Vazifa o'chirildi!**\n\n📝 ${task.name}`, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery('🗑️ Vazifa o\'chirildi!');
});

// Handle priority selection
bot.callbackQuery(/^priority_(.+)$/, async (ctx) => {
    const userId = ctx.from.id.toString();
    const priority = ctx.match[1];
    const userState = getUserState(userId);
    
    if (userState.state !== 'waiting_priority' || !userState.data.taskName || !userState.data.taskDate) {
        await ctx.answerCallbackQuery('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
        return;
    }
    
    const taskId = userData[userId].nextTaskId++;
    
    const newTask = {
        id: taskId,
        name: userState.data.taskName,
        date: userState.data.taskDate,
        priority: priority,
        completed: false,
        createdAt: new Date()
    };
    
    userData[userId].tasks.push(newTask);
    clearUserState(userId);
    
    await saveData();
    
    const message = `✅ Vazifa muvaffaqiyatli qo'shildi!

📝 **Nom:** ${newTask.name}
⏰ **Vaqt:** ${formatDate(newTask.date)}
📊 **Daraja:** ${getPriorityEmoji(priority)} ${priority.toUpperCase()}`;
    
    await ctx.editMessageText(message, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery('✅ Vazifa qo\'shildi!');
});

// Handle text messages based on conversation state (MUST BE AFTER ALL COMMANDS)
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userState = getUserState(userId);
    const text = ctx.message.text;
    
    // Skip if it's a command - let command handlers process it
    if (text.startsWith('/')) {
        return;
    }
    
    initUser(userId);
    
    switch (userState.state) {
        case 'waiting_task_name':
            setUserState(userId, 'waiting_task_time', { taskName: text });
            await ctx.reply('⏰ Vazifa vaqtini kiriting (format: kk.oo.yy ss:dd, masalan: 21.07.25 14:30):');
            break;
            
        case 'waiting_task_time':
            const taskDate = parseDateTime(text);
            
            if (!taskDate) {
                await ctx.reply('❌ Noto\'g\'ri vaqt formati! Iltimos, kk.oo.yy ss:dd formatida kiriting (masalan: 21.07.25 14:30)');
                return;
            }
            
            if (taskDate < new Date()) {
                await ctx.reply('❌ O\'tgan vaqtni kirita olmaysiz! Kelajakdagi vaqtni kiriting.');
                return;
            }
            
            // Priority selection keyboard
            const keyboard = new InlineKeyboard()
                .text('🔴 High', 'priority_high')
                .text('🟡 Medium', 'priority_medium')
                .text('🟢 Low', 'priority_low');
            
            setUserState(userId, 'waiting_priority', { 
                taskName: userState.data.taskName, 
                taskDate: taskDate 
            });
            
            await ctx.reply('📊 Vazifa darajasini tanlang:', { reply_markup: keyboard });
            break;
            
        default:
            // No active conversation - do nothing
            break;
    }
});

// Notification system
function setupNotifications() {
    // Check every minute for due tasks
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        
        for (const userId in userData) {
            const user = userData[userId];
            
            for (const task of user.tasks) {
                if (!task.completed && !task.notified) {
                    const taskTime = new Date(task.date);
                    
                    // Send notification if task time has arrived (within 1 minute window)
                    if (taskTime <= now && (now - taskTime) < 60000) {
                        try {
                            const priority = getPriorityEmoji(task.priority);
                            const message = `⏰ **Vazifa vaqti keldi!**\n\n📝 **Nom:** ${task.name}\n📊 **Daraja:** ${priority} ${task.priority.toUpperCase()}\n⏰ **Vaqt:** ${formatDate(taskTime)}`;
                            
                            await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
                            task.notified = true;
                            await saveData();
                        } catch (error) {
                            console.error(`Error sending notification to user ${userId}:`, error);
                        }
                    }
                }
            }
        }
    });
}

// Error handling
bot.catch((err) => {
    console.error('Bot error:', err);
});

// Initialize and start bot
async function startBot() {
    await loadData();
    setupNotifications();
    
    console.log('🤖 Telegram To-Do Bot ishga tushdi!');
    console.log('Bot username:', await bot.api.getMe().then(me => me.username));
    
    await bot.start();
}

startBot();
