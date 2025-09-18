"""Error handling middleware"""

import logging
from typing import Callable, Dict, Any, Awaitable
from aiogram import BaseMiddleware
from aiogram.types import Message, CallbackQuery, ErrorEvent

logger = logging.getLogger(__name__)


class ErrorMiddleware(BaseMiddleware):
    """Middleware for error handling"""

    def __init__(self):
        super().__init__()

    async def __call__(
        self,
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        event: Message | CallbackQuery,
        data: Dict[str, Any]
    ) -> Any:
        """Handle errors in bot handlers"""

        try:
            # Execute handler
            return await handler(event, data)

        except Exception as e:
            # Log the error
            user_id = getattr(event.from_user, 'id', 'unknown') if hasattr(event, 'from_user') else 'unknown'
            logger.error(f"Error in handler for user {user_id}: {e}", exc_info=True)

            # Try to send error message to user
            try:
                error_message = (
                    "❌ **Xatolik yuz berdi**\n\n"
                    "Iltimos, qaytadan urinib ko'ring yoki /start buyrug'ini bosing.\n\n"
                    "Agar muammo davom etsa, administratorga murojaat qiling."
                )

                if isinstance(event, Message):
                    await event.answer(error_message, parse_mode="Markdown")
                elif isinstance(event, CallbackQuery):
                    await event.message.edit_text(error_message, parse_mode="Markdown")
                    await event.answer("Xatolik yuz berdi")

            except Exception as send_error:
                logger.error(f"Failed to send error message: {send_error}")

            # Re-raise for debugging in development
            if __debug__:
                raise e