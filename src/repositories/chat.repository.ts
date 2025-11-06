import { Pool, PoolClient, QueryResult } from 'pg';

export interface ChatMessage {
  id: number;
  chat_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateChatMessageDto {
  chat_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
}

export interface PaginatedChatMessages {
  messages: ChatMessage[];
  total: number;
  hasMore: boolean;
}

export interface ChatProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface ChatProjectWithStats extends ChatProject {
  active_chat_count: number;
  total_chat_count: number;
  last_activity: Date | null;
}

export interface CreateChatProjectDto {
  user_id: string;
  name: string;
  description?: string | null;
  metadata?: any;
}

export interface UpdateChatProjectDto {
  name?: string | null;
  description?: string | null;
  metadata?: any;
}

export interface ChatSession {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string | null;
  system_prompt: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
  last_message_at: Date | null;
}

export interface ChatSessionSummary extends ChatSession {
  message_count: number;
  last_message_preview: string | null;
  last_message_role: 'user' | 'assistant' | null;
}

export interface CreateChatSessionDto {
  user_id: string;
  project_id?: string | null;
  title?: string | null;
  system_prompt?: string | null;
  metadata?: any;
}

export interface UpdateChatSessionDto {
  project_id?: string | null;
  title?: string | null;
  system_prompt?: string | null;
  archived_at?: Date | null;
  metadata?: any;
  last_message_at?: Date | null;
}

export class ChatRepository {
  constructor(private pool: Pool) {}

  private async runInTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /* -------------------------------------------------------------------------
   * Projects
   * ---------------------------------------------------------------------- */

