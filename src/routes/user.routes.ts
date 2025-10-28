import { Router, Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { UserQueryOptions } from '../interfaces/query-options';

const router = Router();
const userService = new UserService();

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users
 *     description: Retrieve users with optional filtering
 *     parameters:
 *       - in: query
 *         name: fb_profile_id
 *         schema:
 *           type: string
 *         description: Filter by Facebook profile ID
 *       - in: query
 *         name: full_name
 *         schema:
 *           type: string
 *         description: Search by full name (case-insensitive)
 *       - in: query
 *         name: includeComments
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeReactions
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Successfully retrieved users
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const onlyWithCommentsParam = req.query.onlyWithComments as string | undefined;
    const onlyWithComments =
      typeof onlyWithCommentsParam === 'string' ? onlyWithCommentsParam === 'true' : true;

    const parsedLimit = Number.parseInt(req.query.limit as string, 10);
    const parsedOffset = Number.parseInt(req.query.offset as string, 10);
    const defaultLimit = 18;
    const maxLimit = 100;

    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, maxLimit)
      : defaultLimit;
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const options: UserQueryOptions = {
      limit,
      offset,
      orderBy: (req.query.orderBy as string) || 'inserted_at',
      orderDirection: (req.query.orderDirection as 'ASC' | 'DESC') || 'DESC',
      fb_profile_id: req.query.fb_profile_id as string,
      full_name: req.query.full_name as string,
      includeComments: req.query.includeComments === 'true',
      includeReactions: req.query.includeReactions === 'true',
      includeStats: req.query.includeStats === 'true',
      onlyWithComments,
    };

    const { users, totalCount } = await userService.getAllUsers(options);
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(totalCount / limit)) : 1;
    const currentPage = totalCount > 0 ? Math.min(Math.floor(offset / limit) + 1, totalPages) : 1;

    return res.json({
      success: true,
      data: users,
      count: totalCount,
      meta: {
        limit,
        offset,
        page: currentPage,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID or Facebook profile ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User UUID or Facebook profile ID
 *       - in: query
 *         name: includeComments
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeReactions
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const options: UserQueryOptions = {
      includeComments: req.query.includeComments === 'true',
      includeReactions: req.query.includeReactions === 'true',
      includeStats: req.query.includeStats === 'true',
    };

    const user = await userService.getUserById(id, options);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
