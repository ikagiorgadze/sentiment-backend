import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { PageService } from '../services/page.service';
import { PageQueryOptions } from '../interfaces/query-options';

const router = Router();
const pageService = new PageService();

/**
 * @swagger
 * /api/pages:
 *   get:
 *     tags: [Pages]
 *     summary: List pages accessible to the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page_url
 *         schema:
 *           type: string
 *         description: Filter pages by exact URL
 *       - in: query
 *         name: page_name
 *         schema:
 *           type: string
 *         description: Filter pages by exact name
 *     responses:
 *       200:
 *         description: Successfully retrieved pages
 *       401:
 *         description: Authentication required
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const limitParam = Number(req.query.limit);
    const offsetParam = Number(req.query.offset);
    const includePostStats = req.query.includePostStats === 'false' ? false : true;

    const options: PageQueryOptions = {
      limit: Number.isFinite(limitParam) && limitParam > -1 ? limitParam : 100,
      offset: Number.isFinite(offsetParam) && offsetParam > -1 ? offsetParam : 0,
      orderBy: typeof req.query.orderBy === 'string' ? req.query.orderBy : 'page_name',
      orderDirection: req.query.orderDirection === 'DESC' ? 'DESC' : 'ASC',
      page_url: typeof req.query.page_url === 'string' ? req.query.page_url : undefined,
      page_name: typeof req.query.page_name === 'string' ? req.query.page_name : undefined,
      includePostStats,
      sentiment: typeof req.query.sentiment === 'string' ? req.query.sentiment : undefined,
    };

    const pages = await pageService.getAllPagesWithAccess(req.user!.userId, req.user!.role, options);

    if (includePostStats === false) {
      pages.forEach((page) => {
        delete page.post_count;
        delete page.last_post_at;
        delete page.comment_count;
        delete page.sentiment_summary;
      });
    }

    return res.json({
      success: true,
      data: pages,
      count: pages.length,
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pages',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
