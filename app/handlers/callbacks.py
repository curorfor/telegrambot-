"""Callback query handlers for inline keyboards"""

import logging
from datetime import datetime, timedelta
from aiogram import Router, F
from aiogram.types import CallbackQuery, Message, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select, and_

from app.database import async_session_factory, User, Task, Team
from app.utils.keyboards import KeyboardBuilder
from app.utils.formatters import ModernUI
from app.services.team_service import TeamService

logger = logging.getLogger(__name__)

callbacks_router = Router()
keyboard_builder = KeyboardBuilder()
team_service = TeamService()


@callbacks_router.callback_query(F.data == "back_to_main_tasks")
async def callback_main_tasks(callback: CallbackQuery):
    """Show main tasks view"""
    user_id = str(callback.from_user.id)
    await show_tasks(callback.message, user_id)
    await callback.answer()


@callbacks_router.callback_query(F.data == "add_task")
async def callback_add_task(callback: CallbackQuery):
    """Start task creation process"""
    user_id = str(callback.from_user.id)
    logger.info(f"User {user_id} adding new task")

    text = (
        "📝 **Yangi vazifa qo'shish**\n\n"
        "Vazifa nomini kiriting:\n\n"
        "💡 *Masalan: \"Prezentatsiya tayyorlash\", \"Dukonga borish\"*"
    )

    await callback.message.edit_text(text, parse_mode="Markdown")
    await callback.answer()


@callbacks_router.callback_query(F.data == "view_profile")
async def callback_view_profile(callback: CallbackQuery):
    """Show user profile"""
    user_id = str(callback.from_user.id)

    async with async_session_factory() as session:
        # Get user
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            await callback.answer("❌ Foydalanuvchi topilmadi.")
            return

        # Get user tasks for statistics
        tasks_result = await session.execute(
            select(Task).where(Task.user_id == user_id)
        )
        tasks = tasks_result.scalars().all()

        total = len(tasks)
        completed = len([t for t in tasks if t.completed])
        active = total - completed

    progress_bar = ModernUI.create_progress_bar(completed, total)

    profile_text = ModernUI.create_header(
        f"👤 {user.first_name or 'User'}",
        "*Shaxsiy profil*"
    )
    profile_text += "\n" + ModernUI.create_section(
        "📊 STATISTIKA",
        f"📝 **Jami:** {total} ta vazifa\n"
        f"✅ **Bajarilgan:** {completed} ta\n"
        f"⏳ **Faol:** {active} ta\n"
        f"📈 **Bajarish darajasi:** {progress_bar}\n"
    )

    keyboard = keyboard_builder.profile_menu()

    await callback.message.edit_text(profile_text, reply_markup=keyboard, parse_mode="Markdown")
    await callback.answer()


@callbacks_router.callback_query(F.data == "show_help")
async def callback_show_help(callback: CallbackQuery):
    """Show help message"""
    help_text = ModernUI.create_header("❓ YORDAM VA QO'LLANMA")
    help_text += "\n" + ModernUI.create_section(
        "📝 ASOSIY BUYRUQLAR",
        "/start - Botni ishga tushirish\n"
        "/tasks - Barcha vazifalar\n"
        "/add - Yangi vazifa qo'shish\n"
        "/profile - Profil va statistika\n"
        "/help - Bu yordam xabari\n"
    )
    help_text += ModernUI.create_section(
        "🔧 FUNKSIYALAR",
        "🎯 ➕ **Vazifalar yaratish va boshqarish**\n"
        "⏰ 🔔 **Vaqt va eslatmalar**\n"
        "🏆 📁 **Prioritet va kategoriyalar**\n"
        "👥 🤝 **Jamoa bilan ishlash**\n"
        "🕌 📿 **Namaz vaqtlari va bildirishnomalar**\n"
        "📊 📈 **Tahlil va hisobotlar**\n"
    )

    await callback.message.edit_text(help_text, parse_mode="Markdown")
    await callback.answer()


