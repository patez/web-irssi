#!/bin/bash

# --- Configuration ---
APP_NAME="web-irssi-prod"
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Starting deployment for $APP_NAME..."

# 1. Pull latest code (if using git)
git pull origin main

# 2. Pre-build cleanup to save RAM/Disk
# This removes "dangling" build layers before we start a new one
docker builder prune -f

# 3. Build and Start
# --build: Forces recompilation of node-pty
# -d: Runs in background
echo "🛠️ Building containers... (This may take a few mins on a VPS)"
docker-compose -f $COMPOSE_FILE up --build -d

# 4. Post-build cleanup
# Removes the old images that are now 'untagged'
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment successful!"
echo "📈 Status:"
docker-compose -f $COMPOSE_FILE ps