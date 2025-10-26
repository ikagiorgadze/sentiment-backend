import { Router, Request, Response } from 'express';
import { ScrapeService } from '../services/scrape.service';
import { authenticateToken } from '../middleware/auth.middleware';
import axios from 'axios';

const router = Router();
const scrapeService = new ScrapeService();

/**
 * @swagger
 * /api/scrape:
 *   post:
 *     summary: Initiate Facebook scraping
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               page_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *               post_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *               source:
 *                 type: string
 *                 default: api
 *     responses:
 *       202:
 *         description: Scrape initiated
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { page_urls, post_urls, source } = req.body;
    
    // Validation
    if (!source) {
      return res.status(400).json({
        success: false,
        error: 'Source is required',
      });
    }
    
    if (!page_urls && !post_urls) {
      return res.status(400).json({
        success: false,
        error: 'Provide either page_urls or post_urls',
      });
    }
    
    if (page_urls && post_urls) {
      return res.status(400).json({
        success: false,
        error: 'Provide either page_urls or post_urls, not both',
      });
    }
    
    // Validate URL formats and normalize
    let normalizedPageUrls: string[] | undefined;
    let normalizedPostUrls: string[] | undefined;
    
    if (page_urls) {
      const invalidUrls = scrapeService.validatePageUrls(page_urls);
      if (invalidUrls.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid page URL format',
          invalid_urls: invalidUrls,
        });
      }
      // Normalize URLs after validation
      normalizedPageUrls = page_urls.map((url: string) => scrapeService.normalizeUrl(url));
    }
    
    if (post_urls) {
      const invalidUrls = scrapeService.validatePostUrls(post_urls);
      if (invalidUrls.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid post URL format',
          invalid_urls: invalidUrls,
        });
      }
      // Normalize URLs after validation
      normalizedPostUrls = post_urls.map((url: string) => scrapeService.normalizeUrl(url));
    }
    
    // Forward to n8n with normalized URLs and auth_user_id
    const n8nResponse = await scrapeService.initiateScrape(
      { 
        page_urls: normalizedPageUrls, 
        post_urls: normalizedPostUrls, 
        source 
      },
      req.user!.userId
    );
    
    // Return n8n response
    return res.status(202).json({
      success: true,
      data: n8nResponse,
    });
    
  } catch (error) {
    console.error('Error initiating scrape:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        return res.status(400).json({
          success: false,
          error: 'Scrape validation failed',
          details: error.response.data,
        });
      }
      return res.status(502).json({
        success: false,
        error: 'Failed to communicate with scraping service',
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to initiate scrape',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/scrape/jobs:
 *   get:
 *     summary: Get user's scraping jobs
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scraping jobs retrieved
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
 *                       id:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pending, running, completed, failed]
 *                       progress:
 *                         type: number
 *                       totalItems:
 *                         type: integer
 *                       processedItems:
 *                         type: integer
 *                       startedAt:
 *                         type: string
 *                       completedAt:
 *                         type: string
 *                       error:
 *                         type: string
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get('/jobs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const jobs = await scrapeService.getUserJobs(req.user!.userId);
    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error('Error fetching scraping jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scraping jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

