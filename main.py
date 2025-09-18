#!/usr/bin/env python3
"""
FastAPI Telegram To-Do Bot
A modern Python implementation with FastAPI and aiogram
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from aiogram import Bot, Dispatcher
from aiogram.types import Update
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web

from app.config import settings
from app.handlers import router
from app.database import init_db, close_db
from app.services.notification_service import NotificationService
from app.middleware.error import ErrorMiddleware
from app.middleware.auth import AuthMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global instances
bot = Bot(token=settings.BOT_TOKEN)
dp = Dispatcher()
notification_service = NotificationService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("🚀 Starting Telegram Bot API...")

    # Initialize database
    await init_db()

    # Setup bot
    dp.include_router(router)

    # Start notification service
    await notification_service.start()

    # Start polling instead of webhook for development
    logger.info("✅ Bot setup complete - starting in polling mode...")

    yield

    # Shutdown
    logger.info("🛑 Shutting down...")
    await notification_service.stop()
    await bot.delete_webhook()
    await bot.session.close()
    await close_db()
    logger.info("✅ Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Telegram Todo Bot API",
    description="A task management bot with team collaboration features",
    version="2.0.0",
    lifespan=lifespan
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "bot": "Telegram Todo Bot",
        "version": "2.0.0"
    }


@app.post("/webhook")
async def webhook(request: Request):
    """Handle Telegram webhook updates"""
    try:
        data = await request.json()
        update = Update(**data)
        await dp.feed_update(bot, update)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Invalid update")


@app.get("/stats")
async def get_stats():
    """Get bot statistics"""
    from app.database import get_stats
    return await get_stats()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )