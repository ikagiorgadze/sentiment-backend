import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const analyticsService = new AnalyticsService();

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get dashboard statistics
 *     description: Retrieve aggregated statistics for the dashboard overview
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
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
 *                     totalPosts:
 *                       type: integer
 *                     positivePosts:
 *                       type: integer
 *                     negativePosts:
 *                       type: integer
 *                     neutralPosts:
 *                       type: integer
 *                     avgEngagement:
 *                       type: number
 *                     sentimentTrend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           positive:
 *                             type: integer
 *                           negative:
 *                             type: integer
 *                           neutral:
 *                             type: integer
 *                     pageSummary:
 *                       type: object
 *                       properties:
 *                         totalPages:
 *                           type: integer
 *                         activePagesLast7Days:
 *                           type: integer
 *                         pagesAddedLast30Days:
 *                           type: integer
 *                         avgPostsPerPage:
 *                           type: number
 *                         avgCommentsPerPage:
 *                           type: number
 *                     postSummary:
 *                       type: object
 *                       properties:
 *                         postsLast24Hours:
 *                           type: integer
 *                         postsLast7Days:
 *                           type: integer
 *                         avgCommentsPerPost:
 *                           type: number
 *                         avgReactionsPerPost:
 *                           type: number
 *                         uniqueCommenters:
 *                           type: integer
 *                         avgSentimentConfidence:
 *                           type: number
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = req.user!;
    const stats = await analyticsService.getDashboardStats(authUser.userId, authUser.role);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