@callbacks_router.callback_query(F.data == "show_prayer_times")
async def callback_show_prayer_times(callback: CallbackQuery):
    """Show prayer times"""
    user_id = str(callback.from_user.id)

    async with async_session_factory() as session:
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            await callback.answer("❌ Foydalanuvchi topilmadi.")
            return

    from app.services.prayer_service import PrayerService
    prayer_service = PrayerService()

    try:
        region = user.prayer_region or "Toshkent"
        prayer_times = await prayer_service.get_prayer_times(region)
        formatted_times = prayer_service.format_for_display(prayer_times, region)

        keyboard = keyboard_builder.prayer_menu()

        await callback.message.edit_text(formatted_times, reply_markup=keyboard, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Failed to get prayer times: {e}")
        await callback.answer("❌ Namaz vaqtlarini olishda xatolik yuz berdi.")

    await callback.answer()


@callbacks_router.callback_query(F.data == "show_team_features")
async def callback_show_team_features(callback: CallbackQuery):
    """Show team features"""
    user_id = str(callback.from_user.id)

    user_teams = await team_service.get_user_teams(user_id)

    if not user_teams:
        keyboard = keyboard_builder.team_creation_menu()

        await callback.message.edit_text(
            "👥 **JAMOA IMKONIYATLARI**\n\n"
            "🚀 Jamoa yarating va samaradorlikni oshiring!\n\n"
            "💡 **Jamoa nima beradi?**\n"
            "• Vazifalarni taqsimlash va kuzatish\n"
            "• Jamoaviy ishlash va hamkorlik\n"
            "• Progress va statistikalarni ko'rish\n"
            "• Samaradorlikni oshirish\n\n"
            "📝 **Qanday ishlaydi?**\n"
            "1. Jamoa yarating yoki mavjud jamoaga qo'shiling\n"
            "2. Vazifalarni a'zolarga tayinlang\n"
            "3. Progress va natijalarni kuzating",
            reply_markup=keyboard,
            parse_mode="Markdown"
        )
    else:
        keyboard = keyboard_builder.multiple_teams_menu(user_teams)

        message_text = f"👥 **SIZNING JAMOALARINGIZ ({len(user_teams)})**\n\n"
        for i, team in enumerate(user_teams, 1):
            stats = await team_service.get_team_stats(team.id)
            role = "👑" if team.admin_id == user_id else "👤"
            message_text += f"{i}. {role} **{team.name}**\n"
            message_text += f"   🆔 `{team.id}` | 👥 {stats['total_members']} a'zo\n\n"

        await callback.message.edit_text(message_text, reply_markup=keyboard, parse_mode="Markdown")

    await callback.answer()


@callbacks_router.callback_query(F.data.startswith("complete_task_"))
async def callback_complete_task(callback: CallbackQuery):
    """Complete a task"""
    user_id = str(callback.from_user.id)
    task_id = callback.data.split("_")[2]

    logger.info(f"User {user_id} completing task {task_id}")

    async with async_session_factory() as session:
        # Get and update task
        task_result = await session.execute(
            select(Task).where(and_(Task.id == int(task_id), Task.user_id == user_id))
        )
        task = task_result.scalar_one_or_none()

        if not task:
            await callback.answer("❌ Vazifa topilmadi.")
            return

        if task.completed:
            await callback.answer("✅ Vazifa allaqachon bajarilgan.")
            return

        # Mark as completed
        task.completed = True
        task.completed_at = datetime.utcnow()
        await session.commit()

    await callback.answer("✅ Vazifa bajarildi!")

    # Refresh tasks view
    await show_tasks(callback.message, user_id)


async def show_tasks(message: Message, user_id: str):
    """Show user tasks"""
    async with async_session_factory() as session:
        # Get user tasks
        tasks_result = await session.execute(
            select(Task).where(Task.user_id == user_id).order_by(Task.due_date)
        )
        tasks = tasks_result.scalars().all()

        if not tasks:
            text = (
                "📋 **VAZIFALAR RO'YXATI**\n\n"
                "📝 Hozircha vazifalar yo'q\n\n"
                "➕ Yangi vazifa qo'shing va samarali ishlashni boshlang!"
            )
            keyboard = keyboard_builder.empty_tasks_menu()
        else:
            # Separate tasks by status
            active_tasks = [t for t in tasks if not t.completed]
            completed_tasks = [t for t in tasks if t.completed]

            text = f"📋 **VAZIFALAR RO'YXATI**\n\n"

            if active_tasks:
                text += "⏳ **FAOL VAZIFALAR:**\n"
                for task in active_tasks[:5]:  # Show max 5 active tasks
                    priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(task.priority, "⚪")
                    due_date = task.due_date.strftime("%d.%m %H:%M")
                    text += f"{priority_emoji} {task.name} - {due_date}\n"

                if len(active_tasks) > 5:
                    text += f"... va yana {len(active_tasks) - 5} ta\n"

            if completed_tasks:
                text += f"\n✅ **BAJARILGAN:** {len(completed_tasks)} ta\n"

            text += f"\n📊 **Jami:** {len(tasks)} ta vazifa"

            keyboard = keyboard_builder.tasks_menu(active_tasks)

        try:
            await message.edit_text(text, reply_markup=keyboard, parse_mode="Markdown")
        except:
            await message.answer(text, reply_markup=keyboard, parse_mode="Markdown")


@callbacks_router.callback_query(F.data == "notification_settings")
async def callback_notification_settings(callback: CallbackQuery):
    """Show notification settings"""
    user_id = str(callback.from_user.id)

    async with async_session_factory() as session:
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            await callback.answer("❌ Foydalanuvchi topilmadi.")
            return

    # Create notification settings message
    prayer_status = "✅ Yoqilgan" if user.prayer_notifications_enabled else "❌ O'chirilgan"
    general_status = "✅ Yoqilgan" if user.notifications_enabled else "❌ O'chirilgan"

    text = ModernUI.create_header("🔔 BILDIRISHNOMA SOZLAMALARI")
    text += "\n" + ModernUI.create_section(
        "⚙️ JORIY SOZLAMALAR",
        f"🕌 **Namaz bildirishnomalari:** {prayer_status}\n"
        f"📝 **Vazifa bildirishnomalari:** {general_status}\n"
    )
    text += ModernUI.create_section(
        "📱 BILDIRISHNOMA TURLARI",
        "🕌 **Namaz vaqtlari:**\n"
        "• 15 daqiqa oldin\n"
        "• 5 daqiqa oldin\n\n"
        "📝 **Vazifa eslatmalari:**\n"
        "• 1 kun oldin\n"
        "• 1 soat oldin\n"
        "• 15 daqiqa oldin\n"
        "• Vaqti kelganda\n"
    )

    # Create notification settings keyboard inline
    toggle_prayer = "🔕 O'chirish" if user.prayer_notifications_enabled else "🔔 Yoqish"
    toggle_general = "🔕 O'chirish" if user.notifications_enabled else "🔔 Yoqish"

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text=f"🕌 {toggle_prayer}", callback_data="toggle_prayer_notifications"),
            InlineKeyboardButton(text=f"📝 {toggle_general}", callback_data="toggle_general_notifications")
        ],
        [
            InlineKeyboardButton(text="⬅️ Orqaga", callback_data="show_prayer_times")
        ]
    ])

    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="Markdown")
    await callback.answer()


