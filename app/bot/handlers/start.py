from telegram import Update
from telegram.ext import ContextTypes
from app.services.user_service import UserService
from app.bot.keyboards import get_main_keyboard

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    user_service = UserService()
    await user_service.create_or_update_user(
        telegram_id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        language_code=user.language_code
    )

    welcome_text = f"""
🕌 Assalamu Alaikum, {user.first_name}!

Welcome to the Prayer Times & Task Management Bot!

This bot helps you:
• 📿 Get accurate prayer times for your location
• ✅ Manage tasks individually or with your team
• 👥 Collaborate with team members
• 🔔 Receive prayer notifications

Use the buttons below to get started, or type /help for more commands.
    """

    await update.message.reply_text(
        welcome_text,
        reply_markup=get_main_keyboard()
    )

async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text

    # Handle main keyboard buttons
    if text == "🕌 Prayer Times":
        from app.bot.handlers.prayer_times import prayer_command
        await prayer_command(update, context)
        return
    elif text == "✅ My Tasks":
        await update.message.reply_text("✅ Tasks feature coming soon!")
        return
    elif text == "👥 Teams":
        await update.message.reply_text("👥 Teams feature coming soon!")
        return
    elif text == "⚙️ Settings":
        await update.message.reply_text("⚙️ Settings feature coming soon!")
        return

    # Handle text keywords
    text_lower = text.lower()
    if any(keyword in text_lower for keyword in ['prayer', 'salah', 'namaz']):
        await update.message.reply_text(
            "🕌 Use /prayer to get prayer times for your location!"
        )
    elif any(keyword in text_lower for keyword in ['task', 'todo', 'work']):
        await update.message.reply_text(
            "✅ Use /tasks to manage your tasks or /newtask to create a new one!"
        )
    elif any(keyword in text_lower for keyword in ['team', 'group', 'collaborate']):
        await update.message.reply_text(
            "👥 Use /team to manage your teams or /createteam to create a new one!"
        )
    else:
        await update.message.reply_text(
            "I didn't understand that. Use /help to see available commands.",
            reply_markup=get_main_keyboard()
        )