from telegram import Update
from telegram.ext import ContextTypes
from app.services.user_service import UserService
from app.bot.keyboards import get_settings_keyboard

async def settings_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_service = UserService()
    user = await user_service.get_user_by_telegram_id(update.effective_user.id)

    if not user:
        await update.message.reply_text(
            "❌ User not found. Please use /start first."
        )
        return

    settings_text = f"⚙️ *Your Settings*\n\n"
    settings_text += f"*Location:* {user.location or 'Not set'}\n"
    settings_text += f"*Timezone:* {user.timezone}\n"
    settings_text += f"*Language:* {user.language_code.upper()}\n"
    settings_text += f"*Prayer Notifications:* {'✅ Enabled' if user.prayer_notifications else '❌ Disabled'}\n"

    if user.prayer_notifications:
        settings_text += f"*Notification Offset:* {user.notification_offset} minutes before\n"

    settings_text += "\nUse the buttons below to update your settings."

    await update.message.reply_text(
        settings_text,
        parse_mode="Markdown",
        reply_markup=get_settings_keyboard()
    )