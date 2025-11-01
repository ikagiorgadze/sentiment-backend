import { Pool, QueryResult } from 'pg';

export interface ChatMessage {
  id: number;
  user_id: string; // UUID
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateChatMessageDto {
  user_id: string; // UUID
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
}

export interface PaginatedChatMessages {
  messages: ChatMessage[];
  total: number;
  hasMore: boolean;
}

export class ChatRepository {
  constructor(private pool: Pool) {}

  /**
   * Save a new chat message
   */
  async createMessage(data: CreateChatMessageDto): Promise<ChatMessage> {
    const query = `
      INSERT INTO chat_messages (user_id, role, content, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      data.user_id,
      data.role,
      data.content,
      data.metadata || {}
    ];

    const result: QueryResult<ChatMessage> = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get paginated chat messages for a user (newest first)
   */
  async getUserMessages(
    userId: string, // UUID
    limit: number = 6, // 3 pairs (user + assistant)
    offset: number = 0
  ): Promise<PaginatedChatMessages> {
    // Get messages
    const messagesQuery = `
      SELECT *
      FROM chat_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const messagesResult: QueryResult<ChatMessage> = await this.pool.query(
      messagesQuery,
      [userId, limit, offset]
    );

    // Get total count
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM chat_messages
      WHERE user_id = $1
    `;
    
    const countResult = await this.pool.query(countQuery, [userId]);
    const total = countResult.rows[0]?.total || 0;

    return {
      messages: messagesResult.rows,
      total,
      hasMore: offset + messagesResult.rows.length < total
    };
  }

  /**
   * Get recent chat messages for a user (for initial load)
   */
  async getRecentMessages(
    userId: string, // UUID
    limit: number = 20
  ): Promise<ChatMessage[]> {
    const query = `
      SELECT *
      FROM chat_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result: QueryResult<ChatMessage> = await this.pool.query(query, [userId, limit]);
    return result.rows.reverse(); // Reverse to show oldest first in UI
  }

  /**
   * Delete all chat messages for a user
   */
  async deleteUserMessages(userId: string): Promise<number> {
    const query = `
      DELETE FROM chat_messages
      WHERE user_id = $1
    `;
    
    const result = await this.pool.query(query, [userId]);
    return result.rowCount || 0;
  }

  /**
   * Delete a specific message
   */
  async deleteMessage(messageId: number, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM chat_messages
      WHERE id = $1 AND user_id = $2
    `;
    
    const result = await this.pool.query(query, [messageId, userId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get message count for a user
   */
  async getMessageCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::int as count
      FROM chat_messages
      WHERE user_id = $1
    `;
    
    const result = await this.pool.query(query, [userId]);
    return result.rows[0]?.count || 0;
  }
}
