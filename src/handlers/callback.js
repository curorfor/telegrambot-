import { InlineKeyboard } from 'grammy';
import { keyboardBuilder } from '../utils/keyboard.js';
import { logger } from '../utils/logger.js';
import { safeEdit, safeAnswer } from '../middleware/error.js';
import { db } from '../services/database.js';
import { prayerService } from '../services/prayer.js';
import { teamService } from '../services/team.js';

/**
 * Enhanced callback query handler
 */
export class CallbackHandler {
    constructor() {
        this.handlers = new Map();
        this.registerHandlers();
    }

    /**
     * Register callback handlers
     */
    registerHandlers() {
        // Main navigation
        this.register('back_to_main_tasks', this.handleBackToMainTasks);
        this.register('show_active_tasks', this.handleShowActiveTasks);
        this.register('show_completed_tasks', this.handleShowCompletedTasks);
        this.register('show_today_tasks', this.handleShowTodayTasks);
        this.register('add_task_today', this.handleAddTaskToday);
        
        // Task operations
        this.register('add_task', this.handleAddTask);
        this.register('complete_task', this.handleCompleteTask);
        this.register('delete_task', this.handleDeleteTask);
        
        // Handle notification callbacks (pattern: complete_task_123)
        this.register(/^complete_task_(.+)$/, this.handleCompleteTaskById);
        
        // Task creation flow
        this.register('select_date', this.handleSelectDate);
        this.register('select_time', this.handleSelectTime);
        this.register('category_selected', this.handleCategorySelected);
        
        // Settings
        this.register('simple_settings', this.handleSettings);
        this.register('notification_settings', this.handleNotificationSettings);
        
        // Templates
        this.register('show_templates', this.handleShowTemplates);
        this.register('show_template_category', this.handleShowTemplateCategory);
        
        // Additional handlers
        this.register('manage_tasks_menu', this.handleManageTasksMenu);
        this.register('show_categories_menu', this.handleShowCategoriesMenu);
        this.register('view_profile', this.handleViewProfile);
        this.register('show_stats', this.handleShowStats);
        this.register('show_help', this.handleShowHelp);
        this.register('detailed_stats', this.handleDetailedStats);
        
        // Fallback handlers
        this.register('callback_expired', this.handleCallbackExpired);
        this.register('unknown_callback', this.handleUnknownCallback);
        this.register('start_fresh', this.handleStartFresh);
        
        // Back navigation handlers
        this.register('back_to_date_selection', this.handleBackToDateSelection);
        this.register('back_to_time_selection', this.handleBackToTimeSelection);
        
        // Prayer handlers
        this.register('set_prayer_region', this.handleSetPrayerRegion);
        this.register('change_prayer_region', this.handleChangePrayerRegion);
        this.register('show_prayer_times', this.handleShowPrayerTimes);
        this.register('enable_prayer_notifications', this.handleEnablePrayerNotifications);
        this.register('disable_prayer_notifications', this.handleDisablePrayerNotifications);
        this.register('notification_settings', this.handleNotificationSettings);
        
        // Team handlers
        this.register('show_team_features', this.handleShowTeamFeatures);
        this.register('create_team_quick', this.handleCreateTeamQuick);
        this.register('join_team_quick', this.handleJoinTeamQuick);
        this.register('show_my_teams', this.handleShowMyTeams);
        this.register('team_settings', this.handleTeamSettings);
        
        // Team management handlers (direct actions)
        this.register('team_members', this.handleTeamMembers);
        this.register('team_tasks', this.handleTeamTasks);
        this.register('show_team', this.handleShowTeam);
        
        // Team management handlers (regex patterns)
        this.register(/^show_team_(.+)$/, this.handleShowTeam);
        this.register(/^leave_team_(.+)$/, this.handleLeaveTeam);
        this.register(/^team_tasks_(.+)$/, this.handleTeamTasks);
        this.register(/^team_members_(.+)$/, this.handleTeamMembers);
        this.register(/^assign_to_team_(.+)$/, this.handleAssignToTeam);
        
        // Team sharing handlers
        this.register('share_team_code', this.handleShareTeamCode);
        this.register('team_admin', this.handleTeamAdmin);
        this.register('manage_team_members', this.handleManageTeamMembers);
        this.register('assign_task_to_team', this.handleAssignTaskToTeam);
        this.register('team_stats', this.handleTeamStats);
        
        // Advanced team task management
        this.register('create_team_task', this.handleCreateTeamTask);
        this.register('select_team_task_assignee', this.handleSelectTeamTaskAssignee);
        this.register('complete_team_task', this.handleCompleteTeamTask);
        this.register('add_completion_note', this.handleAddCompletionNote);
        this.register('assign_team_task', this.handleAssignTeamTaskToUser);
        this.register('complete_team_task_final', this.handleCompleteTeamTaskFinal);
        this.register('select_team_task_date', this.handleSelectTeamTaskDate);
        this.register('select_team_task_time', this.handleSelectTeamTaskTime);
        
        // Team task regex handlers  
        this.register(/^view_team_task_(.+)_(.+)$/, this.handleViewTeamTask);
        
        logger.info(`Registered ${this.handlers.size} callback handlers`);
    }

    /**
     * Register a callback handler
     */
    register(action, handler) {
        if (action instanceof RegExp) {
            // Store regex patterns separately
            if (!this.regexHandlers) this.regexHandlers = [];
            this.regexHandlers.push({ pattern: action, handler: handler.bind(this) });
        } else {
            this.handlers.set(action, handler.bind(this));
        }
    }

    /**
     * Handle callback query
     */
    async handle(ctx) {
        const callbackData = ctx.callbackQuery.data;
        const userId = ctx.from.id.toString();
        
        logger.callback('Received', userId, { data: callbackData });

        try {
            // Decode callback data
            const decoded = keyboardBuilder.decodeCallback(callbackData);
            if (!decoded) {
                await safeAnswer(ctx, '❌ Tugma tanilmadi');
                return;
            }

            const { action, data } = decoded;
            logger.callback('Decoded', userId, { action, data });

            // Get handler - try direct handler first
            let handler = this.handlers.get(action);
            let matchData = data;
            
            if (!handler) {
                // Try regex handlers
                if (this.regexHandlers) {
                    for (const { pattern, handler: regexHandler } of this.regexHandlers) {
                        const match = action.match(pattern);
                        if (match) {
                            handler = regexHandler;
                            matchData = { ...data, match };
                            logger.callback(`${action} (regex: ${pattern})`, userId, matchData);
                            break;
                        }
                    }
                }
            }
            
            if (!handler) {
                logger.warn(`No handler for action: ${action}`);
                // Try to handle as unknown callback
                const unknownHandler = this.handlers.get('unknown_callback');
                if (unknownHandler) {
                    await unknownHandler(ctx, { originalAction: action, originalData: data });
                } else {
                    await safeAnswer(ctx, '❌ Buyruq topilmadi');
                }
                return;
            }

            // Initialize user
            db.initUser(userId, ctx.from);

            // Execute handler
            await handler(ctx, matchData);
            
            // Only answer callback if no error occurred
            await safeAnswer(ctx);

        } catch (error) {
            logger.error('Callback handler error', error);
            
            // Try to provide helpful error message
            try {
                const errorMessage = '❌ Xatolik yuz berdi.\n' +
                                   'Iltimos, /start buyrug\'ini ishga tushiring.';
                const keyboard = new InlineKeyboard()
                    .text('🔄 Qayta boshlash', keyboardBuilder.encodeCallback('start_fresh', {}));
                await safeEdit(ctx, errorMessage, { reply_markup: keyboard });
            } catch (editError) {
                await safeAnswer(ctx, '❌ Xatolik yuz berdi');
            }
        }
    }

    /**
     * Handler: Back to main tasks
     */
    async handleBackToMainTasks(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const tasks = user.tasks || [];
        
        const activeTasks = tasks.filter(task => !task.completed);
        const completedTasks = tasks.filter(task => task.completed);
        const overdueTasks = activeTasks.filter(task => new Date(task.date) < new Date());

        let message = '📋 **VAZIFALAR**\n\n';
        
        if (tasks.length === 0) {
            message += '📝 Hozircha vazifalar yo\'q!\n\n';
            message += '💡 **Maslahat:** Birinchi vazifangizni yaratish uchun /add ni bosing!';
            
            const keyboard = keyboardBuilder
                .button('➕ Birinchi vazifa qo\'shish', 'add_task')
                .button('🕌 Namaz vaqtlari', 'show_prayer_times')
                .row()
                .button('📋 Shablonlarni ko\'rish', 'show_templates')
                .build();
                
            await safeEdit(ctx, message, { reply_markup: keyboard, parse_mode: 'Markdown' });
            return;
        }

        // Show summary
        message += `📊 **Umumiy:** ${tasks.length} ta vazifa\n`;
        message += `⏳ **Faol:** ${activeTasks.length} ta\n`;
        message += `✅ **Bajarilgan:** ${completedTasks.length} ta\n`;
        
        if (overdueTasks.length > 0) {
            message += `🚨 **Muddati o'tgan:** ${overdueTasks.length} ta\n`;
        }

        const keyboard = keyboardBuilder
            .button(`⏳ Faol vazifalar (${activeTasks.length})`, 'show_active_tasks')
            .button(`✅ Bajarilgan (${completedTasks.length})`, 'show_completed_tasks')
            .row()
            .button('📅 Bugungi vazifalar', 'show_today_tasks')
            .button('📁 Kategoriyalar', 'show_categories_menu')
            .row()
            .button('➕ Yangi vazifa', 'add_task')
            .button('🕌 Namaz vaqtlari', 'show_prayer_times')
            .row()
            .button('⚙️ Boshqarish', 'manage_tasks_menu')
            .build();

        await safeEdit(ctx, message, { reply_markup: keyboard, parse_mode: 'Markdown' });
    }

