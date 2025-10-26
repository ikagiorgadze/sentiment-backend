import { pool } from '../config/database';
import { QueryOptions } from '../interfaces/query-options';

export class AnalyticsRepository {
  private async hasPostAccess(postId: string, userId: string, role: string): Promise<boolean> {
    if (role === 'admin') {
      return true;
    }

    const result = await pool.query(
      `SELECT 1 FROM user_post_access WHERE auth_user_id = $1 AND post_id = $2`,
      [userId, postId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get all users who commented on a specific post
  async getUsersByPostId(postId: string, userId: string, role: string, options: QueryOptions = {}): Promise<any[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'comment_count',
      orderDirection = 'DESC',
    } = options;

    const params: any[] = [postId];
    let paramIndex = 2;
    let accessClause = '';

    if (role !== 'admin') {
      accessClause = `
        AND EXISTS (
          SELECT 1
          FROM user_post_access upa
          WHERE upa.post_id = c.post_id
            AND upa.auth_user_id = $${paramIndex++}
        )
      `;
      params.push(userId);
    }

    const allowedOrderColumns = ['comment_count', 'last_comment_at', 'username', 'full_name', 'email', 'inserted_at'];
    const orderColumn = allowedOrderColumns.includes(orderBy) ? orderBy : 'comment_count';
    const direction = orderDirection === 'ASC' ? 'ASC' : 'DESC';

    const orderExpression = (() => {
      switch (orderColumn) {
        case 'username':
          return 'u.username';
        case 'full_name':
          return 'u.full_name';
        case 'email':
          return 'u.email';
        case 'inserted_at':
          return 'u.inserted_at';
        case 'last_comment_at':
          return 'last_comment_at';
        case 'comment_count':
        default:
          return 'comment_count';
      }
    })();

    const query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.fb_profile_id,
        u.full_name,
        u.inserted_at,
        COUNT(c.id)::int AS comment_count,
        MAX(c.inserted_at) AS last_comment_at
      FROM users u
      INNER JOIN comments c ON u.id = c.user_id
      WHERE c.post_id = $1
      ${accessClause}
      GROUP BY u.id, u.username, u.email, u.fb_profile_id, u.full_name, u.inserted_at
      ORDER BY ${orderExpression} ${direction}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      fb_profile_id: row.fb_profile_id,
      full_name: row.full_name,
      inserted_at: row.inserted_at,
      comment_count: typeof row.comment_count === 'number' ? row.comment_count : Number(row.comment_count ?? 0),
      last_comment_at: row.last_comment_at,
    }));
  }

  // Get all posts where a specific user has commented
  async getPostsByUserId(targetUserId: string, userId: string, role: string, options: QueryOptions = {}): Promise<any[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'last_comment_at',
      orderDirection = 'DESC',
    } = options;

    const params: any[] = [targetUserId];
    let paramIndex = 2;

    let accessJoin = '';
    if (role !== 'admin') {
      accessJoin = `
        INNER JOIN user_post_access upa
          ON upa.post_id = p.id
         AND upa.auth_user_id = $${paramIndex++}
      `;
      params.push(userId);
    }

    const allowedOrderColumns = ['last_comment_at', 'user_comment_count', 'inserted_at', 'posted_at', 'page_name', 'page_url'];
    const orderColumn = allowedOrderColumns.includes(orderBy) ? orderBy : 'last_comment_at';
    const direction = orderDirection === 'ASC' ? 'ASC' : 'DESC';
    const orderExpression = (() => {
      switch (orderColumn) {
        case 'page_name':
          return 'pg.page_name';
        case 'page_url':
          return 'pg.page_url';
        case 'inserted_at':
          return 'p.inserted_at';
        case 'posted_at':
          return 'p.posted_at';
        case 'user_comment_count':
          return 'user_comment_count';
        case 'last_comment_at':
        default:
          return 'last_comment_at';
      }
    })();

      const query = `
        SELECT
          p.id,
          p.page_id,
          p.full_url,
          p.content,
          p.posted_at,
          p.inserted_at,
          pg.id as "page.id",
          pg.page_url as "page.page_url",
          pg.page_name as "page.page_name",
          pg.inserted_at as "page.inserted_at",
          COUNT(c.id)::int AS user_comment_count,
          MAX(c.inserted_at) AS last_comment_at
        FROM posts p
        LEFT JOIN pages pg ON p.page_id = pg.id
        INNER JOIN comments c ON p.id = c.post_id
        ${accessJoin}
        WHERE c.user_id = $1
        GROUP BY
          p.id, p.page_id, p.full_url, p.content, p.posted_at, p.inserted_at,
          pg.id, pg.page_url, pg.page_name, pg.inserted_at
        ORDER BY ${orderExpression} ${direction}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows.map((row) => ({
        id: row.id,
        page_id: row.page_id,
        full_url: row.full_url,
        content: row.content,
        posted_at: row.posted_at,
        inserted_at: row.inserted_at,
        user_comment_count: typeof row.user_comment_count === 'number' ? row.user_comment_count : Number(row.user_comment_count ?? 0),
        last_comment_at: row.last_comment_at,
        page: row['page.id']
          ? {
              id: row['page.id'],
              page_url: row['page.page_url'],
              page_name: row['page.page_name'],
              inserted_at: row['page.inserted_at'],
            }
          : null,
      }));
    }

  // Get post sentiments only (where comment_id is NULL)
  async getPostSentiments(postId: string, userId: string, role: string): Promise<any[]> {
      const hasAccess = await this.hasPostAccess(postId, userId, role);
      if (!hasAccess) {
        return [];
      }

      const query = `
        SELECT s.*
        FROM sentiments s
        WHERE s.post_id = $1 AND s.comment_id IS NULL
        ORDER BY s.inserted_at DESC
      `;

      const result = await pool.query(query, [postId]);
      return result.rows;
    }

  // Get comment sentiments for a post
  async getCommentSentimentsByPostId(postId: string, userId: string, role: string): Promise<any[]> {
      const hasAccess = await this.hasPostAccess(postId, userId, role);
      if (!hasAccess) {
        return [];
      }

      const query = `
        SELECT
          s.*,
          c.id as "comment.id",
          c.content as "comment.content",
          c.user_id as "comment.user_id",
          u.username as "comment.user.username",
          u.full_name as "comment.user.full_name"
        FROM sentiments s
        INNER JOIN comments c ON s.comment_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY s.inserted_at DESC
      `;

      const result = await pool.query(query, [postId]);
      return result.rows.map((row) => ({
        id: row.id,
        post_id: row.post_id,
        comment_id: row.comment_id,
        sentiment: row.sentiment,
        sentiment_category: row.sentiment_category,
        confidence: row.confidence,
        probabilities: row.probabilities,
        polarity: row.polarity,
        inserted_at: row.inserted_at,
        comment: {
          id: row['comment.id'],
          content: row['comment.content'],
          user_id: row['comment.user_id'],
          user: {
            username: row['comment.user.username'],
            full_name: row['comment.user.full_name'],
          },
        },
      }));
    }

  // Get sentiment summary for a post
  async getPostSentimentSummary(postId: string, userId: string, role: string): Promise<any | null> {
      const hasAccess = await this.hasPostAccess(postId, userId, role);
      if (!hasAccess) {
        return null;
      }

      const query = `
        SELECT
          sentiment_category,
          COUNT(*)::int as count,
          AVG(confidence) as avg_confidence,
          AVG(polarity) as avg_polarity
        FROM sentiments
        WHERE post_id = $1
        GROUP BY sentiment_category
        ORDER BY count DESC
      `;

      const result = await pool.query(query, [postId]);

      const totalQuery = `
        SELECT
          COUNT(*)::int as total_sentiments,
          AVG(confidence) as overall_avg_confidence,
          AVG(polarity) as overall_avg_polarity
        FROM sentiments
        WHERE post_id = $1
      `;

      const totalResult = await pool.query(totalQuery, [postId]);

      return {
        post_id: postId,
        total: totalResult.rows[0],
        by_category: result.rows,
      };
    }

  // Get comments with sentiment analysis included
  async getCommentsWithSentiment(postId: string | undefined, userId: string, role: string, options: QueryOptions = {}): Promise<any[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'inserted_at',
      orderDirection = 'DESC',
    } = options;

    if (postId) {
      const hasAccess = await this.hasPostAccess(postId, userId, role);
      if (!hasAccess) {
        return [];
      }
    }

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (postId) {
      whereClauses.push(`c.post_id = $${paramIndex++}`);
      params.push(postId);
    }

    let accessJoin = '';
    if (role !== 'admin') {
      accessJoin = `
        INNER JOIN user_post_access upa
          ON upa.post_id = p.id
         AND upa.auth_user_id = $${paramIndex++}
      `;
      params.push(userId);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const allowedOrderColumns = ['inserted_at', 'sentiment_category', 'username', 'full_name'];
    const orderColumn = allowedOrderColumns.includes(orderBy) ? orderBy : 'inserted_at';
    const direction = orderDirection === 'ASC' ? 'ASC' : 'DESC';
    const orderExpression = (() => {
      switch (orderColumn) {
        case 'sentiment_category':
          return 's.sentiment_category';
        case 'username':
          return 'u.username';
        case 'full_name':
          return 'u.full_name';
        case 'inserted_at':
        default:
          return 'c.inserted_at';
      }
    })();

    const query = `
      SELECT
        c.*,
        p.id as "post.id",
        p.page_id as "post.page_id",
        p.full_url as "post.full_url",
        p.content as "post.content",
        p.posted_at as "post.posted_at",
        p.inserted_at as "post.inserted_at",
        pg.id as "post.page.id",
        pg.page_url as "post.page.page_url",
        pg.page_name as "post.page.page_name",
        pg.inserted_at as "post.page.inserted_at",
        u.username,
        u.full_name,
        s.id as "sentiment.id",
        s.sentiment as "sentiment.sentiment",
        s.sentiment_category as "sentiment.sentiment_category",
        s.confidence as "sentiment.confidence",
        s.polarity as "sentiment.polarity"
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      LEFT JOIN pages pg ON p.page_id = pg.id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN sentiments s ON s.comment_id = c.id
      ${accessJoin}
      ${whereClause}
      ORDER BY ${orderExpression} ${direction}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      id: row.id,
      full_url: row.full_url,
      post_id: row.post_id,
      user_id: row.user_id,
      content: row.content,
      inserted_at: row.inserted_at,
      post: row['post.id']
        ? {
            id: row['post.id'],
            page_id: row['post.page_id'],
            full_url: row['post.full_url'],
            content: row['post.content'],
            posted_at: row['post.posted_at'],
            inserted_at: row['post.inserted_at'],
            page: row['post.page.id']
              ? {
                  id: row['post.page.id'],
                  page_url: row['post.page.page_url'],
                  page_name: row['post.page.page_name'],
                  inserted_at: row['post.page.inserted_at'],
                }
              : null,
          }
        : null,
      user: row.username || row.full_name
        ? {
            username: row.username,
            full_name: row.full_name,
          }
        : null,
      sentiment: row['sentiment.id']
        ? {
            id: row['sentiment.id'],
            sentiment: row['sentiment.sentiment'],
            sentiment_category: row['sentiment.sentiment_category'],
            confidence: row['sentiment.confidence'],
            polarity: row['sentiment.polarity'],
          }
        : null,
    }));
  }

  // Get user activity on a specific post
  async getUserActivityOnPost(targetUserId: string, postId: string, userId: string, role: string): Promise<any | null> {
    const hasAccess = await this.hasPostAccess(postId, userId, role);
    if (!hasAccess) {
      return null;
    }

    const commentsQuery = `
      SELECT
        c.*,
        s.id as "sentiment.id",
        s.sentiment_category as "sentiment.sentiment_category",
        s.confidence as "sentiment.confidence"
      FROM comments c
      LEFT JOIN sentiments s ON s.comment_id = c.id
      WHERE c.user_id = $1 AND c.post_id = $2
      ORDER BY c.inserted_at DESC
    `;

    const reactionsQuery = `
      SELECT * FROM reactions
      WHERE user_id = $1 AND post_id = $2
    `;

    const [commentsResult, reactionsResult] = await Promise.all([
      pool.query(commentsQuery, [targetUserId, postId]),
      pool.query(reactionsQuery, [targetUserId, postId]),
    ]);

    return {
      user_id: targetUserId,
      post_id: postId,
      comments: commentsResult.rows.map((row) => ({
        id: row.id,
        content: row.content,
        inserted_at: row.inserted_at,
        sentiment: row['sentiment.id']
          ? {
              id: row['sentiment.id'],
              sentiment_category: row['sentiment.sentiment_category'],
              confidence: row['sentiment.confidence'],
            }
          : null,
      })),
      reactions: reactionsResult.rows,
      comment_count: commentsResult.rows.length,
      reaction_count: reactionsResult.rows.length,
    };
  }

  // Get dashboard statistics
  async getDashboardStats(userId: string, role: string): Promise<any> {
    const postsQuery = role === 'admin'
      ? `SELECT COUNT(*)::int as total_posts FROM posts`
      : `
        SELECT COUNT(DISTINCT p.id)::int as total_posts
        FROM posts p
        INNER JOIN user_post_access upa ON upa.post_id = p.id
        WHERE upa.auth_user_id = $1
      `;
    const postsParams = role === 'admin' ? [] : [userId];
    const postsResult = await pool.query(postsQuery, postsParams);
    const totalPosts = postsResult.rows[0]?.total_posts ?? 0;

    const sentimentQuery = role === 'admin'
      ? `
        SELECT
          LOWER(sentiment_category) AS sentiment_category,
          COUNT(*)::int AS count
        FROM sentiments
        WHERE post_id IS NOT NULL
          AND comment_id IS NULL
          AND sentiment_category IS NOT NULL
        GROUP BY LOWER(sentiment_category)
      `
      : `
        SELECT
          LOWER(s.sentiment_category) AS sentiment_category,
          COUNT(*)::int AS count
        FROM sentiments s
        INNER JOIN posts p ON s.post_id = p.id
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
        WHERE s.post_id IS NOT NULL
          AND s.comment_id IS NULL
          AND s.sentiment_category IS NOT NULL
        GROUP BY LOWER(s.sentiment_category)
      `;
    const sentimentParams = role === 'admin' ? [] : [userId];
    const sentimentResult = await pool.query(sentimentQuery, sentimentParams);

    const sentimentCounts = {
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    sentimentResult.rows.forEach((row) => {
      switch (row.sentiment_category) {
        case 'positive':
          sentimentCounts.positive = row.count;
          break;
        case 'negative':
          sentimentCounts.negative = row.count;
          break;
        case 'neutral':
          sentimentCounts.neutral = row.count;
          break;
        default:
          break;
      }
    });

    const engagementQuery = role === 'admin'
      ? `
        SELECT
          COUNT(DISTINCT c.id)::float / NULLIF(COUNT(DISTINCT p.id), 0) as avg_comments,
          COUNT(DISTINCT r.id)::float / NULLIF(COUNT(DISTINCT p.id), 0) as avg_reactions
        FROM posts p
        LEFT JOIN comments c ON c.post_id = p.id
        LEFT JOIN reactions r ON r.post_id = p.id
      `
      : `
        SELECT
          COUNT(DISTINCT c.id)::float / NULLIF(COUNT(DISTINCT p.id), 0) as avg_comments,
          COUNT(DISTINCT r.id)::float / NULLIF(COUNT(DISTINCT p.id), 0) as avg_reactions
        FROM posts p
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
        LEFT JOIN comments c ON c.post_id = p.id
        LEFT JOIN reactions r ON r.post_id = p.id
      `;
    const engagementParams = role === 'admin' ? [] : [userId];
    const engagementResult = await pool.query(engagementQuery, engagementParams);
    const avgCommentsPerPost = Number(engagementResult.rows[0]?.avg_comments ?? 0);
    const avgReactionsPerPost = Number(engagementResult.rows[0]?.avg_reactions ?? 0);
    const avgEngagementRaw = (avgCommentsPerPost + avgReactionsPerPost) * 10;

    const trendQuery = role === 'admin'
      ? `
        SELECT
          DATE_TRUNC('hour', inserted_at) as date,
          LOWER(sentiment_category) AS sentiment_category,
          COUNT(*)::int AS count
        FROM sentiments
        WHERE inserted_at >= NOW() - INTERVAL '24 hours'
          AND post_id IS NOT NULL
          AND comment_id IS NULL
          AND sentiment_category IS NOT NULL
        GROUP BY DATE_TRUNC('hour', inserted_at), LOWER(sentiment_category)
        ORDER BY date DESC
      `
      : `
        SELECT
          DATE_TRUNC('hour', s.inserted_at) as date,
          LOWER(s.sentiment_category) AS sentiment_category,
          COUNT(*)::int AS count
        FROM sentiments s
        INNER JOIN posts p ON s.post_id = p.id
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
        WHERE s.inserted_at >= NOW() - INTERVAL '24 hours'
          AND s.post_id IS NOT NULL
          AND s.comment_id IS NULL
          AND s.sentiment_category IS NOT NULL
        GROUP BY DATE_TRUNC('hour', s.inserted_at), LOWER(s.sentiment_category)
        ORDER BY date DESC
      `;
    const trendParams = role === 'admin' ? [] : [userId];
    const trendResult = await pool.query(trendQuery, trendParams);

    const sentimentTrend: { date: string; positive: number; negative: number; neutral: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const date = new Date();
      date.setHours(date.getHours() - i);
      const dateStr = date.toISOString();
      sentimentTrend.push({
        date: dateStr,
        positive: 0,
        negative: 0,
        neutral: 0,
      });
    }

    trendResult.rows.forEach((row) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString() : row.date;
      const trendEntry = sentimentTrend.find((t) => t.date === dateStr);
      if (trendEntry) {
        switch (row.sentiment_category) {
          case 'positive':
            trendEntry.positive = row.count;
            break;
          case 'negative':
            trendEntry.negative = row.count;
            break;
          case 'neutral':
            trendEntry.neutral = row.count;
            break;
          default:
            break;
        }
      }
    });

    const pageCountsQuery = role === 'admin'
      ? `
        SELECT
          COUNT(*)::int AS total_pages,
          COUNT(*) FILTER (WHERE inserted_at >= NOW() - INTERVAL '30 days')::int AS pages_added_30d
        FROM pages
      `
      : `
        SELECT
          COUNT(DISTINCT pg.id)::int AS total_pages,
          COUNT(DISTINCT CASE WHEN pg.inserted_at >= NOW() - INTERVAL '30 days' THEN pg.id END)::int AS pages_added_30d
        FROM pages pg
        INNER JOIN posts p ON p.page_id = pg.id
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
      `;
    const pageCountsParams = role === 'admin' ? [] : [userId];
    const pageCountsResult = await pool.query(pageCountsQuery, pageCountsParams);
    const totalPages = pageCountsResult.rows[0]?.total_pages ?? 0;
    const pagesAddedLast30Days = pageCountsResult.rows[0]?.pages_added_30d ?? 0;

    const activePagesQuery = role === 'admin'
      ? `
        SELECT COUNT(DISTINCT pg.id)::int AS active_pages
        FROM pages pg
        INNER JOIN posts p ON p.page_id = pg.id
        WHERE COALESCE(p.posted_at, p.inserted_at) >= NOW() - INTERVAL '7 days'
      `
      : `
        SELECT COUNT(DISTINCT pg.id)::int AS active_pages
        FROM pages pg
        INNER JOIN posts p ON p.page_id = pg.id
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
        WHERE COALESCE(p.posted_at, p.inserted_at) >= NOW() - INTERVAL '7 days'
      `;
    const activePagesParams = role === 'admin' ? [] : [userId];
    const activePagesResult = await pool.query(activePagesQuery, activePagesParams);
    const activePagesLast7Days = activePagesResult.rows[0]?.active_pages ?? 0;

    const commentsCountQuery = role === 'admin'
      ? `SELECT COUNT(*)::int AS total_comments FROM comments`
      : `
        SELECT COUNT(c.id)::int AS total_comments
        FROM comments c
        INNER JOIN posts p ON c.post_id = p.id
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
      `;
    const commentsCountParams = role === 'admin' ? [] : [userId];
    const commentsCountResult = await pool.query(commentsCountQuery, commentsCountParams);
    const totalComments = commentsCountResult.rows[0]?.total_comments ?? 0;

    const postsWindowQuery = (interval: string) => role === 'admin'
      ? `
        SELECT COUNT(*)::int AS count
        FROM posts p
        WHERE COALESCE(p.posted_at, p.inserted_at) >= NOW() - INTERVAL '${interval}'
      `
      : `
        SELECT COUNT(DISTINCT p.id)::int AS count
        FROM posts p
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
        WHERE COALESCE(p.posted_at, p.inserted_at) >= NOW() - INTERVAL '${interval}'
      `;

    const postsLast24HoursResult = await pool.query(postsWindowQuery('24 hours'), role === 'admin' ? [] : [userId]);
    const postsLast7DaysResult = await pool.query(postsWindowQuery('7 days'), role === 'admin' ? [] : [userId]);
    const postsLast24Hours = postsLast24HoursResult.rows[0]?.count ?? 0;
    const postsLast7Days = postsLast7DaysResult.rows[0]?.count ?? 0;

    const uniqueCommentersQuery = role === 'admin'
      ? `
        SELECT COUNT(DISTINCT c.user_id)::int AS unique_commenters
        FROM comments c
        WHERE c.user_id IS NOT NULL
      `
      : `
        SELECT COUNT(DISTINCT c.user_id)::int AS unique_commenters
        FROM comments c
        INNER JOIN posts p ON c.post_id = p.id
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
        WHERE c.user_id IS NOT NULL
      `;
    const uniqueCommentersParams = role === 'admin' ? [] : [userId];
    const uniqueCommentersResult = await pool.query(uniqueCommentersQuery, uniqueCommentersParams);
    const uniqueCommenters = uniqueCommentersResult.rows[0]?.unique_commenters ?? 0;

    const sentimentConfidenceQuery = role === 'admin'
      ? `
        SELECT AVG(s.confidence)::float AS avg_confidence
        FROM sentiments s
        WHERE s.post_id IS NOT NULL
          AND s.comment_id IS NULL
          AND s.confidence IS NOT NULL
      `
      : `
        SELECT AVG(s.confidence)::float AS avg_confidence
        FROM sentiments s
        INNER JOIN posts p ON s.post_id = p.id
        INNER JOIN user_post_access upa ON upa.post_id = p.id AND upa.auth_user_id = $1
        WHERE s.post_id IS NOT NULL
          AND s.comment_id IS NULL
          AND s.confidence IS NOT NULL
      `;
    const sentimentConfidenceParams = role === 'admin' ? [] : [userId];
    const sentimentConfidenceResult = await pool.query(sentimentConfidenceQuery, sentimentConfidenceParams);
    const avgSentimentConfidenceRaw = Number(sentimentConfidenceResult.rows[0]?.avg_confidence ?? 0);

    const avgPostsPerPage = totalPages > 0 ? totalPosts / totalPages : 0;
    const avgCommentsPerPage = totalPages > 0 ? totalComments / totalPages : 0;

    return {
      totalPosts,
      positivePosts: sentimentCounts.positive,
      negativePosts: sentimentCounts.negative,
      neutralPosts: sentimentCounts.neutral,
      avgEngagement: Math.round(avgEngagementRaw * 10) / 10,
      sentimentTrend,
      pageSummary: {
        totalPages,
        activePagesLast7Days,
        pagesAddedLast30Days,
        avgPostsPerPage,
        avgCommentsPerPage,
      },
      postSummary: {
        postsLast24Hours,
        postsLast7Days,
        avgCommentsPerPost,
        avgReactionsPerPost,
        uniqueCommenters,
        avgSentimentConfidence: avgSentimentConfidenceRaw,
      },
    };
  }
  }



