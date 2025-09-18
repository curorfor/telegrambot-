from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters
from app.config import settings
from app.bot.handlers import start, prayer_times, callback_handler

def create_bot_application():
    application = Application.builder().token(settings.BOT_TOKEN).build()

    # Essential handlers
    application.add_handler(CommandHandler("start", start.start_command))
    application.add_handler(CommandHandler("prayer", prayer_times.prayer_command))
    application.add_handler(CommandHandler("location", prayer_times.location_command))

    # TODO: Re-enable after fixing task/team imports
    # application.add_handler(CommandHandler("tasks", tasks.tasks_command))
    # application.add_handler(CommandHandler("newtask", tasks.new_task_command))
    # application.add_handler(CommandHandler("mytasks", tasks.my_tasks_command))
    # application.add_handler(CommandHandler("team", teams.team_command))
    # application.add_handler(CommandHandler("createteam", teams.create_team_command))
    # application.add_handler(CommandHandler("jointeam", teams.join_team_command))
    # application.add_handler(CommandHandler("settings", settings_handler.settings_command))

    application.add_handler(CallbackQueryHandler(callback_handler.callback_query_handler))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, start.message_handler))

    return application

bot_application = create_bot_application()