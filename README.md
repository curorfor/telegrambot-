# Telegram To-Do Bot

grammY kutubxonasi yordamida yaratilgan Telegram To-Do bot.

## Xususiyatlari

- ✅ Vazifalar qo'shish (/add)
- 📋 Vazifalar ro'yxatini ko'rish (/tasks)  
- ✅ Vazifalarni bajarilgan deb belgilash (/complete)
- 🗑️ Vazifalarni o'chirish (/delete)
- ⏰ Avtomatik eslatma (notification) tizimi
- 📊 Vazifa darajalari (low, medium, high)
- 💾 JSON fayl orqali ma'lumotlar saqlash

## O'rnatish

1. Loyihani klonlang yoki yuklab oling
2. Dependencylarni o'rnating:
```bash
npm install
```

3. Botni ishga tushiring:
```bash
npm start
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
