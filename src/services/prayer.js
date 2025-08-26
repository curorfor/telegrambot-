import { logger } from '../utils/logger.js';

/**
 * Prayer Times Service
 */
export class PrayerService {
    constructor() {
        this.regions = [
            'Toshkent', 'Samarqand', 'Buxoro', 'Andijon', 'Namangan', 
            'Farg\'ona', 'Qashqadaryo', 'Surxondaryo', 'Jizzax', 
            'Sirdaryo', 'Navoiy', 'Xorazm', 'Qoraqalpog\'iston'
        ];
        
        this.cache = new Map();
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Get prayer times for a region
     */
    async getPrayerTimes(region) {
        try {
            // Check cache first
            const cacheKey = `${region}_${new Date().toDateString()}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                logger.debug(`Prayer times from cache for ${region}`);
                return cached.data;
            }

            // Try primary API
            let prayerTimes = await this.fetchFromPrimaryAPI(region);
            
            if (!prayerTimes) {
                // Fallback to secondary API
                prayerTimes = await this.fetchFromSecondaryAPI(region);
            }
            
            if (!prayerTimes) {
                // Use default times if all APIs fail
                prayerTimes = this.getDefaultTimes();
                logger.warn(`Using default prayer times for ${region}`);
            }

            // Cache the result
            this.cache.set(cacheKey, {
                data: prayerTimes,
                timestamp: Date.now()
            });

            logger.info(`Prayer times fetched for ${region}`);
            return prayerTimes;

        } catch (error) {
            logger.error('Failed to get prayer times', error);
            return this.getDefaultTimes();
        }
    }

    /**
     * Fetch from primary API (example: aladhan.com)
     */
    async fetchFromPrimaryAPI(region) {
        try {
            // This is a placeholder - you can integrate with real API
            const coordinates = this.getCoordinates(region);
            
            // Example API call structure
            const response = await fetch(
                `http://api.aladhan.com/v1/timings?latitude=${coordinates.lat}&longitude=${coordinates.lng}&method=2`
            );
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            return this.formatPrayerTimes(data.data.timings);
            
        } catch (error) {
            logger.warn('Primary prayer API failed', error);
            return null;
        }
    }

    /**
     * Fetch from secondary API
     */
    async fetchFromSecondaryAPI(region) {
        try {
            // Fallback API or alternative source
            logger.info('Using fallback prayer API');
            return this.getRegionalTimes(region);
            
        } catch (error) {
            logger.warn('Secondary prayer API failed', error);
            return null;
        }
    }

    /**
     * Get coordinates for region
     */
    getCoordinates(region) {
        const coordinates = {
            'Toshkent': { lat: 41.2995, lng: 69.2401 },
            'Samarqand': { lat: 39.6270, lng: 66.9750 },
            'Buxoro': { lat: 39.7747, lng: 64.4286 },
            'Andijon': { lat: 40.7821, lng: 72.3442 },
            'Namangan': { lat: 40.9983, lng: 71.6726 },
            'Farg\'ona': { lat: 40.3842, lng: 71.7843 },
            'Qashqadaryo': { lat: 38.8604, lng: 65.7887 },
            'Surxondaryo': { lat: 37.9414, lng: 67.5595 },
            'Jizzax': { lat: 40.1158, lng: 67.8420 },
            'Sirdaryo': { lat: 40.3811, lng: 68.7179 },
            'Navoiy': { lat: 40.0844, lng: 65.3792 },
            'Xorazm': { lat: 41.5266, lng: 60.3641 },
            'Qoraqalpog\'iston': { lat: 42.4631, lng: 59.6103 }
        };
        
        return coordinates[region] || coordinates['Toshkent'];
    }

    /**
     * Get regional prayer times (fallback)
     */
    getRegionalTimes(region) {
        // Approximate times for Uzbekistan regions
        const baseTimes = {
            fajr: '05:30',
            sunrise: '07:00',
            dhuhr: '12:30',
            asr: '15:45',
            maghrib: '18:15',
            isha: '19:45'
        };

        // Adjust slightly based on region (simplified)
        if (region.includes('Qoraqalpog\'iston') || region.includes('Xorazm')) {
            // Western regions - slightly later
            return this.adjustTimes(baseTimes, 15);
        } else if (region.includes('Farg\'ona') || region.includes('Andijon')) {
            // Eastern regions - slightly earlier  
            return this.adjustTimes(baseTimes, -15);
        }

        return baseTimes;
    }

    /**
     * Adjust prayer times by minutes
     */
    adjustTimes(times, minutes) {
        const adjusted = {};
        
        for (const [prayer, time] of Object.entries(times)) {
            const [hours, mins] = time.split(':').map(Number);
            const totalMinutes = hours * 60 + mins + minutes;
            const adjustedHours = Math.floor(totalMinutes / 60) % 24;
            const adjustedMins = totalMinutes % 60;
            
            adjusted[prayer] = `${adjustedHours.toString().padStart(2, '0')}:${adjustedMins.toString().padStart(2, '0')}`;
        }
        
        return adjusted;
    }

    /**
     * Format prayer times from API response
     */
    formatPrayerTimes(timings) {
        return {
            fajr: timings.Fajr || '05:30',
            sunrise: timings.Sunrise || '07:00', 
            dhuhr: timings.Dhuhr || '12:30',
            asr: timings.Asr || '15:45',
            maghrib: timings.Maghrib || '18:15',
            isha: timings.Isha || '19:45'
        };
    }

    /**
     * Get default prayer times if all else fails
     */
    getDefaultTimes() {
        return {
            fajr: '05:30',
            sunrise: '07:00',
            dhuhr: '12:30', 
            asr: '15:45',
            maghrib: '18:15',
            isha: '19:45'
        };
    }

    /**
     * Format prayer times for display
     */
    formatForDisplay(prayerTimes, region) {
        const today = new Date().toLocaleDateString('uz-UZ', {
            weekday: 'long',
            year: 'numeric', 
            month: 'long',
            day: 'numeric'
        });

        return `🕌 **${region} - Namoz vaqtlari**\n\n📅 **${today}**\n\n` +
               `🌅 **Bomdod:** ${prayerTimes.fajr}\n` +
               `☀️ **Quyosh:** ${prayerTimes.sunrise}\n` +
               `🌞 **Peshin:** ${prayerTimes.dhuhr}\n` +
               `🌇 **Asr:** ${prayerTimes.asr}\n` +
               `🌆 **Shom:** ${prayerTimes.maghrib}\n` +
               `🌃 **Xufton:** ${prayerTimes.isha}\n\n` +
               `📱 *Bildirishnomalar uchun* /setprayerregion *ni bosing*`;
    }

    /**
     * Get all supported regions
     */
    getRegions() {
        return this.regions;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        logger.info('Prayer times cache cleared');
    }
}

// Global prayer service instance
export const prayerService = new PrayerService();
