"""Text message handlers for conversation flows"""

import logging
from datetime import datetime, timedelta
from aiogram import Router, F
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from app.database import async_session_factory, User, Task
from app.utils.keyboards import KeyboardBuilder
from app.services.team_service import TeamService

logger = logging.getLogger(__name__)

messages_router = Router()
keyboard_builder = KeyboardBuilder()
team_service = TeamService()


class TaskStates(StatesGroup):
    """States for task creation"""
    waiting_task_name = State()
    waiting_task_date = State()
    waiting_task_notes = State()


class TeamStates(StatesGroup):
    """States for team operations"""
    waiting_team_name = State()
    waiting_team_code = State()


@messages_router.message(F.text, TaskStates.waiting_task_name)
async def handle_task_name(message: Message, state: FSMContext):
    """Handle task name input"""
    user_id = str(message.from_user.id)
    task_name = message.text.strip()

    if len(task_name) < 3:
        await message.answer("❌ Vazifa nomi juda qisqa. Kamida 3 ta belgi kiriting.")
        return

    if len(task_name) > 100:
        await message.answer("❌ Vazifa nomi juda uzun. Maksimal 100 ta belgi.")
        return

    # Store task name in state
    await state.update_data(task_name=task_name)

    # Show date selection
    text = f"📅 **\"{task_name}\" vazifasi uchun sanani tanlang:**\n\n"

    keyboard = keyboard_builder.date_selection_menu()

    await message.answer(text, reply_markup=keyboard, parse_mode="Markdown")
    await state.set_state(TaskStates.waiting_task_date)


@messages_router.message(F.text, TaskStates.waiting_task_notes)
async def handle_task_notes(message: Message, state: FSMContext):
    """Handle task notes input"""
    user_id = str(message.from_user.id)
    notes = message.text.strip()

    # Get data from state
    data = await state.get_data()
    task_name = data.get('task_name')
    task_date = data.get('task_date')

    if notes.lower() in ['yo\'q', 'yoq', 'no']:
        notes = ""

    # Create the task
    async with async_session_factory() as session:
        # Get user
        user_result = await session.execute(
            f"SELECT * FROM users WHERE id = '{user_id}'"
        )
        user = user_result.fetchone()

        if not user:
            await message.answer("❌ Foydalanuvchi topilmadi.")
            await state.clear()
            return

        # Create task
        task = Task(
            user_id=user_id,
            name=task_name,
            notes=notes,
            due_date=datetime.fromisoformat(task_date),
            category="personal",
            priority="medium"
        )

        session.add(task)
        await session.commit()
        await session.refresh(task)

        # Update user stats
        await session.execute(
            f"UPDATE users SET total_tasks_created = total_tasks_created + 1 WHERE id = '{user_id}'"
        )
        await session.commit()

    # Clear state
    await state.clear()

    # Send confirmation
    confirm_text = (
        f"✅ **Vazifa yaratildi!**\n\n"
        f"📝 **Nomi:** {task_name}\n"
        f"📅 **Sana:** {datetime.fromisoformat(task_date).strftime('%d.%m.%Y %H:%M')}\n"
        f"📁 **Kategoriya:** Personal\n"
        f"🏆 **Prioritet:** Medium\n"
    )

    if notes:
        confirm_text += f"📋 **Eslatma:** {notes}\n"

    confirm_text += "\n🎉 **Vazifa muvaffaqiyatli saqlandi!**"

    keyboard = keyboard_builder.task_created_menu()

    await message.answer(confirm_text, reply_markup=keyboard, parse_mode="Markdown")

    logger.info(f"User {user_id} created task: {task_name}")


