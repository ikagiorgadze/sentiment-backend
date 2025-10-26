import { pool } from '../config/database';
import { SentimentWithDetails, Post } from '../interfaces/models';
import { SentimentQueryOptions } from '../interfaces/query-options';

export class SentimentRepository {
  // Check if user has access to a sentiment (via its post or comment's post)
  async hasAccess(sentimentId: string, userId: string, role: string): Promise<boolean> {
    // Admins have access to everything
    if (role === 'admin') {
      return true;
    }

    // Check access through the sentiment's post or comment's post
    const query = `
      SELECT 1 FROM sentiments s
      LEFT JOIN comments c ON s.comment_id = c.id
      INNER JOIN user_post_access upa ON 
        (s.post_id IS NOT NULL AND upa.post_id = s.post_id) OR
        (s.comment_id IS NOT NULL AND upa.post_id = c.post_id)
      WHERE s.id = $1 AND upa.auth_user_id = $2
    `;
    
    const result = await pool.query(query, [sentimentId, userId]);
    return result.rows.length > 0;
  }

  // Find all sentiments with access control
  async findAllWithAccess(userId: string, role: string, options: SentimentQueryOptions = {}): Promise<SentimentWithDetails[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'inserted_at',
      orderDirection = 'DESC',
      post_id,
      comment_id,
      sentiment_category,
      includePost,
      includeComment,
      minConfidence,
      maxConfidence,
      onlyPostSentiments,
      onlyCommentSentiments,
    } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (post_id) {
      whereClauses.push(`s.post_id = $${paramCount++}`);
      params.push(post_id);
    }

    if (comment_id) {
      whereClauses.push(`s.comment_id = $${paramCount++}`);
      params.push(comment_id);
    }

    if (sentiment_category) {
      whereClauses.push(`s.sentiment_category = $${paramCount++}`);
      params.push(sentiment_category);
    }

    if (minConfidence !== undefined) {
      whereClauses.push(`s.confidence >= $${paramCount++}`);
      params.push(minConfidence);
    }

    if (maxConfidence !== undefined) {
      whereClauses.push(`s.confidence <= $${paramCount++}`);
      params.push(maxConfidence);
    }

    if (onlyPostSentiments) {
      whereClauses.push(`s.comment_id IS NULL`);
    }

    if (onlyCommentSentiments) {
      whereClauses.push(`s.comment_id IS NOT NULL`);
    }

