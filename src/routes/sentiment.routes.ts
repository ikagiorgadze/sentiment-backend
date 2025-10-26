import { Router, Request, Response } from 'express';
import { SentimentService } from '../services/sentiment.service';
import { SentimentQueryOptions } from '../interfaces/query-options';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const sentimentService = new SentimentService();

/**
 * @swagger
 * /api/sentiments:
 *   get:
 *     tags: [Sentiments]
 *     summary: Get all sentiments (with access control)
 *     description: Retrieve sentiments with filtering options that user has access to
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
 *         name: comment_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by comment ID
 *       - in: query
 *         name: sentiment_category
 *         schema:
 *           type: string
 *         description: Filter by sentiment category
 *       - in: query
 *         name: minConfidence
 *         schema:
 *           type: number
 *         description: Minimum confidence threshold
 *       - in: query
 *         name: maxConfidence
 *         schema:
 *           type: number
 *         description: Maximum confidence threshold
 *       - in: query
 *         name: onlyPostSentiments
 *         schema:
 *           type: boolean
 *         description: Only sentiments where comment_id IS NULL
 *       - in: query
 *         name: onlyCommentSentiments
 *         schema:
 *           type: boolean
 *         description: Only sentiments where comment_id IS NOT NULL
 *       - in: query
 *         name: includePost
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeComment
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Successfully retrieved sentiments
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const options: SentimentQueryOptions = {
      limit: 100,
      offset: 0,
      orderBy: (req.query.orderBy as string) || 'inserted_at',
      orderDirection: (req.query.orderDirection as 'ASC' | 'DESC') || 'DESC',
      post_id: req.query.post_id as string,
      comment_id: req.query.comment_id as string,
      sentiment_category: req.query.sentiment_category as string,
      includePost: req.query.includePost === 'true',
      includeComment: req.query.includeComment === 'true',
      minConfidence: req.query.minConfidence
        ? parseFloat(req.query.minConfidence as string)
        : undefined,
      maxConfidence: req.query.maxConfidence
        ? parseFloat(req.query.maxConfidence as string)
        : undefined,
      onlyPostSentiments: req.query.onlyPostSentiments === 'true',
      onlyCommentSentiments: req.query.onlyCommentSentiments === 'true',
    };

    const sentiments = await sentimentService.getAllSentimentsWithAccess(
      req.user!.userId,
      req.user!.role,
      options
    );
    
    return res.json({
      success: true,
      data: sentiments,
      count: sentiments.length,
    });
  } catch (error) {
    console.error('Error fetching sentiments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/sentiments/{id}:
 *   get:
 *     tags: [Sentiments]
 *     summary: Get sentiment by ID (with access control)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: includePost
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeComment
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Sentiment found
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Sentiment not found or access denied
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const options: SentimentQueryOptions = {
      includePost: req.query.includePost === 'true',
      includeComment: req.query.includeComment === 'true',
    };

    const sentiment = await sentimentService.getSentimentByIdWithAccess(
      id,
      req.user!.userId,
      req.user!.role,
      options
    );

    if (!sentiment) {
      return res.status(404).json({
        success: false,
        error: 'Sentiment not found or access denied',
      });
    }

    return res.json({
      success: true,
      data: sentiment,
    });
  } catch (error) {
    console.error('Error fetching sentiment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
 
// TODO endpoints for manual analysis (to be implemented)
// Accept arrays of IDs and return empty body for now
router.post('/analyze/posts', authenticateToken, async (_req: Request, res: Response) => {
  // TODO: Implement manual post sentiment analysis trigger
  return res.status(202).send();
});

router.post('/analyze/comments', authenticateToken, async (_req: Request, res: Response) => {
  // TODO: Implement manual comment sentiment analysis trigger
  return res.status(202).send();
});

