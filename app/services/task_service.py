from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from app.database import Task, User, async_session_factory
from typing import List, Optional
from datetime import datetime

class TaskService:
    async def create_task(
        self,
        title: str,
        description: str,
        created_by: int,
        assigned_to: Optional[int] = None,
        team_id: Optional[int] = None,
        priority: TaskPriority = TaskPriority.MEDIUM,
        due_date: Optional[datetime] = None
    ) -> Task:
        async with async_session_factory() as session:
            task = Task(
                title=title,
                description=description,
                created_by=created_by,
                assigned_to=assigned_to or created_by,
                team_id=team_id,
                priority=priority,
                due_date=due_date
            )
            session.add(task)
            await session.commit()
            await session.refresh(task)
            return task

    async def get_user_tasks(
        self,
        user_id: int,
        status: Optional[TaskStatus] = None
    ) -> List[Task]:
        async with async_session_factory() as session:
            query = select(Task).options(
                joinedload(Task.assignee),
                joinedload(Task.creator),
                joinedload(Task.team)
            ).where(Task.assigned_to == user_id)

            if status:
                query = query.where(Task.status == status)

            result = await session.execute(query.order_by(Task.created_at.desc()))
            return result.scalars().all()

    async def get_team_tasks(
        self,
        team_id: int,
        status: Optional[TaskStatus] = None
    ) -> List[Task]:
        async with async_session_factory() as session:
            query = select(Task).options(
                joinedload(Task.assignee),
                joinedload(Task.creator),
                joinedload(Task.team)
            ).where(Task.team_id == team_id)

            if status:
                query = query.where(Task.status == status)

            result = await session.execute(query.order_by(Task.created_at.desc()))
            return result.scalars().all()

    async def update_task_status(
        self,
        task_id: int,
        status: TaskStatus,
        user_id: int
    ) -> Optional[Task]:
        async with async_session_factory() as session:
            result = await session.execute(
                select(Task).where(
                    and_(
                        Task.id == task_id,
                        or_(Task.assigned_to == user_id, Task.created_by == user_id)
                    )
                )
            )
            task = result.scalar_one_or_none()

            if task:
                task.status = status
                if status == TaskStatus.COMPLETED:
                    task.completed_at = datetime.utcnow()

                await session.commit()
                await session.refresh(task)

            return task

    async def get_task_by_id(
        self,
        task_id: int,
        user_id: int
    ) -> Optional[Task]:
        async with async_session_factory() as session:
            result = await session.execute(
                select(Task).options(
                    joinedload(Task.assignee),
                    joinedload(Task.creator),
                    joinedload(Task.team)
                ).where(
                    and_(
                        Task.id == task_id,
                        or_(Task.assigned_to == user_id, Task.created_by == user_id)
                    )
                )
            )
            return result.scalar_one_or_none()

    def format_task(self, task: Task) -> str:
        status_emoji = {
            TaskStatus.TODO: "📝",
            TaskStatus.IN_PROGRESS: "🔄",
            TaskStatus.COMPLETED: "✅",
            TaskStatus.CANCELLED: "❌"
        }

        priority_emoji = {
            TaskPriority.LOW: "🟢",
            TaskPriority.MEDIUM: "🟡",
            TaskPriority.HIGH: "🟠",
            TaskPriority.URGENT: "🔴"
        }

        text = f"{status_emoji.get(task.status, '📝')} *Task #{task.id}*\n"
        text += f"*Title:* {task.title}\n"

        if task.description:
            text += f"*Description:* {task.description[:100]}{'...' if len(task.description) > 100 else ''}\n"

        text += f"*Priority:* {priority_emoji.get(task.priority, '🟡')} {task.priority.value.title()}\n"
        text += f"*Status:* {task.status.value.replace('_', ' ').title()}\n"

        if task.assignee:
            text += f"*Assigned to:* {task.assignee.first_name or task.assignee.username}\n"

        if task.team:
            text += f"*Team:* {task.team.name}\n"

        if task.due_date:
            text += f"*Due:* {task.due_date.strftime('%Y-%m-%d %H:%M')}\n"

        text += f"*Created:* {task.created_at.strftime('%Y-%m-%d %H:%M')}"

        return text