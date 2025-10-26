import { pool } from '../config/database';
import { CommentWithDetails, Sentiment, Reaction, PostWithDetails } from '../interfaces/models';
import { CommentQueryOptions } from '../interfaces/query-options';

export class CommentRepository {
  // Check if user has access to a comment (via its post)
  async hasAccess(commentId: string, userId: string, role: string): Promise<boolean> {
    // Admins have access to everything
    if (role === 'admin') {
      return true;
    }

    // Check access through the comment's post
    const query = `
      SELECT 1 FROM comments c
      INNER JOIN user_post_access upa ON c.post_id = upa.post_id
      WHERE c.id = $1 AND upa.auth_user_id = $2
    `;
    
    const result = await pool.query(query, [commentId, userId]);
    return result.rows.length > 0;
  }

  // Find all comments with access control
  async findAllWithAccess(userId: string, role: string, options: CommentQueryOptions = {}): Promise<CommentWithDetails[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'inserted_at',
      orderDirection = 'DESC',
      post_id,
      user_id,
      full_url,
      includeUser,
      includePost,
      includeSentiments,
      includeReactions,
    } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (post_id) {
      whereClauses.push(`c.post_id = $${paramCount++}`);
      params.push(post_id);
    }

    if (user_id) {
      whereClauses.push(`c.user_id = $${paramCount++}`);
      params.push(user_id);
    }

    if (full_url) {
      whereClauses.push(`c.full_url = $${paramCount++}`);
      params.push(full_url);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Build access control join
    const accessJoin = role === 'admin' 
      ? '' 
      : `INNER JOIN user_post_access upa ON c.post_id = upa.post_id AND upa.auth_user_id = $${paramCount++}`;
    
    if (role !== 'admin') {
      params.push(userId);
    }

    const query = `
      SELECT c.*
        ${includeUser ? ', u.id as "user.id", u.fb_profile_id as "user.fb_profile_id", u.full_name as "user.full_name", u.inserted_at as "user.inserted_at"' : ''}
        ${includePost ? ', p.id as "post.id", p.page_id as "post.page_id", p.full_url as "post.full_url", p.content as "post.content", p.posted_at as "post.posted_at", p.inserted_at as "post.inserted_at", pg.id as "post.page.id", pg.page_url as "post.page.page_url", pg.page_name as "post.page.page_name", pg.inserted_at as "post.page.inserted_at"' : ''}
      FROM comments c
      ${accessJoin}
      ${includeUser ? 'LEFT JOIN users u ON c.user_id = u.id' : ''}
      ${includePost ? 'LEFT JOIN posts p ON c.post_id = p.id LEFT JOIN pages pg ON p.page_id = pg.id' : ''}
      ${whereClause}
      ORDER BY c.${orderBy} ${orderDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const comments: CommentWithDetails[] = result.rows.map((row) => {
      const comment: CommentWithDetails = {
        id: row.id,
        full_url: row.full_url,
        post_id: row.post_id,
        user_id: row.user_id,
        content: row.content,
        inserted_at: row.inserted_at,
      };

      if (includeUser && row['user.id']) {
        comment.user = {
          id: row['user.id'],
          fb_profile_id: row['user.fb_profile_id'],
          full_name: row['user.full_name'],
          inserted_at: row['user.inserted_at'],
        };
      }

      if (includePost && row['post.id']) {
        const post: PostWithDetails = {
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

        comment.post = post;
      }

      return comment;
    });

    // Fetch additional related data if requested
    if (comments.length > 0 && (includeSentiments || includeReactions)) {
      const commentIds = comments.map((c) => c.id);

      if (includeSentiments) {
        const sentimentsQuery = `
          SELECT * FROM sentiments
          WHERE comment_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const sentimentsResult = await pool.query(sentimentsQuery, [commentIds]);
        
        const sentimentsByCommentId: { [key: string]: Sentiment[] } = {};
        sentimentsResult.rows.forEach((row) => {
          if (!sentimentsByCommentId[row.comment_id]) {
            sentimentsByCommentId[row.comment_id] = [];
          }
          sentimentsByCommentId[row.comment_id].push(row);
        });

        comments.forEach((comment) => {
          comment.sentiments = sentimentsByCommentId[comment.id] || [];
        });
      }

