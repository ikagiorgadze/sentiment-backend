import { Pool } from 'pg';
import { ChatRepository, CreateChatMessageDto, ChatMessage, PaginatedChatMessages } from '../repositories/chat.repository';

export class ChatService {
  private chatRepository: ChatRepository;

  constructor(pool: Pool) {
    this.chatRepository = new ChatRepository(pool);
  }

  /**
   * Save a chat message (user or assistant)
   */
  async saveMessage(data: CreateChatMessageDto): Promise<ChatMessage> {
    if (!data.content?.trim()) {
      throw new Error('Message content cannot be empty');
    }

    if (!['user', 'assistant'].includes(data.role)) {
      throw new Error('Invalid message role. Must be "user" or "assistant"');
    }

    return await this.chatRepository.createMessage(data);
  }

  /**
   * Save multiple messages at once (e.g., user question + assistant answer)
   */
  async saveMessages(messages: CreateChatMessageDto[]): Promise<ChatMessage[]> {
    const savedMessages: ChatMessage[] = [];
    
    for (const message of messages) {
      const saved = await this.saveMessage(message);
      savedMessages.push(saved);
    }
    
    return savedMessages;
  }

  /**
   * Get paginated chat history for a user
   */
  async getChatHistory(
    userId: string, // UUID
    limit: number = 6,
    offset: number = 0
  ): Promise<PaginatedChatMessages> {
    return await this.chatRepository.getUserMessages(userId, limit, offset);
  }

  /**
   * Get recent chat messages for initial load
   */
  async getRecentMessages(userId: string, limit: number = 20): Promise<ChatMessage[]> {
    return await this.chatRepository.getRecentMessages(userId, limit);
  }

  /**
   * Clear all chat history for a user
   */
  async clearHistory(userId: string): Promise<{ deletedCount: number }> {
    const deletedCount = await this.chatRepository.deleteUserMessages(userId);
    return { deletedCount };
  }

  /**
   * Delete a specific message
   */
  async deleteMessage(messageId: number, userId: string): Promise<boolean> {
    return await this.chatRepository.deleteMessage(messageId, userId);
  }

  /**
   * Get total message count for a user
   */
  async getMessageCount(userId: string): Promise<number> {
    return await this.chatRepository.getMessageCount(userId);
  }
}
