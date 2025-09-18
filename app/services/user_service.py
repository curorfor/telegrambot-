from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import User, async_session_factory
from typing import Optional

class UserService:
    async def create_or_update_user(
        self,
        telegram_id: int,
        username: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        language_code: Optional[str] = "en"
    ) -> User:
        async with async_session_factory() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            user = result.scalar_one_or_none()

            if user:
                user.username = username
                user.first_name = first_name
                user.last_name = last_name
                user.language_code = language_code
            else:
                user = User(
                    telegram_id=telegram_id,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    language_code=language_code
                )
                session.add(user)

            await session.commit()
            await session.refresh(user)
            return user

    async def get_user_by_telegram_id(self, telegram_id: int) -> Optional[User]:
        async with async_session_factory() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            return result.scalar_one_or_none()

    async def update_user_location(
        self,
        telegram_id: int,
        location: str,
        latitude: str,
        longitude: str,
        timezone: str = "UTC"
    ) -> User:
        async with async_session_factory() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            user = result.scalar_one()

            user.location = location
            user.latitude = latitude
            user.longitude = longitude
            user.timezone = timezone

            await session.commit()
            await session.refresh(user)
            return user

    async def update_notification_settings(
        self,
        telegram_id: int,
        prayer_notifications: bool,
        notification_offset: int = 5
    ) -> User:
        async with async_session_factory() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            user = result.scalar_one()

            user.prayer_notifications = prayer_notifications
            user.notification_offset = notification_offset

            await session.commit()
            await session.refresh(user)
            return user