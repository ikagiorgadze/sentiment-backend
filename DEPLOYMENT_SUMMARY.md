# Backend Deployment - Quick Start Summary

## ✅ What Has Been Created

### GitHub Actions Workflow
- `.github/workflows/deploy.yml` - Automated deployment on push to main

### Deployment Scripts
- `scripts/setup-env.sh` - Generate .env file from secrets
- `scripts/deploy.sh` - Main deployment orchestration
- `scripts/health-check.sh` - Verify deployment success
- `scripts/join-docker-network.sh` - Connect to Docker network

### Configuration
- `ecosystem.config.js` - PM2 process configuration
- `.gitignore` - Updated to exclude breadcrumbs, logs, .env

### Documentation
- `GITHUB_ACTIONS_SETUP.md` - Complete setup guide
- `TROUBLESHOOTING.md` - Common issues and solutions

### Breadcrumb Files (Internal, not committed)
- `_DEPLOYMENT_ARCHITECTURE.md` - Architecture overview
- `_ENVIRONMENT_VARIABLES.md` - Environment variable reference
- `_PROJECT_STRUCTURE.md` - Project structure documentation

---

## 🚀 Next Steps

### 1. Configure GitHub Secrets (Required)
Go to repository Settings → Secrets and variables → Actions

**SSH Connection** (3):
- `EC2_HOST` - EC2 IP address
- `EC2_USER` - SSH username (ubuntu/ec2-user)
- `EC2_SSH_KEY` - Private SSH key (entire content)

**Database** (3 - reuse from sentiment-infra):
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

**Backend** (3):
- `JWT_SECRET` - Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `JWT_EXPIRES_IN` - Optional, default: 7d
- `N8N_WEBHOOK_URL` - Optional, default: http://sentiment-infra-n8n-1:5678/webhook/ingest/scrape

### 2. Prepare EC2 Instance

```bash
# SSH into EC2
ssh ubuntu@<EC2_IP>

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js and npm
node --version  # Should be 18.x or higher
npm --version

# Install PM2 globally (requires sudo)
sudo npm install -g pm2

# Verify PM2 installation
pm2 --version

# Ensure user is in docker group (for network access)
sudo usermod -aG docker $USER
sudo systemctl restart docker
# Log out and back in for group changes to take effect
```

### 3. Deploy Backend

**Option A: Push to trigger deployment**
```bash
# In sentiment-backend directory
git add .
git commit -m "Setup backend deployment"
git push origin main
```

**Option B: Manual deployment (first time)**
```bash
# SSH to EC2
ssh ubuntu@<EC2_IP>

# Clone repository (if not already)
git clone <your-repo-url> ~/sentiment-backend
cd ~/sentiment-backend

# Create .env manually or run setup-env.sh
# Then run deployment
bash scripts/deploy.sh
```

### 4. Verify Deployment

```bash
# Check health endpoint
curl http://<EC2_IP>:3000/health

# View PM2 status
pm2 status

# View logs
pm2 logs sentiment-backend
```

---

## 📋 Deployment Architecture

```
┌─────────────────────────────────────────────┐
│           EC2 Instance                       │
│                                              │
│  ┌────────────────────────────────────┐    │
│  │  Docker Network: app-network       │    │
│  │                                     │    │
│  │  ┌──────────┐  ┌──────────┐       │    │
│  │  │PostgreSQL│  │   n8n    │       │    │
│  │  │  :5432   │  │  :5678   │       │    │
│  │  └──────────┘  └──────────┘       │    │
│  └────────────────────────────────────┘    │
│           ▲             ▲                    │
│           │             │                    │
│  ┌────────┴─────────────┴─────────────┐    │
│  │   Backend (PM2)                     │    │
│  │   Port 3000 (internal)              │    │
│  │   ~/sentiment-backend/              │    │
│  └─────────────────────────────────────┘    │
│           ▲                                  │
│           │                                  │
│  ┌────────┴─────────────────────────────┐  │
│  │   Frontend (to be deployed)          │  │
│  │   Port 5173                           │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Key Points**:
- Backend runs with **PM2** (not Docker)
- Connects to **PostgreSQL** via Docker network
- Calls **n8n** webhooks via Docker network  
- **Port 3000** is internal only (blocked by security group)
- Frontend accesses backend via localhost:3000

---

## 🔐 Security Checklist

- [ ] `JWT_SECRET` is a cryptographically strong random string
- [ ] `POSTGRES_PASSWORD` matches sentiment-infra
- [ ] EC2 security group blocks port 3000 from internet
- [ ] SSH key is kept secure and not committed to git
- [ ] `.env` file is in `.gitignore`
- [ ] Breadcrumb `_*.md` files are in `.gitignore`

---

## 📚 Documentation Reference

1. **GITHUB_ACTIONS_SETUP.md** - Start here for setup instructions
2. **TROUBLESHOOTING.md** - If something goes wrong
3. **_DEPLOYMENT_ARCHITECTURE.md** - Architecture details (breadcrumb)
4. **_ENVIRONMENT_VARIABLES.md** - Environment reference (breadcrumb)
5. **_PROJECT_STRUCTURE.md** - Code structure (breadcrumb)

---

## 🛠️ Useful Commands

### PM2 Management
```bash
pm2 status                    # Check status
pm2 logs sentiment-backend    # View logs
pm2 restart sentiment-backend # Restart
pm2 monit                     # Monitor resources
```

### Health Check
```bash
curl http://localhost:3000/health
```

### Manual Deployment
```bash
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

### Database Connection Test
```bash
cd ~/sentiment-backend
npm run test:db
```

---

## ⚠️ Before First Deployment

1. ✅ sentiment-infra must be deployed first (PostgreSQL, n8n running)
2. ✅ All 9 GitHub secrets configured
3. ✅ EC2 has Node.js 18+ and PM2 installed
4. ✅ User is in docker group
5. ✅ Port 3000 blocked from internet (security group)

---

## 🎯 Expected Outcome

After successful deployment:

1. **GitHub Actions** workflow completes successfully ✅
2. **PM2** shows backend process as "online" ✅
3. **Health endpoint** returns 200 OK ✅
4. **Database connection** works ✅
5. **API docs** accessible at http://\<EC2_IP\>:3000/ ✅

---

## 📞 Support

If you run into issues:
1. Check GitHub Actions logs
2. SSH to EC2 and run: `pm2 logs sentiment-backend`
3. Review TROUBLESHOOTING.md
4. Verify all prerequisites are met

---

## 🎉 You're Ready!

The backend deployment infrastructure is complete. When you're ready to deploy:

1. Configure the 9 GitHub secrets
2. Prepare the EC2 instance
3. Push to main branch
4. Monitor the deployment in GitHub Actions
5. Verify with health checks

Good luck with your deployment! 🚀
