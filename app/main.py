from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
import logging
from app.config import settings
from app.bot.bot import bot_application
from app.database import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    await init_db()
    await bot_application.initialize()
    await bot_application.start()
    yield
    logger.info("Shutting down...")
    await bot_application.stop()

app = FastAPI(
    title="Prayer Times Telegram Bot API",
    description="FastAPI backend for Prayer Times Telegram Bot with task management",
    version="2.0.0",
    lifespan=lifespan
)

# app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Prayer Times Bot API", "version": "2.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}