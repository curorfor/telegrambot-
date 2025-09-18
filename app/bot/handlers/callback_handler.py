"""Callback query handlers for python-telegram-bot"""

import logging
from telegram import Update
from telegram.ext import ContextTypes
from app.services.user_service import UserService
from app.services.prayer_service import PrayerService
from app.bot.keyboards import get_prayer_keyboard

logger = logging.getLogger(__name__)


async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle callback queries"""
    query = update.callback_query
    await query.answer()

    if query.data == "show_prayer_times":
        await handle_show_prayer_times(update, context)
    elif query.data == "prayer_today":
        await handle_show_prayer_times(update, context)
    else:
        await query.edit_message_text("❌ Noma'lum buyruq.")


async def handle_show_prayer_times(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show prayer times"""
    query = update.callback_query
    user_id = query.from_user.id

    user_service = UserService()
    prayer_service = PrayerService()

    try:
        # Get user
        user = await user_service.get_user_by_telegram_id(user_id)

        if not user:
            await query.edit_message_text("❌ Foydalanuvchi topilmadi. Iltimos /start bosing.")
            return

        # Get user's prayer region or default to Toshkent
        region = getattr(user, 'prayer_region', None) or "Toshkent"

        # Get prayer times
        prayer_times = await prayer_service.get_prayer_times(region)

        if not prayer_times:
            await query.edit_message_text("❌ Namaz vaqtlarini olishda xatolik yuz berdi.")
            return

        # Format and display
        formatted_times = prayer_service.format_for_display(prayer_times, region)

        await query.edit_message_text(
            formatted_times,
            reply_markup=get_prayer_keyboard(),
            parse_mode="Markdown"
        )

    except Exception as e:
        logger.error(f"Failed to get prayer times: {e}")
        await query.edit_message_text("❌ Namaz vaqtlarini olishda xatolik yuz berdi.")

    finally:
        await prayer_service.close()