@callbacks_router.callback_query(F.data == "start_fresh")
async def callback_start_fresh(callback: CallbackQuery):
    """Return to main start menu"""
    user_id = str(callback.from_user.id)

    text = ModernUI.create_header("🌟 ASOSIY MENYU")
    text += "\n" + ModernUI.create_section(
        "🚀 IMKONIYATLAR",
        "🕌 **Namaz vaqtlari** - Aniq vaqtlar va eslatmalar\n"
        "📝 **Vazifalar** - Shaxsiy va jamoaviy vazifalar\n"
        "👥 **Jamoalar** - Hamkorlik va taqsimlash\n"
        "📊 **Statistika** - Tahlil va hisobotlar\n"
    )

    keyboard = keyboard_builder.main_menu()

    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="Markdown")
    await callback.answer()


@callbacks_router.callback_query(F.data == "change_prayer_region")
async def callback_change_prayer_region(callback: CallbackQuery):
    """Show region selection for prayer times"""
    user_id = str(callback.from_user.id)

    text = ModernUI.create_header("📍 HUDUDNI TANLANG")
    text += "\n" + ModernUI.create_section(
        "🌍 O'ZBEKISTON HUDUDLARI",
        "Namaz vaqtlarini aniq olish uchun\n"
        "hududingizni tanlang:"
    )

    # Create region selection keyboard inline
    from app.services.prayer_service import PrayerService
    prayer_service = PrayerService()
    regions = prayer_service.get_regions()

    keyboard_rows = []
    # Split regions into rows of 2
    for i in range(0, len(regions), 2):
        row = []
        for j in range(i, min(i + 2, len(regions))):
            region = regions[j]
            row.append(InlineKeyboardButton(text=region, callback_data=f"set_region_{region}"))
        keyboard_rows.append(row)

    # Add back button
    keyboard_rows.append([InlineKeyboardButton(text="⬅️ Orqaga", callback_data="show_prayer_times")])

    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)

    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="Markdown")
    await callback.answer()


@callbacks_router.callback_query(F.data == "toggle_prayer_notifications")
async def callback_toggle_prayer_notifications(callback: CallbackQuery):
    """Toggle prayer notifications on/off"""
    user_id = str(callback.from_user.id)

    async with async_session_factory() as session:
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            await callback.answer("❌ Foydalanuvchi topilmadi.")
            return

        # Toggle prayer notifications
        user.prayer_notifications_enabled = not user.prayer_notifications_enabled
        await session.commit()

        status = "yoqildi" if user.prayer_notifications_enabled else "o'chirildi"
        await callback.answer(f"🕌 Namaz bildirishnomalari {status}!")

        # Refresh the notification settings page
        await callback_notification_settings(callback)


@callbacks_router.callback_query(F.data == "toggle_general_notifications")
async def callback_toggle_general_notifications(callback: CallbackQuery):
    """Toggle general notifications on/off"""
    user_id = str(callback.from_user.id)

    async with async_session_factory() as session:
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            await callback.answer("❌ Foydalanuvchi topilmadi.")
            return

        # Toggle general notifications
        user.notifications_enabled = not user.notifications_enabled
        await session.commit()

        status = "yoqildi" if user.notifications_enabled else "o'chirildi"
        await callback.answer(f"📝 Vazifa bildirishnomalari {status}!")

        # Refresh the notification settings page
        await callback_notification_settings(callback)


@callbacks_router.callback_query(F.data.startswith("set_region_"))
async def callback_set_region(callback: CallbackQuery):
    """Set user's prayer region"""
    user_id = str(callback.from_user.id)
    region = callback.data.replace("set_region_", "")

    async with async_session_factory() as session:
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            await callback.answer("❌ Foydalanuvchi topilmadi.")
            return

        # Update user's prayer region
        user.prayer_region = region
        await session.commit()

        await callback.answer(f"📍 Hudud {region}ga o'zgartirildi!")

        # Go back to prayer times with new region
        await callback_show_prayer_times(callback)