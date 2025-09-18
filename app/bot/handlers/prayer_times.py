from telegram import Update
from telegram.ext import ContextTypes
from app.services.user_service import UserService
from app.services.prayer_service import PrayerService
from app.bot.keyboards import get_prayer_keyboard

async def prayer_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_service = UserService()
    prayer_service = PrayerService()

    user = await user_service.get_user_by_telegram_id(update.effective_user.id)

    if not user:
        await update.message.reply_text(
            "❌ Foydalanuvchi topilmadi. Iltimos /start bosing.",
            reply_markup=get_prayer_keyboard()
        )
        return

    # Get user's region or default to Toshkent
    region = getattr(user, 'prayer_region', None) or "Toshkent"

    prayer_times = await prayer_service.get_prayer_times(region)

    if not prayer_times:
        await update.message.reply_text(
            "❌ Namaz vaqtlarini olishda xatolik yuz berdi. Keyinroq qayta urinib ko'ring."
        )
        return

    formatted_times = prayer_service.format_for_display(prayer_times, region)

    await update.message.reply_text(
        formatted_times,
        parse_mode="Markdown",
        reply_markup=get_prayer_keyboard()
    )

async def location_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📍 Please share your location or send me your city name.\n\n"
        "You can:\n"
        "• Use the 📎 attachment button and select Location\n"
        "• Type your city name (e.g., 'New York' or 'London')\n"
        "• Send coordinates (e.g., '40.7128,-74.0060')"
    )

async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_service = UserService()

    if update.message.location:
        location = update.message.location
        latitude = str(location.latitude)
        longitude = str(location.longitude)

        await user_service.update_user_location(
            update.effective_user.id,
            f"Lat: {latitude}, Lon: {longitude}",
            latitude,
            longitude
        )

        await update.message.reply_text(
            "✅ Location saved successfully!\n"
            "Now you can use /prayer to get prayer times."
        )
    else:
        await update.message.reply_text(
            "❌ Please share your location using the location sharing feature."
        )