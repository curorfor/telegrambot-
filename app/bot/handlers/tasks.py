from telegram import Update
from telegram.ext import ContextTypes
from app.services.task_service import TaskService
from app.services.user_service import UserService
from app.models.task import TaskPriority, TaskStatus
from app.bot.keyboards import get_task_keyboard, get_task_status_keyboard

async def tasks_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "✅ *Task Management*\n\n"
        "What would you like to do?",
        parse_mode="Markdown",
        reply_markup=get_task_keyboard()
    )

async def new_task_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "📝 *Create New Task*\n\n"
            "Usage: `/newtask <title> | <description>`\n\n"
            "Example: `/newtask Complete project report | Finish the quarterly report by Friday`\n\n"
            "You can also use: `/newtask <title>` for a simple task without description.",
            parse_mode="Markdown"
        )
        return

    task_text = " ".join(context.args)

    if " | " in task_text:
        title, description = task_text.split(" | ", 1)
    else:
        title = task_text
        description = ""

    task_service = TaskService()

    try:
        task = await task_service.create_task(
            title=title.strip(),
            description=description.strip(),
            created_by=update.effective_user.id,
            priority=TaskPriority.MEDIUM
        )

        formatted_task = task_service.format_task(task)

        await update.message.reply_text(
            f"✅ *Task Created Successfully!*\n\n{formatted_task}",
            parse_mode="Markdown"
        )

    except Exception as e:
        await update.message.reply_text(
            f"❌ Error creating task: {str(e)}"
        )

async def my_tasks_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    task_service = TaskService()

    try:
        tasks = await task_service.get_user_tasks(update.effective_user.id)

        if not tasks:
            await update.message.reply_text(
                "📝 You don't have any tasks yet.\n\n"
                "Use /newtask to create your first task!",
                reply_markup=get_task_keyboard()
            )
            return

        text = f"📋 *Your Tasks ({len(tasks)} total)*\n\n"

        pending_tasks = [t for t in tasks if t.status in [TaskStatus.TODO, TaskStatus.IN_PROGRESS]]
        completed_tasks = [t for t in tasks if t.status == TaskStatus.COMPLETED]

        if pending_tasks:
            text += "🔄 *Active Tasks:*\n"
            for task in pending_tasks[:5]:
                text += f"• {task.title} ({task.status.value.replace('_', ' ').title()})\n"

            if len(pending_tasks) > 5:
                text += f"... and {len(pending_tasks) - 5} more\n"

        if completed_tasks:
            text += f"\n✅ *Completed:* {len(completed_tasks)} tasks\n"

        text += "\nUse the buttons below to manage your tasks."

        await update.message.reply_text(
            text,
            parse_mode="Markdown",
            reply_markup=get_task_keyboard()
        )

    except Exception as e:
        await update.message.reply_text(
            f"❌ Error fetching tasks: {str(e)}"
        )