@messages_router.message(F.text, TeamStates.waiting_team_name)
async def handle_team_name(message: Message, state: FSMContext):
    """Handle team name input"""
    user_id = str(message.from_user.id)
    team_name = message.text.strip()

    if len(team_name) < 3:
        await message.answer("❌ Jamoa nomi juda qisqa. Kamida 3 ta belgi kiriting.")
        return

    if len(team_name) > 50:
        await message.answer("❌ Jamoa nomi juda uzun. Maksimal 50 ta belgi.")
        return

    try:
        # Create team
        team = await team_service.create_team(team_name, user_id)
        await state.clear()

        keyboard = keyboard_builder.team_created_menu(team.id)

        await message.answer(
            f"🎉 **Jamoa yaratildi!**\n\n"
            f"👥 **Nomi:** {team.name}\n"
            f"🆔 **Kod:** `{team.id}`\n"
            f"👑 **Admin:** Siz\n"
            f"📅 **Yaratilgan:** {datetime.now().strftime('%d.%m.%Y')}\n\n"
            f"📤 **Kodni ulashing:** Boshqa foydalanuvchilar `{team.id}` kodi bilan jamoaga qo'shilishlari mumkin.\n\n"
            f"🎯 Endi vazifalar tayinlashingiz va jamoa bilan samarali ishlashingiz mumkin!",
            reply_markup=keyboard,
            parse_mode="Markdown"
        )

        logger.info(f"User {user_id} created team: {team_name} ({team.id})")

    except Exception as e:
        logger.error(f"Failed to create team: {e}")
        await message.answer("❌ Jamoa yaratishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.")


@messages_router.message(F.text, TeamStates.waiting_team_code)
async def handle_team_code(message: Message, state: FSMContext):
    """Handle team code input"""
    user_id = str(message.from_user.id)
    team_code = message.text.strip().upper()

    if len(team_code) != 6:
        await message.answer("❌ Jamoa kodi 6 ta belgidan iborat bo'lishi kerak. Qaytadan kiriting.")
        return

    try:
        # Join team
        team = await team_service.join_team(team_code, user_id)
        await state.clear()

        stats = await team_service.get_team_stats(team.id)
        keyboard = keyboard_builder.team_joined_menu(team.id)

        await message.answer(
            f"✅ **Jamoaga qo'shildingiz!**\n\n"
            f"👥 **Jamoa:** {team.name}\n"
            f"🆔 **Kod:** `{team.id}`\n"
            f"👤 **A'zolar:** {stats['total_members']} kishi\n"
            f"📝 **Vazifalar:** {stats['total_tasks']} ta\n"
            f"📅 **Qo'shilgan:** {datetime.now().strftime('%d.%m.%Y')}\n\n"
            f"🎉 Endi jamoa vazifalarini ko'rishingiz va bajarishingiz mumkin!",
            reply_markup=keyboard,
            parse_mode="Markdown"
        )

        logger.info(f"User {user_id} joined team {team_code}")

    except Exception as e:
        logger.error(f"Failed to join team: {e}")

        if "Team not found" in str(e):
            await message.answer("❌ **Bunday kod bilan jamoa topilmadi**\n\nKodni tekshirib qaytadan kiriting.")
        elif "User already in team" in str(e):
            await message.answer("⚠️ **Siz allaqachon bu jamoada a'zosiz!**\n\nBoshqa jamoa kodini kiriting yoki /team buyrug'i bilan jamoalaringizni ko'ring.")
        else:
            await message.answer("❌ Jamoaga qo'shilishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.")


@messages_router.message(F.text)
async def handle_text_message(message: Message, state: FSMContext):
    """Handle general text messages"""
    user_id = str(message.from_user.id)
    text = message.text.strip()

    # Get current state
    current_state = await state.get_state()

    if current_state:
        # User is in a conversation flow but message wasn't handled
        await message.answer(
            "❓ Buyruq tanilmadi. Iltimos, so'ralgan ma'lumotni kiriting yoki /start ni bosing.",
            reply_markup=keyboard_builder.back_to_main_menu()
        )
    else:
        # No active conversation, show help
        await message.answer(
            "❓ Buyruq tanilmadi. Yordam uchun /help ni bosing yoki tugmalardan foydalaning.",
            reply_markup=keyboard_builder.main_menu()
        )

    logger.debug(f"Unhandled text message from {user_id}: {text}")