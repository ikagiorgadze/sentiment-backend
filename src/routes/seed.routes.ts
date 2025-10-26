import express, { Request, Response } from 'express';
import { SeedService } from '../services/seed.service';

const router = express.Router();
const seedService = new SeedService();

/**
 * @swagger
 * /api/seed:
 *   post:
 *     summary: Seed the database with dummy data
 *     description: Clears existing data and inserts comprehensive dummy data including users, posts, comments, sentiments, and reactions with proper relationships
 *     tags: [Seed]
 *     responses:
 *       200:
 *         description: Database seeded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: number
 *                     posts:
 *                       type: number
 *                     comments:
 *                       type: number
 *                     sentiments:
 *                       type: number
 *                     reactions:
 *                       type: number
 *       500:
 *         description: Server error
 */
router.post('/', async (_req: Request, res: Response) => {
  try {
    const result = await seedService.seedDatabase();
    return res.json(result);
  } catch (error) {
    console.error('Error seeding database:', error);
    return res.status(500).json({ error: 'Failed to seed database' });
  }
});

/**
 * @swagger
 * /api/seed:
 *   delete:
 *     summary: Clear all data from the database
 *     description: Removes all users, posts, comments, sentiments, and reactions (keeps auth users)
 *     tags: [Seed]
 *     responses:
 *       200:
 *         description: Database cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.delete('/', async (_req: Request, res: Response) => {
  try {
    const result = await seedService.clearDatabase();
    return res.json(result);
  } catch (error) {
    console.error('Error clearing database:', error);
    return res.status(500).json({ error: 'Failed to clear database' });
  }
});

export default router;