  async createProject(data: CreateChatProjectDto): Promise<ChatProject> {
    const query = `
      INSERT INTO chat_projects (user_id, name, description, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      data.user_id,
      data.name.trim(),
      data.description ?? null,
      data.metadata ?? {},
    ];

    const result: QueryResult<ChatProject> = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getProjectsWithStats(userId: string): Promise<ChatProjectWithStats[]> {
    const query = `
      SELECT
        p.*,
        COALESCE(active_counts.active_chat_count, 0)::int AS active_chat_count,
        COALESCE(total_counts.total_chat_count, 0)::int AS total_chat_count,
        activity.last_activity
      FROM chat_projects p
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS active_chat_count
        FROM chat_sessions cs
        WHERE cs.project_id = p.id
          AND cs.archived_at IS NULL
      ) active_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total_chat_count
        FROM chat_sessions cs
        WHERE cs.project_id = p.id
      ) total_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(COALESCE(cs.last_message_at, cs.created_at)) AS last_activity
        FROM chat_sessions cs
        WHERE cs.project_id = p.id
      ) activity ON TRUE
      WHERE p.user_id = $1
      ORDER BY COALESCE(activity.last_activity, p.updated_at) DESC NULLS LAST
    `;

    const result: QueryResult<ChatProjectWithStats> = await this.pool.query(query, [userId]);
    return result.rows;
  }

  async updateProject(projectId: string, userId: string, updates: UpdateChatProjectDto): Promise<ChatProject | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${index++}`);
      values.push(updates.name ? updates.name.trim() : null);
    }

    if (updates.description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(updates.description ?? null);
    }

    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${index++}`);
      values.push(updates.metadata ?? {});
    }

    if (fields.length === 0) {
      const query = `SELECT * FROM chat_projects WHERE id = $1 AND user_id = $2`;
      const result = await this.pool.query<ChatProject>(query, [projectId, userId]);
      return result.rows[0] ?? null;
    }

    const query = `
      UPDATE chat_projects
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${index++} AND user_id = $${index++}
      RETURNING *
    `;

    values.push(projectId, userId);

    const result: QueryResult<ChatProject> = await this.pool.query(query, values);
    return result.rows[0] ?? null;
  }

  async deleteProject(projectId: string, userId: string): Promise<boolean> {
    return this.runInTransaction<boolean>(async (client) => {
      // Remove project association from chats to preserve history
      await client.query(
        `
          UPDATE chat_sessions
          SET project_id = NULL
          WHERE project_id = $1 AND user_id = $2
        `,
        [projectId, userId]
      );

      const deleteResult = await client.query(
        `
          DELETE FROM chat_projects
          WHERE id = $1 AND user_id = $2
        `,
        [projectId, userId]
      );

      return (deleteResult.rowCount ?? 0) > 0;
    });
  }

  /* -------------------------------------------------------------------------
   * Chat sessions
   * ---------------------------------------------------------------------- */

  async createSession(data: CreateChatSessionDto): Promise<ChatSession> {
    const query = `
      INSERT INTO chat_sessions (user_id, project_id, title, system_prompt, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result: QueryResult<ChatSession> = await this.pool.query(query, [
      data.user_id,
      data.project_id ?? null,
      data.title ?? 'New chat',
      data.system_prompt ?? null,
      data.metadata ?? {},
    ]);

    return result.rows[0];
  }

  async getSession(chatId: string, userId: string): Promise<ChatSession | null> {
    const query = `
      SELECT *
      FROM chat_sessions
      WHERE id = $1 AND user_id = $2
    `;

    const result: QueryResult<ChatSession> = await this.pool.query(query, [chatId, userId]);
    return result.rows[0] ?? null;
  }

  async updateSession(chatId: string, userId: string, updates: UpdateChatSessionDto): Promise<ChatSession | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (updates.project_id !== undefined) {
      fields.push(`project_id = $${index++}`);
      values.push(updates.project_id ?? null);
    }

    if (updates.title !== undefined) {
      fields.push(`title = $${index++}`);
      values.push(updates.title ?? null);
    }

    if (updates.system_prompt !== undefined) {
      fields.push(`system_prompt = $${index++}`);
      values.push(updates.system_prompt ?? null);
    }

    if (updates.archived_at !== undefined) {
      fields.push(`archived_at = $${index++}`);
      values.push(updates.archived_at);
    }

    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${index++}`);
      values.push(updates.metadata ?? {});
    }

    if (updates.last_message_at !== undefined) {
      fields.push(`last_message_at = $${index++}`);
      values.push(updates.last_message_at);
    }

    if (fields.length === 0) {
      const query = `SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2`;
      const result = await this.pool.query<ChatSession>(query, [chatId, userId]);
      return result.rows[0] ?? null;
    }

    const query = `
      UPDATE chat_sessions
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${index++} AND user_id = $${index++}
      RETURNING *
    `;

    values.push(chatId, userId);

    const result: QueryResult<ChatSession> = await this.pool.query(query, values);
    return result.rows[0] ?? null;
  }

  async listSessionSummaries(userId: string, includeArchived: boolean = false): Promise<ChatSessionSummary[]> {
    const query = `
      SELECT
        cs.*,
        COALESCE(
          (
            SELECT COUNT(*)::int
            FROM chat_messages cm
            WHERE cm.chat_id = cs.id
          ),
          0
        ) AS message_count,
        (
          SELECT content
          FROM chat_messages cm
          WHERE cm.chat_id = cs.id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) AS last_message_preview,
        (
          SELECT role
          FROM chat_messages cm
          WHERE cm.chat_id = cs.id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) AS last_message_role
      FROM chat_sessions cs
      WHERE cs.user_id = $1
        AND ($2::boolean = TRUE OR cs.archived_at IS NULL)
      ORDER BY COALESCE(cs.last_message_at, cs.created_at) DESC NULLS LAST
    `;

    const result: QueryResult<ChatSessionSummary> = await this.pool.query(query, [userId, includeArchived]);
    return result.rows;
  }

  async archiveSession(chatId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        UPDATE chat_sessions
        SET archived_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
      `,
      [chatId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async deleteSession(chatId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        DELETE FROM chat_sessions
        WHERE id = $1 AND user_id = $2
      `,
      [chatId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /* -------------------------------------------------------------------------
   * Messages
   * ---------------------------------------------------------------------- */

  async createMessage(data: CreateChatMessageDto): Promise<ChatMessage> {
    return this.runInTransaction<ChatMessage>(async (client) => {
      const chatCheck = await client.query<{ user_id: string }>(
        `SELECT user_id FROM chat_sessions WHERE id = $1 FOR UPDATE`,
        [data.chat_id]
      );

      if (chatCheck.rowCount === 0) {
        throw new Error('Chat not found');
      }

      if (chatCheck.rows[0].user_id !== data.user_id) {
        throw new Error('Unauthorized chat access');
      }

      const insertResult = await client.query<ChatMessage>(
        `
          INSERT INTO chat_messages (chat_id, user_id, role, content, metadata)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [
          data.chat_id,
          data.user_id,
          data.role,
          data.content,
          data.metadata ?? {},
        ]
      );

      const message = insertResult.rows[0];

      await client.query(
        `
          UPDATE chat_sessions
          SET last_message_at = GREATEST(COALESCE(last_message_at, created_at), $1)
          WHERE id = $2
        `,
        [message.created_at, data.chat_id]
      );

      return message;
    });
  }

  async createMessages(messages: CreateChatMessageDto[]): Promise<ChatMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    return this.runInTransaction<ChatMessage[]>(async (client) => {
      const chatId = messages[0].chat_id;
      const userId = messages[0].user_id;

      const chatCheck = await client.query<{ user_id: string }>(
        `SELECT user_id FROM chat_sessions WHERE id = $1 FOR UPDATE`,
        [chatId]
      );

      if (chatCheck.rowCount === 0) {
        throw new Error('Chat not found');
      }

      if (chatCheck.rows[0].user_id !== userId) {
        throw new Error('Unauthorized chat access');
      }

      const savedMessages: ChatMessage[] = [];
      for (const message of messages) {
        const insertResult = await client.query<ChatMessage>(
          `
            INSERT INTO chat_messages (chat_id, user_id, role, content, metadata)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `,
          [
            message.chat_id,
            message.user_id,
            message.role,
            message.content,
            message.metadata ?? {},
          ]
        );

        savedMessages.push(insertResult.rows[0]);
      }

      const lastMessageAt = savedMessages[savedMessages.length - 1]?.created_at ?? new Date();

      await client.query(
        `
          UPDATE chat_sessions
          SET last_message_at = GREATEST(COALESCE(last_message_at, created_at), $1)
          WHERE id = $2
        `,
        [lastMessageAt, chatId]
      );

      return savedMessages;
    });
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PaginatedChatMessages> {
    const messagesQuery = `
      SELECT cm.*
      FROM chat_messages cm
      INNER JOIN chat_sessions cs ON cs.id = cm.chat_id
      WHERE cm.chat_id = $1 AND cs.user_id = $2
      ORDER BY cm.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM chat_messages cm
      INNER JOIN chat_sessions cs ON cs.id = cm.chat_id
      WHERE cm.chat_id = $1 AND cs.user_id = $2
    `;

    const [messagesResult, countResult] = await Promise.all([
      this.pool.query<ChatMessage>(messagesQuery, [chatId, userId, limit, offset]),
      this.pool.query<{ total: number }>(countQuery, [chatId, userId]),
    ]);

    const total = countResult.rows[0]?.total ?? 0;

    return {
      messages: messagesResult.rows,
      total,
      hasMore: offset + messagesResult.rows.length < total,
    };
  }

  async deleteMessage(messageId: number, chatId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        DELETE FROM chat_messages
        WHERE id = $1
          AND chat_id = $2
          AND user_id = $3
      `,
      [messageId, chatId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async clearChatMessages(chatId: string, userId: string): Promise<number> {
    const result = await this.pool.query(
      `
        DELETE FROM chat_messages
        WHERE chat_id = $1
          AND user_id = $2
      `,
      [chatId, userId]
    );

    await this.pool.query(
      `
        UPDATE chat_sessions
        SET last_message_at = NULL
        WHERE id = $1 AND user_id = $2
      `,
      [chatId, userId]
    );

    return result.rowCount ?? 0;
  }

  async deleteAllUserChats(userId: string): Promise<number> {
    return this.runInTransaction<number>(async (client) => {
      await client.query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId]);

      const sessionResult = await client.query(
        `DELETE FROM chat_sessions WHERE user_id = $1`,
        [userId]
      );

      await client.query(`DELETE FROM chat_projects WHERE user_id = $1`, [userId]);

      return sessionResult.rowCount ?? 0;
    });
  }

  async getMessageCount(chatId: string, userId: string): Promise<number> {
    const result = await this.pool.query<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM chat_messages cm
        INNER JOIN chat_sessions cs ON cs.id = cm.chat_id
        WHERE cm.chat_id = $1
          AND cs.user_id = $2
      `,
      [chatId, userId]
    );

    return result.rows[0]?.count ?? 0;
  }
}
