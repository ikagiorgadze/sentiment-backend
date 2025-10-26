import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { WebhookRepository } from '../repositories/webhook.repository';

const router = Router();
const webhookRepository = new WebhookRepository();

/**
 * @swagger
 * /api/scrape/status/{requestId}:
 *   get:
 *     summary: Get scrape status by request ID
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The scrape request ID
 *     responses:
 *       200:
 *         description: Status found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                     stage:
 *                       type: string
 *                       enum: [posts_inserted, sentiment_complete]
 *                     created_at:
 *                       type: string
 *       404:
 *         description: Status not found
 *       401:
 *         description: Not authenticated
 */
router.get('/status/:requestId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'Request ID is required',
      });
    }

    const status = await webhookRepository.getLatestStatus(requestId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Status not found',
        message: 'No notifications found for this request ID',
      });
    }

    // Verify the request belongs to the authenticated user
    if (status.auth_user_id !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this scrape request',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        request_id: status.request_id,
        stage: status.latest_stage,
        created_at: status.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching scrape status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch scrape status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/scrape/user/all:
 *   get:
 *     summary: Get all scrape requests for the authenticated user
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of scrape requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       request_id:
 *                         type: string
 *                       stage:
 *                         type: string
 *                       post_count:
 *                         type: integer
 *                       comment_count:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *       401:
 *         description: Not authenticated
 */
router.get('/user/all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUserId = req.user!.userId;

    const scrapes = await webhookRepository.getAllUserScrapes(authUserId);

    return res.status(200).json({
      success: true,
      data: scrapes,
    });
  } catch (error) {
    console.error('Error fetching user scrapes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch scrapes',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

