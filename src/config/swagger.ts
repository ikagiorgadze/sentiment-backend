import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sentiment Database API',
      version: '1.0.0',
      description: 'A comprehensive REST API for querying sentiment analysis data from Facebook posts and comments',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fb_profile_id: { type: 'string', nullable: true },
            full_name: { type: 'string', nullable: true },
            inserted_at: { type: 'string', format: 'date-time' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            page_id: { type: 'string', format: 'uuid', nullable: true },
            full_url: { type: 'string', nullable: true },
            content: { type: 'string', nullable: true },
            posted_at: { type: 'string', format: 'date-time', nullable: true },
            inserted_at: { type: 'string', format: 'date-time' },
            page: {
              $ref: '#/components/schemas/Page',
              nullable: true,
            },
          },
        },
        Page: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            page_url: { type: 'string', nullable: true },
            page_name: { type: 'string', nullable: true },
            inserted_at: { type: 'string', format: 'date-time' },
          },
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            full_url: { type: 'string', nullable: true },
            post_id: { type: 'string', format: 'uuid', nullable: true },
            user_id: { type: 'string', format: 'uuid', nullable: true },
            content: { type: 'string', nullable: true },
            inserted_at: { type: 'string', format: 'date-time' },
          },
        },
        Sentiment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            post_id: { type: 'string', format: 'uuid', nullable: true },
            comment_id: { type: 'string', format: 'uuid', nullable: true },
            sentiment: { type: 'string', nullable: true },
            sentiment_category: { type: 'string', nullable: true },
            confidence: { type: 'number', nullable: true },
            probabilities: { type: 'object', nullable: true },
            polarity: { type: 'number', nullable: true },
            inserted_at: { type: 'string', format: 'date-time' },
          },
        },
        AuthUser: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            last_login: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            count: { type: 'integer' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Posts', description: 'Posts operations' },
      { name: 'Comments', description: 'Comments operations' },
      { name: 'Users', description: 'Users operations' },
      { name: 'Sentiments', description: 'Sentiments operations' },
      { name: 'Analytics', description: 'Advanced analytics and aggregations' },
      { name: 'Pages', description: 'Pages operations' },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);





