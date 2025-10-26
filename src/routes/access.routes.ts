import { Router, Request, Response } from 'express';
import { AccessService } from '../services/access.service';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const accessService = new AccessService();

/**
 * @swagger
 * /api/access/grant:
 *   post:
 *     summary: Grant user access to a post (Admin only)
 *     tags: [Access]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authUserId
 *               - postId
 *             properties:
 *               authUserId:
 *                 type: string
 *               postId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access granted successfully
 *       403:
 *         description: Admin access required
 */
router.post('/grant', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { authUserId, postId } = req.body;

    if (!authUserId || !postId) {
      res.status(400).json({
        success: false,
        error: 'authUserId and postId are required',
      });
      return;
    }

    const access = await accessService.grantAccess(
      authUserId,
      postId,
      req.user!.userId
    );

    res.json({
      success: true,
      data: access,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/access/revoke:
 *   delete:
 *     summary: Revoke user access to a post (Admin only)
 *     tags: [Access]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authUserId
 *               - postId
 *             properties:
 *               authUserId:
 *                 type: string
 *               postId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access revoked successfully
 *       403:
 *         description: Admin access required
 */
router.delete('/revoke', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { authUserId, postId } = req.body;

    if (!authUserId || !postId) {
      res.status(400).json({
        success: false,
        error: 'authUserId and postId are required',
      });
      return;
    }

    await accessService.revokeAccess(authUserId, postId);

    res.json({
      success: true,
      message: 'Access revoked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/access/user/{userId}:
 *   get:
 *     summary: Get all posts a user has access to (Admin only)
 *     tags: [Access]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of post IDs
 *       403:
 *         description: Admin access required
 */
router.get('/user/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const postIds = await accessService.getUserPosts(userId);

    res.json({
      success: true,
      data: {
        userId,
        postIds,
        count: postIds.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/access/post/{postId}:
 *   get:
 *     summary: Get all users who have access to a post (Admin only)
 *     tags: [Access]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users with access
 *       403:
 *         description: Admin access required
 */
router.get('/post/:postId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const users = await accessService.getPostUsers(postId);

    res.json({
      success: true,
      data: {
        postId,
        users,
        count: users.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/access/grant-bulk-post:
 *   post:
 *     summary: Grant multiple users access to one post (Admin only)
 *     tags: [Access]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *               - postId
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               postId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk access granted successfully
 *       403:
 *         description: Admin access required
 */
router.post('/grant-bulk-post', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userIds, postId } = req.body;

    if (!userIds || !Array.isArray(userIds) || !postId) {
      res.status(400).json({
        success: false,
        error: 'userIds (array) and postId are required',
      });
      return;
    }

    const results = await accessService.grantBulkAccessToPost(
      userIds,
      postId,
      req.user!.userId
    );

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/access/grant-bulk-user:
 *   post:
 *     summary: Grant one user access to multiple posts (Admin only)
 *     tags: [Access]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authUserId
 *               - postIds
 *             properties:
 *               authUserId:
 *                 type: string
 *               postIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk access granted successfully
 *       403:
 *         description: Admin access required
 */
router.post('/grant-bulk-user', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { authUserId, postIds } = req.body;

    if (!authUserId || !postIds || !Array.isArray(postIds)) {
      res.status(400).json({
        success: false,
        error: 'authUserId and postIds (array) are required',
      });
      return;
    }

    const results = await accessService.grantBulkAccessToUser(
      authUserId,
      postIds,
      req.user!.userId
    );

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

