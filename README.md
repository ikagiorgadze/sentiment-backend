# Sentiment Analysis Backend

TypeScript/Express REST API for sentiment analysis application. Manages database operations, authentication, and integrates with n8n workflows for web scraping.

## 🚀 Quick Start

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm ci
npm run build
npm start
```

## 📦 Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL
- **Process Manager**: PM2
- **Authentication**: JWT
- **API Docs**: Swagger

## 🏗️ Architecture

- **Deployment**: PM2 on EC2 (not Dockerized)
- **Database**: Connects to PostgreSQL via Docker network
- **n8n Integration**: Calls webhooks for scraping workflows
- **Port**: 3000 (internal only)

## 📋 Environment Variables

See `_ENVIRONMENT_VARIABLES.md` for complete reference.

Required:
- `DATABASE_HOST` - PostgreSQL host (Docker container name)
- `DATABASE_PORT` - PostgreSQL port (5432)
- `DATABASE_NAME` - Database name
- `DATABASE_USER` - Database user
- `DATABASE_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing secret
- `N8N_WEBHOOK_URL` - n8n webhook endpoint
- `PORT` - Server port (3000)
- `NODE_ENV` - Environment (production/development)

## 🔧 Deployment

### Automated (GitHub Actions)

1. Configure GitHub secrets (see `GITHUB_ACTIONS_SETUP.md`)
2. Push to main branch
3. GitHub Actions deploys automatically

### Manual

```bash
cd ~/sentiment-backend
bash scripts/deploy.sh
```

## 📚 Documentation

- **[GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)** - Automated deployment setup
- **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Quick deployment overview
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[_DEPLOYMENT_ARCHITECTURE.md](./_DEPLOYMENT_ARCHITECTURE.md)** - Architecture details (internal)
- **[_ENVIRONMENT_VARIABLES.md](./_ENVIRONMENT_VARIABLES.md)** - Environment reference (internal)
- **[_PROJECT_STRUCTURE.md](./_PROJECT_STRUCTURE.md)** - Code structure (internal)

## 🔌 API Endpoints

### Public
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /health` - Health check

### Protected (JWT required)
- `/api/users/*` - User management
- `/api/pages/*` - Page CRUD
- `/api/posts/*` - Post CRUD
- `/api/comments/*` - Comment CRUD
- `/api/scrape/*` - Initiate scraping
- `/api/scrape/status/*` - Check scraping progress
- `/api/sentiment/*` - Sentiment analysis
- `/api/analytics/*` - Analytics queries
- `/api/dashboard/*` - Dashboard data
- `/api/access/*` - Access control

### Internal (n8n callbacks)
- `POST /api/webhooks/scrape-complete` - n8n scraping callback

## 🛠️ Development

### Scripts

```bash
npm run dev        # Start dev server with hot-reload
npm run build      # Compile TypeScript
npm start          # Start production server
npm run test:db    # Test database connection
```

### Project Structure

```
src/
├── app.ts              # Express app setup
├── server.ts           # Entry point
├── config/             # Configuration
│   ├── auth.ts         # JWT config
│   ├── database.ts     # PostgreSQL config
│   └── swagger.ts      # API docs config
├── interfaces/         # TypeScript interfaces
├── middleware/         # Express middleware
├── repositories/       # Database operations
├── routes/             # API routes
├── services/           # Business logic
└── utils/              # Utilities
```

## 🔐 Security

- JWT authentication for protected endpoints
- Password hashing with bcrypt
- CORS configured for frontend
- Port 3000 not exposed to internet (internal only)
- Environment variables for sensitive data

## 📊 Monitoring

### PM2 Commands
```bash
pm2 status                    # Check status
pm2 logs sentiment-backend    # View logs
pm2 monit                     # Monitor resources
pm2 restart sentiment-backend # Restart
```

### Health Check
```bash
curl http://localhost:3000/health
```

## 🐛 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

### Quick Diagnostics
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs sentiment-backend --lines 50

# Test database connection
npm run test:db

# Check health endpoint
curl http://localhost:3000/health
```

## 🤝 Dependencies

### Core
- express - Web framework
- pg - PostgreSQL client
- dotenv - Environment variables
- cors - CORS middleware

### Security
- bcryptjs - Password hashing
- jsonwebtoken - JWT tokens

### Integration
- axios - HTTP client (n8n webhooks)

### Documentation
- swagger-jsdoc - API docs
- swagger-ui-express - API docs UI

## 📝 License

ISC

## 🙋 Support

- Check documentation in `docs/` folder
- Review `TROUBLESHOOTING.md` for common issues
- Check GitHub Actions logs for deployment issues
- SSH to EC2 and check PM2 logs

---

**Status**: ✅ Deployment infrastructure complete. Ready for deployment once GitHub secrets are configured.
