# Troubleshooting Guide

Common issues and solutions for backend deployment.

---

## Table of Contents
1. [Deployment Issues](#deployment-issues)
2. [Connection Issues](#connection-issues)
3. [PM2 Issues](#pm2-issues)
4. [Database Issues](#database-issues)
5. [Docker Network Issues](#docker-network-issues)
6. [Performance Issues](#performance-issues)

---

## Deployment Issues

### ❌ GitHub Actions: "Permission denied (publickey)"

**Symptoms**:
```
Permission denied (publickey).
fatal: Could not read from remote repository.
```

**Causes**:
- Incorrect SSH key in `EC2_SSH_KEY` secret
- Wrong EC2 username in `EC2_USER`
- EC2 security group blocking port 22

**Solutions**:
1. Verify SSH key:
   ```bash
   # On your local machine
   cat ~/.ssh/your-key.pem
   # Copy entire output including headers to EC2_SSH_KEY secret
   ```

2. Test SSH manually:
   ```bash
   ssh -i ~/.ssh/your-key.pem ubuntu@<EC2_IP>
   ```

3. Check EC2 security group:
   - Ensure inbound rule allows SSH (port 22) from `0.0.0.0/0`

---

### ❌ GitHub Actions: "rsync: command not found"

**Symptoms**:
```
rsync: command not found
```

**Cause**: rsync not installed on EC2

**Solution**:
```bash
# SSH to EC2
ssh ubuntu@<EC2_IP>

# Install rsync
sudo apt-get update && sudo apt-get install -y rsync  # Ubuntu
sudo yum install -y rsync  # Amazon Linux
```

---

### ❌ GitHub Actions: "npm: command not found"

**Symptoms**:
```
npm: command not found
```

**Cause**: Node.js not installed on EC2

**Solution**:
```bash
# SSH to EC2
ssh ubuntu@<EC2_IP>

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs  # Ubuntu

# Or for Amazon Linux
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

---

### ❌ GitHub Actions: "pm2: command not found"

**Symptoms**:
```
pm2: command not found
```

**Cause**: PM2 not installed globally

**Solution**:
```bash
# SSH to EC2
ssh ubuntu@<EC2_IP>

# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

---

## Connection Issues

### ❌ Backend: "connect ECONNREFUSED sentiment-infra-postgres-1:5432"

**Symptoms**:
```
Error: connect ECONNREFUSED sentiment-infra-postgres-1:5432
```

**Causes**:
- Not connected to Docker network
- PostgreSQL container not running
- Wrong hostname in environment

**Solutions**:

1. **Check Docker network**:
   ```bash
   docker network ls | grep sentiment-infra
   ```

2. **Join Docker network**:
   ```bash
   cd ~/sentiment-backend
   bash scripts/join-docker-network.sh
   ```

3. **Check PostgreSQL container**:
   ```bash
   docker ps | grep postgres
   # Should show: sentiment-infra-postgres-1
   ```

4. **Restart backend**:
   ```bash
   pm2 restart sentiment-backend
   ```

---

### ❌ Backend: "getaddrinfo ENOTFOUND sentiment-infra-postgres-1"

**Symptoms**:
```
Error: getaddrinfo ENOTFOUND sentiment-infra-postgres-1
```

**Cause**: Cannot resolve Docker container hostname

**Solutions**:

1. **Verify Docker network connection**:
   ```bash
   docker network inspect sentiment-infra_app-network
   # Check if sentiment-backend-bridge is listed
   ```

2. **Manually join network**:
   ```bash
   cd ~/sentiment-backend
   bash scripts/join-docker-network.sh
   ```

3. **Alternative: Use localhost** (if PostgreSQL is port-forwarded):
   ```bash
   # Update .env file
   sed -i 's/sentiment-infra-postgres-1/localhost/g' ~/sentiment-backend/.env
   pm2 restart sentiment-backend
   ```

---

### ❌ Frontend: "Network Error" when calling backend

**Symptoms**:
- Frontend shows "Network Error"
- Backend API calls fail from browser

**Causes**:
- CORS not configured
- Backend not accessible from frontend
- Wrong backend URL in frontend

**Solutions**:

1. **Check backend is running**:
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check from frontend server**:
   ```bash
   # If frontend is on same EC2
   curl http://localhost:3000/health
   
   # If frontend is external
   curl http://<EC2_IP>:3000/health
   ```

3. **Update CORS** (if needed):
   - Edit `src/app.ts`
   - Add frontend origin to CORS config
   - Rebuild and restart

4. **Check EC2 security group**:
   - For internal: Allow port 3000 from VPC/subnet
   - For external: Allow port 3000 from `0.0.0.0/0` (not recommended)

---

## PM2 Issues

### ❌ PM2: "Process not found"

**Symptoms**:
```
[PM2] Process sentiment-backend not found
```

**Cause**: Process not started or crashed

**Solutions**:

1. **Check PM2 list**:
   ```bash
   pm2 list
   ```

2. **Start process**:
   ```bash
   cd ~/sentiment-backend
   pm2 start ecosystem.config.js
   ```

3. **Check logs for crash reason**:
   ```bash
   pm2 logs sentiment-backend --lines 50
   cat ~/sentiment-backend/logs/err.log
   ```

---

### ❌ PM2: "Process in errored state"

**Symptoms**:
```
status    : errored
```

**Causes**:
- Application crash on startup
- Port already in use
- Missing dependencies
- Environment variables not set

**Solutions**:

1. **Check error logs**:
   ```bash
   pm2 logs sentiment-backend --err --lines 100
   ```

2. **Check if port 3000 is in use**:
   ```bash
   sudo lsof -i :3000
   # Or
   sudo netstat -tuln | grep 3000
   ```

3. **Kill process using port 3000**:
   ```bash
   sudo kill -9 $(sudo lsof -t -i:3000)
   ```

4. **Restart PM2**:
   ```bash
   pm2 delete sentiment-backend
   cd ~/sentiment-backend
   pm2 start ecosystem.config.js
   ```

---

### ❌ PM2: "Max restarts reached"

**Symptoms**:
```
Error: Script already had too many unstable restarts (10). Stopped.
```

**Cause**: Application crashing repeatedly on startup

**Solutions**:

1. **Check logs**:
   ```bash
   pm2 logs sentiment-backend --lines 100
   cat ~/sentiment-backend/logs/err.log
   ```

2. **Common causes**:
   - Database connection failed → Check PostgreSQL
   - Port in use → Kill conflicting process
   - Missing .env → Run `bash scripts/setup-env.sh`
   - Syntax error → Check build output

3. **Reset PM2 restart count**:
   ```bash
   pm2 delete sentiment-backend
   pm2 start ecosystem.config.js
   ```

---

## Database Issues

### ❌ "password authentication failed for user"

**Symptoms**:
```
Error: password authentication failed for user "appuser"
```

**Causes**:
- Wrong password in .env
- Password doesn't match sentiment-infra PostgreSQL
- Database user doesn't exist

**Solutions**:

1. **Check .env file**:
   ```bash
   cat ~/sentiment-backend/.env | grep DATABASE_PASSWORD
   ```

2. **Verify password matches sentiment-infra**:
   ```bash
   cd ~/sentiment-infra
   cat .env | grep POSTGRES_PASSWORD
   ```

3. **Update .env if needed**:
   ```bash
   # In GitHub, update POSTGRES_PASSWORD secret
   # Then re-run deployment
   ```

4. **Test database connection**:
   ```bash
   cd ~/sentiment-backend
   npm run test:db
   ```

---

### ❌ "database does not exist"

**Symptoms**:
```
Error: database "facebook_analysis" does not exist
```

**Cause**: Database not created yet

**Solutions**:

1. **Check database exists**:
   ```bash
   docker exec -it sentiment-infra-postgres-1 psql -U appuser -l
   ```

2. **Create database**:
   ```bash
   docker exec -it sentiment-infra-postgres-1 psql -U appuser -c "CREATE DATABASE facebook_analysis;"
   ```

3. **Run migrations**:
   ```bash
   cd ~/sentiment-infra
   docker-compose -f docker-compose.production.yml down
   docker-compose -f docker-compose.production.yml up -d
   # initdb scripts will run
   ```

---

### ❌ "relation does not exist"

**Symptoms**:
```
Error: relation "users" does not exist
```

**Cause**: Database tables not created

**Solutions**:

1. **Run SQL schema scripts**:
   ```bash
   cd ~/sentiment-infra
   docker exec -i sentiment-infra-postgres-1 psql -U appuser -d facebook_analysis < initdb/01_schema.sql
   docker exec -i sentiment-infra-postgres-1 psql -U appuser -d facebook_analysis < initdb/02_auth_schema.sql
   docker exec -i sentiment-infra-postgres-1 psql -U appuser -d facebook_analysis < initdb/03_access_control_migration.sql
   docker exec -i sentiment-infra-postgres-1 psql -U appuser -d facebook_analysis < initdb/04_scrape_notifications.sql
   docker exec -i sentiment-infra-postgres-1 psql -U appuser -d facebook_analysis < initdb/05_scrape_jobs.sql
   ```

2. **Verify tables exist**:
   ```bash
   docker exec -it sentiment-infra-postgres-1 psql -U appuser -d facebook_analysis -c "\dt"
   ```

---

## Docker Network Issues

### ❌ "network sentiment-infra_app-network not found"

**Symptoms**:
```
Error: network sentiment-infra_app-network not found
```

**Cause**: sentiment-infra not deployed

**Solution**:
```bash
cd ~/sentiment-infra
docker-compose -f docker-compose.production.yml up -d
```

---

### ❌ "sentiment-backend-bridge already exists"

**Symptoms**:
```
Error: Conflict. The container name "/sentiment-backend-bridge" is already in use
```

**Cause**: Old bridge container still running

**Solutions**:

1. **Remove old container**:
   ```bash
   docker rm -f sentiment-backend-bridge
   ```

2. **Re-join network**:
   ```bash
   cd ~/sentiment-backend
   bash scripts/join-docker-network.sh
   ```

---

## Performance Issues

### ⚠️ Backend slow to respond

**Possible Causes**:
- Database queries not optimized
- No database indexes
- PM2 running out of memory
- High CPU usage

**Solutions**:

1. **Check PM2 memory usage**:
   ```bash
   pm2 monit
   ```

2. **Check database connections**:
   ```bash
   docker exec -it sentiment-infra-postgres-1 psql -U appuser -d facebook_analysis -c "SELECT count(*) FROM pg_stat_activity;"
   ```

3. **Enable PM2 monitoring**:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 10
   ```

4. **Optimize queries**:
   - Add indexes to frequently queried columns
   - Use database connection pooling (already configured)

---

### ⚠️ High memory usage

**Symptoms**:
- PM2 shows high memory usage
- EC2 running out of memory
- Backend becomes unresponsive

**Solutions**:

1. **Check memory usage**:
   ```bash
   free -h
   pm2 monit
   ```

2. **Restart PM2**:
   ```bash
   pm2 restart sentiment-backend
   ```

3. **Add swap space** (if EC2 has low RAM):
   ```bash
   sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

4. **Upgrade EC2 instance type** (if needed)

---

## Quick Diagnostics Checklist

Run these commands to gather diagnostic information:

```bash
# System info
uname -a
node --version
npm --version
pm2 --version

# PM2 status
pm2 status
pm2 describe sentiment-backend

# Logs
pm2 logs sentiment-backend --lines 50 --nostream
tail -50 ~/sentiment-backend/logs/err.log

# Network
netstat -tuln | grep 3000
curl -v http://localhost:3000/health

# Docker
docker ps
docker network ls
docker network inspect sentiment-infra_app-network

# Database
docker exec sentiment-infra-postgres-1 pg_isready -U appuser

# Environment
cat ~/sentiment-backend/.env
```

---

## Getting Help

If you're still stuck:

1. **Collect logs**:
   ```bash
   pm2 logs sentiment-backend --lines 200 > backend-logs.txt
   docker logs sentiment-infra-postgres-1 > postgres-logs.txt
   ```

2. **Check environment**:
   ```bash
   pm2 env 0 > pm2-env.txt
   ```

3. **Share diagnostic info**:
   - GitHub Actions workflow logs
   - PM2 logs
   - Docker logs
   - `.env` file (redact sensitive values!)
   - Output of diagnostic commands above
