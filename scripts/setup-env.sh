#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "🔧 Setting up environment variables..."
echo "=========================================="

# Read from stdin or environment
read -r DATABASE_HOST
read -r DATABASE_PORT
read -r DATABASE_NAME
read -r DATABASE_USER
read -r DATABASE_PASSWORD
read -r JWT_SECRET
read -r JWT_EXPIRES_IN
read -r N8N_WEBHOOK_URL
read -r PORT
read -r NODE_ENV

# Create .env file
cat > .env <<EOF
# Database Configuration
DATABASE_HOST=${DATABASE_HOST}
DATABASE_PORT=${DATABASE_PORT}
DATABASE_NAME=${DATABASE_NAME}
DATABASE_USER=${DATABASE_USER}
DATABASE_PASSWORD=${DATABASE_PASSWORD}

# Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN}

# n8n Integration
N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL}

# Server Configuration
PORT=${PORT}
NODE_ENV=${NODE_ENV}
EOF

echo "✅ Environment file created successfully"
echo ""
echo "Configuration summary:"
echo "  - Database: ${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}"
echo "  - n8n: ${N8N_WEBHOOK_URL}"
echo "  - Port: ${PORT}"
echo "  - Environment: ${NODE_ENV}"
