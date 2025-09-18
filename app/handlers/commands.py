"""Command handlers for the bot"""

import logging
from datetime import datetime
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command

from app.database import get_or_create_user, get_user, async_session_factory
from app.utils.keyboards import KeyboardBuilder
from app.utils.formatters import ModernUI
from app.services.prayer_service import PrayerService
from app.services.team_service import TeamService

logger = logging.getLogger(__name__)

commands_router = Router()
keyboard_builder = KeyboardBuilder()
prayer_service = PrayerService()
team_service = TeamService()


@commands_router.message(Command("start"))
async def cmd_start(message: Message):
    """Handle /start command"""
    user_id = str(message.from_user.id)

    # Get or create user
    user = await get_or_create_user(
        user_id=user_id,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name,
        username=message.from_user.username
    )

    logger.info(f"User {user_id} started the bot")

    # Check if new user (registered in last minute)
    is_new_user = (datetime.utcnow() - user.registration_date).seconds < 60

    if is_new_user:
        text = (
            f"🎉 **Xush kelibsiz, {message.from_user.first_name or 'Foydalanuvchi'}!**\n\n"
            "📝 **Telegram To-Do Bot** - vazifalaringizni boshqaring!\n\n"
            "✨ **Imkoniyatlar:**\n"
            "• ➕ Vazifalar qo'shish va boshqarish\n"
            "• ⏰ Smart eslatmalar\n"
            "• 🏆 Kategoriyalar va prioritetlar\n"
            "• 👥 Jamoa bilan ishlash\n"
            "• 🕌 Namoz vaqtlari\n"
            "• 📊 Tahlil va statistika\n\n"
            "🚀 **Boshlash uchun quyidagi tugmalardan foydalaning:**"
        )
    else:
        text = (
            f"👋 **Qaytganingiz bilan, {message.from_user.first_name or 'Foydalanuvchi'}!**\n\n"
            "📋 Vazifalaringizni boshqarishda davom eting:"
        )

    keyboard = keyboard_builder.main_menu()

    await message.answer(text, reply_markup=keyboard, parse_mode="Markdown")


@commands_router.message(Command("tasks"))
async def cmd_tasks(message: Message):
    """Handle /tasks command"""
    user_id = str(message.from_user.id)
    logger.info(f"User {user_id} requested tasks")

    # Redirect to main tasks view
    from app.handlers.callbacks import show_tasks
    await show_tasks(message, user_id)


@commands_router.message(Command("add"))
async def cmd_add(message: Message):
    """Handle /add command"""
    user_id = str(message.from_user.id)
    logger.info(f"User {user_id} wants to add task")

    # Set user state for task creation
    # Note: We'll need to implement state management
    text = (
        "📝 **Yangi vazifa qo'shish**\n\n"
        "Vazifa nomini kiriting:\n\n"
        "💡 *Masalan: \"Prezentatsiya tayyorlash\", \"Dukonga borish\"*"
    )

    await message.answer(text, parse_mode="Markdown")


@commands_router.message(Command("profile"))
async def cmd_profile(message: Message):
    """Handle /profile command"""
    user_id = str(message.from_user.id)
    user = await get_user(user_id)

    if not user:
        await message.answer("❌ Foydalanuvchi topilmadi. /start ni bosing.")
        return

    logger.info(f"User {user_id} requested profile")

    # Get user statistics
    async with async_session_factory() as session:
        tasks = await session.execute(
            f"SELECT * FROM tasks WHERE user_id = '{user_id}'"
        )
        user_tasks = tasks.fetchall()

        total = len(user_tasks)
        completed = len([t for t in user_tasks if t.completed])
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

    await message.answer(profile_text, reply_markup=keyboard, parse_mode="Markdown")


@commands_router.message(Command("help"))
async def cmd_help(message: Message):
    """Handle /help command"""
    user_id = str(message.from_user.id)
    logger.info(f"User {user_id} requested help")

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
        "🕌 NAMAZ VAQTLARI",
        "/prayer - Namaz vaqtlarini ko'rish\n"
        "/prayer Toshkent - Toshkent namaz vaqtlari\n"
        "/setprayerregion - Hududni tanlash\n"
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
    help_text += "\n💡 **Maslahat:** Tugmalar orqali oson boshqaring!"

    await message.answer(help_text, parse_mode="Markdown")


