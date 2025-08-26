import { logger } from '../utils/logger.js';
import { db } from './database.js';

/**
 * Team Service
 * Handles team creation, management, and task assignment
 */
class TeamService {
    constructor() {
        this.teamData = {};
        this.loadTeamData();
    }

    /**
     * Load team data from database
     */
    loadTeamData() {
        const data = db.data;
        if (data.teamData) {
            this.teamData = data.teamData;
            logger.info(`Loaded ${Object.keys(this.teamData).length} teams`);
        } else {
            this.teamData = {};
            data.teamData = this.teamData;
        }
    }

    /**
     * Save team data to database
     */
    async saveTeamData() {
        db.data.teamData = this.teamData;
        await db.saveData();
    }

    /**
     * Generate unique team ID
     */
    generateTeamId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Ensure uniqueness
        if (this.teamData[result]) {
            return this.generateTeamId();
        }
        
        return result;
    }

    /**
     * Create new team
     */
    async createTeam(teamName, adminId) {
        const teamId = this.generateTeamId();
        
        this.teamData[teamId] = {
            id: teamId,
            name: teamName,
            admin: adminId,
            members: [adminId],
            sharedTasks: [],
            nextTaskId: 1,
            createdAt: new Date(),
            settings: {
                allowMemberInvite: false,
                requireApproval: true
            }
        };

        // Add team to user's teams
        const user = db.getUser(adminId);
        if (!user.teams) user.teams = [];
        user.teams.push(teamId);

        await this.saveTeamData();
        
        logger.info(`Team created: ${teamName} (${teamId}) by user ${adminId}`);
        return this.teamData[teamId];
    }

    /**
     * Join team by code
     */
    async joinTeam(teamId, userId) {
        if (!this.teamData[teamId]) {
            throw new Error('Team not found');
        }

        if (this.isUserInTeam(userId, teamId)) {
            throw new Error('User already in team');
        }

        const team = this.teamData[teamId];
        team.members.push(userId);

        // Add team to user's teams
        const user = db.getUser(userId);
        if (!user.teams) user.teams = [];
        user.teams.push(teamId);

        await this.saveTeamData();
        
        logger.info(`User ${userId} joined team ${teamId}`);
        return team;
    }

    /**
     * Leave team
     */
    async leaveTeam(teamId, userId) {
        if (!this.teamData[teamId]) {
            throw new Error('Team not found');
        }

        const team = this.teamData[teamId];
        
        // Remove from team members
        team.members = team.members.filter(id => id !== userId);
        
        // Remove from user's teams
        const user = db.getUser(userId);
        if (user.teams) {
            user.teams = user.teams.filter(id => id !== teamId);
        }

        // If admin leaves and there are other members, transfer admin
        if (team.admin === userId && team.members.length > 0) {
            team.admin = team.members[0];
            logger.info(`Admin transferred to ${team.members[0]} in team ${teamId}`);
        }

        // Delete team if no members left
        if (team.members.length === 0) {
            delete this.teamData[teamId];
            logger.info(`Team ${teamId} deleted (no members left)`);
        }

        await this.saveTeamData();
        
        logger.info(`User ${userId} left team ${teamId}`);
        return team.members.length > 0 ? team : null;
    }

    /**
     * Get team by ID
     */
    getTeam(teamId) {
        return this.teamData[teamId] || null;
    }

    /**
     * Get user's teams
     */
    getUserTeams(userId) {
        return Object.values(this.teamData).filter(team => 
            team.members.includes(userId)
        );
    }

    /**
     * Check if user is in team
     */
    isUserInTeam(userId, teamId) {
        const team = this.teamData[teamId];
        return team ? team.members.includes(userId) : false;
    }

    /**
     * Check if user is team admin
     */
    isTeamAdmin(userId, teamId) {
        const team = this.teamData[teamId];
        return team ? team.admin === userId : false;
    }

    /**
     * Get team statistics
     */
    getTeamStats(teamId) {
        const team = this.teamData[teamId];
        if (!team) return null;

        const tasks = team.sharedTasks || [];
        const completed = tasks.filter(t => t.completed).length;
        const active = tasks.filter(t => !t.completed).length;
        const overdue = tasks.filter(t => !t.completed && new Date(t.date) < new Date()).length;

        return {
            totalMembers: team.members.length,
            totalTasks: tasks.length,
            completedTasks: completed,
            activeTasks: active,
            overdueTasks: overdue,
            completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
        };
    }

    /**
     * Assign task to team
     */
    async assignTaskToTeam(task, teamId, assignedBy) {
        const team = this.teamData[teamId];
        if (!team) {
            throw new Error('Team not found');
        }

        // Generate team task ID
        const teamTaskId = `${teamId}_${team.nextTaskId++}`;
        
        // Create team task
        const teamTask = {
            ...task,
            id: teamTaskId,
            originalId: task.id,
            assignedBy: assignedBy,
            assignedTo: teamId,
            assignedAt: new Date(),
            teamTask: true
        };

        team.sharedTasks.push(teamTask);
        
        await this.saveTeamData();
        
        logger.info(`Task ${task.id} assigned to team ${teamId} by user ${assignedBy}`);
        return teamTask;
    }

    /**
     * Complete team task
     */
    async completeTeamTask(teamId, taskId, completedBy) {
        const team = this.teamData[teamId];
        if (!team) {
            throw new Error('Team not found');
        }

        const task = team.sharedTasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        task.completed = true;
        task.completedAt = new Date();
        task.completedBy = completedBy;

        await this.saveTeamData();
        
        logger.info(`Team task ${taskId} completed by user ${completedBy}`);
        return task;
    }

    /**
     * Get team task by ID
     */
    getTeamTask(teamId, taskId) {
        const team = this.teamData[teamId];
        if (!team) return null;

        return team.sharedTasks.find(t => t.id === taskId) || null;
    }

    /**
     * Delete team task
     */
    async deleteTeamTask(teamId, taskId, deletedBy) {
        const team = this.teamData[teamId];
        if (!team) {
            throw new Error('Team not found');
        }

        const taskIndex = team.sharedTasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
            throw new Error('Task not found');
        }

        const task = team.sharedTasks[taskIndex];
        team.sharedTasks.splice(taskIndex, 1);

        await this.saveTeamData();
        
        logger.info(`Team task ${taskId} deleted by user ${deletedBy}`);
        return task;
    }

    /**
     * Get team members info
     */
    async getTeamMembersInfo(teamId, bot) {
        const team = this.teamData[teamId];
        if (!team) return [];

        const membersInfo = [];
        
        for (const memberId of team.members) {
            try {
                const user = db.getUser(memberId);
                const chatInfo = await bot.api.getChat(memberId);
                
                membersInfo.push({
                    id: memberId,
                    name: chatInfo.first_name || chatInfo.username || 'Unknown',
                    username: chatInfo.username,
                    isAdmin: team.admin === memberId,
                    joinedAt: user.joinedTeamAt || team.createdAt,
                    tasksAssigned: team.sharedTasks.filter(t => t.assignedBy === memberId).length,
                    tasksCompleted: team.sharedTasks.filter(t => t.completedBy === memberId).length
                });
            } catch (error) {
                logger.warn(`Could not get info for team member ${memberId}:`, error);
                membersInfo.push({
                    id: memberId,
                    name: 'Unknown User',
                    username: null,
                    isAdmin: team.admin === memberId,
                    joinedAt: team.createdAt,
                    tasksAssigned: 0,
                    tasksCompleted: 0
                });
            }
        }

        return membersInfo;
    }

    /**
     * Format team info for display
     */
    formatTeamInfo(team, stats, userRole = 'member') {
        const createdDate = new Date(team.createdAt).toLocaleDateString('uz-UZ');
        
        let message = `👥 **${team.name}**\n\n`;
        message += `🆔 **Kod:** \`${team.id}\`\n`;
        message += `📅 **Yaratilgan:** ${createdDate}\n`;
        message += `👤 **A'zolar:** ${stats.totalMembers} kishi\n\n`;
        
        message += `📊 **Statistika:**\n`;
        message += `📝 Jami vazifalar: ${stats.totalTasks}\n`;
        message += `✅ Bajarilgan: ${stats.completedTasks}\n`;
        message += `⏳ Faol: ${stats.activeTasks}\n`;
        message += `🚨 Muddati o'tgan: ${stats.overdueTasks}\n`;
        message += `📈 Bajarish darajasi: ${stats.completionRate}%\n\n`;
        
        if (userRole === 'admin') {
            message += `👑 **Admin sifatida siz:**\n`;
            message += `• Vazifalar tayinlashingiz mumkin\n`;
            message += `• A'zolarni boshqarishingiz mumkin\n`;
            message += `• Jamoa sozlamalarini o'zgartirishingiz mumkin\n`;
        } else {
            message += `👤 **A'zo sifatida siz:**\n`;
            message += `• Jamoa vazifalarini ko'rishingiz mumkin\n`;
            message += `• Vazifalarni bajarishingiz mumkin\n`;
            message += `• Jamoa statistikasini ko'rishingiz mumkin\n`;
        }

        return message;
    }

    /**
     * Get all teams count
     */
    getTeamsCount() {
        return Object.keys(this.teamData).length;
    }

    /**
     * Get total team members count
     */
    getTotalMembersCount() {
        return Object.values(this.teamData).reduce((total, team) => total + team.members.length, 0);
    }
}

export const teamService = new TeamService();
