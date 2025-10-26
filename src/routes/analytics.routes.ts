import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { QueryOptions } from '../interfaces/query-options';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const analyticsService = new AnalyticsService();

const parseIntQuery = (value: unknown, defaultValue: number): number => {
  if (typeof value !== 'string') return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

/**
 * @swagger
 * /api/analytics/posts/{postId}/users:
 *   get:
 *     tags: [Analytics]
 *     summary: Get users who commented on a post
 *     description: Retrieve all users who commented on a specific post with comment counts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           default: comment_count
 *           enum: [comment_count, last_comment_at, username, full_name, email, inserted_at]
 *       - in: query
 *         name: orderDirection
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *     responses:
 *       200:
 *         description: Successfully retrieved users
 */
router.get('/posts/:postId/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user!;
    const { postId } = req.params;
    const options: QueryOptions = {
      limit: parseIntQuery(req.query.limit, 100),
      offset: parseIntQuery(req.query.offset, 0),
      orderBy: (req.query.orderBy as string) || 'comment_count',
      orderDirection:
        typeof req.query.orderDirection === 'string' && req.query.orderDirection.toUpperCase() === 'ASC'
          ? 'ASC'
          : 'DESC',
    };

    const users = await analyticsService.getUsersByPostId(postId, authUser.userId, authUser.role, options);
    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error('Error fetching users by post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/analytics/users/{userId}/posts:
 *   get:
 *     tags: [Analytics]
 *     summary: Get posts where user commented
 *     description: Retrieve all posts where a specific user has commented
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           default: last_comment_at
 *           enum: [last_comment_at, user_comment_count, inserted_at, posted_at, page_name, page_url]
 *       - in: query
 *         name: orderDirection
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *     responses:
 *       200:
 *         description: Successfully retrieved posts
 */
router.get('/users/:userId/posts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user!;
    const { userId } = req.params;
    const options: QueryOptions = {
      limit: parseIntQuery(req.query.limit, 100),
      offset: parseIntQuery(req.query.offset, 0),
      orderBy: (req.query.orderBy as string) || 'last_comment_at',
      orderDirection:
        typeof req.query.orderDirection === 'string' && req.query.orderDirection.toUpperCase() === 'ASC'
          ? 'ASC'
          : 'DESC',
    };

    const posts = await analyticsService.getPostsByUserId(userId, authUser.userId, authUser.role, options);
    res.json({
      success: true,
      data: posts,
      count: posts.length,
    });
  } catch (error) {
    console.error('Error fetching posts by user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/analytics/posts/{postId}/sentiments:
 *   get:
 *     tags: [Analytics]
 *     summary: Get post-level sentiments
 *     description: Get sentiments for the post itself (where comment_id IS NULL)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Post sentiments retrieved
 */
router.get('/posts/:postId/sentiments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user!;
    const { postId } = req.params;
    const sentiments = await analyticsService.getPostSentiments(postId, authUser.userId, authUser.role);
    res.json({
      success: true,
      data: sentiments,
      count: sentiments.length,
    });
  } catch (error) {
    console.error('Error fetching post sentiments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/analytics/posts/{postId}/comment-sentiments:
 *   get:
 *     tags: [Analytics]
 *     summary: Get comment sentiments for a post
 *     description: Get all comment-level sentiments with user details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Comment sentiments retrieved
 */
router.get('/posts/:postId/comment-sentiments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user!;
    const { postId } = req.params;
    const sentiments = await analyticsService.getCommentSentimentsByPostId(postId, authUser.userId, authUser.role);
    res.json({
      success: true,
      data: sentiments,
      count: sentiments.length,
    });
  } catch (error) {
    console.error('Error fetching comment sentiments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comment sentiments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/analytics/posts/{postId}/sentiment-summary:
 *   get:
 *     tags: [Analytics]
 *     summary: Get sentiment summary
 *     description: Get aggregated sentiment statistics (counts, averages by category)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sentiment summary retrieved
 */
router.get('/posts/:postId/sentiment-summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user!;
    const { postId } = req.params;
    const summary = await analyticsService.getPostSentimentSummary(postId, authUser.userId, authUser.role);
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching sentiment summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiment summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/analytics/comments-with-sentiment:
 *   get:
 *     tags: [Analytics]
 *     summary: Get comments with sentiment
 *     description: Retrieve comments with their sentiment analysis included
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: post_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by post ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           default: inserted_at
 *           enum: [inserted_at, sentiment_category, username, full_name]
 *       - in: query
 *         name: orderDirection
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *     responses:
 *       200:
 *         description: Comments with sentiment retrieved
 */
router.get('/comments-with-sentiment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user!;
    const postId = req.query.post_id as string | undefined;
    const options: QueryOptions = {
      limit: parseIntQuery(req.query.limit, 100),
      offset: parseIntQuery(req.query.offset, 0),
      orderBy: (req.query.orderBy as string) || 'inserted_at',
      orderDirection:
        typeof req.query.orderDirection === 'string' && req.query.orderDirection.toUpperCase() === 'ASC'
          ? 'ASC'
          : 'DESC',
    };

    const comments = await analyticsService.getCommentsWithSentiment(postId, authUser.userId, authUser.role, options);
    res.json({
      success: true,
      data: comments,
      count: comments.length,
    });
  } catch (error) {
    console.error('Error fetching comments with sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/analytics/users/{userId}/posts/{postId}/activity:
 *   get:
 *     tags: [Analytics]
 *     summary: Get user activity on post
 *     description: Get user's complete activity (comments + reactions) on a specific post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User activity retrieved
 */
router.get('/users/:userId/posts/:postId/activity', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user!;
    const { userId, postId } = req.params;
    const activity = await analyticsService.getUserActivityOnPost(userId, postId, authUser.userId, authUser.role);
    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user activity',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
