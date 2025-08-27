# Railway-compatible Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV DATA_FILE=/app/data/tasks.json

# Expose port for Railway
EXPOSE $PORT

# Start the application
CMD ["node", "bot.js"]
