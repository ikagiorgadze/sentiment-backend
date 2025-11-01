#!/usr/bin/env bash
# Debug script to test the build locally on EC2

echo "=========================================="
echo "🔍 Debugging Build Process"
echo "=========================================="

# Check if tsc is hanging
echo ""
echo "1️⃣ Testing TypeScript compilation with timeout..."
cd ~/sentiment-backend

# Kill any existing tsc processes
pkill -f "node.*tsc" || true

# Try building with a timeout
echo "Running: timeout 120s npm run build"
if timeout 120s npm run build; then
  echo "✅ Build completed successfully in under 2 minutes"
else
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "❌ Build timed out after 2 minutes - tsc is hanging!"
    echo ""
    echo "Checking for zombie tsc processes..."
    ps aux | grep tsc
  else
    echo "❌ Build failed with exit code: $EXIT_CODE"
  fi
fi

echo ""
echo "2️⃣ Checking Node.js memory..."
node -e "console.log('Node heap size:', require('v8').getHeapStatistics().heap_size_limit / (1024*1024), 'MB')"

echo ""
echo "3️⃣ Checking available disk space..."
df -h ~

echo ""
echo "4️⃣ Checking available memory..."
free -h

echo ""
echo "5️⃣ Checking if any TypeScript processes are running..."
ps aux | grep -E "tsc|typescript" | grep -v grep || echo "No TypeScript processes found"

echo ""
echo "=========================================="
echo "Debug complete"
echo "=========================================="
