from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton

def get_main_keyboard():
    keyboard = [
        [KeyboardButton("🕌 Prayer Times"), KeyboardButton("✅ My Tasks")],
        [KeyboardButton("👥 Teams"), KeyboardButton("⚙️ Settings")],
        [KeyboardButton("📍 Set Location"), KeyboardButton("❓ Help")]
    ]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

def get_prayer_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("Today", callback_data="prayer_today"),
            InlineKeyboardButton("Tomorrow", callback_data="prayer_tomorrow")
        ],
        [
            InlineKeyboardButton("Current Week", callback_data="prayer_week"),
            InlineKeyboardButton("Set Location", callback_data="set_location")
        ],
        [InlineKeyboardButton("🔔 Notifications", callback_data="prayer_notifications")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_task_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("📝 New Task", callback_data="new_task"),
            InlineKeyboardButton("📋 My Tasks", callback_data="my_tasks")
        ],
        [
            InlineKeyboardButton("👥 Team Tasks", callback_data="team_tasks"),
            InlineKeyboardButton("✅ Completed", callback_data="completed_tasks")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_team_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("➕ Create Team", callback_data="create_team"),
            InlineKeyboardButton("🔗 Join Team", callback_data="join_team")
        ],
        [
            InlineKeyboardButton("👥 My Teams", callback_data="my_teams"),
            InlineKeyboardButton("👑 Admin Panel", callback_data="admin_panel")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_settings_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("📍 Location", callback_data="settings_location"),
            InlineKeyboardButton("🔔 Notifications", callback_data="settings_notifications")
        ],
        [
            InlineKeyboardButton("🌍 Language", callback_data="settings_language"),
            InlineKeyboardButton("⏰ Timezone", callback_data="settings_timezone")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_task_status_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("📝 To Do", callback_data="status_todo"),
            InlineKeyboardButton("🔄 In Progress", callback_data="status_progress")
        ],
        [
            InlineKeyboardButton("✅ Completed", callback_data="status_completed"),
            InlineKeyboardButton("❌ Cancelled", callback_data="status_cancelled")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_task_priority_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("🟢 Low", callback_data="priority_low"),
            InlineKeyboardButton("🟡 Medium", callback_data="priority_medium")
        ],
        [
            InlineKeyboardButton("🟠 High", callback_data="priority_high"),
            InlineKeyboardButton("🔴 Urgent", callback_data="priority_urgent")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)