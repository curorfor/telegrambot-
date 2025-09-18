"""Authentication and user initialization middleware"""

import logging
from typing import Callable, Dict, Any, Awaitable
from aiogram import BaseMiddleware
from aiogram.types import Message, CallbackQuery

from app.database import get_or_create_user

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseMiddleware):
    """Middleware for user authentication and initialization"""

    def __init__(self):
        super().__init__()

    async def __call__(
        self,
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        event: Message | CallbackQuery,
        data: Dict[str, Any]
    ) -> Any:
        """Process user authentication"""

        # Extract user info from event
        if hasattr(event, 'from_user') and event.from_user:
            user_info = event.from_user
        elif hasattr(event, 'message') and event.message and event.message.from_user:
            user_info = event.message.from_user
        else:
            # Skip if no user info available
            return await handler(event, data)

        try:
            # Get or create user in database
            user = await get_or_create_user(
                user_id=str(user_info.id),
                first_name=user_info.first_name,
                last_name=user_info.last_name,
                username=user_info.username
            )

            # Add user to context
            data['user'] = user
            data['user_id'] = str(user_info.id)

            logger.debug(f"User {user_info.id} authenticated successfully")

        except Exception as e:
            logger.error(f"Failed to authenticate user {user_info.id}: {e}")
            # Continue without user data
            data['user'] = None
            data['user_id'] = str(user_info.id) if user_info else None

        # Continue to handler
        return await handler(event, data)