      if (includeReactions) {
        const reactionsQuery = `
          SELECT * FROM reactions
          WHERE comment_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const reactionsResult = await pool.query(reactionsQuery, [commentIds]);
        
        const reactionsByCommentId: { [key: string]: Reaction[] } = {};
        reactionsResult.rows.forEach((row) => {
          if (!reactionsByCommentId[row.comment_id]) {
            reactionsByCommentId[row.comment_id] = [];
          }
          reactionsByCommentId[row.comment_id].push(row);
        });

        comments.forEach((comment) => {
          comment.reactions = reactionsByCommentId[comment.id] || [];
        });
      }
    }

    return comments;
  }

  // Find comment by ID with access control
  async findByIdWithAccess(id: string, userId: string, role: string, options: CommentQueryOptions = {}): Promise<CommentWithDetails | null> {
    // First check access
    const hasAccess = await this.hasAccess(id, userId, role);
    if (!hasAccess) {
      return null;
    }

    // If access is granted, return the comment
    return this.findById(id, options);
  }

  async findAll(options: CommentQueryOptions = {}): Promise<CommentWithDetails[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'inserted_at',
      orderDirection = 'DESC',
      post_id,
      user_id,
      full_url,
      includeUser,
      includePost,
      includeSentiments,
      includeReactions,
    } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (post_id) {
      whereClauses.push(`c.post_id = $${paramCount++}`);
      params.push(post_id);
    }

    if (user_id) {
      whereClauses.push(`c.user_id = $${paramCount++}`);
      params.push(user_id);
    }

    if (full_url) {
      whereClauses.push(`c.full_url = $${paramCount++}`);
      params.push(full_url);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT c.*
        ${includeUser ? ', u.id as "user.id", u.fb_profile_id as "user.fb_profile_id", u.full_name as "user.full_name", u.inserted_at as "user.inserted_at"' : ''}
        ${includePost ? ', p.id as "post.id", p.page_id as "post.page_id", p.full_url as "post.full_url", p.content as "post.content", p.posted_at as "post.posted_at", p.inserted_at as "post.inserted_at", pg.id as "post.page.id", pg.page_url as "post.page.page_url", pg.page_name as "post.page.page_name", pg.inserted_at as "post.page.inserted_at"' : ''}
      FROM comments c
      ${includeUser ? 'LEFT JOIN users u ON c.user_id = u.id' : ''}
      ${includePost ? 'LEFT JOIN posts p ON c.post_id = p.id LEFT JOIN pages pg ON p.page_id = pg.id' : ''}
      ${whereClause}
      ORDER BY c.${orderBy} ${orderDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const comments: CommentWithDetails[] = result.rows.map((row) => {
      const comment: CommentWithDetails = {
        id: row.id,
        full_url: row.full_url,
        post_id: row.post_id,
        user_id: row.user_id,
        content: row.content,
        inserted_at: row.inserted_at,
      };

      if (includeUser && row['user.id']) {
        comment.user = {
          id: row['user.id'],
          fb_profile_id: row['user.fb_profile_id'],
          full_name: row['user.full_name'],
          inserted_at: row['user.inserted_at'],
        };
      }

      if (includePost && row['post.id']) {
        const post: PostWithDetails = {
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

        comment.post = post;
      }

      return comment;
    });

    // Fetch additional related data if requested
    if (comments.length > 0 && (includeSentiments || includeReactions)) {
      const commentIds = comments.map((c) => c.id);

      if (includeSentiments) {
        const sentimentsQuery = `
          SELECT * FROM sentiments
          WHERE comment_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const sentimentsResult = await pool.query(sentimentsQuery, [commentIds]);
        
        const sentimentsByCommentId: { [key: string]: Sentiment[] } = {};
        sentimentsResult.rows.forEach((row) => {
          if (!sentimentsByCommentId[row.comment_id]) {
            sentimentsByCommentId[row.comment_id] = [];
          }
          sentimentsByCommentId[row.comment_id].push(row);
        });

        comments.forEach((comment) => {
          comment.sentiments = sentimentsByCommentId[comment.id] || [];
        });
      }

      if (includeReactions) {
        const reactionsQuery = `
          SELECT * FROM reactions
          WHERE comment_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const reactionsResult = await pool.query(reactionsQuery, [commentIds]);
        
        const reactionsByCommentId: { [key: string]: Reaction[] } = {};
        reactionsResult.rows.forEach((row) => {
          if (!reactionsByCommentId[row.comment_id]) {
            reactionsByCommentId[row.comment_id] = [];
          }
          reactionsByCommentId[row.comment_id].push(row);
        });

        comments.forEach((comment) => {
          comment.reactions = reactionsByCommentId[comment.id] || [];
        });
      }
    }

    return comments;
  }

  async findById(id: string, options: CommentQueryOptions = {}): Promise<CommentWithDetails | null> {
    const {
      includeUser,
      includePost,
      includeSentiments,
      includeReactions,
    } = options;

    const query = `
      SELECT c.*
        ${includeUser ? ', u.id as "user.id", u.fb_profile_id as "user.fb_profile_id", u.full_name as "user.full_name", u.inserted_at as "user.inserted_at"' : ''}
        ${includePost ? ', p.id as "post.id", p.page_id as "post.page_id", p.full_url as "post.full_url", p.content as "post.content", p.posted_at as "post.posted_at", p.inserted_at as "post.inserted_at", pg.id as "post.page.id", pg.page_url as "post.page.page_url", pg.page_name as "post.page.page_name", pg.inserted_at as "post.page.inserted_at"' : ''}
      FROM comments c
      ${includeUser ? 'LEFT JOIN users u ON c.user_id = u.id' : ''}
      ${includePost ? 'LEFT JOIN posts p ON c.post_id = p.id LEFT JOIN pages pg ON p.page_id = pg.id' : ''}
      WHERE c.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const comment: CommentWithDetails = {
      id: row.id,
      full_url: row.full_url,
      post_id: row.post_id,
      user_id: row.user_id,
      content: row.content,
      inserted_at: row.inserted_at,
    };

    if (includeUser && row['user.id']) {
      comment.user = {
        id: row['user.id'],
        fb_profile_id: row['user.fb_profile_id'],
        full_name: row['user.full_name'],
        inserted_at: row['user.inserted_at'],
      };
    }

    if (includePost && row['post.id']) {
      const post: PostWithDetails = {
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

      comment.post = post;
    }

    if (includeSentiments) {
      const sentimentsQuery = `SELECT * FROM sentiments WHERE comment_id = $1 ORDER BY inserted_at DESC`;
      const sentimentsResult = await pool.query(sentimentsQuery, [id]);
      comment.sentiments = sentimentsResult.rows;
    }

    if (includeReactions) {
      const reactionsQuery = `SELECT * FROM reactions WHERE comment_id = $1 ORDER BY inserted_at DESC`;
      const reactionsResult = await pool.query(reactionsQuery, [id]);
      comment.reactions = reactionsResult.rows;
    }

    return comment;
  }
}