    /**
     * Handler: Show active tasks
     */
    async handleShowActiveTasks(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const tasks = user.tasks.filter(task => !task.completed);
        
        if (tasks.length === 0) {
            const keyboard = new InlineKeyboard()
                .text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));
            await safeEdit(ctx, '✅ **Faol vazifalar yo\'q!**\n\nBarcha vazifalar bajarilgan.', {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            return;
        }

        let message = `⏳ **FAOL VAZIFALAR (${tasks.length})**\n\n`;
        const keyboard = new InlineKeyboard();

        tasks.slice(0, 10).forEach((task, index) => {
            const status = new Date(task.date) < new Date() ? '⚠️' : '⏳';
            const priority = this.getPriorityEmoji(task.priority);
            const dateStr = this.formatDate(task.date);
            
            message += `${index + 1}. ${status} ${priority} **${task.name}**\n`;
            message += `   📅 ${dateStr}\n`;
            if (task.category) {
                message += `   📁 ${task.category.toUpperCase()}\n`;
            }
            message += '\n';

            keyboard.text(`✅ ${index + 1}`, keyboardBuilder.encodeCallback('complete_task', { taskId: task.id }))
                   .text(`🗑️ ${index + 1}`, keyboardBuilder.encodeCallback('delete_task', { taskId: task.id }))
                   .row();
        });

        keyboard.text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));

        await safeEdit(ctx, message, { reply_markup: keyboard, parse_mode: 'Markdown' });
    }

    /**
     * Handler: Show completed tasks
     */
    async handleShowCompletedTasks(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const completedTasks = user.tasks.filter(task => task.completed);
        
        if (completedTasks.length === 0) {
            const keyboard = new InlineKeyboard()
                .text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));
            await safeEdit(ctx, '📋 **Hali bajarilgan vazifalar yo\'q**\n\nVazifalarni bajarib, bu yerda ko\'ring!', {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            return;
        }

        let message = `✅ **BAJARILGAN VAZIFALAR (${completedTasks.length})**\n\n`;
        const keyboard = new InlineKeyboard();

        completedTasks.slice(0, 8).forEach((task, index) => {
            const priority = this.getPriorityEmoji(task.priority);
            const completedDate = this.formatDate(task.completedAt);
            
            message += `${index + 1}. ✅ ${priority} **${task.name}**\n`;
            message += `   ✅ Bajarilgan: ${completedDate}\n`;
            if (task.category) {
                message += `   📁 ${task.category.toUpperCase()}\n`;
            }
            message += '\n';
        });

        if (completedTasks.length > 8) {
            message += `\n... va yana ${completedTasks.length - 8} ta vazifa`;
        }

        keyboard.text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));

        await safeEdit(ctx, message, { reply_markup: keyboard, parse_mode: 'Markdown' });
    }

    /**
     * Handler: Show today's tasks
     */
    async handleShowTodayTasks(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayTasks = user.tasks.filter(task => {
            const taskDate = new Date(task.date);
            return taskDate >= today && taskDate < tomorrow;
        });

        if (todayTasks.length === 0) {
            const keyboard = new InlineKeyboard()
                .text('➕ Bugun uchun vazifa qo\'shish', keyboardBuilder.encodeCallback('add_task_today', {}))
                .row()
                .text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));
                
            await safeEdit(ctx, '📅 **Bugun uchun vazifalar yo\'q**\n\nDam olish kuni! 😎', {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            return;
        }

        const activeTodayTasks = todayTasks.filter(task => !task.completed);
        const completedTodayTasks = todayTasks.filter(task => task.completed);

        let message = `📅 **BUGUNGI VAZIFALAR (${todayTasks.length})**\n\n`;
        
        if (completedTodayTasks.length > 0) {
            const progress = Math.round((completedTodayTasks.length / todayTasks.length) * 100);
            const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
            message += `📈 **Progress:** ${progress}%\n${progressBar}\n\n`;
        }

        // Create keyboard for task buttons
        let taskKeyboard = keyboardBuilder;

        // Show active today tasks first
        if (activeTodayTasks.length > 0) {
            message += `⏳ **Faol (${activeTodayTasks.length}):**\n`;
            activeTodayTasks.forEach((task, index) => {
                const priority = this.getPriorityEmoji(task.priority);
                const timeStr = this.formatTime(task.date);
                
                message += `${index + 1}. ${priority} **${task.name}**\n`;
                message += `   🕐 ${timeStr}\n\n`;

                taskKeyboard.button(`✅ ${index + 1}`, 'complete_task', { taskId: task.id })
                           .button(`🗑️ ${index + 1}`, 'delete_task', { taskId: task.id })
                           .row();
            });
        }

        if (completedTodayTasks.length > 0) {
            message += `\n✅ **Bajarilgan (${completedTodayTasks.length}):**\n`;
            completedTodayTasks.forEach((task, index) => {
                const priority = this.getPriorityEmoji(task.priority);
                message += `${index + 1}. ✅ ${priority} ${task.name}\n`;
            });
        }

        // Create final keyboard with back button
        const finalKeyboard = activeTodayTasks.length > 0 
            ? taskKeyboard.row().button('⬅️ Orqaga', 'back_to_main_tasks').build()
            : new InlineKeyboard().text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));

        await safeEdit(ctx, message, { reply_markup: finalKeyboard, parse_mode: 'Markdown' });
    }

    /**
     * Handler: Add task
     */
    async handleAddTask(ctx, data) {
        ctx.state.set('waiting_task_name', { fromCallback: true });
        
        // Remove the old keyboard and show clean message
        await safeEdit(ctx, 
            '📝 **Yangi vazifa qo\'shish**\n\n' +
            'Vazifa nomini kiriting:\n\n' +
            '💡 *Masalan: "Prezentatsiya tayyorlash", "Dukonga borish"*',
            { 
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] } // Clear keyboard
            }
        );
    }

    /**
     * Handler: Add task for today
     */
    async handleAddTaskToday(ctx, data) {
        ctx.state.set('waiting_task_name', { fromCallback: true, forToday: true });
        
        await safeEdit(ctx, 
            '📝 **Bugun uchun yangi vazifa**\n\n' +
            'Vazifa nomini kiriting:\n\n' +
            '💡 *Masalan: "Yig\'ishtirishga tayyorgarlik", "Mahsulot sotib olish"*',
            { 
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] } // Clear keyboard
            }
        );
    }

    /**
     * Handler: Complete task
     */
    async handleCompleteTask(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const task = user.tasks.find(t => t.id === data.taskId);
        
        if (!task) {
            await safeAnswer(ctx, '❌ Vazifa topilmadi');
            return;
        }

        if (task.completed) {
            await safeAnswer(ctx, '✅ Bu vazifa allaqachon bajarilgan');
            return;
        }

        // Mark as completed
        task.completed = true;
        task.completedAt = new Date();

        // Update stats
        user.activity.totalTasksCompleted++;

        await db.saveData();

        await safeEdit(ctx, `✅ **Vazifa bajarilgan!**\n\n📝 ${task.name}`, { parse_mode: 'Markdown' });
    }

    /**
     * Handler: Complete task by ID (from notification)
     */
    async handleCompleteTaskById(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const taskId = data.match[1]; // Extract task ID from regex match
        
        const task = user.tasks.find(t => t.id === taskId);
        if (!task) {
            await safeEdit(ctx, '❌ **Vazifa topilmadi**\n\nBu vazifa allaqachon o\'chirilgan yoki yaroqsiz.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📋 Vazifalar', callback_data: keyboardBuilder.encodeCallback('back_to_main_tasks', {}) }
                    ]]
                }
            });
            await safeAnswer(ctx, '❌ Vazifa topilmadi');
            return;
        }

        if (task.completed) {
            await safeEdit(ctx, `✅ **Vazifa allaqachon bajarilgan**\n\n📝 **${task.name}**\n\n🎉 Bu vazifa allaqachon tugallangan!`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📋 Vazifalar', callback_data: keyboardBuilder.encodeCallback('back_to_main_tasks', {}) }
                    ]]
                }
            });
            await safeAnswer(ctx, '✅ Allaqachon bajarilgan');
            return;
        }

        // Mark task as completed
        task.completed = true;
        task.completedAt = new Date();
        
        // Update stats
        user.activity.totalTasksCompleted++;
        
        await db.saveData();

        const priority = this.getPriorityEmoji(task.priority);
        await safeEdit(ctx, 
            `🎉 **VAZIFA BAJARILDI!**\n\n` +
            `${priority} **${task.name}**\n\n` +
            `📅 **Muddat:** ${this.formatDate(new Date(task.date))}\n` +
            `⏰ **Bajarildi:** ${this.formatDate(task.completedAt)}\n` +
            `📁 **Kategoriya:** ${task.category || 'Umumiy'}\n\n` +
            `✨ Ajoyib! Yana bir vazifa muvaffaqiyatli yakunlandi!`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📋 Barcha vazifalar', callback_data: keyboardBuilder.encodeCallback('back_to_main_tasks', {}) },
                        { text: '➕ Yangi vazifa', callback_data: keyboardBuilder.encodeCallback('add_task', {}) }
                    ]]
                },
                parse_mode: 'Markdown'
            }
        );
        
        await safeAnswer(ctx, '🎉 Vazifa bajarildi!');
    }

    /**
     * Handler: Delete task
     */
    async handleDeleteTask(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const taskIndex = user.tasks.findIndex(t => t.id === data.taskId);
        
        if (taskIndex === -1) {
            await safeAnswer(ctx, '❌ Vazifa topilmadi');
            return;
        }

        const task = user.tasks[taskIndex];
        user.tasks.splice(taskIndex, 1);

        await db.saveData();

        await safeEdit(ctx, `🗑️ **Vazifa o'chirildi!**\n\n📝 ${task.name}`, { parse_mode: 'Markdown' });
    }

    /**
     * Helper: Get priority emoji
     */
    getPriorityEmoji(priority) {
        const emojis = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        };
        return emojis[priority] || '⚪';
    }

    /**
     * Helper: Format date
     */
    formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleDateString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Helper: Format time
     */
    formatTime(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleTimeString('uz-UZ', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Handler: Manage tasks menu
     */
    async handleManageTasksMenu(ctx, data) {
        const message = '⚙️ **VAZIFALARNI BOSHQARISH**\n\n' +
                       'Quyidagi amallardan birini tanlang:';
        
        const keyboard = keyboardBuilder
            .button('📊 Statistika', 'detailed_stats')
            .button('🗂️ Kategoriyalar', 'show_categories_menu')
            .row()
            .button('🔄 Ma\'lumotlarni eksport', 'export_data')
            .button('🧹 Tozalash', 'cleanup_menu')
            .row()
            .back('back_to_main_tasks')
            .build();

        await safeEdit(ctx, message, { reply_markup: keyboard, parse_mode: 'Markdown' });
    }

    /**
     * Handler: Show categories menu
     */
    async handleShowCategoriesMenu(ctx, data) {
        await safeAnswer(ctx, '🚧 Kategoriyalar funksiyasi tez orada qo\'shiladi');
    }

    /**
     * Handler: View profile
     */
    async handleViewProfile(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
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

        await safeEdit(ctx, profileText, { reply_markup: keyboard, parse_mode: 'Markdown' });
    }

    /**
     * Handler: Show stats
     */
    async handleShowStats(ctx, data) {
        await this.handleDetailedStats(ctx, data);
    }

    /**
     * Handler: Show help
     */
    async handleShowHelp(ctx, data) {
        const helpText = `❓ **YORDAM VA QOʻLLANMA**\n\n` +
                        `📝 **Asosiy buyruqlar:**\n` +
                        `/start - Botni ishga tushirish\n` +
                        `/tasks - Barcha vazifalar\n` +
                        `/add - Yangi vazifa qo'shish\n` +
                        `/profile - Profil va statistika\n` +
                        `/help - Bu yordam xabari\n\n` +
                        `🔧 **Funksiyalar:**\n` +
                        `• ➕ Vazifalar yaratish va boshqarish\n` +
                        `• ⏰ Vaqt va eslatmalar\n` +
                        `• 🏆 Prioritet va kategoriyalar\n` +
                        `• 👥 Jamoa bilan ishlash\n` +
                        `• 📊 Tahlil va hisobotlar\n\n` +
                        `💡 **Maslahat:** Tugmalar orqali oson boshqaring!`;

        await safeEdit(ctx, helpText, { parse_mode: 'Markdown' });
    }

    /**
     * Handler: Detailed stats
     */
    async handleDetailedStats(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const stats = this.getUserStats(user);
        const dbStats = db.getStats();

        let statsText = `📊 **BATAFSIL STATISTIKA**\n\n`;
        statsText += `👤 **Shaxsiy:**\n`;
        statsText += `📝 Jami vazifalar: ${stats.total}\n`;
        statsText += `✅ Bajarilgan: ${stats.completed} (${stats.completionRate}%)\n`;
        statsText += `⏳ Faol: ${stats.active}\n`;
        statsText += `⚠️ Muddati o'tgan: ${stats.overdue}\n`;
        statsText += `📅 Ro'yxatdan o'tgan: ${this.formatDate(user.activity?.registrationDate)}\n\n`;

        statsText += `🌐 **Global:**\n`;
        statsText += `👥 Jami foydalanuvchilar: ${dbStats.users}\n`;
        statsText += `📝 Jami vazifalar: ${dbStats.total_tasks}\n`;
        statsText += `✅ Bajarilgan: ${dbStats.completed_tasks} (${dbStats.completion_rate}%)\n`;

        const keyboard = new InlineKeyboard()
            .text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));
        await safeEdit(ctx, statsText, { reply_markup: keyboard, parse_mode: 'Markdown' });
    }

    /**
     * Helper: Get user statistics
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
     * Helper: Generate time options
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
     * Helper: Get categories
     */
    getCategories() {
        return [
            { id: 'personal', name: 'Shaxsiy', emoji: '👤' },
            { id: 'work', name: 'Ish', emoji: '💼' },
            { id: 'health', name: 'Sog\'liq', emoji: '💪' },
            { id: 'education', name: 'Ta\'lim', emoji: '📚' },
            { id: 'finance', name: 'Moliya', emoji: '💰' },
            { id: 'family', name: 'Oila', emoji: '👨‍👩‍👧‍👦' }
        ];
    }

    /**
     * Handler: Callback expired or lost
     */
    async handleCallbackExpired(ctx, data) {
        const message = '⚠️ **Bu tugma eski**\n\n' +
                       'Bot qayta ishga tushgan yoki vaqt tugagan.\n' +
                       'Iltimos, yangi menyu olish uchun /start ni bosing.';
        
        const keyboard = keyboardBuilder
            .button('🔄 Yangilash', 'back_to_main_tasks')
            .button('🏠 Bosh sahifa', 'start_fresh')
            .build();

        await safeEdit(ctx, message, { reply_markup: keyboard, parse_mode: 'Markdown' });
        await safeAnswer(ctx, '⚠️ Tugma eski, menyu yangilandi');
    }

    /**
     * Handler: Unknown callback
     */
    async handleUnknownCallback(ctx, data) {
        const message = '❓ **Noma\'lum buyruq**\n\n' +
                       'Bu tugma tanilmadi.\n' +
                       'Asosiy menyuga qaytish uchun tugmani bosing.';
        
        const keyboard = keyboardBuilder
            .button('📋 Vazifalar', 'back_to_main_tasks')
            .button('🏠 Bosh sahifa', 'start_fresh')
            .build();

        await safeEdit(ctx, message, { reply_markup: keyboard, parse_mode: 'Markdown' });
        await safeAnswer(ctx, '❓ Noma\'lum buyruq');
    }

    /**
     * Handler: Fresh start
     */
    async handleStartFresh(ctx, data) {
        // Clear any existing state
        ctx.state?.clear();
        
        // Redirect to main tasks
        await this.handleBackToMainTasks(ctx, {});
    }

    /**
     * Handler: Back to date selection
     */
    async handleBackToDateSelection(ctx, data) {
        const taskName = data.taskName;
        
        if (!taskName) {
            await safeAnswer(ctx, '❌ Vazifa nomi topilmadi');
            return;
        }

        // Reset state to date selection
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
        keyboard.text('⬅️ Asosiy menyu', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));

        await safeEdit(ctx, message, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
        await safeAnswer(ctx, '📅 Sana tanlashga qaytdingiz');
    }

    /**
     * Handler: Back to time selection
     */
    async handleBackToTimeSelection(ctx, data) {
        const taskName = data.taskName;
        const selectedDate = data.selectedDate;
        
        if (!taskName || !selectedDate) {
            await safeAnswer(ctx, '❌ Ma\'lumotlar topilmadi');
            return;
        }

        // Reset state to time selection
        ctx.state.set('waiting_time_selection', { taskName, selectedDate });

        // Generate time options - cleaner layout
        const timeOptions = this.generateTimeOptions();
        let timeMessage = `🕐 **"${taskName}" vazifasi uchun vaqtni tanlang:**\n\n📅 **Sana:** ${selectedDate}\n\n`;
        
        // Create clean time keyboard (3 columns)
        const keyboard = new InlineKeyboard();
        for (let i = 0; i < timeOptions.length; i += 3) {
            for (let j = 0; j < 3 && i + j < timeOptions.length; j++) {
                const option = timeOptions[i + j];
                keyboard.text(option.text, keyboardBuilder.encodeCallback('select_time', { 
                    date: selectedDate, 
                    time: option.value, 
                    taskName: taskName
                }));
            }
            keyboard.row();
        }

        // Add back button to go back to date selection
        keyboard.text('⬅️ Sana tanlash', keyboardBuilder.encodeCallback('back_to_date_selection', { 
            taskName: taskName 
        }));

        await safeEdit(ctx, timeMessage, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
        await safeAnswer(ctx, '🕐 Vaqt tanlashga qaytdingiz');
    }

    /**
     * Helper: Generate date options
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
     * Handler: Select date for task
     */
    async handleSelectDate(ctx, data) {
        const userId = ctx.from.id.toString();
        const userState = ctx.state.get();
        
        if (!userState.state.includes('waiting_date_selection')) {
            await safeAnswer(ctx, '❌ Noto\'g\'ri holat.');
            return;
        }
        
        const selectedDate = data.date;
        const taskName = data.taskName || userState.data.taskName;
        
        // Generate time options - cleaner layout
        const timeOptions = this.generateTimeOptions();
        let timeMessage = `🕐 **"${taskName}" vazifasi uchun vaqtni tanlang:**\n\n📅 **Sana:** ${selectedDate}\n\n`;
        
        // Create clean time keyboard (3 columns)
        const keyboard = new InlineKeyboard();
        for (let i = 0; i < timeOptions.length; i += 3) {
            for (let j = 0; j < 3 && i + j < timeOptions.length; j++) {
                const option = timeOptions[i + j];
                keyboard.text(option.text, keyboardBuilder.encodeCallback('select_time', { 
                    date: selectedDate, 
                    time: option.value, 
                    taskName: taskName
                }));
            }
            keyboard.row();
        }

        // Add back button to go back to date selection
        keyboard.text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_date_selection', { 
            taskName: taskName 
        }));
        
        // Update state
        ctx.state.set('waiting_time_selection', { 
            taskName: taskName,
            selectedDate: selectedDate
        });
        
        await safeEdit(ctx, timeMessage, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
        await safeAnswer(ctx, '📅 Sana tanlandi!');
    }
    /**
     * Handler: Select time for task
     */
    async handleSelectTime(ctx, data) {
        const userId = ctx.from.id.toString();
        const userState = ctx.state.get();
        
        if (!userState.state.includes('waiting_time_selection') && !userState.state.includes('waiting_date_selection')) {
            await safeAnswer(ctx, '❌ Noto\'g\'ri holat.');
            return;
        }
        
        const selectedDate = data.date;
        const selectedTime = data.time;
        const taskName = data.taskName || userState.data.taskName;
        
        // Create full datetime
        const taskDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
        
        // Validate future date
        if (taskDateTime <= new Date()) {
            await safeAnswer(ctx, '❌ O\'tgan vaqtni tanlay olmaysiz!');
            return;
        }
        
        // Show category selection - clean layout
        const categories = this.getCategories();
        let categoryMessage = `📁 **"${taskName}" vazifasi uchun kategoriyani tanlang:**\n\n📅 **Sana:** ${selectedDate}\n🕐 **Vaqt:** ${selectedTime}\n\n`;
        
        // Create clean category keyboard (2 columns)
        const keyboard = new InlineKeyboard();
        for (let i = 0; i < categories.length; i += 2) {
            for (let j = 0; j < 2 && i + j < categories.length; j++) {
                const category = categories[i + j];
                keyboard.text(`${category.emoji} ${category.name}`, keyboardBuilder.encodeCallback('category_selected', {
                    category: category.id,
                    taskName: taskName,
                    taskDate: taskDateTime.toISOString(),
                    selectedDate: selectedDate,
                    selectedTime: selectedTime
                }));
            }
            keyboard.row();
        }

        // Add back button to go back to time selection
        keyboard.text('⬅️ Orqaga', keyboardBuilder.encodeCallback('back_to_time_selection', { 
            taskName: taskName,
            selectedDate: selectedDate
        }));
        
        // Update state
        ctx.state.set('waiting_category', { 
            taskName: taskName,
            taskDate: taskDateTime.toISOString(),
            selectedDate: selectedDate,
            selectedTime: selectedTime
        });
        
        await safeEdit(ctx, categoryMessage, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
        await safeAnswer(ctx, '✅ Vaqt tanlandi!');
    }
    /**
     * Handler: Category selected for task
     */
    async handleCategorySelected(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        // Extract data
        const taskName = data.taskName;
        const taskDate = new Date(data.taskDate);
        const category = data.category;
        const selectedDate = data.selectedDate;
        const selectedTime = data.selectedTime;
        
        // Create the task
        const task = {
            id: user.nextTaskId++,
            name: taskName,
            date: taskDate,
            category: category,
            priority: 'medium', // Default priority
            notes: '',
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

        const categoryName = this.getCategories().find(c => c.id === category)?.name || category;
        const confirmText = `✅ **Vazifa yaratildi!**\n\n` +
                          `📝 **Nomi:** ${task.name}\n` +
                          `📅 **Sana:** ${selectedDate}\n` +
                          `🕐 **Vaqt:** ${selectedTime}\n` +
                          `📁 **Kategoriya:** ${categoryName}\n` +
                          `🏆 **Prioritet:** Medium\n` +
                          `\n🎉 **Vazifa muvaffaqiyatli saqlandi!**`;

        const keyboard = keyboardBuilder
            .button('📋 Barcha vazifalar', 'back_to_main_tasks')
            .button('➕ Yana vazifa qo\'shish', 'add_task')
            .build();

        await safeEdit(ctx, confirmText, { 
            reply_markup: keyboard, 
            parse_mode: 'Markdown' 
        });
        await safeAnswer(ctx, '✅ Vazifa yaratildi!');
    }
    async handleSettings(ctx, data) { 
        await safeAnswer(ctx, '🚧 Sozlamalar funksiyasi ishlab chiqilmoqda'); 
    }
    async handleNotificationSettings(ctx, data) { 
        await safeAnswer(ctx, '🚧 Bildirishnoma sozlamalari ishlab chiqilmoqda'); 
    }
    async handleShowTemplates(ctx, data) { 
        await safeAnswer(ctx, '🚧 Shablonlar funksiyasi ishlab chiqilmoqda'); 
    }
    async handleShowTemplateCategory(ctx, data) { 
        await safeAnswer(ctx, '🚧 Shablon kategoriyalari ishlab chiqilmoqda'); 
    }

    /**
     * Handler: Set prayer region
     */
    async handleSetPrayerRegion(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const region = data.region;

        if (!region) {
            await safeAnswer(ctx, '❌ Hudud tanlanmadi');
            return;
        }

        // Save user's prayer region
        user.preferences.prayerRegion = region;
        user.prayerRegion = region; // For backward compatibility
        
        await db.saveData();

        // Get prayer times for the region
        const prayerTimes = await prayerService.getPrayerTimes(region);
        const formattedTimes = prayerService.formatForDisplay(prayerTimes, region);

        const keyboard = new InlineKeyboard()
            .text('🔔 Bildirishnomalarni yoqish', keyboardBuilder.encodeCallback('enable_prayer_notifications', { region }))
            .row()
            .text('⬅️ Sozlamalar', keyboardBuilder.encodeCallback('simple_settings', {}));

        await safeEdit(ctx, formattedTimes + '\n\n✅ **Hudud saqlandi!**', {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, `✅ ${region} hududi saqlandi`);
    }

    /**
     * Handler: Change prayer region (show region selection)
     */
    async handleChangePrayerRegion(ctx, data) {
        const regions = prayerService.getRegions();
        let message = '🕌 **Namaz vaqtlari uchun hududni tanlang:**\n\n';
        
        const keyboard = new InlineKeyboard();
        
        // Show regions in 2 columns
        for (let i = 0; i < regions.length; i += 2) {
            for (let j = 0; j < 2 && i + j < regions.length; j++) {
                const region = regions[i + j];
                keyboard.text(region, keyboardBuilder.encodeCallback('set_prayer_region', { region }));
            }
            keyboard.row();
        }

        // Add back button
        keyboard.text('⬅️ Orqaga', keyboardBuilder.encodeCallback('simple_settings', {}));

        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '🕌 Hudud tanlang');
    }

    /**
     * Handler: Show prayer times (inline button)
     */
    async handleShowPrayerTimes(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        // Get user's saved region or default
        const region = user.preferences?.prayerRegion || user.prayerRegion || 'Toshkent';

        try {
            // Get prayer times
            const prayerTimes = await prayerService.getPrayerTimes(region);
            const formattedTimes = prayerService.formatForDisplay(prayerTimes, region);

            const keyboard = new InlineKeyboard()
                .text('🔄 Hududni o\'zgartirish', keyboardBuilder.encodeCallback('change_prayer_region', {}))
                .text('⚙️ Bildirishnoma', keyboardBuilder.encodeCallback('notification_settings', {}))
                .row()
                .text('⬅️ Bosh menyu', keyboardBuilder.encodeCallback('start_fresh', {}));

            await safeEdit(ctx, formattedTimes, {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            await safeAnswer(ctx, '🕌 Namaz vaqtlari');

        } catch (error) {
            logger.error('Failed to get prayer times in callback', error);
            
            const keyboard = new InlineKeyboard()
                .text('🔄 Qaytadan urinish', keyboardBuilder.encodeCallback('show_prayer_times', {}))
                .text('⬅️ Bosh menyu', keyboardBuilder.encodeCallback('start_fresh', {}));
                
            await safeEdit(ctx, '❌ **Namaz vaqtlarini olishda xatolik**\n\nIltimos, qaytadan urinib ko\'ring.', {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            await safeAnswer(ctx, '❌ Xatolik yuz berdi');
        }
    }

    /**
     * Handler: Enable prayer notifications
     */
    async handleEnablePrayerNotifications(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        // Enable prayer notifications
        if (!user.preferences) user.preferences = {};
        user.preferences.prayerNotifications = true;
        
        await db.saveData();
        
        const keyboard = new InlineKeyboard()
            .text('🔕 O\'chirish', keyboardBuilder.encodeCallback('disable_prayer_notifications', {}))
            .text('⚙️ Sozlamalar', keyboardBuilder.encodeCallback('notification_settings', {}))
            .row()
            .text('⬅️ Namaz vaqtlari', keyboardBuilder.encodeCallback('show_prayer_times', {}));
            
        await safeEdit(ctx, 
            '🔔 **Namaz bildirishnomalari yoqildi!**\n\n' +
            '✅ Har bir namaz vaqtidan 15 va 5 daqiqa oldin eslatma oling\n' +
            '📱 Bildirishnomalar sizning tanlangan hududingiz bo\'yicha yuboriladi\n\n' +
            '🎯 Namaz vaqtlarini esdan chiqarmang!',
            {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            }
        );
        await safeAnswer(ctx, '🔔 Bildirishnomalar yoqildi');
    }

    /**
     * Handler: Disable prayer notifications
     */
    async handleDisablePrayerNotifications(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        // Disable prayer notifications
        if (!user.preferences) user.preferences = {};
        user.preferences.prayerNotifications = false;
        
        await db.saveData();
        
        const keyboard = new InlineKeyboard()
            .text('🔔 Yoqish', keyboardBuilder.encodeCallback('enable_prayer_notifications', {}))
            .text('⚙️ Sozlamalar', keyboardBuilder.encodeCallback('notification_settings', {}))
            .row()
            .text('⬅️ Namaz vaqtlari', keyboardBuilder.encodeCallback('show_prayer_times', {}));
            
        await safeEdit(ctx, 
            '🔕 **Namaz bildirishnomalari o\'chirildi**\n\n' +
            '❌ Endi namaz vaqtlari haqida eslatma olmaysiz\n' +
            '📱 Istalgan vaqtda qaytadan yoqishingiz mumkin\n\n' +
            '💡 Namaz vaqtlarini tekshirish uchun /prayer buyrug\'ini ishlating',
            {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            }
        );
        await safeAnswer(ctx, '🔕 Bildirishnomalar o\'chirildi');
    }

    /**
     * Handler: Notification settings
     */
    async handleNotificationSettings(ctx, data) {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        
        const prayerNotifications = user.preferences?.prayerNotifications !== false;
        const prayerRegion = user.preferences?.prayerRegion || user.prayerRegion || 'Toshkent';
        
        let message = '⚙️ **BILDIRISHNOMA SOZLAMALARI**\n\n';
        message += `🕌 **Namaz hududi:** ${prayerRegion}\n`;
        message += `🔔 **Namaz bildirishnomalari:** ${prayerNotifications ? '✅ Yoqilgan' : '❌ O\'chirilgan'}\n\n`;
        message += '**Namaz bildirishnomalari:**\n';
        message += '• Har bir namaz vaqtidan 15 daqiqa oldin\n';
        message += '• Har bir namaz vaqtidan 5 daqiqa oldin\n\n';
        message += '**Vazifa bildirishnomalari:**\n';
        message += '• 1 kun oldin eslatma\n';
        message += '• 1 soat oldin eslatma\n';
        message += '• 15 daqiqa oldin eslatma\n';
        message += '• Vaqt kelganda eslatma\n';
        
        const keyboard = new InlineKeyboard();
        
        if (prayerNotifications) {
            keyboard.text('🔕 Namaz bildirishnomalarini o\'chirish', keyboardBuilder.encodeCallback('disable_prayer_notifications', {}));
        } else {
            keyboard.text('🔔 Namaz bildirishnomalarini yoqish', keyboardBuilder.encodeCallback('enable_prayer_notifications', {}));
        }
        
        keyboard.row()
               .text('🔄 Hududni o\'zgartirish', keyboardBuilder.encodeCallback('change_prayer_region', {}))
               .row()
               .text('⬅️ Namaz vaqtlari', keyboardBuilder.encodeCallback('show_prayer_times', {}));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '⚙️ Sozlamalar');
    }

    /**
     * Handler: Show team features
     */
    async handleShowTeamFeatures(ctx, data) {
        const userId = ctx.from.id.toString();
        const userTeams = teamService.getUserTeams(userId);
        
        let message = '👥 **JAMOA FUNKSIYALARI**\n\n';
        
        let keyboard;
        
        if (userTeams.length === 0) {
            message += '🚀 **Jamoalar bilan ishlash:**\n';
            message += '• Jamoa yarating yoki mavjud jamoaga qo\'shiling\n';
            message += '• Vazifalarni jamoa a\'zolariga tayinlang\n';
            message += '• Jamoa ishini kuzatib boring\n';
            message += '• Hamkorlikda samarali ishlang\n\n';
            message += '💡 **Foydalanish:**\n';
            message += '1. Jamoa yaratish - yangi jamoa boshqaruvchisi bo\'ling\n';
            message += '2. Jamoaga qo\'shilish - 6 raqamli kod orqali\n';
            message += '3. Vazifa tayinlash - shaxsiy vazifalarni jamoaga o\'tkazing\n\n';
            message += '🎯 Birinchi jamoa yaratish yoki qo\'shilishdan boshlang!';
            
            keyboard = new InlineKeyboard()
                .text('➕ Jamoa yaratish', keyboardBuilder.encodeCallback('create_team_quick', {}))
                .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}))
                .row()
                .text('⬅️ Bosh menyu', keyboardBuilder.encodeCallback('start_fresh', {}));
                
        } else {
            message += `✅ **Siz ${userTeams.length} ta jamoada a'zosiz**\n\n`;
            message += '🎯 **Mavjud imkoniyatlar:**\n';
            message += '• Jamoa vazifalarini ko\'rish va bajarish\n';
            message += '• Yangi vazifalar tayinlash\n';
            message += '• Jamoa statistikasini kuzatish\n';
            message += '• A\'zolar bilan hamkorlik qilish\n\n';
            message += '📊 **Jamoa statistikasi:**\n';
            
            let totalTasks = 0;
            let totalMembers = 0;
            userTeams.forEach(team => {
                const stats = teamService.getTeamStats(team.id);
                totalTasks += stats.totalTasks;
                totalMembers += stats.totalMembers;
            });
            
            message += `👥 Jami a'zolar: ${totalMembers} kishi\n`;
            message += `📝 Jami vazifalar: ${totalTasks} ta\n`;
            
            keyboard = new InlineKeyboard()
                .text('👥 Jamoa ro\'yxati', keyboardBuilder.encodeCallback('show_my_teams', {}))
                .text('➕ Yangi jamoa', keyboardBuilder.encodeCallback('create_team_quick', {}))
                .row()
                .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}))
                .text('⚙️ Sozlamalar', keyboardBuilder.encodeCallback('team_settings', {}))
                .row()
                .text('⬅️ Bosh menyu', keyboardBuilder.encodeCallback('start_fresh', {}));
        }
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '👥 Jamoa funksiyalari');
    }

    /**
     * Handler: Create team quick
     */
    async handleCreateTeamQuick(ctx, data) {
        ctx.state.set('waiting_team_name', { fromCallback: true });
        
        await safeEdit(ctx, 
            '👥 **Yangi jamoa yaratish**\n\n' +
            'Jamoa nomini kiriting:\n\n' +
            '💡 *Masalan: "Loyiha jamoasi", "Dars guruhi", "Ish jamoasi"*\n\n' +
            '📝 **Eslatma:** Jamoa yaratilgandan keyin sizga 6 raqamli kod beriladi. ' +
            'Bu kod orqali boshqa foydalanuvchilar jamoaga qo\'shilishlari mumkin.',
            { 
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] }
            }
        );
        await safeAnswer(ctx, '👥 Jamoa nomini kiriting');
    }

    /**
     * Handler: Join team quick
     */
    async handleJoinTeamQuick(ctx, data) {
        ctx.state.set('waiting_team_code', { fromCallback: true });
        
        await safeEdit(ctx, 
            '🔑 **Jamoaga qo\'shilish**\n\n' +
            'Jamoa kodini kiriting:\n\n' +
            '💡 *6 raqamli kod, masalan: ABC123*\n\n' +
            '📝 **Eslatma:** Jamoa kodi jamoa admin tomonidan beriladi. ' +
            'Kodni to\'g\'ri kiritganingizga ishonch hosil qiling.',
            { 
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] }
            }
        );
        await safeAnswer(ctx, '🔑 Jamoa kodini kiriting');
    }

    /**
     * Handler: Show my teams
     */
    async handleShowMyTeams(ctx, data) {
        const userId = ctx.from.id.toString();
        const userTeams = teamService.getUserTeams(userId);
        
        if (userTeams.length === 0) {
            const keyboard = new InlineKeyboard()
                .text('➕ Jamoa yaratish', keyboardBuilder.encodeCallback('create_team_quick', {}))
                .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}))
                .row()
                .text('⬅️ Jamoa funksiyalari', keyboardBuilder.encodeCallback('show_team_features', {}));
                
            await safeEdit(ctx, 
                '👥 **Sizning jamoalaringiz**\n\n' +
                '📝 Hozircha hech qaysi jamoada emassiz\n\n' +
                '🚀 Jamoa yarating yoki mavjud jamoaga qo\'shiling!',
                {
                    reply_markup: keyboard,
                    parse_mode: 'Markdown'
                }
            );
            await safeAnswer(ctx, 'Jamoa topilmadi');
            return;
        }
        
        let message = `👥 **SIZNING JAMOALARINGIZ (${userTeams.length})**\n\n`;
        
        const keyboard = new InlineKeyboard();
        
        userTeams.forEach((team, index) => {
            const stats = teamService.getTeamStats(team.id);
            const isAdmin = teamService.isTeamAdmin(userId, team.id);
            const role = isAdmin ? '👑 Admin' : '👤 A\'zo';
            
            message += `${index + 1}. **${team.name}** ${role}\n`;
            message += `   🆔 \`${team.id}\` | 👥 ${stats.totalMembers} a'zo | 📝 ${stats.totalTasks} vazifa\n`;
            message += `   ✅ ${stats.completedTasks} bajarilgan (${stats.completionRate}%)\n\n`;
            
            keyboard.text(`${index + 1}. ${team.name}`, keyboardBuilder.encodeCallback('show_team', { teamId: team.id }));
            keyboard.row();
        });
        
        keyboard.text('➕ Yangi jamoa', keyboardBuilder.encodeCallback('create_team_quick', {}))
               .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}))
               .row()
               .text('⬅️ Jamoa funksiyalari', keyboardBuilder.encodeCallback('show_team_features', {}));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '👥 Jamoa ro\'yxati');
    }

    /**
     * Handler: Show specific team
     */
    async handleShowTeam(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId || data.match[1];
        
        const team = teamService.getTeam(teamId);
        if (!team) {
            await safeEdit(ctx, '❌ **Jamoa topilmadi**\n\nBu jamoa o\'chirilgan yoki mavjud emas.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '👥 Jamoa ro\'yxati', callback_data: keyboardBuilder.encodeCallback('show_my_teams', {}) }
                    ]]
                }
            });
            await safeAnswer(ctx, '❌ Jamoa topilmadi');
            return;
        }
        
        if (!teamService.isUserInTeam(userId, teamId)) {
            await safeEdit(ctx, '❌ **Ruxsat yo\'q**\n\nSiz bu jamoa a\'zosi emassiz.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '👥 Jamoa ro\'yxati', callback_data: keyboardBuilder.encodeCallback('show_my_teams', {}) }
                    ]]
                }
            });
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        const stats = teamService.getTeamStats(teamId);
        const isAdmin = teamService.isTeamAdmin(userId, teamId);
        const userRole = isAdmin ? 'admin' : 'member';
        
        const message = teamService.formatTeamInfo(team, stats, userRole);
        
        const keyboard = new InlineKeyboard()
            .text('📝 Vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId }))
            .text('👥 A\'zolar', keyboardBuilder.encodeCallback('team_members', { teamId }))
            .row()
            .text('➕ Yangi vazifa', keyboardBuilder.encodeCallback('create_team_task', { teamId }))
            .text('📤 Kod ulashish', keyboardBuilder.encodeCallback('share_team_code', { teamId }))
            .row();
            
        if (isAdmin) {
            keyboard.text('⚙️ Boshqarish', keyboardBuilder.encodeCallback('team_admin', { teamId }));
        } else {
            keyboard.text('🚪 Chiqish', keyboardBuilder.encodeCallback('leave_team', { teamId }));
        }
        
        keyboard.row()
               .text('⬅️ Jamoa ro\'yxati', keyboardBuilder.encodeCallback('show_my_teams', {}));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, `👥 ${team.name}`);
    }

    /**
     * Handler: Team settings
     */
    async handleTeamSettings(ctx, data) {
        const userId = ctx.from.id.toString();
        const userTeams = teamService.getUserTeams(userId);
        
        let message = '⚙️ **JAMOA SOZLAMALARI**\n\n';
        
        if (userTeams.length === 0) {
            message += '📝 Hozircha hech qaysi jamoada emassiz\n\n';
            message += '💡 Avval jamoa yarating yoki jamoaga qo\'shiling';
            
            const keyboard = new InlineKeyboard()
                .text('➕ Jamoa yaratish', keyboardBuilder.encodeCallback('create_team_quick', {}))
                .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}))
                .row()
                .text('⬅️ Jamoa funksiyalari', keyboardBuilder.encodeCallback('show_team_features', {}));
                
            await safeEdit(ctx, message, {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            await safeAnswer(ctx, 'Jamoa topilmadi');
            return;
        }
        
        message += `📊 **Umumiy statistika:**\n`;
        message += `👥 Jamoalar soni: ${userTeams.length}\n`;
        
        let adminTeams = 0;
        let totalMembers = 0;
        let totalTasks = 0;
        
        userTeams.forEach(team => {
            if (teamService.isTeamAdmin(userId, team.id)) adminTeams++;
            const stats = teamService.getTeamStats(team.id);
            totalMembers += stats.totalMembers;
            totalTasks += stats.totalTasks;
        });
        
        message += `👑 Admin bo'lgan: ${adminTeams}\n`;
        message += `👤 Jami a'zolar: ${totalMembers}\n`;
        message += `📝 Jami vazifalar: ${totalTasks}\n\n`;
        
        message += `🎯 **Mavjud amallar:**\n`;
        message += `• Yangi jamoa yaratish\n`;
        message += `• Mavjud jamoaga qo'shilish\n`;
        message += `• Jamoa ma'lumotlarini ko'rish\n`;
        message += `• Vazifa tayinlash va bajarish\n`;
        
        const keyboard = new InlineKeyboard()
            .text('👥 Jamoa ro\'yxati', keyboardBuilder.encodeCallback('show_my_teams', {}))
            .text('📊 Umumiy statistika', keyboardBuilder.encodeCallback('team_global_stats', {}))
            .row()
            .text('➕ Yangi jamoa', keyboardBuilder.encodeCallback('create_team_quick', {}))
            .text('🔑 Jamoaga qo\'shilish', keyboardBuilder.encodeCallback('join_team_quick', {}))
            .row()
            .text('⬅️ Jamoa funksiyalari', keyboardBuilder.encodeCallback('show_team_features', {}));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '⚙️ Jamoa sozlamalari');
    }

    /**
     * Handler: Leave team
     */
    async handleLeaveTeam(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId || data.match[1];
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Jamoa topilmadi');
            return;
        }
        
        const isAdmin = teamService.isTeamAdmin(userId, teamId);
        
        if (isAdmin && team.members.length > 1) {
            // Admin leaving - show warning
            const keyboard = new InlineKeyboard()
                .text('✅ Ha, chiqmoqchiman', keyboardBuilder.encodeCallback('confirm_leave_team', { teamId }))
                .text('❌ Yo\'q, qolaman', keyboardBuilder.encodeCallback('show_team', { teamId }));
                
            await safeEdit(ctx, 
                `⚠️ **Admin sifatida chiqish**\n\n` +
                `Siz "${team.name}" jamoasining adminisiz.\n\n` +
                `Agar chiqsangiz:\n` +
                `• Admin huquqlari birinchi a'zoga o'tadi\n` +
                `• Jamoa ishlashda davom etadi\n\n` +
                `Haqiqatan chiqmoqchimisiz?`,
                {
                    reply_markup: keyboard,
                    parse_mode: 'Markdown'
                }
            );
        } else {
            // Regular member leaving
            const keyboard = new InlineKeyboard()
                .text('✅ Ha, chiqmoqchiman', keyboardBuilder.encodeCallback('confirm_leave_team', { teamId }))
                .text('❌ Yo\'q, qolaman', keyboardBuilder.encodeCallback('show_team', { teamId }));
                
            await safeEdit(ctx, 
                `🚪 **Jamoadan chiqish**\n\n` +
                `"${team.name}" jamoasidan chiqmoqchimisiz?\n\n` +
                `Bu amalni ortga qaytarib bo'lmaydi.`,
                {
                    reply_markup: keyboard,
                    parse_mode: 'Markdown'
                }
            );
        }
        
        await safeAnswer(ctx, 'Chiqish tasdiqi');
    }

    /**
     * Handler: Team tasks
     */
    async handleTeamTasks(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId || data.match[1];
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        const tasks = team.sharedTasks || [];
        const activeTasks = tasks.filter(t => !t.completed);
        const completedTasks = tasks.filter(t => t.completed);
        
        let message = `📝 **${team.name.toUpperCase()} VAZIFALAR**\n\n`;
        
        if (tasks.length === 0) {
            message += '📋 Jamoa vazifalar yo\'q\n\n';
            message += '💡 Admin vazifa tayinlashi mumkin';
            
            const keyboard = new InlineKeyboard()
                .text('⬅️ Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
                
            await safeEdit(ctx, message, {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            await safeAnswer(ctx, 'Vazifa yo\'q');
            return;
        }
        
        if (activeTasks.length > 0) {
            message += `⏳ **Faol vazifalar (${activeTasks.length}):**\n\n`;
            activeTasks.slice(0, 5).forEach((task, index) => {
                const priority = this.getPriorityEmoji(task.priority);
                const timeStr = this.formatDate(new Date(task.date));
                message += `${index + 1}. ${priority} **${task.name}**\n`;
                message += `   📅 ${timeStr}\n`;
                message += `   👤 Tayinlagan: User ${task.assignedBy}\n\n`;
            });
            
            if (activeTasks.length > 5) {
                message += `... va yana ${activeTasks.length - 5} ta vazifa\n\n`;
            }
        }
        
        if (completedTasks.length > 0) {
            message += `✅ **Bajarilgan (${completedTasks.length}):**\n\n`;
            completedTasks.slice(0, 3).forEach((task, index) => {
                const priority = this.getPriorityEmoji(task.priority);
                message += `${index + 1}. ${priority} ${task.name}\n`;
                message += `   ✅ User ${task.completedBy}\n\n`;
            });
        }
        
        const keyboard = new InlineKeyboard()
            .text('📊 Batafsil ko\'rish', keyboardBuilder.encodeCallback('team_tasks_detailed', { teamId }))
            .text('⬅️ Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '📝 Jamoa vazifalar');
    }

    /**
     * Handler: Team members
     */
    async handleTeamMembers(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId || data.match[1];
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        let message = `👥 **${team.name.toUpperCase()} A'ZOLARI**\n\n`;
        message += `👤 **Jami a'zolar:** ${team.members.length} kishi\n\n`;
        
        try {
            // Get member info (simplified version)
            team.members.forEach((memberId, index) => {
                const isAdmin = team.admin === memberId;
                const role = isAdmin ? '👑 Admin' : '👤 A\'zo';
                
                message += `${index + 1}. ${role}\n`;
                message += `   🆔 User ${memberId}\n`;
                if (isAdmin) {
                    message += `   🎯 Jamoa yaratuvchisi\n`;
                }
                message += '\n';
            });
            
        } catch (error) {
            logger.error('Error loading team members:', error);
            message += '❌ A\'zolar ma\'lumotini yuklashda xatolik\n\n';
        }
        
        const isAdmin = teamService.isTeamAdmin(userId, teamId);
        const keyboard = new InlineKeyboard();
        
        if (isAdmin) {
            keyboard.text('⚙️ A\'zolarni boshqarish', keyboardBuilder.encodeCallback('manage_team_members', { teamId }));
        }
        
        keyboard.text('⬅️ Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '👥 A\'zolar ro\'yxati');
    }

    /**
     * Handler: Assign to team
     */
    async handleAssignToTeam(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId || data.match[1];
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        // Get user's personal unassigned tasks
        const user = db.getUser(userId);
        const personalTasks = user.tasks.filter(t => !t.completed && !t.assignedTo);
        
        if (personalTasks.length === 0) {
            const keyboard = new InlineKeyboard()
                .text('➕ Yangi vazifa yaratish', keyboardBuilder.encodeCallback('add_task', {}))
                .text('⬅️ Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
                
            await safeEdit(ctx, 
                `📝 **Tayinlash uchun vazifa yo'q**\n\n` +
                `Sizda "${team.name}" jamoasiga tayinlash uchun shaxsiy vazifalar yo'q.\n\n` +
                `Avval vazifa yarating, keyin uni jamoaga tayinlashingiz mumkin.`,
                {
                    reply_markup: keyboard,
                    parse_mode: 'Markdown'
                }
            );
            await safeAnswer(ctx, 'Vazifa yo\'q');
            return;
        }
        
        let message = `📝 **VAZIFA TAYINLASH**\n\n`;
        message += `👥 **Jamoa:** ${team.name}\n`;
        message += `📋 **Mavjud vazifalar:** ${personalTasks.length} ta\n\n`;
        message += `Qaysi vazifani tayinlamoqchisiz?\n\n`;
        
        const keyboard = new InlineKeyboard();
        
        personalTasks.slice(0, 5).forEach((task, index) => {
            const priority = this.getPriorityEmoji(task.priority);
            const timeStr = this.formatTime(task.date);
            message += `${index + 1}. ${priority} **${task.name}**\n`;
            message += `   📅 ${timeStr}\n\n`;
            
            keyboard.text(`${index + 1}. ${task.name.slice(0, 20)}...`, 
                keyboardBuilder.encodeCallback('assign_task_to_team', { 
                    taskId: task.id, 
                    teamId: teamId 
                }));
            keyboard.row();
        });
        
        if (personalTasks.length > 5) {
            message += `... va yana ${personalTasks.length - 5} ta vazifa`;
        }
        
        keyboard.text('⬅️ Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, 'Vazifa tanlang');
    }

    /**
     * Handler: Share team code
     */
    async handleShareTeamCode(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        const message = `📤 **JAMOA KODINI ULASHISH**\n\n` +
            `👥 **Jamoa:** ${team.name}\n` +
            `🆔 **Kod:** \`${team.id}\`\n\n` +
            `📋 **Ulashish usullari:**\n` +
            `• **Telegram:** Bu xabarni forward qiling\n` +
            `• **Kopyalash:** Kodni nusxalab boshqa joyga yozing\n` +
            `• **Screenshot:** Bu xabarni rasmga oling\n\n` +
            `💡 **Qo'shilish:**\n` +
            `Boshqa foydalanuvchilar \`${team.id}\` kodini `/jointeam` buyrug'i bilan kirishib jamoaga qo'shilishlari mumkin.\n\n` +
            `🔐 **Xavfsizlik:**\n` +
            `Kod faqat ishonchli odamlar bilan ulashing. Har kim jamoaga qo'shilishi mumkin.`;
        
        const keyboard = new InlineKeyboard()
            .text('📋 Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }))
            .text('⬅️ Orqaga', keyboardBuilder.encodeCallback('show_team', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '📤 Kod ulashildi');
    }

    /**
     * Handler: Team admin panel
     */
    async handleTeamAdmin(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isTeamAdmin(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        const stats = teamService.getTeamStats(teamId);
        
        let message = `⚙️ **JAMOA BOSHQARUVI**\n\n`;
        message += `👥 **Jamoa:** ${team.name}\n`;
        message += `🆔 **Kod:** \`${team.id}\`\n\n`;
        message += `📊 **Statistika:**\n`;
        message += `👤 A'zolar: ${stats.totalMembers} kishi\n`;
        message += `📝 Vazifalar: ${stats.totalTasks} ta\n`;
        message += `✅ Bajarilgan: ${stats.completedTasks} ta\n\n`;
        message += `👑 **Admin funksiyalari:**\n`;
        message += `• A'zolarni boshqarish\n`;
        message += `• Jamoa kodi ulashish\n`;
        message += `• Vazifalar nazorati\n`;
        
        const keyboard = new InlineKeyboard()
            .text('👥 A\'zolarni boshqarish', keyboardBuilder.encodeCallback('manage_team_members', { teamId }))
            .text('📤 Kod ulashish', keyboardBuilder.encodeCallback('share_team_code', { teamId }))
            .row()
            .text('📝 Vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId }))
            .text('📊 Statistika', keyboardBuilder.encodeCallback('team_stats', { teamId }))
            .row()
            .text('⬅️ Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '⚙️ Admin panel');
    }

    /**
     * Handler: Manage team members
     */
    async handleManageTeamMembers(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isTeamAdmin(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        let message = `👥 **A'ZOLARNI BOSHQARISH**\n\n`;
        message += `📋 **Jamoa:** ${team.name}\n\n`;
        message += `👤 **A'zolar ro'yxati:**\n`;
        
        team.members.forEach((memberId, index) => {
            try {
                const member = db.getUser(memberId);
                const isAdmin = team.adminId === memberId;
                message += `${index + 1}. **${member.profile?.name || member.firstName || 'Foydalanuvchi'}**\n`;
                if (isAdmin) {
                    message += `   👑 Jamoa yaratuvchisi\n`;
                } else {
                    message += `   👤 A'zo\n`;
                }
                message += '\n';
            } catch (error) {
                message += `${index + 1}. ❌ Foydalanuvchi ma'lumoti yo'q\n\n`;
            }
        });
        
        message += `🛠️ **Boshqaruv funksiyalari:**\n`;
        message += `• Yangi a'zolar avtomatik qo'shiladi\n`;
        message += `• A'zolar o'z-o'zidan chiqib ketishlari mumkin\n`;
        message += `• Admin barcha huquqlarga ega\n`;
        
        const keyboard = new InlineKeyboard()
            .text('📤 Kod ulashish', keyboardBuilder.encodeCallback('share_team_code', { teamId }))
            .text('📝 Vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId }))
            .row()
            .text('⬅️ Admin panel', keyboardBuilder.encodeCallback('team_admin', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '👥 A\'zolar boshqaruvi');
    }

    /**
     * Handler: Assign task to team (complete assignment)
     */
    async handleAssignTaskToTeam(ctx, data) {
        const userId = ctx.from.id.toString();
        const { taskId, teamId } = data;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        try {
            const user = db.getUser(userId);
            const task = user.tasks.find(t => t.id === taskId);
            
            if (!task) {
                await safeAnswer(ctx, '❌ Vazifa topilmadi');
                return;
            }
            
            // Assign task to team
            task.assignedTo = teamId;
            task.assignedBy = userId;
            task.assignedAt = new Date().toISOString();
            
            await db.saveData();
            
            const message = `✅ **VAZIFA TAYINLANDI**\n\n` +
                `📝 **Vazifa:** ${task.name}\n` +
                `👥 **Jamoa:** ${team.name}\n` +
                `📅 **Muddati:** ${this.formatTime(task.date)}\n` +
                `👤 **Tayinlovchi:** Siz\n\n` +
                `🎯 Vazifa jamoaga tayinlandi va barcha a'zolar uni ko'rishlari mumkin.`;
            
            const keyboard = new InlineKeyboard()
                .text('📝 Jamoa vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId }))
                .text('👥 Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }))
                .row()
                .text('⬅️ Vazifalar', keyboardBuilder.encodeCallback('back_to_main_tasks', {}));
            
            await safeEdit(ctx, message, {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            await safeAnswer(ctx, '✅ Vazifa tayinlandi');
            
            // Notify team members
            for (const memberId of team.members) {
                if (memberId !== userId) {
                    try {
                        await ctx.api.sendMessage(memberId, 
                            `🎯 **YANGI VAZIFA TAYINLANDI**\n\n` +
                            `📝 Vazifa: ${task.name}\n` +
                            `👥 Jamoa: ${team.name}\n` +
                            `📅 Muddati: ${this.formatTime(task.date)}\n` +
                            `👤 Tayinlovchi: ${user.profile?.name || user.firstName}\n\n` +
                            `Vazifani ko'rish uchun /team buyrug'ini ishlating.`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (error) {
                        logger.error(`Failed to notify team member ${memberId}:`, error);
                    }
                }
            }
            
        } catch (error) {
            logger.error('Error assigning task to team:', error);
            await safeAnswer(ctx, '❌ Xatolik yuz berdi');
        }
    }

    /**
     * Handler: Team statistics
     */
    async handleTeamStats(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        const stats = teamService.getTeamStats(teamId);
        
        let message = `📊 **JAMOA STATISTIKASI**\n\n`;
        message += `👥 **Jamoa:** ${team.name}\n`;
        message += `📅 **Yaratilgan:** ${new Date(team.createdAt).toLocaleDateString('uz-UZ')}\n\n`;
        
        message += `👤 **A'zolar:**\n`;
        message += `• Jami: ${stats.totalMembers} kishi\n`;
        message += `• Faol: ${stats.activeMembers || stats.totalMembers} kishi\n\n`;
        
        message += `📝 **Vazifalar:**\n`;
        message += `• Jami: ${stats.totalTasks} ta\n`;
        message += `• ✅ Bajarilgan: ${stats.completedTasks} ta\n`;
        message += `• ⏳ Faol: ${stats.activeTasks} ta\n`;
        message += `• 🚨 Muddati o'tgan: ${stats.overdueTasks} ta\n\n`;
        
        message += `📈 **Ko'rsatkichlar:**\n`;
        message += `• Bajarish darajasi: ${stats.completionRate}%\n`;
        if (stats.totalTasks > 0) {
            const avgTasksPerMember = (stats.totalTasks / stats.totalMembers).toFixed(1);
            message += `• O'rtacha vazifa (har bir a'zo): ${avgTasksPerMember} ta\n`;
        }
        
        if (stats.completedTasks > 0) {
            message += `• Oxirgi bajarilgan vazifa: bugun\n`;
        }
        
        message += `\n🎯 **Jamoa faolligi:** ${stats.completionRate >= 80 ? 'Juda yaxshi' : stats.completionRate >= 60 ? 'Yaxshi' : stats.completionRate >= 40 ? 'O\'rtacha' : 'Yaxshilash kerak'}`;
        
        const keyboard = new InlineKeyboard()
            .text('📝 Vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId }))
            .text('👥 A\'zolar', keyboardBuilder.encodeCallback('team_members', { teamId }))
            .row()
            .text('⬅️ Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '📊 Statistika');
    }

    /**
     * Handler: Create team task
     */
    async handleCreateTeamTask(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        let message = `➕ **JAMOA UCHUN YANGI VAZIFA**\n\n`;
        message += `👥 **Jamoa:** ${team.name}\n\n`;
        message += `📝 **Vazifa nomini kiriting:**\n`;
        message += `Misol: "Hisobot tayyorlash", "Mijoz bilan uchrashuv", "Loyiha tahlili"\n\n`;
        message += `💡 **Keyingi qadamlar:**\n`;
        message += `1. Vazifa nomi\n`;
        message += `2. Muddatni belgilash\n`;
        message += `3. Mas'ul shaxsni tanlash\n`;
        message += `4. Vazifani yaratish`;
        
        const keyboard = new InlineKeyboard()
            .text('⬅️ Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
        
        // Set state for team task creation
        ctx.state.set('waiting_team_task_name', { teamId });
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '✏️ Vazifa nomini kiriting');
    }

    /**
     * Handler: Select team task assignee
     */
    async handleSelectTeamTaskAssignee(ctx, data) {
        const userId = ctx.from.id.toString();
        const { teamId, taskData } = data;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        let message = `👤 **MAS'UL SHAXSNI TANLANG**\n\n`;
        message += `📝 **Vazifa:** ${taskData.name}\n`;
        message += `📅 **Muddat:** ${this.formatTime(taskData.date)}\n`;
        message += `👥 **Jamoa:** ${team.name}\n\n`;
        message += `👥 **Mavjud a'zolar:**\n`;
        
        const keyboard = new InlineKeyboard();
        
        // Add option for "Anyone can do it"
        keyboard.text('👥 Har kim bajara oladi', keyboardBuilder.encodeCallback('assign_team_task', { 
            teamId, 
            taskData, 
            assigneeId: 'anyone' 
        }));
        keyboard.row();
        
        // Add team members
        team.members.forEach((memberId, index) => {
            try {
                const member = db.getUser(memberId);
                const memberName = member.profile?.name || member.firstName || 'Foydalanuvchi';
                const isCreator = memberId === userId;
                
                message += `${index + 1}. **${memberName}**${isCreator ? ' (Siz)' : ''}\n`;
                
                keyboard.text(
                    `${index + 1}. ${memberName}${isCreator ? ' (Siz)' : ''}`,
                    keyboardBuilder.encodeCallback('assign_team_task', { 
                        teamId, 
                        taskData, 
                        assigneeId: memberId 
                    })
                );
                keyboard.row();
            } catch (error) {
                logger.error('Error loading team member:', error);
            }
        });
        
        keyboard.text('⬅️ Orqaga', keyboardBuilder.encodeCallback('create_team_task', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '👤 Mas\'ul shaxsni tanlang');
    }

    /**
     * Handler: Assign team task to user
     */
    async handleAssignTeamTaskToUser(ctx, data) {
        const userId = ctx.from.id.toString();
        const { teamId, taskData, assigneeId } = data;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        try {
            // Create team task
            const taskId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const teamTask = {
                id: taskId,
                name: taskData.name,
                date: taskData.date,
                priority: taskData.priority || 'medium',
                teamId: teamId,
                createdBy: userId,
                assignedTo: assigneeId === 'anyone' ? null : assigneeId,
                createdAt: new Date().toISOString(),
                completed: false,
                completionNote: null,
                completedBy: null,
                completedAt: null
            };
            
            // Save to team data
            if (!team.tasks) team.tasks = [];
            team.tasks.push(teamTask);
            
            await teamService.saveTeamData();
            
            const assigneeName = assigneeId === 'anyone' ? 'Har kim' : 
                                 assigneeId === userId ? 'Siz' :
                                 (() => {
                                     try {
                                         const assignee = db.getUser(assigneeId);
                                         return assignee.profile?.name || assignee.firstName || 'Foydalanuvchi';
                                     } catch {
                                         return 'Noma\'lum';
                                     }
                                 })();
            
            let message = `✅ **JAMOA VAZIFASI YARATILDI**\n\n`;
            message += `📝 **Vazifa:** ${taskData.name}\n`;
            message += `📅 **Muddat:** ${this.formatTime(taskData.date)}\n`;
            message += `👥 **Jamoa:** ${team.name}\n`;
            message += `👤 **Mas'ul:** ${assigneeName}\n`;
            message += `👑 **Yaratuvchi:** Siz\n\n`;
            message += `🎯 **Vazifa yaratildi va barcha jamoa a'zolariga xabar berildi!**`;
            
            const keyboard = new InlineKeyboard()
                .text('📝 Jamoa vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId }))
                .text('👥 Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }))
                .row()
                .text('➕ Yana vazifa yaratish', keyboardBuilder.encodeCallback('create_team_task', { teamId }));
            
            await safeEdit(ctx, message, {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            await safeAnswer(ctx, '✅ Vazifa yaratildi');
            
            // Notify all team members
            const creator = db.getUser(userId);
            const creatorName = creator.profile?.name || creator.firstName || 'Foydalanuvchi';
            
            for (const memberId of team.members) {
                if (memberId !== userId) {
                    try {
                        const isAssigned = assigneeId === memberId || assigneeId === 'anyone';
                        const notificationMessage = 
                            `🎯 **YANGI JAMOA VAZIFASI**\n\n` +
                            `📝 **Vazifa:** ${taskData.name}\n` +
                            `👥 **Jamoa:** ${team.name}\n` +
                            `📅 **Muddat:** ${this.formatTime(taskData.date)}\n` +
                            `👤 **Mas'ul:** ${assigneeName}\n` +
                            `👑 **Yaratuvchi:** ${creatorName}\n\n` +
                            (isAssigned ? `🔥 **Sizga tayinlangan vazifa!**\n` : '') +
                            `Vazifani ko'rish uchun /team buyrug'ini ishlating.`;
                        
                        await ctx.api.sendMessage(memberId, notificationMessage, { 
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { 
                                        text: '👁️ Vazifani ko\'rish', 
                                        callback_data: keyboardBuilder.encodeCallback('view_team_task', { 
                                            teamId, 
                                            taskId 
                                        }) 
                                    }
                                ]]
                            }
                        });
                    } catch (error) {
                        logger.error(`Failed to notify team member ${memberId}:`, error);
                    }
                }
            }
            
        } catch (error) {
            logger.error('Error creating team task:', error);
            await safeAnswer(ctx, '❌ Xatolik yuz berdi');
        }
    }

    /**
     * Handler: View specific team task
     */
    async handleViewTeamTask(ctx, data) {
        const userId = ctx.from.id.toString();
        const teamId = data.teamId || data.match[1];
        const taskId = data.taskId || data.match[2];
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        const task = team.tasks?.find(t => t.id === taskId);
        if (!task) {
            await safeAnswer(ctx, '❌ Vazifa topilmadi');
            return;
        }
        
        let message = `📝 **JAMOA VAZIFASI**\n\n`;
        message += `**${task.name}**\n\n`;
        message += `👥 **Jamoa:** ${team.name}\n`;
        message += `📅 **Muddat:** ${this.formatTime(task.date)}\n`;
        message += `🎯 **Holat:** ${task.completed ? '✅ Bajarilgan' : '⏳ Jarayonda'}\n`;
        
        try {
            const creator = db.getUser(task.createdBy);
            message += `👑 **Yaratuvchi:** ${creator.profile?.name || creator.firstName}\n`;
        } catch (error) {
            message += `👑 **Yaratuvchi:** Noma'lum\n`;
        }
        
        if (task.assignedTo) {
            try {
                const assignee = db.getUser(task.assignedTo);
                message += `👤 **Mas'ul:** ${assignee.profile?.name || assignee.firstName}\n`;
            } catch (error) {
                message += `👤 **Mas'ul:** Noma'lum\n`;
            }
        } else {
            message += `👤 **Mas'ul:** Har kim bajara oladi\n`;
        }
        
        if (task.completed) {
            message += `📅 **Bajarilgan sana:** ${new Date(task.completedAt).toLocaleString('uz-UZ')}\n`;
            
            if (task.completedBy) {
                try {
                    const completer = db.getUser(task.completedBy);
                    message += `👤 **Bajaruvchi:** ${completer.profile?.name || completer.firstName}\n`;
                } catch (error) {
                    message += `👤 **Bajaruvchi:** Noma'lum\n`;
                }
            }
            
            if (task.completionNote) {
                message += `📝 **Izoh:** ${task.completionNote}\n`;
            }
        }
        
        const keyboard = new InlineKeyboard();
        
        // Show completion button only for assigned user or if task is open to anyone
        const canComplete = !task.completed && (
            !task.assignedTo || task.assignedTo === userId
        );
        
        if (canComplete) {
            keyboard.text('✅ Bajarildi', keyboardBuilder.encodeCallback('complete_team_task', { 
                teamId, 
                taskId 
            }));
            keyboard.row();
        }
        
        keyboard.text('📝 Jamoa vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId }))
               .text('👥 Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, task.completed ? '✅ Bajarilgan vazifa' : '📝 Faol vazifa');
    }

    /**
     * Handler: Complete team task
     */
    async handleCompleteTeamTask(ctx, data) {
        const userId = ctx.from.id.toString();
        const { teamId, taskId } = data;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        const task = team.tasks?.find(t => t.id === taskId);
        if (!task) {
            await safeAnswer(ctx, '❌ Vazifa topilmadi');
            return;
        }
        
        if (task.completed) {
            await safeAnswer(ctx, '✅ Vazifa allaqachon bajarilgan');
            return;
        }
        
        // Check if user can complete this task
        const canComplete = !task.assignedTo || task.assignedTo === userId;
        if (!canComplete) {
            await safeAnswer(ctx, '❌ Bu vazifani faqat tayinlangan shaxs bajara oladi');
            return;
        }
        
        let message = `✅ **VAZIFANI BAJARISH**\n\n`;
        message += `📝 **Vazifa:** ${task.name}\n`;
        message += `👥 **Jamoa:** ${team.name}\n`;
        message += `📅 **Muddat:** ${this.formatTime(task.date)}\n\n`;
        message += `🎉 **Vazifa bajarildi deb belgilansinmi?**\n\n`;
        message += `📝 **Ixtiyoriy izoh qo'shishingiz mumkin:**\n`;
        message += `Misol: "Muvaffaqiyatli yakunlandi", "Qo'shimcha takliflar bor", "Muammosiz bajarildi"`;
        
        const keyboard = new InlineKeyboard()
            .text('✅ Izhohsiz yakunlash', keyboardBuilder.encodeCallback('complete_team_task_final', { 
                teamId, 
                taskId, 
                note: '' 
            }))
            .row()
            .text('📝 Izoh bilan yakunlash', keyboardBuilder.encodeCallback('add_completion_note', { 
                teamId, 
                taskId 
            }))
            .row()
            .text('❌ Bekor qilish', keyboardBuilder.encodeCallback('view_team_task', { 
                teamId, 
                taskId 
            }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '✅ Vazifani yakunlash');
    }

    /**
     * Handler: Add completion note
     */
    async handleAddCompletionNote(ctx, data) {
        const userId = ctx.from.id.toString();
        const { teamId, taskId } = data;
        
        let message = `📝 **BAJARISH IZOHI**\n\n`;
        message += `Vazifa bajarilganligi haqida qisqacha izoh yozing:\n\n`;
        message += `💡 **Maslahatlar:**\n`;
        message += `• Qanday natijaga erishganingiz\n`;
        message += `• Qanday qiyinchiliklar bo'lgani\n`;
        message += `• Keyingi qadamlar haqida takliflar\n`;
        message += `• Boshqa a'zolar uchun foydali ma'lumotlar`;
        
        const keyboard = new InlineKeyboard()
            .text('❌ Izhohsiz yakunlash', keyboardBuilder.encodeCallback('complete_team_task_final', { 
                teamId, 
                taskId, 
                note: '' 
            }))
            .row()
            .text('⬅️ Orqaga', keyboardBuilder.encodeCallback('complete_team_task', { 
                teamId, 
                taskId 
            }));
        
        // Set state for completion note
        ctx.state.set('waiting_completion_note', { teamId, taskId });
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '📝 Izoh yozing');
    }

    /**
     * Handler: Complete team task final
     */
    async handleCompleteTeamTaskFinal(ctx, data) {
        const userId = ctx.from.id.toString();
        const { teamId, taskId, note } = data;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        const task = team.tasks?.find(t => t.id === taskId);
        if (!task) {
            await safeAnswer(ctx, '❌ Vazifa topilmadi');
            return;
        }
        
        if (task.completed) {
            await safeAnswer(ctx, '✅ Vazifa allaqachon bajarilgan');
            return;
        }
        
        try {
            // Mark task as completed
            task.completed = true;
            task.completedBy = userId;
            task.completedAt = new Date().toISOString();
            task.completionNote = note || null;
            
            await teamService.saveTeamData();
            
            let message = `🎉 **VAZIFA MUVAFFAQIYATLI BAJARILDI!**\n\n`;
            message += `✅ **Vazifa:** ${task.name}\n`;
            message += `👥 **Jamoa:** ${team.name}\n`;
            message += `📅 **Muddat:** ${this.formatTime(task.date)}\n`;
            message += `👤 **Bajaruvchi:** Siz\n`;
            message += `🕐 **Bajarilgan vaqt:** ${new Date().toLocaleString('uz-UZ')}\n`;
            
            if (note) {
                message += `\n📝 **Izoh:** ${note}\n`;
            }
            
            message += `\n🎯 **Barcha jamoa a'zolariga xabar berildi!**`;
            
            const keyboard = new InlineKeyboard()
                .text('📝 Jamoa vazifalar', keyboardBuilder.encodeCallback('team_tasks', { teamId }))
                .text('👥 Jamoa ma\'lumoti', keyboardBuilder.encodeCallback('show_team', { teamId }))
                .row()
                .text('➕ Yangi vazifa yaratish', keyboardBuilder.encodeCallback('create_team_task', { teamId }));
            
            await safeEdit(ctx, message, {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
            await safeAnswer(ctx, '🎉 Vazifa bajarildi!');
            
            // Notify all team members
            const completer = db.getUser(userId);
            const completerName = completer.profile?.name || completer.firstName || 'Foydalanuvchi';
            
            for (const memberId of team.members) {
                if (memberId !== userId) {
                    try {
                        let notificationMessage = 
                            `🎉 **VAZIFA BAJARILDI!**\n\n` +
                            `✅ **Vazifa:** ${task.name}\n` +
                            `👥 **Jamoa:** ${team.name}\n` +
                            `👤 **Bajaruvchi:** ${completerName}\n` +
                            `🕐 **Vaqt:** ${new Date().toLocaleString('uz-UZ')}\n`;
                        
                        if (note) {
                            notificationMessage += `\n📝 **Izoh:** ${note}\n`;
                        }
                        
                        notificationMessage += `\nVazifani ko'rish uchun /team buyrug'ini ishlating.`;
                        
                        await ctx.api.sendMessage(memberId, notificationMessage, { 
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { 
                                        text: '👁️ Vazifani ko\'rish', 
                                        callback_data: keyboardBuilder.encodeCallback('view_team_task', { 
                                            teamId, 
                                            taskId 
                                        }) 
                                    }
                                ]]
                            }
                        });
                    } catch (error) {
                        logger.error(`Failed to notify team member ${memberId}:`, error);
                    }
                }
            }
            
        } catch (error) {
            logger.error('Error completing team task:', error);
            await safeAnswer(ctx, '❌ Xatolik yuz berdi');
        }
    }

    /**
     * Handler: Select team task date
     */
    async handleSelectTeamTaskDate(ctx, data) {
        const userId = ctx.from.id.toString();
        const { teamId, taskData, dateType } = data;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        let selectedDate = new Date();
        
        switch (dateType) {
            case 'today':
                // Today - keep current date
                break;
            case 'tomorrow':
                selectedDate.setDate(selectedDate.getDate() + 1);
                break;
            case 'custom':
                // For custom, show date picker (simplified - use tomorrow for now)
                selectedDate.setDate(selectedDate.getDate() + 2);
                break;
        }
        
        // Show time selection
        let message = `🕐 **VAQTNI BELGILANG**\n\n`;
        message += `📝 **Vazifa:** ${taskData.name}\n`;
        message += `👥 **Jamoa:** ${team.name}\n`;
        message += `📅 **Sana:** ${selectedDate.toLocaleDateString('uz-UZ')}\n\n`;
        message += `Vazifa qaysi vaqtda bajarilishi kerak?`;
        
        const timeOptions = [
            { label: '🌅 Ertalab (09:00)', time: '09:00' },
            { label: '🌞 Tushlik (12:00)', time: '12:00' },
            { label: '🌇 Kechqurun (15:00)', time: '15:00' },
            { label: '🌙 Kech (18:00)', time: '18:00' },
            { label: '🌃 Tun (21:00)', time: '21:00' }
        ];
        
        const keyboard = new InlineKeyboard();
        
        timeOptions.forEach(option => {
            keyboard.text(option.label, keyboardBuilder.encodeCallback('select_team_task_time', {
                teamId,
                taskData: {
                    ...taskData,
                    date: selectedDate.toISOString(),
                    time: option.time
                }
            }));
            keyboard.row();
        });
        
        keyboard.text('⬅️ Orqaga', keyboardBuilder.encodeCallback('create_team_task', { teamId }));
        
        await safeEdit(ctx, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        await safeAnswer(ctx, '🕐 Vaqtni tanlang');
    }

    /**
     * Handler: Select team task time
     */
    async handleSelectTeamTaskTime(ctx, data) {
        const userId = ctx.from.id.toString();
        const { teamId, taskData } = data;
        
        const team = teamService.getTeam(teamId);
        if (!team || !teamService.isUserInTeam(userId, teamId)) {
            await safeAnswer(ctx, '❌ Ruxsat yo\'q');
            return;
        }
        
        // Create final task date
        const taskDate = new Date(taskData.date);
        const [hours, minutes] = taskData.time.split(':');
        taskDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        const finalTaskData = {
            ...taskData,
            date: taskDate.toISOString(),
            priority: 'medium'
        };
        
        // Show assignee selection
        await this.handleSelectTeamTaskAssignee(ctx, { teamId, taskData: finalTaskData });
    }
}

// Global callback handler instance
export const callbackHandler = new CallbackHandler();
