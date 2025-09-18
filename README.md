# 🤖 Telegram Todo Bot - FastAPI Version

A modern, feature-rich Telegram bot for task management with team collaboration, built with **FastAPI** and **aiogram**.

## ✨ Features

- 📝 **Task Management**: Create, complete, and organize tasks
- ⏰ **Smart Notifications**: Timely reminders for upcoming tasks
- 👥 **Team Collaboration**: Create teams and assign tasks
- 🕌 **Prayer Times**: Get accurate prayer times with notifications
- 📊 **Statistics**: Track productivity and progress
- 🔔 **Notification System**: Customizable reminder system
- 🌐 **Multi-language**: Uzbek language support

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd telegrambot
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your bot token
   ```

4. **Run migration (if migrating from Node.js)**
   ```bash
   python migrate_data.py
   ```

5. **Start the bot**
   ```bash
   # Development
   python main.py

   # Production with Uvicorn
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

## Buyruqlar

### /start
Botga xush kelibsiz xabari va qo'llanma

### /add
Yangi vazifa qo'shish. Bot ketma-ket so'raydi:
- Vazifa nomi
- Vaqt (format: kk.oo.yy ss:dd, masalan: 21.07.25 14:30)
- Daraja (low, medium, high)

### /tasks
Barcha vazifalar ro'yxatini ko'rsatadi. Har bir vazifada:
- Vazifa nomi
- Vaqti
- Darajasi (🔴 high, 🟡 medium, 🟢 low)
- Holati (⏳ faol, ✅ bajarilgan)

### /complete
Vazifani bajarilgan deb belgilash uchun

### /delete
### /templates
Tayyor vazifa shablonlari orqali tez workflow yaratish

### /prayer
Hudud bo'yicha bugungi namoz vaqtlari. Masalan: `/prayer Toshkent`

### /setprayerregion
Hududni tanlash uchun interaktiv menyu. Ro'yxatdan o'tgan foydalanuvchilarga 15 daqiqa oldin va ayni vaqtda bildirishnomalar yuboriladi.

### /register
Ro'yxatdan o'ting va quyidagilarga ega bo'ling:
- 📨 Yangi funksiyalar haqida avtomatik xabarlar
- 🕌 Namoz vaqti bildirishnomalari (15 daqiqa oldin va ayni vaqtda)
- 🔔 Kelgusidagi maxsus ogohlantirishlar

### /unregister
Barcha yangilanish va namoz bildirishnomalarini o'chirish

### /updates
Hozirgi versiyadagi yangi funksiyalar ro'yxati

Vazifani butunlay o'chirish uchun

## Eslatma tizimi

Bot har daqiqada vazifalar vaqtini tekshiradi va belgilangan vaqt kelganda foydalanuvchiga avtomatik xabar yuboradi.

## Ma'lumotlar saqlash

Barcha ma'lumotlar `tasks.json` faylida saqlanadi. Bu fayl avtomatik yaratiladi va yangilanadi.

## Texnologiyalar

- [grammY](https://grammy.dev/) - Telegram Bot API uchun framework
- [node-cron](https://www.npmjs.com/package/node-cron) - Eslatma tizimi uchun
- Node.js ES Modules

## Bot Token

Bot token `bot.js` faylida o'rnatilgan. Ishlab chiqarish muhitida environment variable sifatida saqlash tavsiya etiladi.

## 🐳 Docker Setup

### Quick Start with Docker Compose

1. **Production deployment:**
```bash
npm run compose:up
```

2. **Development with hot reload:**
```bash
npm run compose:dev
```

3. **Stop services:**
```bash
npm run compose:down
```

### Manual Docker Commands

1. **Build the image:**
```bash
npm run docker:build
# or
docker build -t telegram-todo-bot .
```

2. **Run container:**
```bash
npm run docker:run
# or
docker run -d --name telegram-todo-bot \
  -v telegram_bot_data:/app/data \
  -e NODE_ENV=production \
  -e DATA_FILE=/app/data/tasks.json \
  telegram-todo-bot
```

3. **View logs:**
```bash
npm run docker:logs
# or
docker logs -f telegram-todo-bot
```

4. **Stop and remove:**
```bash
npm run docker:stop
```

### Docker Features

- ✅ **Multi-stage build** - Optimized image size
- ✅ **Non-root user** - Enhanced security
- ✅ **Health checks** - Container monitoring
- ✅ **Volume persistence** - Data retention
- ✅ **Resource limits** - Memory and CPU constraints
- ✅ **Hot reload** - Development mode
- ✅ **Logging** - Structured log management

### Environment Variables

- `DATA_FILE` - Path to tasks JSON file (default: `./tasks.json`)
- `NODE_ENV` - Environment (development/production)
- `BOT_TOKEN` - (optional) Bot token as env var if you externalize it

### Volume Management

Data is persisted in Docker volumes:
- Production: `bot_data`
- Development: `bot_data_dev`

To backup data:
```bash
docker run --rm -v bot_data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data
```

To restore data:
```bash
docker run --rm -v bot_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/backup.tar.gz --strip 1"
```

## Troubleshooting

- If you see "terminated by other getUpdates request", ensure only one instance is running (`docker ps`, `docker stop` others).
- If namoz vaqtlari API sekin javob bersa, bot fallback endpointlardan foydalanadi va natijani kesh qiladi.
