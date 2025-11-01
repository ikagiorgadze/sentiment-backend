import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ChatService } from '../services/chat.service';
import { authenticateToken } from '../middleware/auth.middleware';

export function createChatRoutes(pool: Pool): Router {
  const router = Router();
  const chatService = new ChatService(pool);

  /**
   * @route POST /api/chat/messages
   * @desc Save a chat message
   * @access Private
   */
  router.post('/messages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      const { role, content, metadata } = req.body;
      const userId = req.user!.userId; // Keep as string (UUID)

      if (!role || !content) {
        res.status(400).json({ 
          error: 'Role and content are required' 
        });
        return;
      }

      const message = await chatService.saveMessage({
        user_id: userId,
        role,
        content,
        metadata
      });

      res.status(201).json(message);
    } catch (error: any) {
      console.error('Error saving chat message:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to save message' 
      });
    }
  });

  /**
   * @route POST /api/chat/messages/batch
   * @desc Save multiple chat messages at once
   * @access Private
   */
  router.post('/messages/batch', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      const { messages } = req.body;
      const userId = req.user!.userId; // Keep as string (UUID)

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ 
          error: 'Messages array is required' 
        });
        return;
      }

      const messagesWithUserId = messages.map(msg => ({
        ...msg,
        user_id: userId
      }));

      const savedMessages = await chatService.saveMessages(messagesWithUserId);

      res.status(201).json(savedMessages);
    } catch (error: any) {
      console.error('Error saving chat messages:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to save messages' 
      });
    }
  });

  /**
   * @route GET /api/chat/messages
   * @desc Get paginated chat history
   * @access Private
   */
  router.get('/messages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId; // Keep as string (UUID)
      const limit = parseInt(req.query.limit as string) || 6;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await chatService.getChatHistory(userId, limit, offset);

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ 
        error: 'Failed to fetch chat history' 
      });
    }
  });

  /**
   * @route GET /api/chat/messages/recent
   * @desc Get recent chat messages for initial load
   * @access Private
   */
  router.get('/messages/recent', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId; // Keep as string (UUID)
      const limit = parseInt(req.query.limit as string) || 20;

      const messages = await chatService.getRecentMessages(userId, limit);

      res.json(messages);
    } catch (error: any) {
      console.error('Error fetching recent messages:', error);
      res.status(500).json({ 
        error: 'Failed to fetch recent messages' 
      });
    }
  });

  /**
   * @route DELETE /api/chat/messages
   * @desc Clear all chat history for the user
   * @access Private
   */
  router.delete('/messages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId; // Keep as string (UUID)

      const result = await chatService.clearHistory(userId);

      res.json({ 
        message: 'Chat history cleared successfully',
        ...result 
      });
    } catch (error: any) {
      console.error('Error clearing chat history:', error);
      res.status(500).json({ 
        error: 'Failed to clear chat history' 
      });
    }
  });

  /**
   * @route DELETE /api/chat/messages/:messageId
   * @desc Delete a specific message
   * @access Private
   */
  router.delete('/messages/:messageId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId; // Keep as string (UUID)
      const messageId = parseInt(req.params.messageId);

      if (isNaN(messageId)) {
        res.status(400).json({ 
          error: 'Invalid message ID' 
        });
        return;
      }

      const deleted = await chatService.deleteMessage(messageId, userId);

      if (!deleted) {
        res.status(404).json({ 
          error: 'Message not found or already deleted' 
        });
        return;
      }

      res.json({ 
        message: 'Message deleted successfully' 
      });
    } catch (error: any) {
      console.error('Error deleting message:', error);
      res.status(500).json({ 
        error: 'Failed to delete message' 
      });
    }
  });

  /**
   * @route GET /api/chat/count
   * @desc Get total message count for the user
   * @access Private
   */
  router.get('/count', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId; // Keep as string (UUID)

      const count = await chatService.getMessageCount(userId);

      res.json({ count });
    } catch (error: any) {
      console.error('Error fetching message count:', error);
      res.status(500).json({ 
        error: 'Failed to fetch message count' 
      });
    }
  });

  return router;
}
