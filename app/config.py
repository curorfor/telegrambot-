"""Configuration settings for the Telegram Bot"""

import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Bot configuration
    BOT_TOKEN: str = Field(..., description="Telegram Bot Token")
    WEBHOOK_URL: Optional[str] = Field(None, description="Webhook URL for production")

    # Database configuration
    DATABASE_URL: str = Field("sqlite+aiosqlite:///./bot.db", description="Database URL")

    # API configuration
    PRAYER_API_URL: str = Field("https://islomapi.uz/api/present/day", description="Prayer times API")

    # Notification settings
    NOTIFICATION_INTERVAL: int = Field(60, description="Notification check interval in seconds")

    # Development settings
    DEBUG: bool = Field(False, description="Debug mode")
    LOG_LEVEL: str = Field("INFO", description="Logging level")

    # Server settings
    HOST: str = Field("0.0.0.0", description="Server host")
    PORT: int = Field(8000, description="Server port")

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()