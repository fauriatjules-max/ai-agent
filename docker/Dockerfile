# Stage 1: Builder stage
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    openssh-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY .npmrc ./

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies for production
RUN npm prune --production

# Stage 2: Production stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    curl \
    bash \
    postgresql-client \
    redis \
    tzdata

# Set timezone
ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files from builder
COPY --from=builder /app/package*.json ./

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY --from=builder /app/config ./config
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env.example ./.env.example

# Copy necessary source files for runtime
COPY --from=builder /app/src/database/migrations ./src/database/migrations
COPY --from=builder /app/src/nodes ./src/nodes

# Copy UI files if they exist
COPY --from=builder /app/ui ./ui

# Set ownership to app user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5678/health || exit 1

# Expose port
EXPOSE 5678

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Default command
CMD ["node", "dist/server.js"]
