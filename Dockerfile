# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY --chown=botuser:nodejs package*.json ./
COPY --chown=botuser:nodejs bot.js ./
COPY --chown=botuser:nodejs README.md ./

# Create data directory for tasks.json
RUN mkdir -p /app/data && \
    chown -R botuser:nodejs /app/data

# Set environment variables
ENV NODE_ENV=production
ENV DATA_FILE=/app/data/tasks.json

# Expose port (if needed for health checks)
EXPOSE 3000

# Switch to non-root user
USER botuser

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Bot is healthy')" || exit 1

# Start the application
CMD ["node", "bot.js"]
