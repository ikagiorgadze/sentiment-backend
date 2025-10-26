#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "🐳 Connecting to Docker network..."
echo "=========================================="

NETWORK_NAME="sentiment-infra_app-network"
CONTAINER_NAME="sentiment-backend-bridge"

# Check if Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker is not installed or not in PATH"
  exit 1
fi

# Check if network exists
if ! docker network ls | grep -q "${NETWORK_NAME}"; then
  echo "❌ Docker network '${NETWORK_NAME}' not found"
  echo "   Make sure sentiment-infra is deployed first!"
  exit 1
fi

# Check if we're already connected
if docker network inspect "${NETWORK_NAME}" 2>/dev/null | grep -q "${CONTAINER_NAME}"; then
  echo "✅ Already connected to Docker network"
  exit 0
fi

echo "Creating bridge container to join Docker network..."

# Create a long-running container that does nothing
# This allows the host to resolve Docker container names
docker run -d \
  --name "${CONTAINER_NAME}" \
  --network "${NETWORK_NAME}" \
  --restart unless-stopped \
  alpine:latest \
  sleep infinity

echo "✅ Connected to Docker network: ${NETWORK_NAME}"
echo ""
echo "You can now access:"
echo "  - sentiment-infra-postgres-1:5432"
echo "  - sentiment-infra-n8n-1:5678"
