#!/usr/bin/env python3
"""
Simple bot runner for testing
"""

import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.filters import Command

from app.config import settings
from app.database import init_db
from app.handlers import router
from app.services.notification_service import NotificationService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    # Initialize database
    await init_db()
    logger.info("✅ Database initialized")

    # Create bot and dispatcher
    bot = Bot(token=settings.BOT_TOKEN)
    dp = Dispatcher()

    # Include handlers
    dp.include_router(router)

    # Initialize notification service with bot instance
    notification_service = NotificationService(bot)

    logger.info("🚀 Starting bot in polling mode...")
    logger.info("🔔 Starting notification service...")

    try:
        # Start notification service
        await notification_service.start()

        # Start polling
        await dp.start_polling(bot)
    finally:
        await notification_service.stop()
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())