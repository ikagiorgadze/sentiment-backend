#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "🏥 Running health checks..."
echo "=========================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall health
all_healthy=true

# Check PM2 process
echo ""
echo "Checking PM2 process..."
if pm2 describe sentiment-backend >/dev/null 2>&1; then
  if pm2 describe sentiment-backend | grep -q "online"; then
    echo -e "${GREEN}✅ PM2 process is running${NC}"
  else
    echo -e "${RED}❌ PM2 process exists but is not online${NC}"
    pm2 describe sentiment-backend
    all_healthy=false
  fi
else
  echo -e "${RED}❌ PM2 process not found${NC}"
  all_healthy=false
fi

# Check if port 3000 is listening
echo ""
echo "Checking port 3000..."
if command -v netstat >/dev/null 2>&1; then
  if netstat -tuln | grep -q ":3000 "; then
    echo -e "${GREEN}✅ Port 3000 is listening${NC}"
  else
    echo -e "${RED}❌ Port 3000 is not listening${NC}"
    all_healthy=false
  fi
elif command -v ss >/dev/null 2>&1; then
  if ss -tuln | grep -q ":3000 "; then
    echo -e "${GREEN}✅ Port 3000 is listening${NC}"
  else
    echo -e "${RED}❌ Port 3000 is not listening${NC}"
    all_healthy=false
  fi
else
  echo -e "${YELLOW}⚠️  Cannot check port status (netstat/ss not available)${NC}"
fi

# Check health endpoint
echo ""
echo "Checking health endpoint..."
if command -v curl >/dev/null 2>&1; then
  http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
  
  if [[ "$http_code" == "200" ]]; then
    echo -e "${GREEN}✅ Health endpoint responding (HTTP 200)${NC}"
    
    # Get health response
    health_response=$(curl -s http://localhost:3000/health)
    echo ""
    echo "Health response:"
    echo "$health_response" | grep -E '"status"|"database"|"uptime"' || echo "$health_response"
  else
    echo -e "${RED}❌ Health endpoint not responding properly (HTTP ${http_code})${NC}"
    all_healthy=false
  fi
else
  echo -e "${YELLOW}⚠️  curl not available, skipping health endpoint check${NC}"
fi

# Check Docker network connectivity
echo ""
echo "Checking Docker network connectivity..."
if docker network inspect sentiment-infra_app-network >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Docker network exists${NC}"
  
  # Check if backend container/bridge is connected
  if docker network inspect sentiment-infra_app-network | grep -q "sentiment-backend-bridge"; then
    echo -e "${GREEN}✅ Connected to Docker network${NC}"
  else
    echo -e "${YELLOW}⚠️  Not connected to Docker network (may cause database issues)${NC}"
  fi
else
  echo -e "${RED}❌ Docker network 'sentiment-infra_app-network' not found${NC}"
  echo "   Make sure sentiment-infra is deployed!"
  all_healthy=false
fi

# Display recent logs if something is wrong
if [ "$all_healthy" = false ]; then
  echo ""
  echo -e "${YELLOW}⚠️  Some services are unhealthy. Recent logs:${NC}"
  echo ""
  if pm2 describe sentiment-backend >/dev/null 2>&1; then
    pm2 logs sentiment-backend --lines 30 --nostream
  fi
fi

# Final summary
echo ""
echo "=========================================="
if [ "$all_healthy" = true ]; then
  echo -e "${GREEN}✅ All health checks passed!${NC}"
  echo "=========================================="
  echo ""
  echo "🔗 Backend is ready:"
  echo "   - Health: http://localhost:3000/health"
  echo "   - API Docs: http://localhost:3000/"
  echo ""
  echo "📝 Useful commands:"
  echo "   - View logs: pm2 logs sentiment-backend"
  echo "   - Restart: pm2 restart sentiment-backend"
  echo "   - Status: pm2 status"
  exit 0
else
  echo -e "${RED}❌ Some health checks failed!${NC}"
  echo "=========================================="
  echo ""
  echo "Please check the logs above for more details."
  echo "You can also run: pm2 logs sentiment-backend"
  exit 1
fi
