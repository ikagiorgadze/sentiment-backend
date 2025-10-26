#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "🚀 Starting deployment process..."
echo "=========================================="

# Prerequisites check
if [ ! -f ".env" ]; then
  echo "❌ .env file not found. Run setup-env.sh first."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm is not installed"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ PM2 is not installed. Installing globally..."
  npm install -g pm2
fi

echo "✅ Prerequisites checked"

# Join Docker network (if not already joined)
echo ""
echo "🐳 Ensuring Docker network connection..."
bash scripts/join-docker-network.sh

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci --production=false

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build

# Create logs directory
mkdir -p logs

# Check if PM2 process exists
if pm2 describe sentiment-backend >/dev/null 2>&1; then
  echo ""
  echo "🔄 Restarting existing PM2 process..."
  pm2 restart sentiment-backend
else
  echo ""
  echo "🚀 Starting new PM2 process..."
  pm2 start ecosystem.config.js
fi

# Save PM2 configuration
pm2 save

# Wait for backend to start
echo ""
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if process is running
if pm2 describe sentiment-backend | grep -q "online"; then
  echo "✅ Backend is running"
else
  echo "❌ Backend failed to start"
  pm2 logs sentiment-backend --lines 20
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="
echo ""
echo "Backend status:"
pm2 describe sentiment-backend
echo ""
echo "To view logs:"
echo "  pm2 logs sentiment-backend"
echo ""
echo "To restart:"
echo "  pm2 restart sentiment-backend"
echo ""
echo "To stop:"
echo "  pm2 stop sentiment-backend"
