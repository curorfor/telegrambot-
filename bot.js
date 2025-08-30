#!/usr/bin/env node

/**
 * Enhanced Telegram To-Do Bot v2.0
 * 
 * A modern, modular Telegram bot for task management with:
 * - Better architecture and maintainability
 * - Fixed inline keyboard issues
 * - Enhanced error handling
 * - Improved state management
 * - Cleaner code organization
 */

import { Bot, InlineKeyboard } from 'grammy';
import { config } from './src/config/index.js';
import { logger } from './src/utils/logger.js';
import { db } from './src/services/database.js';
import { errorMiddleware } from './src/middleware/error.js';
import { stateMiddleware } from './src/middleware/state.js';
import { callbackHandler } from './src/handlers/callback.js';
import { keyboardBuilder } from './src/utils/keyboard.js';
import { prayerService } from './src/services/prayer.js';
import { NotificationService } from './src/services/notification.js';
import { teamService } from './src/services/team.js';

/**
 * Main Bot Class
 */
class TodoBot {
    constructor() {
        this.bot = new Bot(config.BOT_TOKEN);
        this.notificationService = new NotificationService(this.bot);
        this.setupMiddleware();
        this.setupHandlers();
    }

    /**
     * Setup middleware
     */
    setupMiddleware() {
        // Error handling (must be first)
        this.bot.use(errorMiddleware());
        
        // State management
        this.bot.use(stateMiddleware());
        
        // User initialization
        this.bot.use(async (ctx, next) => {
            if (ctx.from?.id) {
                db.initUser(ctx.from.id, ctx.from);
            }
            await next();
        });

        logger.info('Middleware setup complete');
    }

    /**
     * Setup command and callback handlers
     */
    setupHandlers() {
        // Commands
        this.bot.command('start', this.handleStart.bind(this));
        this.bot.command('tasks', this.handleTasks.bind(this));
        this.bot.command('add', this.handleAdd.bind(this));
        this.bot.command('profile', this.handleProfile.bind(this));
        this.bot.command('help', this.handleHelp.bind(this));
        this.bot.command('stats', this.handleStats.bind(this));
        this.bot.command('notifications', this.handleNotifications.bind(this));
        
        // Prayer commands
        this.bot.command('prayer', this.handlePrayer.bind(this));
        this.bot.command('setprayerregion', this.handleSetPrayerRegion.bind(this));
        
        // Register team commands
        this.bot.command('team', this.handleTeam.bind(this));
        this.bot.command('createteam', this.handleCreateTeam.bind(this));
        this.bot.command('jointeam', this.handleJoinTeam.bind(this));
        this.bot.command('assign', this.handleAssign.bind(this));

        // Callback queries
        this.bot.callbackQuery(/.+/, callbackHandler.handle.bind(callbackHandler));

        // Text messages (for conversation flows)
        this.bot.on('message:text', this.handleTextMessage.bind(this));

        logger.info('Handlers setup complete');
    }

    /**
     * Command: /start
     */
    async handleStart(ctx) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        logger.command('start', userId);

        const isNewUser = !user.activity.lastActivity || 
                         new Date() - new Date(user.activity.registrationDate) < 60000;

        let message;
        if (isNewUser) {
            message = `🎉 **Xush kelibsiz, ${ctx.from.first_name || 'Foydalanuvchi'}!**\n\n` +
                     '📝 **Telegram To-Do Bot** - vazifalaringizni boshqaring!\n\n' +
                     '✨ **Imkoniyatlar:**\n' +
                     '• ➕ Vazifalar qo\'shish va boshqarish\n' +
                     '• ⏰ Smart eslatmalar\n' +
                     '• 🏆 Kategoriyalar va prioritetlar\n' +
                     '• 👥 Jamoa bilan ishlash\n' +
                     '• 🕌 Namoz vaqtlari\n' +
                     '• 📊 Tahlil va statistika\n\n' +
                     '🚀 **Boshlash uchun quyidagi tugmalardan foydalaning:**';
        } else {
            message = `👋 **Qaytganingiz bilan, ${ctx.from.first_name || 'Foydalanuvchi'}!**\n\n` +
                     '📋 Vazifalaringizni boshqarishda davom eting:';
        }

        const keyboard = keyboardBuilder
            .button('📋 Vazifalarim', 'back_to_main_tasks')
            .button('👥 Jamoa', 'show_team_features')
            .row()
            .button('👤 Profil', 'view_profile')
            .button('❓ Yordam', 'show_help')
            .build();

