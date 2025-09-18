"""Database configuration and models"""

import asyncio
from datetime import datetime
from typing import AsyncGenerator, List, Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, selectinload
from sqlalchemy import select, func

from app.config import settings

Base = declarative_base()

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True
)

# Create session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(String, primary_key=True)  # Telegram user ID
    first_name = Column(String)
    last_name = Column(String, nullable=True)
    username = Column(String, nullable=True)

    # Settings
    prayer_region = Column(String, default="Toshkent")
    notifications_enabled = Column(Boolean, default=True)
    prayer_notifications_enabled = Column(Boolean, default=True)

    # Activity tracking
    registration_date = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    total_tasks_created = Column(Integer, default=0)
    blocked_bot = Column(Boolean, default=False)
    blocked_at = Column(DateTime, nullable=True)

    # Relationships
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan", foreign_keys="Task.user_id")
    team_memberships = relationship("TeamMember", back_populates="user")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name or ''}".strip()


class Task(Base):
    """Task model"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    # Task details
    name = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    category = Column(String, default="personal")
    priority = Column(String, default="medium")  # low, medium, high

    # Dates
    due_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    completed = Column(Boolean, default=False)

    # Team assignment
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    assigned_by = Column(String, ForeignKey("users.id"), nullable=True)
    completed_by = Column(String, ForeignKey("users.id"), nullable=True)

    # Notifications tracking
    notification_1day_sent = Column(Boolean, default=False)
    notification_1hour_sent = Column(Boolean, default=False)
    notification_15min_sent = Column(Boolean, default=False)
    notification_due_sent = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", back_populates="tasks", foreign_keys=[user_id])
    team = relationship("Team", back_populates="tasks")


class Team(Base):
    """Team model"""
    __tablename__ = "teams"

    id = Column(String, primary_key=True)  # 6-character code
    name = Column(String, nullable=False)
    admin_id = Column(String, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Settings
    allow_member_invite = Column(Boolean, default=False)
    require_approval = Column(Boolean, default=True)

    # Relationships
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="team")
    admin = relationship("User", foreign_keys=[admin_id])


class TeamMember(Base):
    """Team membership model"""
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    joined_at = Column(DateTime, default=datetime.utcnow)
    is_admin = Column(Boolean, default=False)

    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")


class PrayerNotification(Base):
    """Prayer notification tracking"""
    __tablename__ = "prayer_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD format
    prayer_name = Column(String, nullable=False)  # Fajr, Dhuhr, Asr, Maghrib, Isha
    notification_type = Column(String, nullable=False)  # 15min, 5min
    sent_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User")


# Database functions
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session"""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Close database connections"""
    await engine.dispose()


async def get_user(user_id: str) -> Optional[User]:
    """Get user by ID"""
    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()




async def get_or_create_user(user_id: str, first_name: str, last_name: str = None, username: str = None) -> User:
    """Get existing user or create new one"""
    async with async_session_factory() as session:
        # Try to get existing user
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            # Create new user
            user = User(
                id=user_id,
                first_name=first_name,
                last_name=last_name,
                username=username
            )
            session.add(user)
        else:
            # Update existing user info
            user.first_name = first_name
            user.last_name = last_name
            user.username = username
            user.last_activity = datetime.utcnow()

        await session.commit()
        await session.refresh(user)
        return user


async def get_stats():
    """Get bot statistics"""
    async with async_session_factory() as session:
        # Count users
        total_users = await session.scalar(select(func.count(User.id)))
        active_users = await session.scalar(
            select(func.count(User.id)).where(User.blocked_bot == False)
        )

        # Count tasks
        total_tasks = await session.scalar(select(func.count(Task.id)))
        completed_tasks = await session.scalar(
            select(func.count(Task.id)).where(Task.completed == True)
        )

        # Count teams
        total_teams = await session.scalar(select(func.count(Team.id)))

        return {
            "users": {
                "total": total_users,
                "active": active_users,
                "blocked": total_users - active_users
            },
            "tasks": {
                "total": total_tasks,
                "completed": completed_tasks,
                "active": total_tasks - completed_tasks
            },
            "teams": {
                "total": total_teams
            }
        }