import { pool } from '../config/database';
import { PostWithDetails, Comment, Sentiment, Reaction } from '../interfaces/models';
import { PostQueryOptions } from '../interfaces/query-options';

export class PostRepository {
  private mapPostRow(row: any): PostWithDetails {
    const post: PostWithDetails = {
      id: row.id,
      page_id: row.page_id,
      full_url: row.full_url,
      content: row.content,
      posted_at: row.posted_at,
      inserted_at: row.inserted_at,
      comment_count: typeof row.comment_count === 'number' ? row.comment_count : Number(row.comment_count ?? 0),
    };

    if (row.reaction_count !== undefined) {
      post.reaction_count = typeof row.reaction_count === 'number'
        ? row.reaction_count
        : Number(row.reaction_count ?? 0);
    }

    if (row.engagement_score !== undefined) {
      post.engagement_score = typeof row.engagement_score === 'number'
        ? row.engagement_score
        : Number(row.engagement_score ?? 0);
    }

    if (row['page.id']) {
      post.page = {
        id: row['page.id'],
        page_url: row['page.page_url'],
        page_name: row['page.page_name'],
        inserted_at: row['page.inserted_at'],
      };
    }

    return post;
  }

  // Check if user has access to a post
  async hasAccess(postId: string, userId: string, role: string): Promise<boolean> {
    // Admins have access to everything
    if (role === 'admin') {
      return true;
    }

    // Check user_post_access table
    const query = `
      SELECT 1 FROM user_post_access
      WHERE auth_user_id = $1 AND post_id = $2
    `;
    
    const result = await pool.query(query, [userId, postId]);
    return result.rows.length > 0;
  }

  // Find all posts with access control
  async findAllWithAccess(userId: string, role: string, options: PostQueryOptions = {}): Promise<PostWithDetails[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'inserted_at',
      orderDirection = 'DESC',
      page_id,
      page_url,
      page_name,
      full_url,
      includeComments,
      includeSentiments,
      includeReactions,
      includePage = true,
      sentiment,
      search,
    } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (page_id) {
      whereClauses.push(`p.page_id = $${paramCount++}`);
      params.push(page_id);
    }

    if (page_url) {
      whereClauses.push(`pg.page_url = $${paramCount++}`);
      params.push(page_url);
    }

    if (page_name) {
      whereClauses.push(`pg.page_name = $${paramCount++}`);
      params.push(page_name);
    }

    if (full_url) {
      whereClauses.push(`p.full_url = $${paramCount++}`);
      params.push(full_url);
    }

    if (sentiment) {
      whereClauses.push(`EXISTS (
        SELECT 1
        FROM (
          SELECT s.sentiment, s.sentiment_category
          FROM sentiments s
          WHERE s.post_id = p.id
            AND s.comment_id IS NULL
          ORDER BY s.inserted_at DESC
          LIMIT 1
        ) latest
        WHERE (
          (latest.sentiment_category IS NOT NULL AND LOWER(latest.sentiment_category) = LOWER($${paramCount}))
          OR (latest.sentiment IS NOT NULL AND LOWER(latest.sentiment) = LOWER($${paramCount}))
        )
      )`);
      params.push(sentiment);
      paramCount += 1;
    }

