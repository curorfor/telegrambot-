"""Keyboard builders for bot interface"""

from typing import List, Dict, Any
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from app.database import Task, Team


class KeyboardBuilder:
    """Builder for inline keyboards"""

    def __init__(self):
        pass

    def main_menu(self) -> InlineKeyboardMarkup:
        """Main menu keyboard"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="📋 📝 Vazifalarim", callback_data="back_to_main_tasks"),
                InlineKeyboardButton(text="👥 🤝 Jamoa", callback_data="show_team_features")
            ],
            [
                InlineKeyboardButton(text="👤 📊 Profil", callback_data="view_profile"),
                InlineKeyboardButton(text="❓ 📚 Yordam", callback_data="show_help")
            ],
            [
                InlineKeyboardButton(text="🕌 📿 Namaz vaqtlari", callback_data="show_prayer_times")
            ]
        ])

    def tasks_menu(self, tasks: List[Task]) -> InlineKeyboardMarkup:
        """Tasks menu with task actions"""
        keyboard = []

        # Add quick actions
        keyboard.append([
            InlineKeyboardButton(text="➕ Yangi vazifa", callback_data="add_task"),
            InlineKeyboardButton(text="📊 Statistika", callback_data="view_profile")
        ])

        # Add task completion buttons for first few tasks
        if tasks:
            for task in tasks[:3]:  # Show max 3 task buttons
                keyboard.append([
                    InlineKeyboardButton(
                        text=f"✅ {task.name[:25]}...",
                        callback_data=f"complete_task_{task.id}"
                    )
                ])

        # Add navigation
        keyboard.append([
            InlineKeyboardButton(text="🔄 Yangilash", callback_data="back_to_main_tasks"),
            InlineKeyboardButton(text="🏠 Bosh sahifa", callback_data="start_fresh")
        ])

        return InlineKeyboardMarkup(inline_keyboard=keyboard)

    def empty_tasks_menu(self) -> InlineKeyboardMarkup:
        """Menu when no tasks exist"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="➕ Birinchi vazifa", callback_data="add_task")
            ],
            [
                InlineKeyboardButton(text="👥 Jamoa yaratish", callback_data="create_team_quick"),
                InlineKeyboardButton(text="🕌 Namaz vaqtlari", callback_data="show_prayer_times")
            ],
            [
                InlineKeyboardButton(text="🏠 Bosh sahifa", callback_data="start_fresh")
            ]
        ])

    def profile_menu(self) -> InlineKeyboardMarkup:
        """Profile menu"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="⚙️ 🔧 Sozlamalar", callback_data="simple_settings"),
                InlineKeyboardButton(text="📊 📈 Batafsil statistika", callback_data="detailed_stats")
            ],
            [
                InlineKeyboardButton(text="🔔 📱 Bildirishnomalar", callback_data="notification_settings"),
                InlineKeyboardButton(text="⬅️ 🏠 Bosh sahifa", callback_data="start_fresh")
            ]
        ])

    def prayer_menu(self) -> InlineKeyboardMarkup:
        """Prayer times menu"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="🔄 Hududni o'zgartirish", callback_data="change_prayer_region"),
                InlineKeyboardButton(text="⚙️ Bildirishnoma sozlash", callback_data="notification_settings")
            ],
            [
                InlineKeyboardButton(text="⬅️ Orqaga", callback_data="start_fresh")
            ]
        ])

    def team_creation_menu(self) -> InlineKeyboardMarkup:
        """Team creation menu"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="➕ Jamoa yaratish", callback_data="create_team_quick"),
                InlineKeyboardButton(text="🔑 Jamoaga qo'shilish", callback_data="join_team_quick")
            ],
            [
                InlineKeyboardButton(text="⬅️ Orqaga", callback_data="start_fresh")
            ]
        ])

    def single_team_menu(self, team_id: str) -> InlineKeyboardMarkup:
        """Menu for single team view"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="📝 Vazifalar", callback_data=f"team_tasks_{team_id}"),
                InlineKeyboardButton(text="👥 A'zolar", callback_data=f"team_members_{team_id}")
            ],
            [
                InlineKeyboardButton(text="⚙️ Boshqarish", callback_data=f"team_admin_{team_id}"),
                InlineKeyboardButton(text="➕ Yangi jamoa", callback_data="create_team_quick")
            ],
            [
                InlineKeyboardButton(text="⬅️ Orqaga", callback_data="start_fresh")
            ]
        ])

    def multiple_teams_menu(self, teams: List[Team]) -> InlineKeyboardMarkup:
        """Menu for multiple teams selection"""
        keyboard = []

        # Add team buttons
        for i, team in enumerate(teams[:5]):  # Max 5 teams
            keyboard.append([
                InlineKeyboardButton(
                    text=f"{i+1}. {team.name}",
                    callback_data=f"show_team_{team.id}"
                )
            ])

        # Add actions
        keyboard.append([
            InlineKeyboardButton(text="➕ Yangi jamoa", callback_data="create_team_quick"),
            InlineKeyboardButton(text="🔑 Jamoaga qo'shilish", callback_data="join_team_quick")
        ])

        keyboard.append([
            InlineKeyboardButton(text="⬅️ Orqaga", callback_data="start_fresh")
        ])

        return InlineKeyboardMarkup(inline_keyboard=keyboard)

    def date_selection_menu(self) -> InlineKeyboardMarkup:
        """Date selection for task creation"""
        from datetime import datetime, timedelta

        today = datetime.now()
        tomorrow = today + timedelta(days=1)

        keyboard = [
            [
                InlineKeyboardButton(text="📅 Bugun", callback_data="select_date_today"),
                InlineKeyboardButton(text="📅 Ertaga", callback_data="select_date_tomorrow")
            ]
        ]

        # Add next few days
        for i in range(2, 6):
            date = today + timedelta(days=i)
            day_name = date.strftime("%A")  # Day name
            day_num = date.strftime("%d.%m")  # Day and month

            # Translate day names to Uzbek
            day_translations = {
                "Monday": "Dushanba",
                "Tuesday": "Seshanba",
                "Wednesday": "Chorshanba",
                "Thursday": "Payshanba",
                "Friday": "Juma",
                "Saturday": "Shanba",
                "Sunday": "Yakshanba"
            }

            uzbek_day = day_translations.get(day_name, day_name)

            keyboard.append([
                InlineKeyboardButton(
                    text=f"📅 {uzbek_day} ({day_num})",
                    callback_data=f"select_date_{date.strftime('%Y-%m-%d')}"
                )
            ])

        keyboard.append([
            InlineKeyboardButton(text="⬅️ Orqaga", callback_data="back_to_main_tasks")
        ])

        return InlineKeyboardMarkup(inline_keyboard=keyboard)

    def time_selection_menu(self, date: str) -> InlineKeyboardMarkup:
        """Time selection for task creation"""
        times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]

        keyboard = []

        # Add times in rows of 3
        for i in range(0, len(times), 3):
            row = []
            for j in range(3):
                if i + j < len(times):
                    time = times[i + j]
                    row.append(
                        InlineKeyboardButton(
                            text=f"🕐 {time}",
                            callback_data=f"select_time_{date}_{time}"
                        )
                    )
            keyboard.append(row)

        keyboard.append([
            InlineKeyboardButton(text="⬅️ Orqaga", callback_data="add_task")
        ])

        return InlineKeyboardMarkup(inline_keyboard=keyboard)

    def task_created_menu(self) -> InlineKeyboardMarkup:
        """Menu after task creation"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="📋 Barcha vazifalar", callback_data="back_to_main_tasks"),
                InlineKeyboardButton(text="➕ Yana vazifa qo'shish", callback_data="add_task")
            ],
            [
                InlineKeyboardButton(text="🏠 Bosh sahifa", callback_data="start_fresh")
            ]
        ])

    def team_created_menu(self, team_id: str) -> InlineKeyboardMarkup:
        """Menu after team creation"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="👥 Jamoa ma'lumoti", callback_data=f"show_team_{team_id}"),
                InlineKeyboardButton(text="📤 Kodni ulashish", callback_data=f"share_team_code_{team_id}")
            ],
            [
                InlineKeyboardButton(text="🔑 Yana jamoa yaratish", callback_data="create_team_quick"),
                InlineKeyboardButton(text="📋 Vazifalar", callback_data="back_to_main_tasks")
            ]
        ])

    def team_joined_menu(self, team_id: str) -> InlineKeyboardMarkup:
        """Menu after joining team"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="👥 Jamoa ma'lumoti", callback_data=f"show_team_{team_id}"),
                InlineKeyboardButton(text="📝 Vazifalar", callback_data=f"team_tasks_{team_id}")
            ],
            [
                InlineKeyboardButton(text="👥 A'zolar", callback_data=f"team_members_{team_id}"),
                InlineKeyboardButton(text="📋 Mening vazifalarim", callback_data="back_to_main_tasks")
            ]
        ])

    def back_to_main_menu(self) -> InlineKeyboardMarkup:
        """Simple back to main menu"""
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="🏠 Bosh sahifa", callback_data="start_fresh")
            ]
        ])

    def encode_callback(self, action: str, data: Dict[str, Any]) -> str:
        """Encode callback data"""
        import json
        callback_data = {"action": action, "data": data}
        return json.dumps(callback_data, separators=(',', ':'))[:64]  # Telegram limit

    def decode_callback(self, callback_data: str) -> Dict[str, Any]:
        """Decode callback data"""
        import json
        try:
            return json.loads(callback_data)
        except:
            return {"action": callback_data, "data": {}}