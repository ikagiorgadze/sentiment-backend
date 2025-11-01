#!/usr/bin/env bash
# Quick fix script to restart all services after EC2 reboot

echo "=========================================="
echo "🔄 Restarting All Services"
echo "=========================================="

# 1. Start Docker containers (PostgreSQL, n8n, Adminer)
echo ""
echo "1️⃣ Starting Docker containers..."
cd ~/sentiment-infra
docker compose up -d

echo ""
echo "⏳ Waiting 10 seconds for PostgreSQL to initialize..."
sleep 10

# 2. Check Docker containers
echo ""
echo "2️⃣ Checking Docker containers..."
docker ps

# 3. Verify PostgreSQL is accessible
echo ""
echo "3️⃣ Testing PostgreSQL connection..."
if nc -zv localhost 5432 2>&1 | grep -q succeeded; then
    echo "✅ PostgreSQL is accessible on localhost:5432"
else
    echo "❌ PostgreSQL is NOT accessible"
    exit 1
fi

# 4. Verify n8n is accessible
echo ""
echo "4️⃣ Testing n8n connection..."
if nc -zv localhost 5678 2>&1 | grep -q succeeded; then
    echo "✅ n8n is accessible on localhost:5678"
else
    echo "❌ n8n is NOT accessible"
    exit 1
fi

# 5. Restart backend
echo ""
echo "5️⃣ Restarting backend..."
cd ~/sentiment-backend
pm2 restart sentiment-backend

echo ""
echo "⏳ Waiting 5 seconds for backend to start..."
sleep 5

# 6. Check backend status
echo ""
echo "6️⃣ Checking backend status..."
pm2 status

# 7. Test backend health
echo ""
echo "7️⃣ Testing backend health..."
if curl -f http://localhost:3000/health 2>/dev/null; then
    echo ""
    echo "✅ Backend is healthy"
else
    echo ""
    echo "❌ Backend health check failed"
    echo "Checking logs..."
    pm2 logs sentiment-backend --lines 20 --nostream
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ All Services Restarted Successfully!"
echo "=========================================="
echo ""
echo "Services Status:"
echo "  🐘 PostgreSQL: localhost:5432"
echo "  🔧 n8n: localhost:5678"
echo "  🚀 Backend: localhost:3000"
echo "  🌐 Frontend: Port 80"
echo ""
echo "Quick checks:"
echo "  docker ps"
echo "  pm2 status"
echo "  curl http://localhost:3000/health"
