import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Enhanced database service with better data management
 */
class DatabaseService {
    constructor() {
        this.dataFile = config.DATA_FILE;
        this.dataDir = path.dirname(this.dataFile);
        this.data = {
            userData: {},
            teamData: {},
            globalSettings: {
                version: '2.0.0',
                lastUpdated: new Date().toISOString()
            }
        };
        this.saveQueue = [];
        this.isSaving = false;
    }

    /**
     * Initialize database
     */
    async init() {
        await this.ensureDataDir();
        await this.loadData();
        this.startAutoSave();
        logger.info('Database service initialized');
    }

    /**
     * Ensure data directory exists
     */
    async ensureDataDir() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            logger.error('Failed to create data directory', error);
            throw error;
        }
    }

    /**
     * Load data from file
     */
    async loadData() {
        try {
            const fileContent = await fs.readFile(this.dataFile, 'utf8');
            
            // Handle empty or corrupted files
            if (!fileContent.trim()) {
                logger.warn('Data file is empty, starting fresh');
                await this.saveData();
                return;
            }
            
            const loadedData = JSON.parse(fileContent);
            
            // Migrate old format if needed
            if (loadedData.userData) {
                this.data = { ...this.data, ...loadedData };
            } else {
                // Legacy format - convert to new structure
                this.data.userData = loadedData;
            }

            // Convert date strings back to Date objects
            this.convertDates();
            this.initializeUserDefaults();
            
            logger.info(`Loaded data for ${Object.keys(this.data.userData).length} users`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('No existing data file found, starting fresh');
                await this.saveData();
            } else {
                logger.error('Failed to load data', error);
                throw error;
            }
        }
    }

    /**
     * Convert date strings to Date objects
     */
    convertDates() {
        for (const userId in this.data.userData) {
            const user = this.data.userData[userId];
            
            if (user.tasks) {
                user.tasks.forEach(task => {
                    ['date', 'createdAt', 'completedAt', 'assignedAt', 'startTime', 'endTime'].forEach(field => {
                        if (task[field] && typeof task[field] === 'string') {
                            task[field] = new Date(task[field]);
                        }
                    });
                });
            }
        }

        for (const teamId in this.data.teamData) {
            const team = this.data.teamData[teamId];
            
            if (team.sharedTasks) {
                team.sharedTasks.forEach(task => {
                    ['date', 'createdAt', 'completedAt', 'assignedAt', 'startTime', 'endTime'].forEach(field => {
                        if (task[field] && typeof task[field] === 'string') {
                            task[field] = new Date(task[field]);
                        }
                    });
                });
            }
        }
    }

    /**
     * Initialize default values for users
     */
    initializeUserDefaults() {
        for (const userId in this.data.userData) {
            const user = this.data.userData[userId];
            
            // Ensure required fields exist
            if (!user.tasks) user.tasks = [];
            if (!user.teams) user.teams = [];
            if (!user.sharedTasks) user.sharedTasks = [];
            if (!user.nextTaskId) user.nextTaskId = 1;
            
            // Initialize new fields if missing
            if (!user.profile) {
                user.profile = {
                    username: '',
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    bio: '',
                    avatar: '',
                    timezone: config.defaults.timezone,
                    language: config.defaults.language,
                    dateFormat: 'DD.MM.YYYY',
                    timeFormat: '24h'
                };
            }

            if (!user.preferences) {
                user.preferences = {
                    prayerRegion: config.defaults.prayer_region,
                    notifications: {
                        tasks: true,
                        prayer: true,
                        updates: true,
                        teams: true,
                        reminders: true
                    },
                    privacy: {
                        showProfile: true,
                        allowTeamInvites: true,
                        shareTaskStats: false
                    }
                };
            }

            if (!user.activity) {
                user.activity = {
                    registrationDate: new Date().toISOString(),
                    lastActivity: new Date().toISOString(),
                    totalTasksCreated: user.tasks.length,
                    totalTasksCompleted: user.tasks.filter(t => t.completed).length,
                    streakDays: 0,
                    lastStreakDate: null,
                    activityLog: []
                };
            }
        }
    }

    /**
     * Save data to file (with queue to prevent concurrent writes)
     */
    async saveData() {
        return new Promise((resolve, reject) => {
            this.saveQueue.push({ resolve, reject });
            this.processSaveQueue();
        });
    }

    async processSaveQueue() {
        if (this.isSaving || this.saveQueue.length === 0) {
            return;
        }

        this.isSaving = true;
        const currentQueue = [...this.saveQueue];
        this.saveQueue = [];

        try {
            // Update global settings
            this.data.globalSettings.lastUpdated = new Date().toISOString();
            
            const dataToSave = JSON.stringify(this.data, null, 2);
            await fs.writeFile(this.dataFile, dataToSave, 'utf8');
            
            // Resolve all pending save promises
            currentQueue.forEach(({ resolve }) => resolve());
            
            logger.debug('Data saved successfully');
        } catch (error) {
            logger.error('Failed to save data', error);
            
            // Reject all pending save promises
            currentQueue.forEach(({ reject }) => reject(error));
        } finally {
            this.isSaving = false;
            
            // Process any new items added during save
            if (this.saveQueue.length > 0) {
                setTimeout(() => this.processSaveQueue(), 100);
            }
        }
    }

    /**
     * Start auto-save every 30 seconds
     */
    startAutoSave() {
        setInterval(async () => {
            try {
                await this.saveData();
            } catch (error) {
                logger.error('Auto-save failed', error);
            }
        }, 30000);
    }

    /**
     * Get user data
     */
    getUser(userId) {
        const id = userId.toString();
        if (!this.data.userData[id]) {
            this.initUser(id);
        }
        return this.data.userData[id];
    }

    /**
     * Get all users
     */
    getAllUsers() {
        return this.data.userData || {};
    }

    /**
     * Initialize new user
     */
    initUser(userId, userInfo = {}) {
        const id = userId.toString();
        
        if (!this.data.userData[id]) {
            this.data.userData[id] = {
                tasks: [],
                nextTaskId: 1,
                teams: [],
                sharedTasks: [],
                profile: {
                    username: userInfo.username || '',
                    firstName: userInfo.first_name || '',
                    lastName: userInfo.last_name || '',
                    email: '',
                    phone: '',
                    bio: '',
                    avatar: '',
                    timezone: config.defaults.timezone,
                    language: config.defaults.language,
                    dateFormat: 'DD.MM.YYYY',
                    timeFormat: '24h'
                },
                preferences: {
                    prayerRegion: config.defaults.prayer_region,
                    notifications: {
                        tasks: true,
                        prayer: true,
                        updates: true,
                        teams: true,
                        reminders: true
                    },
                    privacy: {
                        showProfile: true,
                        allowTeamInvites: true,
                        shareTaskStats: false
                    }
                },
                activity: {
                    registrationDate: new Date().toISOString(),
                    lastActivity: new Date().toISOString(),
                    totalTasksCreated: 0,
                    totalTasksCompleted: 0,
                    streakDays: 0,
                    lastStreakDate: null,
                    activityLog: []
                }
            };
            
            logger.info(`Initialized new user: ${id}`);
        }
        
        // Update last activity
        this.data.userData[id].activity.lastActivity = new Date().toISOString();
        
        return this.data.userData[id];
    }

    /**
     * Get team data
     */
    getTeam(teamId) {
        return this.data.teamData[teamId] || null;
    }

    /**
     * Create team
     */
    createTeam(teamId, teamData) {
        this.data.teamData[teamId] = {
            id: teamId,
            name: teamData.name,
            members: teamData.members || [],
            sharedTasks: [],
            nextTaskId: 1,
            createdAt: new Date().toISOString(),
            admin: teamData.admin,
            ...teamData
        };
        
        return this.data.teamData[teamId];
    }

    /**
     * Get database stats
     */
    getStats() {
        const userCount = Object.keys(this.data.userData).length;
        const teamCount = Object.keys(this.data.teamData).length;
        let totalTasks = 0;
        let completedTasks = 0;
        
        for (const user of Object.values(this.data.userData)) {
            totalTasks += user.tasks?.length || 0;
            completedTasks += user.tasks?.filter(t => t.completed)?.length || 0;
        }

        return {
            users: userCount,
            teams: teamCount,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            data_file_size: 0, // Will be set by file stats
            last_updated: this.data.globalSettings.lastUpdated
        };
    }
}

// Global database instance
export const db = new DatabaseService();
