#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "🐳 Checking Docker network connectivity..."
echo "=========================================="

NETWORK_NAME="sentiment-infra_app-network"

# Check if Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "⚠️  Docker is not installed or not in PATH"
  echo "   This is OK if using localhost for connections"
  exit 0
fi

# Check if network exists
if ! docker network ls | grep -q "${NETWORK_NAME}"; then
  echo "⚠️  Docker network '${NETWORK_NAME}' not found"
  echo "   This is OK if sentiment-infra is not deployed yet"
  echo "   Backend will use localhost for connections"
  exit 0
fi

echo "✅ Docker network '${NETWORK_NAME}' found"
echo ""
echo "ℹ️  Backend connects via localhost to Docker services:"
echo "  - PostgreSQL: localhost:5432"
echo "  - n8n: localhost:5678"
echo ""
echo "   Docker containers expose these ports to the host,"
echo "   so PM2 processes can access them without joining"
echo "   the Docker network."
echo ""
