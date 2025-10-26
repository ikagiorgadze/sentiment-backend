# GitHub Actions Deployment Setup

This guide will help you configure automated deployment of the sentiment-backend to your EC2 instance.

## Prerequisites

### 1. EC2 Instance
- **Same EC2 instance** as sentiment-infra
- Ubuntu/Amazon Linux
- Node.js 18+ installed
- PM2 installed globally (`npm install -g pm2`)
- User in `docker` group (for network access)
- SSH access configured

### 2. sentiment-infra Deployed
The backend requires the infra services to be running:
- PostgreSQL (port 5432)
- n8n (port 5678)
- Docker network: `sentiment-infra_app-network`

## Required GitHub Secrets

Go to your repository: **Settings → Secrets and variables → Actions → New repository secret**

### SSH Connection (3 secrets)

#### 1. `EC2_HOST`
- **Value**: Your EC2 public IP address
- **Example**: `54.123.45.67`

#### 2. `EC2_USER`
- **Value**: SSH username
- **Example**: `ubuntu` (Ubuntu) or `ec2-user` (Amazon Linux)

#### 3. `EC2_SSH_KEY`
- **Value**: Your private SSH key (the entire key including headers)
- **Example**:
  ```
  -----BEGIN RSA PRIVATE KEY-----
  MIIEpAIBAAKCAQEA...
  ...
  -----END RSA PRIVATE KEY-----
  ```

### Database Configuration (3 secrets - REUSE from sentiment-infra)

#### 4. `POSTGRES_USER`
- **Value**: PostgreSQL username
- **Example**: `appuser`
- **⚠️ MUST MATCH** sentiment-infra `POSTGRES_USER`

#### 5. `POSTGRES_PASSWORD`
- **Value**: PostgreSQL password
- **Example**: `your_secure_password`
- **⚠️ MUST MATCH** sentiment-infra `POSTGRES_PASSWORD`

#### 6. `POSTGRES_DB`
- **Value**: Database name
- **Example**: `facebook_analysis`
- **⚠️ MUST MATCH** sentiment-infra `POSTGRES_DB`

### Backend-Specific Configuration (3 secrets)

#### 7. `JWT_SECRET`
- **Value**: Random secret string for JWT signing
- **Generate**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- **Example**: `a1b2c3d4e5f6...` (128 characters)
- **⚠️ CRITICAL**: Keep this secret! Anyone with this can forge JWT tokens.

#### 8. `JWT_EXPIRES_IN` (Optional)
- **Value**: Token expiration time
- **Default**: `7d` (7 days)
- **Examples**: `24h`, `7d`, `30d`

#### 9. `N8N_WEBHOOK_URL` (Optional)
- **Value**: n8n webhook endpoint
- **Default**: `http://sentiment-infra-n8n-1:5678/webhook/ingest/scrape`
- **Only set if** you have a custom n8n URL

---

## Secrets Summary

| Secret Name | Required | Source | Example |
|------------|----------|--------|---------|
| `EC2_HOST` | ✅ | Your EC2 | `54.123.45.67` |
| `EC2_USER` | ✅ | Your EC2 | `ubuntu` |
| `EC2_SSH_KEY` | ✅ | Your SSH key | `-----BEGIN RSA...` |
| `POSTGRES_USER` | ✅ | sentiment-infra | `appuser` |
| `POSTGRES_PASSWORD` | ✅ | sentiment-infra | `secure_password` |
| `POSTGRES_DB` | ✅ | sentiment-infra | `facebook_analysis` |
| `JWT_SECRET` | ✅ | Generate new | `a1b2c3d4e5f6...` |
| `JWT_EXPIRES_IN` | ⬜ | Optional | `7d` |
| `N8N_WEBHOOK_URL` | ⬜ | Optional | `http://...` |

**Total**: 7 required + 2 optional = **9 secrets**

---

## Workflow Overview

The GitHub Actions workflow (`.github/workflows/deploy.yml`) performs these steps:

### 1. **Setup SSH**
- Configures SSH key for EC2 access
- Handles host key verification
- Falls back to non-interactive mode if needed

### 2. **Copy Files**
- Uses `rsync` to copy files to `~/sentiment-backend/` on EC2
- Excludes: `.git`, `node_modules`, `dist`, `_*.md` (breadcrumbs)

### 3. **Create Environment File**
- Runs `scripts/setup-env.sh`
- Generates `.env` file from GitHub secrets
- Configures database, n8n, JWT settings

### 4. **Deploy Backend**
- Runs `scripts/deploy.sh`
- Installs dependencies (`npm ci`)
- Builds TypeScript (`npm run build`)
- Joins Docker network (if needed)
- Restarts PM2 process

### 5. **Health Check**
- Runs `scripts/health-check.sh`
- Verifies PM2 process is running
- Checks port 3000 is listening
- Tests `/health` endpoint
- Validates Docker network connection

### 6. **Deployment Summary**
- Displays success message
- Shows URLs and next steps

---

## Trigger Deployment

