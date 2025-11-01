import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { pool } from './config/database';
import postRoutes from './routes/post.routes';
import commentRoutes from './routes/comment.routes';
import userRoutes from './routes/user.routes';
import sentimentRoutes from './routes/sentiment.routes';
import authRoutes from './routes/auth.routes';
import analyticsRoutes from './routes/analytics.routes';
import pageRoutes from './routes/page.routes';
import seedRoutes from './routes/seed.routes';
import accessRoutes from './routes/access.routes';
import scrapeRoutes from './routes/scrape.routes';
import webhookRoutes from './routes/webhook.routes';
import scrapeStatusRoutes from './routes/scrape-status.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { createChatRoutes } from './routes/chat.routes';

const app: Application = express();

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3001',
    // Add production frontend URL when available
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Sentiment Database API Documentation',
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sentiments', sentimentRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/scrape', scrapeRoutes);
app.use('/api/scrape', scrapeStatusRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/chat', createChatRoutes(pool));

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Sentiment Database API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      access: '/api/access',
      posts: '/api/posts',
      pages: '/api/pages',
      comments: '/api/comments',
      users: '/api/users',
      sentiments: '/api/sentiments',
      analytics: '/api/analytics',
      dashboard: '/api/dashboard',
      seed: '/api/seed',
      scrape: '/api/scrape',
      webhooks: '/api/webhooks',
      chat: '/api/chat',
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

export default app;

