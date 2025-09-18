"""Team management service"""

import logging
import random
import string
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select, and_, func
from app.database import async_session_factory, Team, TeamMember, User, Task

logger = logging.getLogger(__name__)


class TeamService:
    """Service for team management"""

    def __init__(self):
        pass

    def _generate_team_id(self) -> str:
        """Generate unique 6-character team ID"""
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choices(chars, k=6))

    async def create_team(self, team_name: str, admin_id: str) -> Team:
        """Create a new team"""
        async with async_session_factory() as session:
            # Generate unique team ID
            team_id = self._generate_team_id()

            # Ensure uniqueness
            while True:
                existing = await session.execute(
                    select(Team).where(Team.id == team_id)
                )
                if not existing.scalar_one_or_none():
                    break
                team_id = self._generate_team_id()

            # Create team
            team = Team(
                id=team_id,
                name=team_name,
                admin_id=admin_id
            )
            session.add(team)

            # Add admin as member
            member = TeamMember(
                team_id=team_id,
                user_id=admin_id,
                is_admin=True
            )
            session.add(member)

            await session.commit()
            await session.refresh(team)

            logger.info(f"Team created: {team_name} ({team_id}) by user {admin_id}")
            return team

    async def join_team(self, team_id: str, user_id: str) -> Team:
        """Join a team by ID"""
        async with async_session_factory() as session:
            # Check if team exists
            team_result = await session.execute(
                select(Team).where(Team.id == team_id)
            )
            team = team_result.scalar_one_or_none()

            if not team:
                raise ValueError("Team not found")

            # Check if user is already a member
            existing_result = await session.execute(
                select(TeamMember).where(
                    and_(
                        TeamMember.team_id == team_id,
                        TeamMember.user_id == user_id
                    )
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                raise ValueError("User already in team")

            # Add user as member
            member = TeamMember(
                team_id=team_id,
                user_id=user_id,
                is_admin=False
            )
            session.add(member)

            await session.commit()

            logger.info(f"User {user_id} joined team {team_id}")
            return team

    async def leave_team(self, team_id: str, user_id: str) -> Optional[Team]:
        """Leave a team"""
        async with async_session_factory() as session:
            # Get team and member
            team_result = await session.execute(
                select(Team).where(Team.id == team_id)
            )
            team = team_result.scalar_one_or_none()

            if not team:
                raise ValueError("Team not found")

            member_result = await session.execute(
                select(TeamMember).where(
                    and_(
                        TeamMember.team_id == team_id,
                        TeamMember.user_id == user_id
                    )
                )
            )
            member = member_result.scalar_one_or_none()

            if not member:
                raise ValueError("User not in team")

            # Remove member
            await session.delete(member)

            # If admin is leaving, transfer admin to another member
            if team.admin_id == user_id:
                other_members = await session.execute(
                    select(TeamMember).where(
                        and_(
                            TeamMember.team_id == team_id,
                            TeamMember.user_id != user_id
                        )
                    )
                )
                other_member = other_members.first()

                if other_member:
                    team.admin_id = other_member.user_id
                    other_member.is_admin = True
                    logger.info(f"Admin transferred to {other_member.user_id} in team {team_id}")
                else:
                    # No other members, delete team
                    await session.delete(team)
                    await session.commit()
                    logger.info(f"Team {team_id} deleted (no members left)")
                    return None

            await session.commit()
            logger.info(f"User {user_id} left team {team_id}")
            return team

    async def get_team(self, team_id: str) -> Optional[Team]:
        """Get team by ID"""
        async with async_session_factory() as session:
            result = await session.execute(
                select(Team).where(Team.id == team_id)
            )
            return result.scalar_one_or_none()

    async def get_user_teams(self, user_id: str) -> List[Team]:
        """Get all teams for a user"""
        async with async_session_factory() as session:
            result = await session.execute(
                select(Team).join(TeamMember).where(TeamMember.user_id == user_id)
            )
            return result.scalars().all()

    async def is_user_in_team(self, user_id: str, team_id: str) -> bool:
        """Check if user is in team"""
        async with async_session_factory() as session:
            result = await session.execute(
                select(TeamMember).where(
                    and_(
                        TeamMember.team_id == team_id,
                        TeamMember.user_id == user_id
                    )
                )
            )
            return result.scalar_one_or_none() is not None

    async def is_team_admin(self, user_id: str, team_id: str) -> bool:
        """Check if user is team admin"""
        async with async_session_factory() as session:
            result = await session.execute(
                select(Team).where(
                    and_(
                        Team.id == team_id,
                        Team.admin_id == user_id
                    )
                )
            )
            return result.scalar_one_or_none() is not None

    async def get_team_stats(self, team_id: str) -> Dict:
        """Get team statistics"""
        async with async_session_factory() as session:
            # Count members
            members_result = await session.execute(
                select(func.count(TeamMember.id)).where(TeamMember.team_id == team_id)
            )
            total_members = members_result.scalar() or 0

            # Count tasks
            tasks_result = await session.execute(
                select(func.count(Task.id)).where(Task.team_id == team_id)
            )
            total_tasks = tasks_result.scalar() or 0

            # Count completed tasks
            completed_result = await session.execute(
                select(func.count(Task.id)).where(
                    and_(
                        Task.team_id == team_id,
                        Task.completed == True
                    )
                )
            )
            completed_tasks = completed_result.scalar() or 0

            # Count overdue tasks
            overdue_result = await session.execute(
                select(func.count(Task.id)).where(
                    and_(
                        Task.team_id == team_id,
                        Task.completed == False,
                        Task.due_date < datetime.utcnow()
                    )
                )
            )
            overdue_tasks = overdue_result.scalar() or 0

            active_tasks = total_tasks - completed_tasks
            completion_rate = int((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0

            return {
                "total_members": total_members,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "active_tasks": active_tasks,
                "overdue_tasks": overdue_tasks,
                "completion_rate": completion_rate
            }

    async def assign_task_to_team(self, task_id: int, team_id: str, assigned_by: str):
        """Assign a personal task to team"""
        async with async_session_factory() as session:
            # Get the task
            task_result = await session.execute(
                select(Task).where(Task.id == task_id)
            )
            task = task_result.scalar_one_or_none()

            if not task:
                raise ValueError("Task not found")

            if task.user_id != assigned_by:
                raise ValueError("Can only assign your own tasks")

            # Check if team exists and user is member
            if not await self.is_user_in_team(assigned_by, team_id):
                raise ValueError("User not in team")

            # Assign to team
            task.team_id = team_id
            task.assigned_by = assigned_by

            await session.commit()
            logger.info(f"Task {task_id} assigned to team {team_id} by user {assigned_by}")

    async def complete_team_task(self, team_id: str, task_id: int, completed_by: str, note: str = ""):
        """Complete a team task"""
        async with async_session_factory() as session:
            # Get the task
            task_result = await session.execute(
                select(Task).where(
                    and_(
                        Task.id == task_id,
                        Task.team_id == team_id
                    )
                )
            )
            task = task_result.scalar_one_or_none()

            if not task:
                raise ValueError("Task not found")

            if task.completed:
                raise ValueError("Task already completed")

            # Check if user is team member
            if not await self.is_user_in_team(completed_by, team_id):
                raise ValueError("User not in team")

            # Complete task
            task.completed = True
            task.completed_at = datetime.utcnow()
            task.completed_by = completed_by
            if note:
                task.notes = f"{task.notes}\n\nCompletion note: {note}" if task.notes else f"Completion note: {note}"

            await session.commit()
            logger.info(f"Team task {task_id} completed by user {completed_by}")

    async def get_team_members_info(self, team_id: str) -> List[Dict]:
        """Get detailed team member information"""
        async with async_session_factory() as session:
            # Get team members with user info
            result = await session.execute(
                select(TeamMember, User).join(User, TeamMember.user_id == User.id).where(TeamMember.team_id == team_id)
            )
            members_data = result.all()

            members_info = []

            for member, user in members_data:
                # Count tasks assigned by this member
                assigned_result = await session.execute(
                    select(func.count(Task.id)).where(
                        and_(
                            Task.team_id == team_id,
                            Task.assigned_by == user.id
                        )
                    )
                )
                tasks_assigned = assigned_result.scalar() or 0

                # Count tasks completed by this member
                completed_result = await session.execute(
                    select(func.count(Task.id)).where(
                        and_(
                            Task.team_id == team_id,
                            Task.completed_by == user.id
                        )
                    )
                )
                tasks_completed = completed_result.scalar() or 0

                members_info.append({
                    "id": user.id,
                    "name": user.full_name,
                    "username": user.username,
                    "is_admin": member.is_admin,
                    "joined_at": member.joined_at,
                    "tasks_assigned": tasks_assigned,
                    "tasks_completed": tasks_completed
                })

            return members_info

    def format_team_info(self, team: Team, stats: Dict, user_role: str = "member") -> str:
        """Format team information for display"""
        from app.utils.formatters import ModernUI

        role_emoji = "👑" if user_role == "admin" else "👤"

        header = f"👥 {role_emoji} **{team.name}**"
        subheader = f"*Team ID: {team.id}*"

        info_text = (
            f"🆔 **Kod:** `{team.id}`\n"
            f"👥 **A'zolar:** {stats['total_members']} kishi\n"
            f"📝 **Vazifalar:** {stats['total_tasks']} ta\n"
            f"✅ **Bajarilgan:** {stats['completed_tasks']} ta\n"
            f"⏳ **Faol:** {stats['active_tasks']} ta\n"
            f"⚠️ **Muddati o'tgan:** {stats['overdue_tasks']} ta\n"
            f"📈 **Bajarish darajasi:** {stats['completion_rate']}%\n"
            f"📅 **Yaratilgan:** {team.created_at.strftime('%d.%m.%Y')}"
        )

        return ModernUI.create_header(header, subheader) + "\n" + ModernUI.create_section("📊 MA'LUMOTLAR", info_text)