    // Build access control join
    let accessJoin = '';
    if (role !== 'admin') {
      // Need to join through comments for comment sentiments
      accessJoin = `
        LEFT JOIN comments c_access ON s.comment_id = c_access.id
        INNER JOIN user_post_access upa ON 
          (s.post_id IS NOT NULL AND upa.post_id = s.post_id) OR
          (s.comment_id IS NOT NULL AND upa.post_id = c_access.post_id)
        AND upa.auth_user_id = $${paramCount++}
      `;
      params.push(userId);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT s.*
        ${includePost ? ', p.id as "post.id", p.page_id as "post.page_id", p.full_url as "post.full_url", p.content as "post.content", p.posted_at as "post.posted_at", p.inserted_at as "post.inserted_at", pg.id as "post.page.id", pg.page_url as "post.page.page_url", pg.page_name as "post.page.page_name", pg.inserted_at as "post.page.inserted_at"' : ''}
        ${includeComment ? ', c.id as "comment.id", c.full_url as "comment.full_url", c.post_id as "comment.post_id", c.user_id as "comment.user_id", c.content as "comment.content", c.inserted_at as "comment.inserted_at"' : ''}
      FROM sentiments s
      ${accessJoin}
      ${includePost ? 'LEFT JOIN posts p ON s.post_id = p.id LEFT JOIN pages pg ON p.page_id = pg.id' : ''}
      ${includeComment ? 'LEFT JOIN comments c ON s.comment_id = c.id' : ''}
      ${whereClause}
      ORDER BY s.${orderBy} ${orderDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const sentiments: SentimentWithDetails[] = result.rows.map((row) => {
      const sentiment: SentimentWithDetails = {
        id: row.id,
        post_id: row.post_id,
        comment_id: row.comment_id,
        sentiment: row.sentiment,
        sentiment_category: row.sentiment_category,
        confidence: row.confidence,
        probabilities: row.probabilities,
        polarity: row.polarity,
        inserted_at: row.inserted_at,
      };

      if (includePost && row['post.id']) {
        const post: Post = {
          id: row['post.id'],
          page_id: row['post.page_id'],
          full_url: row['post.full_url'],
          content: row['post.content'],
          posted_at: row['post.posted_at'],
          inserted_at: row['post.inserted_at'],
        };

        if (row['post.page.id']) {
          post.page = {
            id: row['post.page.id'],
            page_url: row['post.page.page_url'],
            page_name: row['post.page.page_name'],
            inserted_at: row['post.page.inserted_at'],
          };
        }

        sentiment.post = post;
      }

      if (includeComment && row['comment.id']) {
        sentiment.comment = {
          id: row['comment.id'],
          full_url: row['comment.full_url'],
          post_id: row['comment.post_id'],
          user_id: row['comment.user_id'],
          content: row['comment.content'],
          inserted_at: row['comment.inserted_at'],
        };
      }

      return sentiment;
    });

    return sentiments;
  }

  // Find sentiment by ID with access control
  async findByIdWithAccess(id: string, userId: string, role: string, options: SentimentQueryOptions = {}): Promise<SentimentWithDetails | null> {
    // First check access
    const hasAccess = await this.hasAccess(id, userId, role);
    if (!hasAccess) {
      return null;
    }

    // If access is granted, return the sentiment
    return this.findById(id, options);
  }

  async findAll(options: SentimentQueryOptions = {}): Promise<SentimentWithDetails[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'inserted_at',
      orderDirection = 'DESC',
      post_id,
      comment_id,
      sentiment_category,
      includePost,
      includeComment,
      minConfidence,
      maxConfidence,
      onlyPostSentiments,
      onlyCommentSentiments,
    } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (post_id) {
      whereClauses.push(`s.post_id = $${paramCount++}`);
      params.push(post_id);
    }

    if (comment_id) {
      whereClauses.push(`s.comment_id = $${paramCount++}`);
      params.push(comment_id);
    }

    if (sentiment_category) {
      whereClauses.push(`s.sentiment_category = $${paramCount++}`);
      params.push(sentiment_category);
    }

    if (minConfidence !== undefined) {
      whereClauses.push(`s.confidence >= $${paramCount++}`);
      params.push(minConfidence);
    }

    if (maxConfidence !== undefined) {
      whereClauses.push(`s.confidence <= $${paramCount++}`);
      params.push(maxConfidence);
    }

    if (onlyPostSentiments) {
      whereClauses.push(`s.comment_id IS NULL`);
    }

    if (onlyCommentSentiments) {
      whereClauses.push(`s.comment_id IS NOT NULL`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT s.*
        ${includePost ? ', p.id as "post.id", p.page_id as "post.page_id", p.full_url as "post.full_url", p.content as "post.content", p.posted_at as "post.posted_at", p.inserted_at as "post.inserted_at", pg.id as "post.page.id", pg.page_url as "post.page.page_url", pg.page_name as "post.page.page_name", pg.inserted_at as "post.page.inserted_at"' : ''}
        ${includeComment ? ', c.id as "comment.id", c.full_url as "comment.full_url", c.post_id as "comment.post_id", c.user_id as "comment.user_id", c.content as "comment.content", c.inserted_at as "comment.inserted_at"' : ''}
      FROM sentiments s
      ${includePost ? 'LEFT JOIN posts p ON s.post_id = p.id LEFT JOIN pages pg ON p.page_id = pg.id' : ''}
      ${includeComment ? 'LEFT JOIN comments c ON s.comment_id = c.id' : ''}
      ${whereClause}
      ORDER BY s.${orderBy} ${orderDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const sentiments: SentimentWithDetails[] = result.rows.map((row) => {
      const sentiment: SentimentWithDetails = {
        id: row.id,
        post_id: row.post_id,
        comment_id: row.comment_id,
        sentiment: row.sentiment,
        sentiment_category: row.sentiment_category,
        confidence: row.confidence,
        probabilities: row.probabilities,
        polarity: row.polarity,
        inserted_at: row.inserted_at,
      };

      if (includePost && row['post.id']) {
        const post: Post = {
          id: row['post.id'],
          page_id: row['post.page_id'],
          full_url: row['post.full_url'],
          content: row['post.content'],
          posted_at: row['post.posted_at'],
          inserted_at: row['post.inserted_at'],
        };

        if (row['post.page.id']) {
          post.page = {
            id: row['post.page.id'],
            page_url: row['post.page.page_url'],
            page_name: row['post.page.page_name'],
            inserted_at: row['post.page.inserted_at'],
          };
        }

        sentiment.post = post;
      }

      if (includeComment && row['comment.id']) {
        sentiment.comment = {
          id: row['comment.id'],
          full_url: row['comment.full_url'],
          post_id: row['comment.post_id'],
          user_id: row['comment.user_id'],
          content: row['comment.content'],
          inserted_at: row['comment.inserted_at'],
        };
      }

      return sentiment;
    });

    return sentiments;
  }

  async findById(id: string, options: SentimentQueryOptions = {}): Promise<SentimentWithDetails | null> {
    const {
      includePost,
      includeComment,
    } = options;

    const query = `
      SELECT s.*
        ${includePost ? ', p.id as "post.id", p.page_id as "post.page_id", p.full_url as "post.full_url", p.content as "post.content", p.posted_at as "post.posted_at", p.inserted_at as "post.inserted_at", pg.id as "post.page.id", pg.page_url as "post.page.page_url", pg.page_name as "post.page.page_name", pg.inserted_at as "post.page.inserted_at"' : ''}
        ${includeComment ? ', c.id as "comment.id", c.full_url as "comment.full_url", c.post_id as "comment.post_id", c.user_id as "comment.user_id", c.content as "comment.content", c.inserted_at as "comment.inserted_at"' : ''}
      FROM sentiments s
      ${includePost ? 'LEFT JOIN posts p ON s.post_id = p.id LEFT JOIN pages pg ON p.page_id = pg.id' : ''}
      ${includeComment ? 'LEFT JOIN comments c ON s.comment_id = c.id' : ''}
      WHERE s.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const sentiment: SentimentWithDetails = {
      id: row.id,
      post_id: row.post_id,
      comment_id: row.comment_id,
      sentiment: row.sentiment,
      sentiment_category: row.sentiment_category,
      confidence: row.confidence,
      probabilities: row.probabilities,
      polarity: row.polarity,
      inserted_at: row.inserted_at,
    };

    if (includePost && row['post.id']) {
      const post: Post = {
        id: row['post.id'],
        page_id: row['post.page_id'],
        full_url: row['post.full_url'],
        content: row['post.content'],
        posted_at: row['post.posted_at'],
        inserted_at: row['post.inserted_at'],
      };

      if (row['post.page.id']) {
        post.page = {
          id: row['post.page.id'],
          page_url: row['post.page.page_url'],
          page_name: row['post.page.page_name'],
          inserted_at: row['post.page.inserted_at'],
        };
      }

      sentiment.post = post;
    }

    if (includeComment && row['comment.id']) {
      sentiment.comment = {
        id: row['comment.id'],
        full_url: row['comment.full_url'],
        post_id: row['comment.post_id'],
        user_id: row['comment.user_id'],
        content: row['comment.content'],
        inserted_at: row['comment.inserted_at'],
      };
    }

    return sentiment;
  }
}

