# Dockerfile (Debian-based - Best UTF-8 Support)
# Use this if Alpine locale issues persist

FROM node:24-trixie-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    irssi \
    tmux \
    sqlite3 \
    wget \
    locales \
    && rm -rf /var/lib/apt/lists/*

# Generate UTF-8 locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
    locale-gen en_US.UTF-8

# Set locale environment
ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    LANGUAGE=en_US:en

# Remove conflicting users
RUN deluser --remove-home node 2>/dev/null || true
RUN deluser git 2>/dev/null || true

# Create non-root user
RUN useradd -r -m -s /bin/bash -u 1000 webircuser

WORKDIR /app

# Copy package files
COPY --chown=webircuser:webircuser package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY --chown=webircuser:webircuser . .

# Create directories
RUN mkdir -p irssi-sessions logs && \
    chown -R webircuser:webircuser /app

# Switch to non-root user
USER webircuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:3001 || exit 1

# Start application
CMD ["node", "server/index.js"]