        await ctx.reply(message, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
    }

    /**
     * Command: /tasks
     */
    async handleTasks(ctx) {
        logger.command('tasks', ctx.from.id);
        
        // Simulate callback to main tasks handler
        const mockCallbackCtx = {
            ...ctx,
            callbackQuery: { data: 'back_to_main_tasks' }
        };
        
        await callbackHandler.handleBackToMainTasks(mockCallbackCtx, {});
    }

    /**
     * Command: /add
     */
    async handleAdd(ctx) {
        logger.command('add', ctx.from.id);
        
        ctx.state.set('waiting_task_name', {});
        
        await ctx.reply(
            '📝 **Yangi vazifa qo\'shish**\n\n' +
            'Vazifa nomini kiriting:\n\n' +
            '💡 *Masalan: "Prezentatsiya tayyorlash", "Dukonga borish"*',
            { parse_mode: 'Markdown' }
        );
    }

    /**
     * Command: /profile
     */
    async handleProfile(ctx) {
    const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        logger.command('profile', userId);

        const stats = this.getUserStats(user);
        
        let profileText = `👤 **Profil: ${ctx.from.first_name || 'User'}**\n\n`;
        profileText += `📊 **Statistika:**\n`;
        profileText += `📝 **Jami:** ${stats.total} ta vazifa\n`;
        profileText += `✅ **Bajarilgan:** ${stats.completed} ta\n`;
        profileText += `⏳ **Faol:** ${stats.active} ta\n`;
    profileText += `📈 **Bajarish darajasi:** ${stats.completionRate}%\n`;

        const keyboard = keyboardBuilder
            .button('⚙️ Sozlamalar', 'simple_settings')
        .row()
            .button('📊 Batafsil statistika', 'detailed_stats')
            .build();

    await ctx.reply(profileText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
    }

    /**
     * Command: /help
     */
    async handleHelp(ctx) {
        logger.command('help', ctx.from.id);

        const helpText = `❓ **YORDAM VA QOʻLLANMA**\n\n` +
                        `📝 **Asosiy buyruqlar:**\n` +
                        `/start - Botni ishga tushirish\n` +
                        `/tasks - Barcha vazifalar\n` +
                        `/add - Yangi vazifa qo'shish\n` +
                        `/profile - Profil va statistika\n` +
                        `/help - Bu yordam xabari\n\n` +
                        `🕌 **Namaz vaqtlari:**\n` +
                        `/prayer - Namaz vaqtlarini ko'rish\n` +
                        `/prayer Toshkent - Toshkent namaz vaqtlari\n` +
                        `/setprayerregion - Hududni tanlash\n\n` +
                        `🔧 **Funksiyalar:**\n` +
                        `• ➕ Vazifalar yaratish va boshqarish\n` +
                        `• ⏰ Vaqt va eslatmalar\n` +
                        `• 🏆 Prioritet va kategoriyalar\n` +
                        `• 👥 Jamoa bilan ishlash\n` +
                        `• 🕌 Namaz vaqtlari va bildirishnomalar\n` +
                        `• 📊 Tahlil va hisobotlar\n\n` +
                        `💡 **Maslahat:** Tugmalar orqali oson boshqaring!`;

        await ctx.reply(helpText, { parse_mode: 'Markdown' });
    }

    /**
     * Command: /stats
     */
    async handleStats(ctx) {
    const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        logger.command('stats', userId);

        const stats = this.getUserStats(user);
        const dbStats = db.getStats();

        let statsText = `📊 **BATAFSIL STATISTIKA**\n\n`;
        statsText += `👤 **Shaxsiy:**\n`;
        statsText += `📝 Jami vazifalar: ${stats.total}\n`;
        statsText += `✅ Bajarilgan: ${stats.completed} (${stats.completionRate}%)\n`;
        statsText += `⏳ Faol: ${stats.active}\n`;
        statsText += `⚠️ Muddati o'tgan: ${stats.overdue}\n`;
        statsText += `📅 Ro'yxatdan o'tgan: ${this.formatDate(user.activity.registrationDate)}\n\n`;

        statsText += `🌐 **Global:**\n`;
        statsText += `👥 Jami foydalanuvchilar: ${dbStats.users}\n`;
        statsText += `📝 Jami vazifalar: ${dbStats.total_tasks}\n`;
        statsText += `✅ Bajarilgan: ${dbStats.completed_tasks} (${dbStats.completion_rate}%)\n`;

        await ctx.reply(statsText, { parse_mode: 'Markdown' });
    }

    /**
     * Command: /notifications
     */
    async handleNotifications(ctx) {
        const userId = ctx.from.id.toString();
        
        logger.command('notifications', userId);

        try {
            const stats = await this.notificationService.getNotificationStats();
            
            if (!stats) {
                await ctx.reply('❌ Bildirishnoma statistikalarini olishda xatolik yuz berdi.');
                return;
            }

            let statsText = `🔔 **BILDIRISHNOMA TIZIMI**\n\n`;
            statsText += `📊 **Statistika:**\n`;
            statsText += `👥 Jami foydalanuvchilar: ${stats.totalUsers}\n`;
            statsText += `✅ Faol foydalanuvchilar: ${stats.activeUsers}\n`;
            statsText += `🚫 Bloklanganlar: ${stats.blockedUsers}\n`;
            statsText += `📝 Vazifa bildirish.: ${stats.tasksEnabled}\n`;
            statsText += `🕌 Namaz bildirish.: ${stats.prayerEnabled}\n`;
            statsText += `⚙️ Tizim holati: ${stats.systemRunning ? '✅ Ishlamoqda' : '❌ To\'xtatilgan'}\n\n`;
            
            if (stats.blockedUsers > 0) {
                statsText += `⚠️ **Diqqat:** ${stats.blockedUsers} ta foydalanuvchi botni bloklagan.\n`;
                statsText += `Bu foydalanuvchilarga bildirishnomalar yuborilmaydi.\n\n`;
            }

            await ctx.reply(statsText, { parse_mode: 'Markdown' });

        } catch (error) {
            logger.error('Failed to get notification stats:', error);
            await ctx.reply('❌ Bildirishnoma statistikalarini olishda xatolik yuz berdi.');
        }
    }

    /**
     * Command: /prayer [region]
     */
    async handlePrayer(ctx) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        logger.command('prayer', userId);

        // Get region from command or user's saved region
        const commandText = ctx.message.text;
        const parts = commandText.split(' ');
        let region = parts.length > 1 ? parts.slice(1).join(' ') : null;
        
        if (!region) {
            region = user.preferences?.prayerRegion || user.prayerRegion || 'Toshkent';
        }

        try {
            // Get prayer times
            const prayerTimes = await prayerService.getPrayerTimes(region);
            const formattedTimes = prayerService.formatForDisplay(prayerTimes, region);

            const keyboard = new InlineKeyboard()
                .text('🔄 Hududni o\'zgartirish', keyboardBuilder.encodeCallback('change_prayer_region', {}))
        .row()
                .text('⚙️ Bildirishnoma sozlash', keyboardBuilder.encodeCallback('notification_settings', {}));

            await ctx.reply(formattedTimes, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });

        } catch (error) {
            logger.error('Failed to get prayer times', error);
            await ctx.reply('❌ Namaz vaqtlarini olishda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
        }
    }

