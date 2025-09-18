from telegram import Update
from telegram.ext import ContextTypes
from app.services.team_service import TeamService
from app.bot.keyboards import get_team_keyboard

async def team_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👥 *Team Management*\n\n"
        "Collaborate with your team members on tasks and projects.",
        parse_mode="Markdown",
        reply_markup=get_team_keyboard()
    )

async def create_team_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "➕ *Create New Team*\n\n"
            "Usage: `/createteam <name> | <description>`\n\n"
            "Example: `/createteam Development Team | Our awesome dev team`\n\n"
            "You can also use: `/createteam <name>` for a simple team without description.",
            parse_mode="Markdown"
        )
        return

    team_text = " ".join(context.args)

    if " | " in team_text:
        name, description = team_text.split(" | ", 1)
    else:
        name = team_text
        description = ""

    team_service = TeamService()

    try:
        team = await team_service.create_team(
            name=name.strip(),
            description=description.strip(),
            admin_id=update.effective_user.id
        )

        await update.message.reply_text(
            f"✅ *Team Created Successfully!*\n\n"
            f"*Name:* {team.name}\n"
            f"*Description:* {team.description or 'No description'}\n"
            f"*Team ID:* `{team.id}`\n\n"
            f"Share the Team ID with others so they can join using `/jointeam {team.id}`",
            parse_mode="Markdown"
        )

    except Exception as e:
        await update.message.reply_text(
            f"❌ Error creating team: {str(e)}"
        )

async def join_team_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "🔗 *Join Team*\n\n"
            "Usage: `/jointeam <team_id>`\n\n"
            "Example: `/jointeam 123`\n\n"
            "Ask your team admin for the Team ID.",
            parse_mode="Markdown"
        )
        return

    try:
        team_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text(
            "❌ Invalid Team ID. Please provide a valid number."
        )
        return

    team_service = TeamService()

    try:
        team = await team_service.add_team_member(
            team_id=team_id,
            user_id=update.effective_user.id
        )

        if team:
            await update.message.reply_text(
                f"✅ *Successfully joined team!*\n\n"
                f"*Team:* {team.name}\n"
                f"*Description:* {team.description or 'No description'}\n\n"
                f"You can now collaborate with your team members!",
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(
                "❌ Team not found or you're already a member."
            )

    except Exception as e:
        await update.message.reply_text(
            f"❌ Error joining team: {str(e)}"
        )