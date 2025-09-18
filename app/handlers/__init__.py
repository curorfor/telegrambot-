"""Bot handlers package"""

from aiogram import Router
from .commands import commands_router
from .callbacks import callbacks_router
from .messages import messages_router

# Main router that includes all handlers
router = Router()
router.include_router(commands_router)
router.include_router(callbacks_router)
router.include_router(messages_router)