    /**
     * Handle /team command
     */
    async handleTeam(ctx) {
        const userId = ctx.from.id.toString();
        logger.command('team', userId);
        
        const userTeams = teamService.getUserTeams(userId);
        
        if (userTeams.length === 0) {
            const keyboard = new InlineKeyboard()
                .text('➕ Jamoa yaratish', keyboardBuilder.encodeCallback('create_team_quick', {}))
                .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}));
            
            await ctx.reply(
                '👥 **Siz hech qaysi jamoada emassiz**\n\n' +
                '🚀 Jamoa yarating yoki mavjud jamoaga qo\'shiling!\n\n' +
                '💡 **Jamoa nima beradi?**\n' +
                '• Vazifalarni taqsimlash\n' +
                '• Jamoaviy ishlash\n' +
                '• Progress kuzatish\n' +
                '• Samaradorlikni oshirish',
                { 
        reply_markup: keyboard,
        parse_mode: 'Markdown'
                }
            );
        return;
    }

        if (userTeams.length === 1) {
            // Show the single team
            const team = userTeams[0];
            const stats = teamService.getTeamStats(team.id);
            const isAdmin = teamService.isTeamAdmin(userId, team.id);
            const userRole = isAdmin ? 'admin' : 'member';
            
            const message = teamService.formatTeamInfo(team, stats, userRole);
            
            const keyboard = new InlineKeyboard()
                .text('📝 Vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId: team.id }))
                .text('👥 A\'zolar', keyboardBuilder.encodeCallback('team_members', { teamId: team.id }))
                .row();
                
            if (isAdmin) {
                keyboard.text('⚙️ Boshqarish', keyboardBuilder.encodeCallback('team_admin', { teamId: team.id }));
            }
            
            keyboard.row()
                   .text('➕ Yangi jamoa', keyboardBuilder.encodeCallback('create_team_quick', {}))
                   .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}));
            
            await ctx.reply(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
        } else {
            // Multiple teams - show selection
            let message = `👥 **SIZNING JAMOALARINGIZ (${userTeams.length})**\n\n`;

    const keyboard = new InlineKeyboard();
            userTeams.forEach((team, index) => {
                const stats = teamService.getTeamStats(team.id);
                const isAdmin = teamService.isTeamAdmin(userId, team.id);
                const role = isAdmin ? '👑' : '👤';
                
                message += `${index + 1}. ${role} **${team.name}**\n`;
                message += `   🆔 \`${team.id}\` | 👥 ${stats.totalMembers} a'zo\n\n`;
                
                keyboard.text(`${index + 1}. ${team.name}`, keyboardBuilder.encodeCallback('show_team', { teamId: team.id }));
            keyboard.row();
            });
            
            keyboard.text('➕ Yangi jamoa', keyboardBuilder.encodeCallback('create_team_quick', {}))
                   .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}));
            
            await ctx.reply(message, { 
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}
    }

    /**
     * Handle /createteam command
     */
    async handleCreateTeam(ctx) {
    const userId = ctx.from.id.toString();
        logger.command('createteam', userId);
        
        ctx.state.set('waiting_team_name', { fromCommand: true });

                await ctx.reply(
            '👥 **Yangi jamoa yaratish**\n\n' +
            'Jamoa nomini kiriting:\n\n' +
            '💡 *Masalan: "Loyiha jamoasi", "Dars guruhi", "Ish jamoasi"*\n\n' +
            '📝 **Eslatma:** Jamoa yaratilgandan keyin sizga 6 raqamli kod beriladi. ' +
            'Bu kod orqali boshqa foydalanuvchilar jamoaga qo\'shilishlari mumkin.',
            { parse_mode: 'Markdown' }
        );
    }

    /**
     * Handle /jointeam command
     */
    async handleJoinTeam(ctx) {
        const userId = ctx.from.id.toString();
        logger.command('jointeam', userId);
        
        ctx.state.set('waiting_team_code', { fromCommand: true });

                await ctx.reply(
            '🔑 **Jamoaga qo\'shilish**\n\n' +
            'Jamoa kodini kiriting:\n\n' +
            '💡 *6 raqamli kod, masalan: ABC123*\n\n' +
            '📝 **Eslatma:** Jamoa kodi jamoa admin tomonidan beriladi. ' +
            'Kodni to\'g\'ri kiritganingizga ishonch hosil qiling.',
            { parse_mode: 'Markdown' }
        );
    }

    /**
     * Handle /assign command
     */
    async handleAssign(ctx) {
        const userId = ctx.from.id.toString();
        logger.command('assign', userId);
        
        const userTeams = teamService.getUserTeams(userId);
        
        if (userTeams.length === 0) {
                await ctx.reply(
                '❌ **Siz hech qaysi jamoada emassiz**\n\n' +
                'Vazifa tayinlash uchun avval jamoa yarating yoki jamoaga qo\'shiling.\n\n' +
                '/createteam - Yangi jamoa yaratish\n' +
                '/jointeam - Mavjud jamoaga qo\'shilish',
                { parse_mode: 'Markdown' }
            );
        return;
    }

        // Check if user has personal tasks to assign
        const user = db.getUser(userId);
        const personalTasks = user.tasks.filter(t => !t.completed && !t.assignedTo);
        
        if (personalTasks.length === 0) {
                await ctx.reply(
                '📋 **Tayinlash uchun shaxsiy vazifalar yo\'q**\n\n' +
                'Avval /add buyrug\'i bilan vazifa qo\'shing, keyin uni jamoaga tayinlashingiz mumkin.',
                { parse_mode: 'Markdown' }
                );
                    return;
                }

        // Show teams to assign to
        let message = `📝 **VAZIFA TAYINLASH**\n\n`;
        message += `Sizda ${personalTasks.length} ta tayinlanmagan vazifa bor.\n\n`;
        message += `Qaysi jamoaga vazifa tayinlamoqchisiz?\n\n`;
        
        const keyboard = new InlineKeyboard();
        userTeams.forEach(team => {
            const stats = teamService.getTeamStats(team.id);
            message += `👥 **${team.name}** (${stats.totalMembers} a'zo)\n`;
            keyboard.text(`👥 ${team.name}`, keyboardBuilder.encodeCallback('assign_to_team', { teamId: team.id }));
            keyboard.row();
        });
        
        await ctx.reply(message, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
    }

    /**
     * Handle team name input
     */
    async handleTeamName(ctx, teamName) {
    const userId = ctx.from.id.toString();
        
        if (teamName.length < 3) {
            await ctx.reply('❌ Jamoa nomi juda qisqa. Kamida 3 ta belgi kiriting.');
        return;
    }
    
        if (teamName.length > 50) {
            await ctx.reply('❌ Jamoa nomi juda uzun. Maksimal 50 ta belgi.');
        return;
    }

        try {
            const team = await teamService.createTeam(teamName, userId);
            ctx.state.clear();

        const keyboard = new InlineKeyboard()
                .text('👥 Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId: team.id }))
                .text('📤 Kodni ulashish', keyboardBuilder.encodeCallback('share_team_code', { teamId: team.id }))
            .row()
                .text('🔑 Yana jamoa yaratish', keyboardBuilder.encodeCallback('create_team_quick', {}))
                .text('📋 Vazifalar', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));
                
            await ctx.reply(
                `🎉 **Jamoa yaratildi!**\n\n` +
                `👥 **Nomi:** ${team.name}\n` +
                `🆔 **Kod:** \`${team.id}\`\n` +
                `👑 **Admin:** Siz\n` +
                `📅 **Yaratilgan:** ${new Date().toLocaleDateString('uz-UZ')}\n\n` +
                `📤 **Kodni ulashing:** Boshqa foydalanuvchilar \`${team.id}\` kodi bilan jamoaga qo'shilishlari mumkin.\n\n` +
                `🎯 Endi vazifalar tayinlashingiz va jamoa bilan samarali ishlashingiz mumkin!`,
            { 
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            }
        );
            
            logger.info(`Team created: ${teamName} (${team.id}) by user ${userId}`);
            
        } catch (error) {
            logger.error('Failed to create team:', error);
            await ctx.reply('❌ Jamoa yaratishda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
        }
    }

    /**
     * Handle team code input
     */
    async handleTeamCode(ctx, teamCode) {
        const userId = ctx.from.id.toString();
        const inputTeamId = teamCode.toUpperCase();
        
        if (inputTeamId.length !== 6) {
            await ctx.reply('❌ Jamoa kodi 6 ta belgidan iborat bo\'lishi kerak. Qaytadan kiriting.');
        return;
    }

        try {
            const team = await teamService.joinTeam(inputTeamId, userId);
            ctx.state.clear();
            
            const stats = teamService.getTeamStats(inputTeamId);
            
        const keyboard = new InlineKeyboard()
                .text('👥 Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId: team.id }))
                .text('📝 Vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId: team.id }))
            .row()
                .text('👥 A\'zolar', keyboardBuilder.encodeCallback('team_members', { teamId: team.id }))
                .text('📋 Mening vazifalarim', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));
                
            await ctx.reply(
                `✅ **Jamoaga qo'shildingiz!**\n\n` +
                `👥 **Jamoa:** ${team.name}\n` +
                `🆔 **Kod:** \`${team.id}\`\n` +
                `👤 **A'zolar:** ${stats.totalMembers} kishi\n` +
                `📝 **Vazifalar:** ${stats.totalTasks} ta\n` +
                `📅 **Qo'shilgan:** ${new Date().toLocaleDateString('uz-UZ')}\n\n` +
                `🎉 Endi jamoa vazifalarini ko'rishingiz va bajarishingiz mumkin!`,
            {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            }
        );
            
            // Notify team admin
            try {
                const adminKeyboard = new InlineKeyboard()
                    .text('👥 Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId: team.id }));
                    
                await this.bot.api.sendMessage(
                    team.admin,
                    `👥 **Yangi a'zo qo'shildi!**\n\n` +
                    `**${ctx.from.first_name || ctx.from.username || 'Foydalanuvchi'}** "${team.name}" jamoasiga qo'shildi!\n\n` +
                    `👤 Jami a'zolar: ${stats.totalMembers} kishi`,
                    {
                        reply_markup: adminKeyboard,
                parse_mode: 'Markdown'
            }
        );
            } catch (error) {
                logger.warn('Could not notify team admin:', error);
            }
            
            logger.info(`User ${userId} joined team ${inputTeamId}`);
            
        } catch (error) {
            logger.error('Failed to join team:', error);
            
            if (error.message === 'Team not found') {
                await ctx.reply('❌ **Bunday kod bilan jamoa topilmadi**\n\nKodni tekshirib qaytadan kiriting.');
            } else if (error.message === 'User already in team') {
                await ctx.reply('⚠️ **Siz allaqachon bu jamoada a\'zosiz!**\n\nBoshqa jamoa kodini kiriting yoki /team buyrug\'i bilan jamoalaringizni ko\'ring.');
            } else {
                await ctx.reply('❌ Jamoaga qo\'shilishda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
            }
        }
    }

    /**
     * Handle team task name input
     */
    async handleTeamTaskName(ctx, taskName) {
        const userId = ctx.from.id.toString();
        const userState = ctx.state.get();
        const { teamId } = userState.data;

        if (taskName.length < 3) {
            await ctx.reply('❌ Vazifa nomi juda qisqa. Kamida 3 ta belgi kiriting.');
            return;
        }

        if (taskName.length > 100) {
            await ctx.reply('❌ Vazifa nomi juda uzun. Maksimal 100 ta belgi.');
        return;
    }

        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await ctx.reply('❌ Jamoa topilmadi yoki ruxsat yo\'q.');
            ctx.state.clear();
        return;
    }

        // Show date selection for team task
        let message = `📅 **MUDDATNI BELGILANG**\n\n`;
        message += `📝 **Vazifa:** ${taskName}\n`;
        message += `👥 **Jamoa:** ${team.name}\n\n`;
        message += `Vazifa qachon bajarilishi kerak?`;

        const keyboard = new InlineKeyboard()
            .text('📅 Bugun', keyboardBuilder.encodeCallback('select_team_task_date', { 
                teamId, 
                taskData: { name: taskName }, 
                dateType: 'today' 
            }))
            .text('📅 Ertaga', keyboardBuilder.encodeCallback('select_team_task_date', { 
                teamId, 
                taskData: { name: taskName }, 
                dateType: 'tomorrow' 
            }))
            .row()
            .text('📅 Boshqa sana', keyboardBuilder.encodeCallback('select_team_task_date', { 
                teamId, 
                taskData: { name: taskName }, 
                dateType: 'custom' 
            }))
            .row()
            .text('⬅️ Orqaga', keyboardBuilder.encodeCallback('create_team_task', { teamId }));
        
        ctx.state.clear();
        
        await ctx.reply(message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    }

    /**
     * Handle completion note text
     */
    async handleCompletionNoteText(ctx, noteText) {
        const userId = ctx.from.id.toString();
        const userState = ctx.state.get();
        const { teamId, taskId } = userState.data;

        if (noteText.length > 500) {
            await ctx.reply('❌ Izoh juda uzun. Maksimal 500 ta belgi.');
            return;
        }

        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await ctx.reply('❌ Jamoa topilmadi yoki ruxsat yo\'q.');
            ctx.state.clear();
        return;
    }

        const task = team.sharedTasks?.find(t => t.id === taskId);
        if (!task) {
            await ctx.reply('❌ Vazifa topilmadi.');
            ctx.state.clear();
        return;
    }

        ctx.state.clear();

        // Complete task with note using callback handler
        const completeData = { teamId, taskId, note: noteText };
        
        try {
            // Simulate callback to complete task
            await callbackHandler.handleCompleteTeamTaskFinal(ctx, completeData);
        } catch (error) {
            logger.error('Error completing team task with note:', error);
            await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
        }
    }
    
    /**
     * Command: /setprayerregion
     */
    async handleSetPrayerRegion(ctx) {
        const userId = ctx.from.id.toString();
        
        logger.command('setprayerregion', userId);

        const regions = prayerService.getRegions();
        let message = '🕌 **Namaz vaqtlari uchun hududni tanlang:**\n\n';
        message += 'Tanlanganingizdan so\'ng, har kuni namaz vaqtlari 15 daqiqa oldin va ayni vaqtda bildirishnoma keladi.\n\n';
        
        const keyboard = new InlineKeyboard();
        
        // Show regions in 2 columns
        for (let i = 0; i < regions.length; i += 2) {
            for (let j = 0; j < 2 && i + j < regions.length; j++) {
                const region = regions[i + j];
                keyboard.text(region, keyboardBuilder.encodeCallback('set_prayer_region', { region }));
            }
            keyboard.row();
        }

        await ctx.reply(message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    }

    /**
     * Handle text messages (conversation flow)
     */
    async handleTextMessage(ctx) {
    const userId = ctx.from.id.toString();
        const userState = ctx.state.get();
        const text = ctx.message.text.trim();

        logger.debug(`Text message from ${userId} in state ${userState.state}`, { text });

        // Handle based on current state
    switch (userState.state) {
        case 'waiting_task_name':
                await this.handleTaskName(ctx, text);
            break;
            
            case 'waiting_notes':
                await this.handleTaskNotes(ctx, text);
            break;
            
        case 'waiting_team_name':
                await this.handleTeamName(ctx, text);
            break;
            
        case 'waiting_team_code':
                await this.handleTeamCode(ctx, text);
                break;
                
            case 'waiting_team_task_name':
                await this.handleTeamTaskName(ctx, text);
            break;
            
            case 'waiting_completion_note':
                await this.handleCompletionNoteText(ctx, text);
            break;
            
        default:
                // No active conversation, show help
                await ctx.reply(
                    '❓ Buyruq tanilmadi. Yordam uchun /help ni bosing yoki tugmalardan foydalaning.',
                    { 
                        reply_markup: keyboardBuilder
                            .button('📋 Vazifalar', 'back_to_main_tasks')
                            .button('➕ Yangi vazifa', 'add_task')
                            .build()
                    }
                );
            break;
    }
    }

    /**
     * Handle task name input
     */
    async handleTaskName(ctx, taskName) {
        if (taskName.length < 3) {
            await ctx.reply('❌ Vazifa nomi juda qisqa. Kamida 3 ta belgi kiriting.');
        return;
    }
    
        if (taskName.length > 100) {
            await ctx.reply('❌ Vazifa nomi juda uzun. Maksimal 100 ta belgi.');
        return;
    }
    
        const userState = ctx.state.get();
        
        // Check if this is for today specifically 
        if (userState.data?.forToday) {
            // Skip date selection and go directly to time selection for today
            const today = new Date().toISOString().split('T')[0];
            ctx.state.set('waiting_time_selection', { 
                taskName: taskName,
                selectedDate: today 
            });
            
            const timeOptions = this.generateTimeOptions();
            let timeMessage = `🕐 **"${taskName}" bugungi vazifa uchun vaqtni tanlang:**\n\n📅 **Sana:** Bugun\n\n`;
            
            const keyboard = new InlineKeyboard();
            for (let i = 0; i < timeOptions.length; i += 3) {
                for (let j = 0; j < 3 && i + j < timeOptions.length; j++) {
                    const option = timeOptions[i + j];
                    keyboard.text(option.text, keyboardBuilder.encodeCallback('select_time', { 
                        date: today, 
                        time: option.value, 
                        taskName: taskName
                    }));
                }
                keyboard.row();
            }
            keyboard.text('⬅️ Bugungi vazifalar', keyboardBuilder.encodeCallback('show_today_tasks', {}));
            
            await ctx.reply(timeMessage, { 
                reply_markup: keyboard, 
                parse_mode: 'Markdown' 
            });
        return;
    }
    
        // Store task name and move to date selection
        ctx.state.set('waiting_date_selection', { taskName });

        const dateOptions = this.generateDateOptions();
        let message = `📅 **"${taskName}" vazifasi uchun sanani tanlang:**\n\n`;
        
        // Create clean keyboard with only date options (2 columns)
    const keyboard = new InlineKeyboard();
    
        // Today and Tomorrow in first row
        keyboard.text(dateOptions[0].text, keyboardBuilder.encodeCallback('select_date', { 
            date: dateOptions[0].value, 
            taskName 
        }));
        keyboard.text(dateOptions[1].text, keyboardBuilder.encodeCallback('select_date', { 
            date: dateOptions[1].value, 
            taskName 
        }));
        keyboard.row();
        
        // Rest of the dates, one per row
        for (let i = 2; i < Math.min(dateOptions.length, 5); i++) {
            keyboard.text(dateOptions[i].text, keyboardBuilder.encodeCallback('select_date', { 
                date: dateOptions[i].value, 
                taskName 
            }));
            keyboard.row();
        }

        // Add back button
        keyboard.text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));

        await ctx.reply(message, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
    }

    /**
     * Handle task notes input
     */
    async handleTaskNotes(ctx, notes) {
    const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const userState = ctx.state.get();

        let taskNotes = '';
        if (notes.toLowerCase() !== 'yo\'q' && notes.toLowerCase() !== 'yoq') {
            taskNotes = notes;
        }

        // Create the task
        const task = {
            id: user.nextTaskId++,
            name: userState.data.taskName,
            date: new Date(userState.data.taskDate),
            category: userState.data.category || 'personal',
            priority: userState.data.priority || 'medium',
            notes: taskNotes,
            completed: false,
            createdAt: new Date(),
            notifications: {
                sent1Day: false,
                sent1Hour: false,
                sent15Min: false,
                sentDue: false
            }
        };

        user.tasks.push(task);
        user.activity.totalTasksCreated++;

        await db.saveData();
        ctx.state.clear();

        const confirmText = `✅ **Vazifa yaratildi!**\n\n` +
                          `📝 **Nomi:** ${task.name}\n` +
                          `📅 **Sana:** ${this.formatDate(task.date)}\n` +
                          `📁 **Kategoriya:** ${task.category.toUpperCase()}\n` +
                          `🏆 **Prioritet:** ${task.priority.toUpperCase()}\n` +
                          (taskNotes ? `📋 **Eslatma:** ${taskNotes}\n` : '') +
                          `\n🎉 **Vazifa muvaffaqiyatli saqlandi!**`;

        const keyboard = keyboardBuilder
            .button('📋 Barcha vazifalar', 'back_to_main_tasks')
            .button('➕ Yana vazifa qo\'shish', 'add_task')
            .build();

        await ctx.reply(confirmText, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
    }

    /**
     * Generate date options for task creation
     */
    generateDateOptions() {
        const options = [];
        const today = new Date();

        // Today
        options.push({
            text: '📅 Bugun',
            value: today.toISOString().split('T')[0]
        });

        // Tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        options.push({
            text: '📅 Ertaga',
            value: tomorrow.toISOString().split('T')[0]
        });

        // Next 5 days
        for (let i = 2; i <= 6; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            options.push({
                text: `📅 ${date.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'short' })}`,
                value: date.toISOString().split('T')[0]
            });
        }

        return options;
    }

    /**
     * Generate time options for task scheduling
     */
    generateTimeOptions() {
        const options = [];
        
        // Common times
        const times = [
            '09:00', '10:00', '11:00', '12:00', 
            '13:00', '14:00', '15:00', '16:00',
            '17:00', '18:00', '19:00', '20:00'
        ];
        
        times.forEach(time => {
            options.push({
                text: `🕐 ${time}`,
                value: time
            });
        });
        
        return options;
    }

    /**
     * Get user statistics
     */
    getUserStats(user) {
        const tasks = user.tasks || [];
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const active = total - completed;
        const overdue = tasks.filter(t => !t.completed && new Date(t.date) < new Date()).length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, active, overdue, completionRate };
    }

    /**
     * Format date helper
     */
    formatDate(date) {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Start the bot
     */
    async start() {
        try {
            logger.info('Initializing database...');
            await db.init();

            logger.info('Starting notification service...');
            this.notificationService.start();

            logger.info('Starting bot...');
            await this.bot.start();
            
            logger.info('✅ Todo Bot v2.0 is running!');
            
            // Log statistics
            const stats = db.getStats();
            logger.info('Bot statistics', stats);
            
                        } catch (error) {
            logger.error('Failed to start bot', error);
            process.exit(1);
        }
    }

    /**
     * Stop the bot gracefully
     */
    async stop() {
        logger.info('Stopping bot...');
        this.notificationService.stop();
        await this.bot.stop();
        await db.saveData();
        logger.info('✅ Bot stopped gracefully');
    }
}

/**
 * Main execution
 */
async function main() {
    const bot = new TodoBot();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        await bot.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
    });

    // Start the bot
    await bot.start();
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('Fatal error', error);
        process.exit(1);
    });
}

export { TodoBot };
