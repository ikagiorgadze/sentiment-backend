import { Router, Request, Response } from 'express';
import { CommentService } from '../services/comment.service';
import { CommentQueryOptions } from '../interfaces/query-options';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const commentService = new CommentService();

/**
 * @swagger
 * /api/comments:
 *   get:
 *     tags: [Comments]
 *     summary: Get all comments (with access control)
 *     description: Retrieve comments with optional filtering and related data that user has access to
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
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: includeUser
 *         schema:
 *           type: boolean
 *         description: Include user information
 *       - in: query
 *         name: includePost
 *         schema:
 *           type: boolean
 *         description: Include post information
 *       - in: query
 *         name: includeSentiments
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Successfully retrieved comments
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const options: CommentQueryOptions = {
      limit: 100,
      offset: 0,
      orderBy: (req.query.orderBy as string) || 'inserted_at',
      orderDirection: (req.query.orderDirection as 'ASC' | 'DESC') || 'DESC',
      post_id: req.query.post_id as string,
      user_id: req.query.user_id as string,
      full_url: req.query.full_url as string,
      includeUser: req.query.includeUser === 'true',
      includePost: req.query.includePost === 'true',
      includeSentiments: req.query.includeSentiments === 'true',
    };

    const comments = await commentService.getAllCommentsWithAccess(
      req.user!.userId,
      req.user!.role,
      options
    );
    
    return res.json({
      success: true,
      data: comments,
      count: comments.length,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/comments/{id}:
 *   get:
 *     tags: [Comments]
 *     summary: Get comment by ID (with access control)
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
 *         name: includeUser
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includePost
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeSentiments
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Comment found
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Comment not found or access denied
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const options: CommentQueryOptions = {
      includeUser: req.query.includeUser === 'true',
      includePost: req.query.includePost === 'true',
      includeSentiments: req.query.includeSentiments === 'true',
    };

    const comment = await commentService.getCommentByIdWithAccess(
      id,
      req.user!.userId,
      req.user!.role,
      options
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found or access denied',
      });
    }

    return res.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error fetching comment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch comment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

