#!/usr/bin/env python3
"""
Data Migration Script
Migrates data from Node.js JSON format to Python SQLAlchemy models
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path

import sys
sys.path.append('.')
from app.database import init_db, async_session_factory, User, Task, Team, TeamMember

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate_data():
    """Main migration function"""
    logger.info("🔄 Starting data migration...")

    # Initialize database
    await init_db()

    # Load JSON data
    json_files = [
        "data/database.json",  # Node.js database
        "database.json",       # Alternative location
        "src/data/database.json"  # Another possible location
    ]

    data = None
    for json_file in json_files:
        if Path(json_file).exists():
            logger.info(f"📂 Found data file: {json_file}")
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            break

    if not data:
        logger.warning("⚠️ No JSON data file found. Creating fresh database.")
        return

    logger.info(f"📊 Data loaded: {len(data.get('users', {}))} users")

    async with async_session_factory() as session:
        # Migrate users
        users_data = data.get('users', {})
        migrated_users = 0

        for user_id, user_data in users_data.items():
            try:
                # Check if user already exists
                existing_user = await session.get(User, user_id)
                if existing_user:
                    logger.debug(f"User {user_id} already exists, skipping...")
                    continue

                # Create user
                user = User(
                    id=user_id,
                    first_name=user_data.get('firstName', 'Unknown'),
                    last_name=user_data.get('lastName'),
                    username=user_data.get('username'),
                    prayer_region=user_data.get('prayerRegion', 'Toshkent'),
                    notifications_enabled=user_data.get('preferences', {}).get('notifications', {}).get('tasks', True),
                    prayer_notifications_enabled=user_data.get('preferences', {}).get('notifications', {}).get('prayer', True),
                    registration_date=parse_date(user_data.get('activity', {}).get('registrationDate')),
                    last_activity=parse_date(user_data.get('activity', {}).get('lastActivity')),
                    total_tasks_created=user_data.get('activity', {}).get('totalTasksCreated', 0),
                    blocked_bot=user_data.get('activity', {}).get('blockedBot', False),
                    blocked_at=parse_date(user_data.get('activity', {}).get('blockedAt'))
                )

                session.add(user)
                migrated_users += 1

                # Migrate user tasks
                tasks_data = user_data.get('tasks', [])
                migrated_tasks = 0

                for task_data in tasks_data:
                    try:
                        task = Task(
                            user_id=user_id,
                            name=task_data.get('name', 'Untitled Task'),
                            notes=task_data.get('notes', ''),
                            category=task_data.get('category', 'personal'),
                            priority=task_data.get('priority', 'medium'),
                            due_date=parse_date(task_data.get('date')),
                            created_at=parse_date(task_data.get('createdAt')),
                            completed=task_data.get('completed', False),
                            completed_at=parse_date(task_data.get('completedAt')),
                            # Notification flags
                            notification_1day_sent=task_data.get('notifications', {}).get('sent1Day', False),
                            notification_1hour_sent=task_data.get('notifications', {}).get('sent1Hour', False),
                            notification_15min_sent=task_data.get('notifications', {}).get('sent15Min', False),
                            notification_due_sent=task_data.get('notifications', {}).get('sentDue', False)
                        )

                        session.add(task)
                        migrated_tasks += 1

                    except Exception as e:
                        logger.error(f"Failed to migrate task for user {user_id}: {e}")

                logger.info(f"✅ Migrated user {user_id} with {migrated_tasks} tasks")

            except Exception as e:
                logger.error(f"Failed to migrate user {user_id}: {e}")

        # Migrate teams
        teams_data = data.get('teamData', {})
        migrated_teams = 0

        for team_id, team_data in teams_data.items():
            try:
                # Check if team already exists
                existing_team = await session.get(Team, team_id)
                if existing_team:
                    logger.debug(f"Team {team_id} already exists, skipping...")
                    continue

                # Create team
                team = Team(
                    id=team_id,
                    name=team_data.get('name', 'Unnamed Team'),
                    admin_id=team_data.get('admin'),
                    created_at=parse_date(team_data.get('createdAt')),
                    allow_member_invite=team_data.get('settings', {}).get('allowMemberInvite', False),
                    require_approval=team_data.get('settings', {}).get('requireApproval', True)
                )

                session.add(team)

                # Add team members
                members = team_data.get('members', [])
                for member_id in members:
                    member = TeamMember(
                        team_id=team_id,
                        user_id=member_id,
                        is_admin=(member_id == team_data.get('admin'))
                    )
                    session.add(member)

                # Migrate team tasks
                shared_tasks = team_data.get('sharedTasks', [])
                for task_data in shared_tasks:
                    try:
                        task = Task(
                            user_id=task_data.get('assignedBy', team_data.get('admin')),
                            team_id=team_id,
                            name=task_data.get('name', 'Untitled Team Task'),
                            notes=task_data.get('notes', ''),
                            category=task_data.get('category', 'team'),
                            priority=task_data.get('priority', 'medium'),
                            due_date=parse_date(task_data.get('date')),
                            created_at=parse_date(task_data.get('createdAt')),
                            completed=task_data.get('completed', False),
                            completed_at=parse_date(task_data.get('completedAt')),
                            assigned_by=task_data.get('assignedBy'),
                            completed_by=task_data.get('completedBy')
                        )

                        session.add(task)

                    except Exception as e:
                        logger.error(f"Failed to migrate team task for team {team_id}: {e}")

                migrated_teams += 1
                logger.info(f"✅ Migrated team {team_id} ({team_data.get('name')}) with {len(members)} members")

            except Exception as e:
                logger.error(f"Failed to migrate team {team_id}: {e}")

        # Commit all changes
        await session.commit()

        logger.info(f"🎉 Migration complete!")
        logger.info(f"   👥 Users migrated: {migrated_users}")
        logger.info(f"   🏢 Teams migrated: {migrated_teams}")

        # Print summary
        from app.database import get_stats
        stats = await get_stats()
        logger.info(f"📊 Final database stats: {stats}")


def parse_date(date_str):
    """Parse date string to datetime object"""
    if not date_str:
        return None

    try:
        # Try different date formats
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',  # ISO format with microseconds
            '%Y-%m-%dT%H:%M:%SZ',     # ISO format
            '%Y-%m-%d %H:%M:%S',      # Standard format
            '%Y-%m-%d',               # Date only
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        # If all formats fail, try parsing as timestamp
        return datetime.fromtimestamp(float(date_str) / 1000)

    except Exception:
        logger.warning(f"Failed to parse date: {date_str}")
        return None


if __name__ == "__main__":
    asyncio.run(migrate_data())