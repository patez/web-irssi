# Stage 1: Build stage
FROM node:24-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./

# Install build tools for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && npm ci --only=production

# Stage 2: Runtime stage
FROM node:24-bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    irssi \
    tmux \
    sqlite3 \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Create user (Debian uses useradd)
RUN useradd -m -s /bin/bash webircuser

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=webircuser:webircuser . .

RUN mkdir -p irssi-sessions logs && \
    chown -R webircuser:webircuser /app

USER webircuser
EXPOSE 3001

CMD ["node", "server/index.js"]