# Simple single-stage build for GitHub Copilot CLI Server
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget || true

# Set environment variables
ENV NODE_ENV=production \
    COPILOT_PORT=3000 \
    LOG_LEVEL=info

# Copy server package files
COPY src/server/package*.json ./

# Install dependencies (with retry logic for network issues)
RUN npm install --production || npm install --production || npm install --production && \
    npm cache clean --force

# Install GitHub Copilot CLI globally
RUN npm install -g @github/copilot || npm install -g @github/copilot

# Copy server code
COPY src/server/index.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the server port
EXPOSE ${COPILOT_PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${COPILOT_PORT}/health || exit 1

# Start the server
CMD ["node", "index.js"]
