import { Router, Request, Response } from 'express';
import { PostService } from '../services/post.service';
import { CommentService } from '../services/comment.service';
import { PostQueryOptions, CommentQueryOptions } from '../interfaces/query-options';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const postService = new PostService();
const commentService = new CommentService();

/**
 * @swagger
 * /api/posts:
 *   get:
 *     tags: [Posts]
 *     summary: Get all posts (with access control)
 *     description: Retrieve all posts that the authenticated user has access to
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of posts to return (default 100)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of posts to skip before starting to collect the result set
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *         description: Column to order by (default inserted_at)
 *       - in: query
 *         name: orderDirection
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *         description: Sort direction (default DESC)
 *       - in: query
 *         name: page_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter posts by page id
 *       - in: query
 *         name: page_url
 *         schema:
 *           type: string
 *         description: Filter posts by exact page URL
 *       - in: query
 *         name: page_name
 *         schema:
 *           type: string
 *         description: Filter posts by exact page name
 *       - in: query
 *         name: full_url
 *         schema:
 *           type: string
 *         description: Filter posts by exact post URL
 *       - in: query
 *         name: includeComments
 *         schema:
 *           type: boolean
 *         description: Include comments in the response
 *       - in: query
 *         name: includeSentiments
 *         schema:
 *           type: boolean
 *         description: Include sentiments in the response
 *       - in: query
 *         name: includeReactions
 *         schema:
 *           type: boolean
 *         description: Include reactions in the response
 *       - in: query
 *         name: includePage
 *         schema:
 *           type: boolean
 *         description: Include page details in the response (default true)
 *       - in: query
 *         name: sentiment
 *         schema:
 *           type: string
 *           enum: [positive, negative, neutral]
 *         description: Filter posts by sentiment category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search posts by content (case-insensitive partial match)
 *     responses:
 *       200:
 *         description: Successfully retrieved posts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const limitParam = Number(req.query.limit);
    const offsetParam = Number(req.query.offset);
    const includeComments = req.query.includeComments === 'true';
    const includeSentiments = req.query.includeSentiments === 'true';
    const includeReactions = req.query.includeReactions === 'true';
    const includePage = req.query.includePage === 'false' ? false : true;

    const options: PostQueryOptions = {
      limit: Number.isFinite(limitParam) && limitParam > -1 ? limitParam : 100,
      offset: Number.isFinite(offsetParam) && offsetParam > -1 ? offsetParam : 0,
      orderBy: typeof req.query.orderBy === 'string' ? req.query.orderBy : 'inserted_at',
      orderDirection: req.query.orderDirection === 'ASC' ? 'ASC' : 'DESC',
      includeComments,
      includeSentiments,
      includeReactions,
      includePage,
      page_id: typeof req.query.page_id === 'string' ? req.query.page_id : undefined,
      page_url: typeof req.query.page_url === 'string' ? req.query.page_url : undefined,
      page_name: typeof req.query.page_name === 'string' ? req.query.page_name : undefined,
      full_url: typeof req.query.full_url === 'string' ? req.query.full_url : undefined,
      sentiment: typeof req.query.sentiment === 'string' ? req.query.sentiment : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    };

    const posts = await postService.getAllPostsWithAccess(
      req.user!.userId,
      req.user!.role,
      options
    );

    if (!includePage) {
      posts.forEach((post) => {
        delete post.page;
      });
    }

    return res.json({
      success: true,
      data: posts,
      count: posts.length,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     tags: [Posts]
 *     summary: Get post by ID (with access control)
 *     description: Retrieve a specific post if user has access
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Post UUID
 *       - in: query
 *         name: includeComments
 *         schema:
 *           type: boolean
 *         description: Include post comments in the response
 *       - in: query
 *         name: includeSentiments
 *         schema:
 *           type: boolean
 *         description: Include post-level sentiments (default true)
 *       - in: query
 *         name: includeReactions
 *         schema:
 *           type: boolean
 *         description: Include reactions summary (default true)
 *       - in: query
 *         name: includePage
 *         schema:
 *           type: boolean
 *         description: Include page details (default true)
 *     responses:
 *       200:
 *         description: Post found
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Post not found or no access
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const includePage = req.query.includePage === 'false' ? false : true;
    const includeReactions = req.query.includeReactions === 'false' ? false : true;
    const options: PostQueryOptions = {
      includeSentiments: req.query.includeSentiments === 'false' ? false : true,
      includeReactions,
      includeComments: req.query.includeComments === 'true',
      includePage,
    };

    const post = await postService.getPostByIdWithAccess(
      id,
      req.user!.userId,
      req.user!.role,
      options
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found or access denied',
      });
    }

    if (!includePage) {
      delete post.page;
    }

    return res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch post',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/posts/{id}/comments:
 *   get:
 *     tags: [Posts]
 *     summary: Get comments for a specific post (with access control)
 *     description: Retrieve all comments for a post if user has access to the post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Post UUID
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied to post
 *       404:
 *         description: Post not found or no access
 */
router.get('/:id/comments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const options: CommentQueryOptions = {
      limit: 100,
      offset: 0,
      orderBy: 'inserted_at',
      orderDirection: 'DESC',
      post_id: id,
      includeUser: true,
      includeSentiments: true,
    };

    // First check if user has access to the post
    const post = await postService.getPostByIdWithAccess(
      id,
      req.user!.userId,
      req.user!.role,
      {}
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found or access denied',
      });
    }

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
    console.error('Error fetching post comments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

