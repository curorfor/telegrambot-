"""Prayer times service using IslamAPI.uz"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class PrayerService:
    """Service for fetching prayer times"""

    def __init__(self):
        self.api_url = "https://islomapi.uz/api/present/day"
        self.client = httpx.AsyncClient(timeout=10.0)

        # Supported regions in Uzbekistan (matching API regions)
        self.regions = [
            "Toshkent", "Samarqand", "Buxoro", "Andijon", "Namangan",
            "Farg'ona", "Qashqadaryo", "Surxondaryo", "Jizzax", "Sirdaryo",
            "Xorazm", "Navoiy", "Qoraqalpog'iston"
        ]

    async def get_prayer_times(self, region: str = "Toshkent") -> Optional[Dict[str, str]]:
        """Get prayer times for a specific region"""
        try:
            # Make API request to islomapi.uz
            params = {"region": region}

            response = await self.client.get(self.api_url, params=params)
            response.raise_for_status()

            data = response.json()

            if "times" in data:
                times = data["times"]

                # Map to standard prayer names
                prayer_times = {
                    "Fajr": times["tong_saharlik"],
                    "Dhuhr": times["peshin"],
                    "Asr": times["asr"],
                    "Maghrib": times["shom_iftor"],
                    "Isha": times["hufton"]
                }

                logger.debug(f"Fetched prayer times for {region}: {prayer_times}")
                return prayer_times

            else:
                logger.error(f"API error: No times data in response: {data}")
                return None

        except Exception as e:
            logger.error(f"Failed to get prayer times for {region}: {e}")
            return None

    def format_for_display(self, prayer_times: Dict[str, str], region: str) -> str:
        """Format prayer times for display"""
        if not prayer_times:
            return "❌ Namaz vaqtlarini olishda xatolik yuz berdi."

        # Get current time
        now = datetime.now()
        today = now.strftime("%d.%m.%Y")
        current_time = now.strftime("%H:%M")

        # Prayer names in Uzbek
        prayer_names = {
            "Fajr": "🌅 Bomdod",
            "Dhuhr": "🌞 Peshin",
            "Asr": "🌇 Asr",
            "Maghrib": "🌆 Shom",
            "Isha": "🌃 Xufton"
        }

        message = f"🕌 **NAMAZ VAQTLARI**\n\n"
        message += f"📍 **Hudud:** {region}\n"
        message += f"📅 **Sana:** {today}\n"
        message += f"🕐 **Hozir:** {current_time}\n\n"

        # Find next prayer
        next_prayer = self._find_next_prayer(prayer_times, current_time)

        for prayer, time in prayer_times.items():
            prayer_name = prayer_names.get(prayer, prayer)

            # Highlight next prayer
            if prayer == next_prayer:
                message += f"▶️ **{prayer_name}**: `{time}`\n"
            else:
                message += f"   {prayer_name}: {time}\n"

        if next_prayer:
            next_time = prayer_times[next_prayer]
            time_until = self._calculate_time_until(current_time, next_time)
            next_name = prayer_names.get(next_prayer, next_prayer)

            message += f"\n⏰ **Keyingi namaz:** {next_name}\n"
            message += f"⏳ **Qolgan vaqt:** {time_until}\n"

        message += f"\n🤲 **Allah panohida bo'ling!**"

        return message

    def _find_next_prayer(self, prayer_times: Dict[str, str], current_time: str) -> Optional[str]:
        """Find the next upcoming prayer"""
        try:
            current_minutes = self._time_to_minutes(current_time)

            for prayer, time in prayer_times.items():
                prayer_minutes = self._time_to_minutes(time)

                if prayer_minutes > current_minutes:
                    return prayer

            # If no prayer today, next is Fajr tomorrow
            return "Fajr"

        except Exception:
            return None

    def _calculate_time_until(self, current_time: str, prayer_time: str) -> str:
        """Calculate time remaining until prayer"""
        try:
            current_minutes = self._time_to_minutes(current_time)
            prayer_minutes = self._time_to_minutes(prayer_time)

            if prayer_minutes <= current_minutes:
                # Next day
                prayer_minutes += 24 * 60

            diff_minutes = prayer_minutes - current_minutes

            hours = diff_minutes // 60
            minutes = diff_minutes % 60

            if hours > 0:
                return f"{hours} soat {minutes} daqiqa"
            else:
                return f"{minutes} daqiqa"

        except Exception:
            return "Noma'lum"

    def _time_to_minutes(self, time_str: str) -> int:
        """Convert time string to minutes since midnight"""
        try:
            hours, minutes = map(int, time_str.split(':'))
            return hours * 60 + minutes
        except:
            return 0

    def get_regions(self) -> List[str]:
        """Get list of supported regions"""
        return self.regions.copy()

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()