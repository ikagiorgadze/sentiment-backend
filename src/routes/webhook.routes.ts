import { Router, Request, Response } from 'express';
import { WebhookRepository } from '../repositories/webhook.repository';
import { WebhookNotification } from '../interfaces/webhook';

const router = Router();
const webhookRepository = new WebhookRepository();

/**
 * @swagger
 * /api/webhooks/scrape-complete:
 *   post:
 *     summary: Receive scrape completion webhook from n8n
 *     tags: [Webhooks]
 *     description: Called by n8n workflow to notify when scraping stages complete
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stage
 *               - auth_user_id
 *               - request_id
 *               - timestamp
 *             properties:
 *               stage:
 *                 type: string
 *                 enum: [posts_inserted, sentiment_complete]
 *               auth_user_id:
 *                 type: string
 *                 format: uuid
 *               request_id:
 *                 type: string
 *               post_count:
 *                 type: integer
 *               comment_count:
 *                 type: integer
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Notification received and stored
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/scrape-complete', async (req: Request, res: Response) => {
  try {
    const { stage, auth_user_id, request_id, post_count, comment_count, timestamp } = req.body;

    // Validation
    if (!stage || !auth_user_id || !request_id || !timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: stage, auth_user_id, request_id, timestamp',
      });
    }

    if (!['posts_inserted', 'sentiment_complete'].includes(stage)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid stage. Must be posts_inserted or sentiment_complete',
      });
    }

    const notification: WebhookNotification = {
      stage,
      auth_user_id,
      request_id,
      post_count,
      comment_count,
      timestamp,
    };

    // Store notification
    await webhookRepository.storeNotification(notification);

    console.log(`[Webhook] Scrape notification received: ${stage} for request ${request_id}`);

    return res.status(200).json({
      success: true,
      message: 'Notification received',
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

