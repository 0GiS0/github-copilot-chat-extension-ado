# Multi-stage build for optimized Docker image
FROM node:20-alpine AS base

# Install necessary packages
RUN apk add --no-cache \
    dumb-init \
    curl \
    git

# Create app directory
WORKDIR /app

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM base AS dependencies

# Copy package files for server
COPY src/server/package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Install GitHub Copilot CLI globally
RUN npm install -g @github/copilot

# ============================================
# Stage 2: Production image
# ============================================
FROM base AS production

# Set environment variables
ENV NODE_ENV=production \
    COPILOT_PORT=3000 \
    LOG_LEVEL=info

# Copy dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /usr/local/lib/node_modules/@github /usr/local/lib/node_modules/@github
COPY --from=dependencies /usr/local/bin/copilot /usr/local/bin/copilot

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
    CMD curl -f http://localhost:${COPILOT_PORT}/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "index.js"]