### Automatic
Push to `main` branch:
```bash
git add .
git commit -m "Deploy backend"
git push origin main
```

### Manual
Go to: **Actions → Deploy Backend to EC2 → Run workflow**

---

## Monitoring Deployment

### View GitHub Actions Logs
1. Go to repository → **Actions** tab
2. Click on the latest workflow run
3. Click on the "deploy" job
4. Expand each step to see logs

### SSH to EC2 and Check Status
```bash
# SSH into EC2
ssh ubuntu@<EC2_IP>

# Check PM2 status
pm2 status

# View logs
pm2 logs sentiment-backend

# Check health endpoint
curl http://localhost:3000/health

# View recent logs
tail -f ~/sentiment-backend/logs/out.log
```

---

## Post-Deployment Verification

### 1. Health Check
```bash
curl http://<EC2_IP>:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-26T12:34:56.789Z",
  "uptime": 123.45,
  "database": "connected"
}
```

### 2. API Documentation
Open in browser: `http://<EC2_IP>:3000/`

You should see Swagger UI with API documentation.

### 3. Test Database Connection
```bash
ssh ubuntu@<EC2_IP>
cd ~/sentiment-backend
npm run test:db
```

### 4. Test n8n Integration
```bash
curl -X POST http://<EC2_IP>:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{"urls": ["https://facebook.com/page1"], "type": "page"}'
```

---

## Security Notes

### Port 3000 Access
- **Internal only**: EC2 security group should block external access to port 3000
- **Frontend**: Can access backend on `http://localhost:3000` (same EC2)
- **Public**: Should only access through a reverse proxy (nginx, ALB, etc.)

### JWT Secret
- **Critical**: Never commit `JWT_SECRET` to git
- **Rotate**: Change periodically (will invalidate all existing tokens)
- **Generate**: Use cryptographically secure random strings

### Database Credentials
- **Sync**: Must match sentiment-infra secrets exactly
- **Secure**: Use strong passwords
- **Network**: Database only accessible via Docker network (not exposed to internet)

---

## Troubleshooting

### Deployment Fails at "Copy files"
**Cause**: SSH connection issue
**Solution**: 
- Verify `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` secrets
- Check EC2 security group allows SSH (port 22) from GitHub Actions IPs
- Try manual SSH: `ssh -i ~/.ssh/key.pem ubuntu@<EC2_IP>`

### Deployment Fails at "Deploy Backend"
**Cause**: Missing dependencies or build error
**Solution**:
- SSH to EC2 and check logs: `cat ~/sentiment-backend/logs/err.log`
- Verify Node.js and npm are installed
- Check PM2 is installed globally: `pm2 --version`

### Health Check Fails
**Cause**: Backend not starting or database connection issue
**Solution**:
- SSH to EC2: `ssh ubuntu@<EC2_IP>`
- Check PM2 logs: `pm2 logs sentiment-backend`
- Verify Docker network: `docker network ls | grep sentiment-infra`
- Test database connection: `cd ~/sentiment-backend && npm run test:db`

### "Cannot resolve sentiment-infra-postgres-1"
**Cause**: Not connected to Docker network
**Solution**:
- SSH to EC2
- Run: `cd ~/sentiment-backend && bash scripts/join-docker-network.sh`
- Verify: `docker network inspect sentiment-infra_app-network`

See `TROUBLESHOOTING.md` for more detailed solutions.

---

## Next Steps

After successful deployment:

1. **Configure Frontend**
   - Set backend URL in frontend: `http://<EC2_IP>:3000`
   - Update CORS settings if needed

2. **Set Up Monitoring**
   - Configure PM2 monitoring: `pm2 monitor`
   - Set up log rotation: `pm2 install pm2-logrotate`

3. **Add Reverse Proxy** (Optional)
   - Install nginx
   - Configure SSL/TLS
   - Proxy `/api` → `localhost:3000`

4. **Database Migrations**
   - Backend will auto-create tables on first connection
   - Run `sentiment-infra/initdb/*.sql` scripts if needed

---

## Useful Commands

### PM2 Management
```bash
pm2 status                    # Check status
pm2 logs sentiment-backend    # View logs
pm2 restart sentiment-backend # Restart
pm2 stop sentiment-backend    # Stop
pm2 delete sentiment-backend  # Remove
```

### Manual Deployment
```bash
ssh ubuntu@<EC2_IP>
cd ~/sentiment-backend
git pull
bash scripts/deploy.sh
```

### View Logs
```bash
# PM2 logs
pm2 logs sentiment-backend --lines 100

# File logs
tail -f ~/sentiment-backend/logs/out.log
tail -f ~/sentiment-backend/logs/err.log
```

### Health Check
```bash
curl http://localhost:3000/health
```

---

## Support

If you encounter issues:
1. Check GitHub Actions logs
2. SSH to EC2 and check PM2 logs
3. Review `TROUBLESHOOTING.md`
4. Check Docker network connectivity
5. Verify all secrets are configured correctly
