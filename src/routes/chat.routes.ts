import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ChatService } from '../services/chat.service';
import { UpdateChatSessionDto } from '../repositories/chat.repository';
import { authenticateToken } from '../middleware/auth.middleware';

export function createChatRoutes(pool: Pool): Router {
  const router = Router();
  const chatService = new ChatService(pool);

  const parseBoolean = (value: unknown, defaultValue: boolean = false): boolean => {
    if (value === undefined || value === null) {
      return defaultValue;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no'].includes(normalized)) {
        return false;
      }
    }

    return defaultValue;
  };

  /* -----------------------------------------------------------------------
   * Workspace overview
   * -------------------------------------------------------------------- */

  router.get('/workspace', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const overview = await chatService.getWorkspaceOverview(userId);
      res.json(overview);
    } catch (error: any) {
      console.error('Error fetching chat workspace:', error);
      res.status(500).json({ error: error.message ?? 'Failed to load chat workspace' });
    }
  });

  /* -----------------------------------------------------------------------
   * Projects
   * -------------------------------------------------------------------- */

  router.get('/projects', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const projects = await chatService.listProjects(userId);
      res.json(projects);
    } catch (error: any) {
      console.error('Error listing chat projects:', error);
      res.status(500).json({ error: error.message ?? 'Failed to list projects' });
    }
  });

  router.post('/projects', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { name, description, metadata } = req.body;
      const project = await chatService.createProject({
        user_id: userId,
        name,
        description,
        metadata,
      });
      res.status(201).json(project);
    } catch (error: any) {
      console.error('Error creating chat project:', error);
      const status = error.message === 'Project name is required' ? 400 : 500;
      res.status(status).json({ error: error.message ?? 'Failed to create project' });
    }
  });

  router.patch('/projects/:projectId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { projectId } = req.params;
      const { name, description, metadata } = req.body;

      const project = await chatService.updateProject(projectId, userId, {
        name,
        description,
        metadata,
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json(project);
    } catch (error: any) {
      console.error('Error updating chat project:', error);
      const status = error.message === 'Project name cannot be empty' ? 400 : 500;
      res.status(status).json({ error: error.message ?? 'Failed to update project' });
    }
  });

  router.delete('/projects/:projectId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { projectId } = req.params;

      const deleted = await chatService.deleteProject(projectId, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting chat project:', error);
      res.status(500).json({ error: error.message ?? 'Failed to delete project' });
    }
  });

  /* -----------------------------------------------------------------------
   * Chat sessions
   * -------------------------------------------------------------------- */

  router.get('/sessions', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const includeArchived = parseBoolean(req.query.includeArchived, false);
      const chats = await chatService.listChatSummaries(userId, includeArchived);
      res.json(chats);
    } catch (error: any) {
      console.error('Error listing chat sessions:', error);
      res.status(500).json({ error: error.message ?? 'Failed to list chat sessions' });
    }
  });

  router.post('/sessions', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { projectId, title, systemPrompt, metadata } = req.body;
      const chat = await chatService.createChatSession({
        user_id: userId,
        project_id: projectId,
        title,
        system_prompt: systemPrompt,
        metadata,
      });
      res.status(201).json(chat);
    } catch (error: any) {
      console.error('Error creating chat session:', error);
      res.status(500).json({ error: error.message ?? 'Failed to create chat session' });
    }
  });

  router.get('/sessions/:chatId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { chatId } = req.params;
      const chat = await chatService.getChatSession(chatId, userId);

      if (!chat) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      res.json(chat);
    } catch (error: any) {
      console.error('Error fetching chat session:', error);
      res.status(500).json({ error: error.message ?? 'Failed to fetch chat session' });
    }
  });

  router.patch('/sessions/:chatId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { chatId } = req.params;
      const { projectId, title, systemPrompt, metadata, archived } = req.body;

      const updates: UpdateChatSessionDto = {
        project_id: projectId,
        title,
        system_prompt: systemPrompt,
        metadata,
      };

      if (archived !== undefined) {
        updates.archived_at = archived ? new Date() : null;
      }

      const chat = await chatService.updateChatSession(chatId, userId, updates);

      if (!chat) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      res.json(chat);
    } catch (error: any) {
      console.error('Error updating chat session:', error);
      const status = error.message === 'Chat title cannot be empty' ? 400 : 500;
      res.status(status).json({ error: error.message ?? 'Failed to update chat session' });
    }
  });

  router.delete('/sessions/:chatId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { chatId } = req.params;

      const deleted = await chatService.deleteChatSession(chatId, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting chat session:', error);
      res.status(500).json({ error: error.message ?? 'Failed to delete chat session' });
    }
  });

  /* -----------------------------------------------------------------------
   * Messages
   * -------------------------------------------------------------------- */

  router.get('/sessions/:chatId/messages', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { chatId } = req.params;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const history = await chatService.getChatHistory(chatId, userId, limit, offset);
      res.json(history);
    } catch (error: any) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: error.message ?? 'Failed to fetch chat history' });
    }
  });

  router.post('/sessions/:chatId/messages', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { chatId } = req.params;
      const { role, content, metadata } = req.body;

      const message = await chatService.saveMessage({
        chat_id: chatId,
        user_id: userId,
        role,
        content,
        metadata,
      });

      res.status(201).json(message);
    } catch (error: any) {
      console.error('Error saving chat message:', error);
      const status = error.message?.includes('Message content cannot be empty') ? 400 : 500;
      res.status(status).json({ error: error.message ?? 'Failed to save message' });
    }
  });

  router.post('/sessions/:chatId/messages/batch', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { chatId } = req.params;
      const { messages } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Messages array is required' });
        return;
      }

      const prepared = messages.map((message: any) => ({
        chat_id: chatId,
        user_id: userId,
        role: message.role,
        content: message.content,
        metadata: message.metadata,
      }));

      const savedMessages = await chatService.saveMessages(prepared);
      res.status(201).json(savedMessages);
    } catch (error: any) {
      console.error('Error saving chat messages:', error);
      const status = error.message?.includes('Message content cannot be empty') ? 400 : 500;
      res.status(status).json({ error: error.message ?? 'Failed to save messages' });
    }
  });

  router.delete('/sessions/:chatId/messages', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { chatId } = req.params;
      const result = await chatService.clearChat(chatId, userId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error clearing chat messages:', error);
      res.status(500).json({ error: error.message ?? 'Failed to clear chat messages' });
    }
  });

  router.delete(
    '/sessions/:chatId/messages/:messageId',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.userId;
        const { chatId, messageId } = req.params;
        const id = parseInt(messageId, 10);

        if (Number.isNaN(id)) {
          res.status(400).json({ error: 'Invalid message ID' });
          return;
        }

        const deleted = await chatService.deleteMessage(id, chatId, userId);
        if (!deleted) {
          res.status(404).json({ error: 'Message not found' });
          return;
        }

        res.json({ success: true });
      } catch (error: any) {
        console.error('Error deleting chat message:', error);
        res.status(500).json({ error: error.message ?? 'Failed to delete chat message' });
      }
    },
  );

  router.get('/sessions/:chatId/count', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { chatId } = req.params;
      const count = await chatService.getMessageCount(chatId, userId);
      res.json({ count });
    } catch (error: any) {
      console.error('Error fetching chat message count:', error);
      res.status(500).json({ error: error.message ?? 'Failed to fetch message count' });
    }
  });

  /* -----------------------------------------------------------------------
   * Workspace level actions
   * -------------------------------------------------------------------- */

  router.delete('/workspace', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const result = await chatService.archiveWorkspace(userId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error clearing chat workspace:', error);
      res.status(500).json({ error: error.message ?? 'Failed to clear workspace' });
    }
  });

  return router;
}