    if (search) {
      whereClauses.push(`p.content ILIKE $${paramCount++}`);
      params.push(`%${search}%`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const commentCountExpr = 'COALESCE((SELECT COUNT(*) FROM comments WHERE post_id = p.id), 0)';
    const reactionCountExpr = 'COALESCE((SELECT COUNT(*) FROM reactions WHERE post_id = p.id), 0)';

    const selectFields = [
      'p.*',
      `${commentCountExpr}::int AS comment_count`,
      `${reactionCountExpr}::int AS reaction_count`,
      `(${commentCountExpr} + ${reactionCountExpr})::int AS engagement_score`,
    ];
    if (includePage) {
      selectFields.push(
        'pg.id as "page.id"',
        'pg.page_url as "page.page_url"',
        'pg.page_name as "page.page_name"',
        'pg.inserted_at as "page.inserted_at"'
      );
    }

    // Build access control join
    const accessJoin = role === 'admin' 
      ? '' 
      : `INNER JOIN user_post_access upa ON p.id = upa.post_id AND upa.auth_user_id = $${paramCount++}`;
    
    if (role !== 'admin') {
      params.push(userId);
    }

    let orderExpression: string;
    switch (orderBy) {
      case 'posted_at':
        orderExpression = 'p.posted_at';
        break;
      case 'comment_count':
        orderExpression = 'comment_count';
        break;
      case 'reaction_count':
        orderExpression = 'reaction_count';
        break;
      case 'engagement_score':
        orderExpression = 'engagement_score';
        break;
      case 'content':
        orderExpression = 'p.content';
        break;
      case 'inserted_at':
      default:
        orderExpression = 'p.inserted_at';
        break;
    }

    const direction = orderDirection === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT ${selectFields.join(', ')}
      FROM posts p
      LEFT JOIN pages pg ON p.page_id = pg.id
      ${accessJoin}
      ${whereClause}
      ORDER BY ${orderExpression} ${direction}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const posts: PostWithDetails[] = result.rows.map((row) => this.mapPostRow(row));

    // Fetch related data if requested
    if (posts.length > 0) {
      const postIds = posts.map((p) => p.id);

      if (includeComments) {
        const commentsQuery = `
          SELECT c.*, u.id as user_id, u.fb_profile_id, u.full_name
          FROM comments c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE c.post_id = ANY($1)
          ORDER BY c.inserted_at DESC
        `;
        const commentsResult = await pool.query(commentsQuery, [postIds]);
        
        // Group comments by post_id
        const commentsByPostId: { [key: string]: Comment[] } = {};
        commentsResult.rows.forEach((row) => {
          if (!commentsByPostId[row.post_id]) {
            commentsByPostId[row.post_id] = [];
          }
          commentsByPostId[row.post_id].push(row);
        });

        posts.forEach((post) => {
          post.comments = commentsByPostId[post.id] || [];
        });
      }

      if (includeSentiments) {
        const sentimentsQuery = `
          SELECT * FROM sentiments
          WHERE post_id = ANY($1)
            AND comment_id IS NULL
          ORDER BY inserted_at DESC
        `;
        const sentimentsResult = await pool.query(sentimentsQuery, [postIds]);
        
        const sentimentsByPostId: { [key: string]: Sentiment[] } = {};
        sentimentsResult.rows.forEach((row) => {
          if (!sentimentsByPostId[row.post_id]) {
            sentimentsByPostId[row.post_id] = [];
          }
          sentimentsByPostId[row.post_id].push(row);
        });

        posts.forEach((post) => {
          post.sentiments = sentimentsByPostId[post.id] || [];
        });
      }

      if (includeReactions) {
        const reactionsQuery = `
          SELECT * FROM reactions
          WHERE post_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const reactionsResult = await pool.query(reactionsQuery, [postIds]);
        
        const reactionsByPostId: { [key: string]: Reaction[] } = {};
        reactionsResult.rows.forEach((row) => {
          if (!reactionsByPostId[row.post_id]) {
            reactionsByPostId[row.post_id] = [];
          }
          reactionsByPostId[row.post_id].push(row);
        });

        posts.forEach((post) => {
          post.reactions = reactionsByPostId[post.id] || [];
        });
      }
    }

    return posts;
  }

  // Find post by ID with access control
  async findByIdWithAccess(id: string, userId: string, role: string, options: PostQueryOptions = {}): Promise<PostWithDetails | null> {
    // First check access
    const hasAccess = await this.hasAccess(id, userId, role);
    if (!hasAccess) {
      return null;
    }

    // If access is granted, return the post
    return this.findById(id, options);
  }

  async findAll(options: PostQueryOptions = {}): Promise<PostWithDetails[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'inserted_at',
      orderDirection = 'DESC',
      page_id,
      page_url,
      page_name,
      full_url,
      includeComments,
      includeSentiments,
      includeReactions,
      includePage = true,
    } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (page_id) {
      whereClauses.push(`p.page_id = $${paramCount++}`);
      params.push(page_id);
    }

    if (page_url) {
      whereClauses.push(`pg.page_url = $${paramCount++}`);
      params.push(page_url);
    }

    if (page_name) {
      whereClauses.push(`pg.page_name = $${paramCount++}`);
      params.push(page_name);
    }

    if (full_url) {
      whereClauses.push(`p.full_url = $${paramCount++}`);
      params.push(full_url);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const selectFields = [
      'p.*',
      'COALESCE((SELECT COUNT(*) FROM comments WHERE post_id = p.id), 0)::int AS comment_count',
    ];
    if (includeReactions) {
      selectFields.push('(SELECT COUNT(*)::int FROM reactions WHERE post_id = p.id) as reaction_count');
    }
    if (includePage) {
      selectFields.push(
        'pg.id as "page.id"',
        'pg.page_url as "page.page_url"',
        'pg.page_name as "page.page_name"',
        'pg.inserted_at as "page.inserted_at"'
      );
    }

    const query = `
      SELECT ${selectFields.join(', ')}
      FROM posts p
      LEFT JOIN pages pg ON p.page_id = pg.id
      ${whereClause}
      ORDER BY p.${orderBy} ${orderDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const posts: PostWithDetails[] = result.rows.map((row) => this.mapPostRow(row));

    // Fetch related data if requested
    if (posts.length > 0) {
      const postIds = posts.map((p) => p.id);

      if (includeComments) {
        const commentsQuery = `
          SELECT c.*, u.id as user_id, u.fb_profile_id, u.full_name
          FROM comments c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE c.post_id = ANY($1)
          ORDER BY c.inserted_at DESC
        `;
        const commentsResult = await pool.query(commentsQuery, [postIds]);
        
        // Group comments by post_id
        const commentsByPostId: { [key: string]: Comment[] } = {};
        commentsResult.rows.forEach((row) => {
          if (!commentsByPostId[row.post_id]) {
            commentsByPostId[row.post_id] = [];
          }
          commentsByPostId[row.post_id].push(row);
        });

        posts.forEach((post) => {
          post.comments = commentsByPostId[post.id] || [];
        });
      }

      if (includeSentiments) {
        const sentimentsQuery = `
          SELECT * FROM sentiments
          WHERE post_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const sentimentsResult = await pool.query(sentimentsQuery, [postIds]);
        
        const sentimentsByPostId: { [key: string]: Sentiment[] } = {};
        sentimentsResult.rows.forEach((row) => {
          if (!sentimentsByPostId[row.post_id]) {
            sentimentsByPostId[row.post_id] = [];
          }
          sentimentsByPostId[row.post_id].push(row);
        });

        posts.forEach((post) => {
          post.sentiments = sentimentsByPostId[post.id] || [];
        });
      }

      if (includeReactions) {
        const reactionsQuery = `
          SELECT * FROM reactions
          WHERE post_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const reactionsResult = await pool.query(reactionsQuery, [postIds]);
        
        const reactionsByPostId: { [key: string]: Reaction[] } = {};
        reactionsResult.rows.forEach((row) => {
          if (!reactionsByPostId[row.post_id]) {
            reactionsByPostId[row.post_id] = [];
          }
          reactionsByPostId[row.post_id].push(row);
        });

        posts.forEach((post) => {
          post.reactions = reactionsByPostId[post.id] || [];
        });
      }
    }

    return posts;
  }

  async findById(id: string, options: PostQueryOptions = {}): Promise<PostWithDetails | null> {
    const {
      includeComments,
      includeSentiments,
      includeReactions,
      includePage = true,
    } = options;

    const selectFields = [
      'p.*',
      'COALESCE((SELECT COUNT(*) FROM comments WHERE post_id = p.id), 0)::int AS comment_count',
    ];
    if (includeReactions) {
      selectFields.push('(SELECT COUNT(*)::int FROM reactions WHERE post_id = p.id) as reaction_count');
    }
    if (includePage) {
      selectFields.push(
        'pg.id as "page.id"',
        'pg.page_url as "page.page_url"',
        'pg.page_name as "page.page_name"',
        'pg.inserted_at as "page.inserted_at"'
      );
    }

    const query = `
      SELECT ${selectFields.join(', ')}
      FROM posts p
      LEFT JOIN pages pg ON p.page_id = pg.id
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const post: PostWithDetails = this.mapPostRow(result.rows[0]);

    // Fetch related data if requested
    if (includeComments) {
      const commentsQuery = `
        SELECT c.*, u.id as user_id, u.fb_profile_id, u.full_name
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.inserted_at DESC
      `;
      const commentsResult = await pool.query(commentsQuery, [id]);
      post.comments = commentsResult.rows;
    }

    if (includeSentiments) {
      const sentimentsQuery = `SELECT * FROM sentiments WHERE post_id = $1 ORDER BY inserted_at DESC`;
      const sentimentsResult = await pool.query(sentimentsQuery, [id]);
      post.sentiments = sentimentsResult.rows;
    }

    if (includeReactions) {
      const reactionsQuery = `SELECT * FROM reactions WHERE post_id = $1 ORDER BY inserted_at DESC`;
      const reactionsResult = await pool.query(reactionsQuery, [id]);
      post.reactions = reactionsResult.rows;
    }

    return post;
  }
}