@commands_router.message(Command("prayer"))
async def cmd_prayer(message: Message):
    """Handle /prayer command"""
    user_id = str(message.from_user.id)
    user = await get_user(user_id)

    if not user:
        await message.answer("❌ Foydalanuvchi topilmadi. /start ni bosing.")
        return

    logger.info(f"User {user_id} requested prayer times")

    # Get region from command or user's saved region
    command_text = message.text
    parts = command_text.split(' ', 1)
    region = parts[1] if len(parts) > 1 else user.prayer_region or "Toshkent"

    try:
        prayer_times = await prayer_service.get_prayer_times(region)
        formatted_times = prayer_service.format_for_display(prayer_times, region)

        keyboard = keyboard_builder.prayer_menu()

        await message.answer(formatted_times, reply_markup=keyboard, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Failed to get prayer times: {e}")
        await message.answer("❌ Namaz vaqtlarini olishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.")


@commands_router.message(Command("team"))
async def cmd_team(message: Message):
    """Handle /team command"""
    user_id = str(message.from_user.id)
    logger.info(f"User {user_id} requested team info")

    user_teams = await team_service.get_user_teams(user_id)

    if not user_teams:
        keyboard = keyboard_builder.team_creation_menu()

        await message.answer(
            "👥 **Siz hech qaysi jamoada emassiz**\n\n"
            "🚀 Jamoa yarating yoki mavjud jamoaga qo'shiling!\n\n"
            "💡 **Jamoa nima beradi?**\n"
            "• Vazifalarni taqsimlash\n"
            "• Jamoaviy ishlash\n"
            "• Progress kuzatish\n"
            "• Samaradorlikni oshirish",
            reply_markup=keyboard,
            parse_mode="Markdown"
        )
        return

    if len(user_teams) == 1:
        # Show single team
        team = user_teams[0]
        stats = await team_service.get_team_stats(team.id)
        keyboard = keyboard_builder.single_team_menu(team.id)

        message_text = team_service.format_team_info(team, stats)

        await message.answer(message_text, reply_markup=keyboard, parse_mode="Markdown")
    else:
        # Multiple teams - show selection
        keyboard = keyboard_builder.multiple_teams_menu(user_teams)

        message_text = f"👥 **SIZNING JAMOALARINGIZ ({len(user_teams)})**\n\n"
        for i, team in enumerate(user_teams, 1):
            stats = await team_service.get_team_stats(team.id)
            role = "👑" if team.admin_id == user_id else "👤"
            message_text += f"{i}. {role} **{team.name}**\n"
            message_text += f"   🆔 `{team.id}` | 👥 {stats['total_members']} a'zo\n\n"

        await message.answer(message_text, reply_markup=keyboard, parse_mode="Markdown")


@commands_router.message(Command("createteam"))
async def cmd_create_team(message: Message):
    """Handle /createteam command"""
    user_id = str(message.from_user.id)
    logger.info(f"User {user_id} wants to create team")

    # Set user state for team creation
    text = (
        "👥 **Yangi jamoa yaratish**\n\n"
        "Jamoa nomini kiriting:\n\n"
        "💡 *Masalan: \"Loyiha jamoasi\", \"Dars guruhi\", \"Ish jamoasi\"*\n\n"
        "📝 **Eslatma:** Jamoa yaratilgandan keyin sizga 6 raqamli kod beriladi. "
        "Bu kod orqali boshqa foydalanuvchilar jamoaga qo'shilishlari mumkin."
    )

    await message.answer(text, parse_mode="Markdown")


@commands_router.message(Command("jointeam"))
async def cmd_join_team(message: Message):
    """Handle /jointeam command"""
    user_id = str(message.from_user.id)
    logger.info(f"User {user_id} wants to join team")

    # Set user state for team joining
    text = (
        "🔑 **Jamoaga qo'shilish**\n\n"
        "Jamoa kodini kiriting:\n\n"
        "💡 *6 raqamli kod, masalan: ABC123*\n\n"
        "📝 **Eslatma:** Jamoa kodi jamoa admin tomonidan beriladi. "
        "Kodni to'g'ri kiritganingizga ishonch hosil qiling."
    )

    await message.answer(text, parse_mode="Markdown")