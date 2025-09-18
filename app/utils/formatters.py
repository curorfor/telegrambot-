"""Message formatting utilities"""

from typing import Dict, Any
from datetime import datetime


class ModernUI:
    """Modern UI formatting utilities"""

    @staticmethod
    def create_header(title: str, subtitle: str = "") -> str:
        """Create formatted header"""
        header = f"{'=' * 30}\n{title}\n"
        if subtitle:
            header += f"{subtitle}\n"
        header += "=" * 30
        return header

    @staticmethod
    def create_section(title: str, content: str) -> str:
        """Create formatted section"""
        return f"\n📋 **{title}**\n{'-' * 20}\n{content}\n"

    @staticmethod
    def create_progress_bar(completed: int, total: int, length: int = 10) -> str:
        """Create ASCII progress bar"""
        if total == 0:
            return "▱" * length + " 0%"

        percentage = (completed / total) * 100
        filled = int((completed / total) * length)
        bar = "▰" * filled + "▱" * (length - filled)

        return f"{bar} {percentage:.1f}%"

    @staticmethod
    def create_team_info(team: Any, stats: Dict, user_role: str = "member") -> str:
        """Create team information display"""
        role_emoji = "👑" if user_role == "admin" else "👤"

        text = f"👥 {role_emoji} **{team.name}**\n"
        text += f"*Team ID: {team.id}*\n\n"

        text += "📊 **STATISTIKA:**\n"
        text += f"🆔 Kod: `{team.id}`\n"
        text += f"👥 A'zolar: {stats.get('total_members', 0)} kishi\n"
        text += f"📝 Vazifalar: {stats.get('total_tasks', 0)} ta\n"
        text += f"✅ Bajarilgan: {stats.get('completed_tasks', 0)} ta\n"
        text += f"⏳ Faol: {stats.get('active_tasks', 0)} ta\n"
        text += f"⚠️ Muddati o'tgan: {stats.get('overdue_tasks', 0)} ta\n"
        text += f"📈 Bajarish darajasi: {stats.get('completion_rate', 0)}%\n"

        if hasattr(team, 'created_at'):
            text += f"📅 Yaratilgan: {team.created_at.strftime('%d.%m.%Y')}\n"

        return text

    @staticmethod
    def format_task_list(tasks: list, max_tasks: int = 5) -> str:
        """Format task list for display"""
        if not tasks:
            return "📝 Hozircha vazifalar yo'q"

        text = ""
        displayed = 0

        for task in tasks:
            if displayed >= max_tasks:
                break

            if task.completed:
                continue

            # Priority emoji
            priority_emoji = {
                "high": "🔴",
                "medium": "🟡",
                "low": "🟢"
            }.get(task.priority, "⚪")

            # Due date
            if hasattr(task, 'due_date') and task.due_date:
                due_date = task.due_date.strftime("%d.%m %H:%M")
            else:
                due_date = "Muddatsiz"

            text += f"{priority_emoji} **{task.name}**\n"
            text += f"   📅 {due_date}"

            if hasattr(task, 'category') and task.category:
                text += f" | 📁 {task.category}"

            text += "\n\n"
            displayed += 1

        if len([t for t in tasks if not t.completed]) > max_tasks:
            remaining = len([t for t in tasks if not t.completed]) - max_tasks
            text += f"... va yana {remaining} ta vazifa\n"

        return text.strip()

    @staticmethod
    def format_user_stats(user: Any, tasks: list) -> str:
        """Format user statistics"""
        total = len(tasks)
        completed = len([t for t in tasks if t.completed])
        active = total - completed
        overdue = len([t for t in tasks if not t.completed and
                      hasattr(t, 'due_date') and t.due_date and
                      t.due_date < datetime.utcnow()])

        progress_bar = ModernUI.create_progress_bar(completed, total)

        text = f"👤 **{getattr(user, 'first_name', 'User')}**\n"
        text += "*Shaxsiy profil*\n\n"

        text += "📊 **STATISTIKA:**\n"
        text += f"📝 Jami: {total} ta vazifa\n"
        text += f"✅ Bajarilgan: {completed} ta\n"
        text += f"⏳ Faol: {active} ta\n"
        text += f"⚠️ Muddati o'tgan: {overdue} ta\n"
        text += f"📈 Bajarish darajasi: {progress_bar}\n"

        if hasattr(user, 'registration_date'):
            text += f"📅 Ro'yxatdan o'tgan: {user.registration_date.strftime('%d.%m.%Y')}\n"

        return text

    @staticmethod
    def format_date(date: datetime) -> str:
        """Format date in Uzbek locale"""
        if not date:
            return "Noma'lum"

        return date.strftime("%d.%m.%Y %H:%M")

    @staticmethod
    def format_time_remaining(target_time: datetime) -> str:
        """Format time remaining until target"""
        if not target_time:
            return "Noma'lum"

        now = datetime.utcnow()
        diff = target_time - now

        if diff.total_seconds() <= 0:
            return "Vaqt tugagan"

        total_minutes = int(diff.total_seconds() / 60)

        if total_minutes < 60:
            return f"{total_minutes} daqiqa"

        hours = total_minutes // 60
        minutes = total_minutes % 60

        if hours < 24:
            return f"{hours} soat {minutes} daqiqa" if minutes > 0 else f"{hours} soat"

        days = hours // 24
        remaining_hours = hours % 24

        return f"{days} kun {remaining_hours} soat" if remaining_hours > 0 else f"{days} kun"

    @staticmethod
    def truncate_text(text: str, max_length: int = 50) -> str:
        """Truncate text with ellipsis"""
        if len(text) <= max_length:
            return text
        return text[:max_length - 3] + "..."

    @staticmethod
    def emoji_for_priority(priority: str) -> str:
        """Get emoji for task priority"""
        return {
            "high": "🔴",
            "medium": "🟡",
            "low": "🟢"
        }.get(priority, "⚪")

    @staticmethod
    def emoji_for_category(category: str) -> str:
        """Get emoji for task category"""
        return {
            "work": "💼",
            "personal": "👤",
            "study": "📚",
            "health": "🏥",
            "shopping": "🛒",
            "family": "👨‍👩‍👧‍👦",
            "finance": "💰",
            "travel": "✈️",
            "hobby": "🎨"
        }.get(category, "📝")

    @staticmethod
    def format_prayer_times(prayer_times: Dict[str, str], region: str) -> str:
        """Format prayer times for display"""
        if not prayer_times:
            return "❌ Namaz vaqtlarini olishda xatolik yuz berdi."

        now = datetime.now()
        today = now.strftime("%d.%m.%Y")
        current_time = now.strftime("%H:%M")

        prayer_names = {
            "Fajr": "🌅 Bomdod",
            "Dhuhr": "🌞 Peshin",
            "Asr": "🌇 Asr",
            "Maghrib": "🌆 Shom",
            "Isha": "🌃 Xufton"
        }

        text = f"🕌 **NAMAZ VAQTLARI**\n\n"
        text += f"📍 **Hudud:** {region}\n"
        text += f"📅 **Sana:** {today}\n"
        text += f"🕐 **Hozir:** {current_time}\n\n"

        for prayer, time in prayer_times.items():
            prayer_name = prayer_names.get(prayer, prayer)
            text += f"   {prayer_name}: {time}\n"

        text += f"\n🤲 **Allah panohida bo'ling!**"

        return text