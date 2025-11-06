import { Pool } from 'pg';
import {
  ChatMessage,
  ChatProject,
  ChatProjectWithStats,
  ChatRepository,
  ChatSession,
  ChatSessionSummary,
  CreateChatMessageDto,
  CreateChatProjectDto,
  CreateChatSessionDto,
  PaginatedChatMessages,
  UpdateChatProjectDto,
  UpdateChatSessionDto,
} from '../repositories/chat.repository';

export interface WorkspaceOverview {
  projects: Array<{
    project: ChatProjectWithStats;
    chats: ChatSessionSummary[];
  }>;
  standalone: ChatSessionSummary[];
}

export class ChatService {
  private chatRepository: ChatRepository;

  constructor(pool: Pool) {
    this.chatRepository = new ChatRepository(pool);
  }

  /* -----------------------------------------------------------------------
   * Workspace overview
   * -------------------------------------------------------------------- */

  async getWorkspaceOverview(userId: string): Promise<WorkspaceOverview> {
    const [projects, chats] = await Promise.all([
      this.chatRepository.getProjectsWithStats(userId),
      this.chatRepository.listSessionSummaries(userId, false),
    ]);

    const grouped = new Map<string, ChatSessionSummary[]>();
    const standalone: ChatSessionSummary[] = [];

    for (const chat of chats) {
      if (chat.project_id) {
        if (!grouped.has(chat.project_id)) {
          grouped.set(chat.project_id, []);
        }
        grouped.get(chat.project_id)!.push(chat);
      } else {
        standalone.push(chat);
      }
    }

    const projectEntries = projects.map((project) => ({
      project,
      chats: grouped.get(project.id) ?? [],
    }));

    return {
      projects: projectEntries,
      standalone,
    };
  }

  /* -----------------------------------------------------------------------
   * Projects
   * -------------------------------------------------------------------- */

  async createProject(data: CreateChatProjectDto): Promise<ChatProject> {
    if (!data.name?.trim()) {
      throw new Error('Project name is required');
    }

    return this.chatRepository.createProject({
      ...data,
      name: data.name.trim(),
    });
  }

  async updateProject(
    projectId: string,
    userId: string,
    updates: UpdateChatProjectDto,
  ): Promise<ChatProject | null> {
    if (updates.name !== undefined && updates.name !== null && !updates.name.trim()) {
      throw new Error('Project name cannot be empty');
    }

    return this.chatRepository.updateProject(projectId, userId, {
      ...updates,
      name: updates.name?.trim(),
    });
  }

  async deleteProject(projectId: string, userId: string): Promise<boolean> {
    return this.chatRepository.deleteProject(projectId, userId);
  }

  async listProjects(userId: string): Promise<ChatProjectWithStats[]> {
    return this.chatRepository.getProjectsWithStats(userId);
  }

  /* -----------------------------------------------------------------------
   * Chat sessions
   * -------------------------------------------------------------------- */

  async createChatSession(data: CreateChatSessionDto): Promise<ChatSession> {
    const baseTitle = data.title?.trim();
    const title = baseTitle && baseTitle.length > 0 ? baseTitle : 'New chat';

    return this.chatRepository.createSession({
      ...data,
      title,
    });
  }

  async getChatSession(chatId: string, userId: string): Promise<ChatSession | null> {
    return this.chatRepository.getSession(chatId, userId);
  }

  async listChatSummaries(
    userId: string,
    includeArchived: boolean = false,
  ): Promise<ChatSessionSummary[]> {
    return this.chatRepository.listSessionSummaries(userId, includeArchived);
  }

  async updateChatSession(
    chatId: string,
    userId: string,
    updates: UpdateChatSessionDto,
  ): Promise<ChatSession | null> {
    if (updates.title !== undefined && updates.title !== null && !updates.title.trim()) {
      throw new Error('Chat title cannot be empty');
    }

    return this.chatRepository.updateSession(chatId, userId, {
      ...updates,
      title: updates.title?.trim(),
    });
  }

  async archiveChatSession(chatId: string, userId: string): Promise<boolean> {
    return this.chatRepository.archiveSession(chatId, userId);
  }

  async deleteChatSession(chatId: string, userId: string): Promise<boolean> {
    return this.chatRepository.deleteSession(chatId, userId);
  }

  /* -----------------------------------------------------------------------
   * Messages
   * -------------------------------------------------------------------- */

  private deriveTitleFromContent(content: string): string {
    const firstLine = content.split('\n').find((line) => line.trim().length > 0) ?? content;
    const trimmed = firstLine.trim();
    if (!trimmed) {
      return 'New chat';
    }

    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
  }

  async saveMessage(data: CreateChatMessageDto): Promise<ChatMessage> {
    if (!data.content?.trim()) {
      throw new Error('Message content cannot be empty');
    }

    if (!['user', 'assistant'].includes(data.role)) {
      throw new Error('Invalid message role. Must be "user" or "assistant"');
    }

    const chat = await this.chatRepository.getSession(data.chat_id, data.user_id);
    if (!chat) {
      throw new Error('Chat not found');
    }

    const message = await this.chatRepository.createMessage(data);

    if (data.role === 'user') {
      const shouldRename =
        !chat.title ||
        chat.title.trim().length === 0 ||
        chat.title.toLowerCase() === 'new chat';

      if (shouldRename) {
        await this.chatRepository.updateSession(chat.id, chat.user_id, {
          title: this.deriveTitleFromContent(data.content),
        });
      }
    }

    return message;
  }

  async saveMessages(messages: CreateChatMessageDto[]): Promise<ChatMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    messages.forEach((message) => {
      if (!message.content?.trim()) {
        throw new Error('Message content cannot be empty');
      }

      if (!['user', 'assistant'].includes(message.role)) {
        throw new Error('Invalid message role. Must be "user" or "assistant"');
      }
    });

    const chatId = messages[0].chat_id;
    const userId = messages[0].user_id;
    const chat = await this.chatRepository.getSession(chatId, userId);
    if (!chat) {
      throw new Error('Chat not found');
    }

    const results = await this.chatRepository.createMessages(messages);

    const firstUserMessage = messages.find((message) => message.role === 'user');
    if (firstUserMessage) {
      const shouldRename =
        !chat.title ||
        chat.title.trim().length === 0 ||
        chat.title.toLowerCase() === 'new chat';

      if (shouldRename) {
        await this.chatRepository.updateSession(chat.id, chat.user_id, {
          title: this.deriveTitleFromContent(firstUserMessage.content),
        });
      }
    }

    return results;
  }

  async getChatHistory(
    chatId: string,
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<PaginatedChatMessages> {
    return this.chatRepository.getChatMessages(chatId, userId, limit, offset);
  }

  async clearChat(chatId: string, userId: string): Promise<{ deletedCount: number }> {
    const deletedCount = await this.chatRepository.clearChatMessages(chatId, userId);
    return { deletedCount };
  }

  async deleteMessage(messageId: number, chatId: string, userId: string): Promise<boolean> {
    return this.chatRepository.deleteMessage(messageId, chatId, userId);
  }

  async getMessageCount(chatId: string, userId: string): Promise<number> {
    return this.chatRepository.getMessageCount(chatId, userId);
  }

  async archiveWorkspace(userId: string): Promise<{ deletedChats: number }> {
    const deletedChats = await this.chatRepository.deleteAllUserChats(userId);
    return { deletedChats };
  }
}
