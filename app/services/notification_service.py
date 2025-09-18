"""Notification service for task and prayer reminders"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, and_

from app.database import async_session_factory, User, Task, PrayerNotification
from app.services.prayer_service import PrayerService
from app.utils.formatters import ModernUI

logger = logging.getLogger(__name__)


class NotificationService:
    """Handle task and prayer notifications"""

    def __init__(self, bot=None):
        self.scheduler = AsyncIOScheduler()
        self.prayer_service = PrayerService()
        self.bot = bot
        self.is_running = False

        # Notification intervals for tasks (in minutes)
        self.task_intervals = [
            {"id": "1day", "name": "1 kun oldin", "minutes": 24 * 60},
            {"id": "1hour", "name": "1 soat oldin", "minutes": 60},
            {"id": "15min", "name": "15 daqiqa oldin", "minutes": 15},
            {"id": "due", "name": "Vaqti keldi", "minutes": 0}
        ]

        # Prayer notification intervals (in minutes)
        self.prayer_intervals = [
            {"id": "15min", "name": "15 daqiqa oldin", "minutes": 15},
            {"id": "5min", "name": "5 daqiqa oldin", "minutes": 5}
        ]

    async def start(self):
        """Start the notification service"""
        if self.is_running:
            logger.warning("Notification service is already running")
            return

        logger.info("🔔 Starting notification service...")

        # Schedule notification checks every minute
        self.scheduler.add_job(
            self.check_notifications,
            CronTrigger(second=0),  # Run every minute at 0 seconds
            id="notification_check",
            max_instances=1
        )

        self.scheduler.start()
        self.is_running = True
        logger.info("✅ Notification service started")

    async def stop(self):
        """Stop the notification service"""
        if not self.is_running:
            return

        logger.info("🔕 Stopping notification service...")
        self.scheduler.shutdown()
        self.is_running = False
        logger.info("✅ Notification service stopped")

    async def check_notifications(self):
        """Main notification check function"""
        now = datetime.utcnow()
        logger.debug(f"⏰ Checking notifications at: {now}")

        total_notifications = 0

        try:
            async with async_session_factory() as session:
                # Get all active users
                users_result = await session.execute(
                    select(User).where(User.blocked_bot == False)
                )
                users = users_result.scalars().all()

                for user in users:
                    # Check task notifications
                    task_notifications = await self._check_task_notifications(user, now)
                    total_notifications += task_notifications

                    # Check prayer notifications
                    prayer_notifications = await self._check_prayer_notifications(user, now)
                    total_notifications += prayer_notifications

            if total_notifications > 0:
                logger.info(f"📬 Sent {total_notifications} notifications")

        except Exception as e:
            logger.error(f"Error in notification check: {e}")

    async def _check_task_notifications(self, user: User, now: datetime) -> int:
        """Check and send task notifications for a user"""
        if not user.notifications_enabled:
            return 0

        notifications_sent = 0

        async with async_session_factory() as session:
            # Get user's active tasks
            tasks_result = await session.execute(
                select(Task).where(
                    and_(
                        Task.user_id == user.id,
                        Task.completed == False
                    )
                )
            )
            tasks = tasks_result.scalars().all()

            for task in tasks:
                if not task.due_date:
                    continue

                time_diff = task.due_date - now
                minutes_until_due = int(time_diff.total_seconds() / 60)

                # Check each notification interval
                for interval in self.task_intervals:
                    if await self._should_send_task_notification(task, interval, minutes_until_due):
                        try:
                            message = self._get_task_notification_message(task, interval, minutes_until_due)

                            # Use bot instance from service
                            bot = self.bot

                            await bot.send_message(
                                chat_id=user.id,
                                text=message,
                                parse_mode="Markdown",
                                reply_markup=self._get_task_notification_keyboard(task)
                            )

                            # Mark notification as sent
                            await self._mark_task_notification_sent(task, interval)
                            notifications_sent += 1

                            logger.info(f"📤 Task notification sent to user {user.id}: \"{task.name}\" ({interval['name']})")

                        except Exception as e:
                            if await self._is_user_blocked_error(e):
                                await self._mark_user_as_blocked(user.id)
                            else:
                                logger.error(f"Failed to send task notification to user {user.id}: {e}")

        return notifications_sent

    async def _check_prayer_notifications(self, user: User, now: datetime) -> int:
        """Check and send prayer notifications for a user"""
        if not user.prayer_notifications_enabled or not user.prayer_region:
            return 0

        notifications_sent = 0
        today = now.date().isoformat()

        try:
            # Get prayer times for user's region
            prayer_times = await self.prayer_service.get_prayer_times(user.prayer_region)
            if not prayer_times:
                return 0

            prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]

            for prayer in prayers:
                prayer_time_str = prayer_times.get(prayer)
                if not prayer_time_str:
                    continue

                prayer_time = self._parse_prayer_time(prayer_time_str, now)
                time_diff = prayer_time - now
                minutes_until_prayer = int(time_diff.total_seconds() / 60)

                # Check each prayer notification interval
                for interval in self.prayer_intervals:
                    if await self._should_send_prayer_notification(
                        user, prayer, interval, minutes_until_prayer, today
                    ):
                        try:
                            message = self._get_prayer_notification_message(
                                prayer, prayer_time_str, interval, user.prayer_region
                            )

                            # Use bot instance from service
                            bot = self.bot

                            await bot.send_message(
                                chat_id=user.id,
                                text=message,
                                parse_mode="Markdown",
                                reply_markup=self._get_prayer_notification_keyboard()
                            )

                            # Record notification
                            await self._record_prayer_notification(user.id, today, prayer, interval["id"])
                            notifications_sent += 1

                            logger.info(f"🕌 Prayer notification sent to user {user.id}: {prayer} in {interval['minutes']} minutes")

                        except Exception as e:
                            if await self._is_user_blocked_error(e):
                                await self._mark_user_as_blocked(user.id)
                            else:
                                logger.error(f"Failed to send prayer notification to user {user.id}: {e}")

        except Exception as e:
            logger.error(f"Error checking prayer notifications for user {user.id}: {e}")

        return notifications_sent

    async def _should_send_task_notification(self, task: Task, interval: Dict, minutes_until_due: int) -> bool:
        """Check if task notification should be sent"""
        target_minutes = interval["minutes"]

        # Check if it's time for this notification (5-minute window)
        is_time_for_notification = (
            minutes_until_due <= target_minutes and
            minutes_until_due > (target_minutes - 5)
        )

        if not is_time_for_notification:
            return False

        # Check if notification already sent
        notification_field = f"notification_{interval['id']}_sent"
        return not getattr(task, notification_field, False)

    async def _should_send_prayer_notification(
        self, user: User, prayer: str, interval: Dict, minutes_until_prayer: int, today: str
    ) -> bool:
        """Check if prayer notification should be sent"""
        target_minutes = interval["minutes"]

        # Check if it's time for this notification (2-minute window for prayers)
        is_time_for_notification = (
            minutes_until_prayer <= target_minutes and
            minutes_until_prayer > (target_minutes - 2)
        )

        if not is_time_for_notification:
            return False

        # Check if notification already sent today
        async with async_session_factory() as session:
            existing_result = await session.execute(
                select(PrayerNotification).where(
                    and_(
                        PrayerNotification.user_id == user.id,
                        PrayerNotification.date == today,
                        PrayerNotification.prayer_name == prayer,
                        PrayerNotification.notification_type == interval["id"]
                    )
                )
            )
            existing = existing_result.scalar_one_or_none()
            return existing is None

    def _get_task_notification_message(self, task: Task, interval: Dict, minutes_until_due: int) -> str:
        """Generate task notification message"""
        time_remaining = self._format_time_remaining(max(0, minutes_until_due))
        priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(task.priority, "⚪")

        if interval["id"] == "due":
            return (
                f"⏰ **VAZIFA VAQTI KELDI!**\n\n"
                f"{priority_emoji} **{task.name}**\n\n"
                f"📅 **Sana:** {self._format_date(task.due_date)}\n"
                f"📁 **Kategoriya:** {task.category or 'Umumiy'}\n\n"
                f"🎯 Hozir bajarish vaqti!"
            )
        else:
            return (
                f"⏰ **VAZIFA ESLATMASI**\n\n"
                f"{priority_emoji} **{task.name}**\n\n"
                f"📅 **Sana:** {self._format_date(task.due_date)}\n"
                f"⏳ **Qolgan vaqt:** {time_remaining}\n"
                f"📁 **Kategoriya:** {task.category or 'Umumiy'}\n\n"
                f"💡 Tayyorgarlik ko'ring!"
            )

    def _get_prayer_notification_message(self, prayer: str, prayer_time: str, interval: Dict, region: str) -> str:
        """Generate prayer notification message"""
        prayer_names = {
            "Fajr": "🌅 Bomdod",
            "Dhuhr": "🌞 Peshin",
            "Asr": "🌇 Asr",
            "Maghrib": "🌆 Shom",
            "Isha": "🌃 Xufton"
        }

        prayer_name = prayer_names.get(prayer, prayer)

        return (
            f"🕌 **NAMAZ VAQTI ESLATMASI**\n\n"
            f"{prayer_name} namazi {interval['minutes']} daqiqadan keyin\n\n"
            f"⏰ **Vaqt:** {prayer_time}\n"
            f"📍 **Hudud:** {region}\n\n"
            f"🤲 Tahorat oling va tayyorgarlik ko'ring!"
        )

    def _get_task_notification_keyboard(self, task: Task):
        """Get keyboard for task notifications"""
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Bajarildi", callback_data=f"complete_task_{task.id}"),
                InlineKeyboardButton(text="📋 Vazifalar", callback_data="back_to_main_tasks")
            ]
        ])

    def _get_prayer_notification_keyboard(self):
        """Get keyboard for prayer notifications"""
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="🕌 Namaz vaqtlari", callback_data="show_prayer_times"),
                InlineKeyboardButton(text="🔕 O'chirish", callback_data="disable_prayer_notifications")
            ]
        ])

    async def _mark_task_notification_sent(self, task: Task, interval: Dict):
        """Mark task notification as sent"""
        async with async_session_factory() as session:
            # Update the task notification field
            notification_field = f"notification_{interval['id']}_sent"
            setattr(task, notification_field, True)

            session.add(task)
            await session.commit()

    async def _record_prayer_notification(self, user_id: str, date: str, prayer: str, notification_type: str):
        """Record prayer notification in database"""
        async with async_session_factory() as session:
            notification = PrayerNotification(
                user_id=user_id,
                date=date,
                prayer_name=prayer,
                notification_type=notification_type
            )
            session.add(notification)
            await session.commit()

    async def _mark_user_as_blocked(self, user_id: str):
        """Mark user as blocked"""
        async with async_session_factory() as session:
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()

            if user:
                user.blocked_bot = True
                user.blocked_at = datetime.utcnow()
                user.notifications_enabled = False
                user.prayer_notifications_enabled = False

                await session.commit()
                logger.info(f"User {user_id} marked as blocked")

    async def _is_user_blocked_error(self, error) -> bool:
        """Check if error indicates user has blocked the bot"""
        error_message = str(error).lower()
        blocked_indicators = [
            "bot was blocked by the user",
            "user is deactivated",
            "chat not found",
            "bot is not a member"
        ]
        return any(indicator in error_message for indicator in blocked_indicators)

    def _parse_prayer_time(self, time_str: str, base_date: datetime) -> datetime:
        """Parse prayer time string to datetime object"""
        try:
            hours, minutes = map(int, time_str.split(':'))
            return base_date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
        except:
            return base_date

    def _format_time_remaining(self, minutes: int) -> str:
        """Format time remaining in a readable format"""
        if minutes <= 0:
            return "Vaqt tugadi"
        if minutes < 60:
            return f"{minutes} daqiqa"

        hours = minutes // 60
        remaining_minutes = minutes % 60

        if hours < 24:
            return f"{hours} soat {remaining_minutes} daqiqa" if remaining_minutes > 0 else f"{hours} soat"

        days = hours // 24
        remaining_hours = hours % 24
        return f"{days} kun {remaining_hours} soat" if remaining_hours > 0 else f"{days} kun"

    def _format_date(self, date: datetime) -> str:
        """Format date for display"""
        return date.strftime("%d.%m.%Y %H:%M")

    async def get_notification_stats(self) -> Optional[Dict]:
        """Get notification statistics"""
        try:
            async with async_session_factory() as session:
                # Count users
                total_users_result = await session.execute(select(User))
                total_users = len(total_users_result.scalars().all())

                blocked_users_result = await session.execute(
                    select(User).where(User.blocked_bot == True)
                )
                blocked_users = len(blocked_users_result.scalars().all())

                task_enabled_result = await session.execute(
                    select(User).where(User.notifications_enabled == True)
                )
                tasks_enabled = len(task_enabled_result.scalars().all())

                prayer_enabled_result = await session.execute(
                    select(User).where(User.prayer_notifications_enabled == True)
                )
                prayer_enabled = len(prayer_enabled_result.scalars().all())

                return {
                    "totalUsers": total_users,
                    "blockedUsers": blocked_users,
                    "activeUsers": total_users - blocked_users,
                    "tasksEnabled": tasks_enabled,
                    "prayerEnabled": prayer_enabled,
                    "systemRunning": self.is_running
                }

        except Exception as e:
            logger.error(f"Failed to get notification stats: {e}")
            return None