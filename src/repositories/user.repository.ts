import { pool } from '../config/database';
import { UserWithDetails, Comment, Reaction, Sentiment } from '../interfaces/models';
import { UserQueryOptions } from '../interfaces/query-options';

export class UserRepository {
  async findAll(options: UserQueryOptions = {}): Promise<UserWithDetails[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'inserted_at',
      orderDirection = 'DESC',
      fb_profile_id,
      full_name,
      includeComments,
      includeReactions,
      includeStats,
      onlyWithComments = false,
    } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (fb_profile_id) {
      whereClauses.push(`u.fb_profile_id = $${paramCount++}`);
      params.push(fb_profile_id);
    }

    if (full_name) {
      whereClauses.push(`u.full_name ILIKE $${paramCount++}`);
      params.push(`%${full_name}%`);
    }

    if (onlyWithComments) {
      whereClauses.push(`EXISTS (SELECT 1 FROM comments c WHERE c.user_id = u.id)`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const selectFields = ['u.*'];

    if (includeComments || includeStats) {
      selectFields.push('COALESCE(comment_count_sub.count, 0)::int AS comment_count');
    }

    if (includeReactions || includeStats) {
      selectFields.push('COALESCE(reaction_count_sub.count, 0)::int AS reaction_count');
    }

    if (includeStats) {
      selectFields.push(
        'COALESCE(stats_comments.total_comments, 0)::int AS stats_total_comments',
        'COALESCE(stats_comments.posts_commented, 0)::int AS stats_posts_commented',
        'COALESCE(stats_reactions.total_reactions, 0)::int AS stats_total_reactions',
        'COALESCE(stats_sentiments.positive_comments, 0)::int AS stats_positive_comments',
        'COALESCE(stats_sentiments.neutral_comments, 0)::int AS stats_neutral_comments',
        'COALESCE(stats_sentiments.negative_comments, 0)::int AS stats_negative_comments',
        'stats_sentiments.average_polarity AS stats_average_polarity',
        'stats_top_pages.pages AS stats_top_pages'
      );
    }

    const statsJoins: string[] = [];

    if (includeComments || includeStats) {
      statsJoins.push(`LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count
        FROM comments c
        WHERE c.user_id = u.id
      ) comment_count_sub ON TRUE`);
    }

    if (includeReactions || includeStats) {
      statsJoins.push(`LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count
        FROM reactions r
        WHERE r.user_id = u.id
      ) reaction_count_sub ON TRUE`);
    }

    if (includeStats) {
      statsJoins.push(
        `LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS total_comments,
            COUNT(DISTINCT post_id)::int AS posts_commented
          FROM comments c
          WHERE c.user_id = u.id
        ) stats_comments ON TRUE`,
        `LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total_reactions
          FROM reactions r
          WHERE r.user_id = u.id
        ) stats_reactions ON TRUE`,
        `LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'positive')::int AS positive_comments,
            COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'neutral')::int AS neutral_comments,
            COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'negative')::int AS negative_comments,
            AVG(s.polarity) AS average_polarity
          FROM sentiments s
          JOIN comments c ON s.comment_id = c.id
          WHERE c.user_id = u.id
        ) stats_sentiments ON TRUE`,
        `LEFT JOIN LATERAL (
          SELECT jsonb_agg(
                   jsonb_build_object(
                     'page_id', page_id,
                     'page_name', page_name,
                     'comment_count', comment_count,
                     'positive_comments', positive_comments,
                     'neutral_comments', neutral_comments,
                     'negative_comments', negative_comments,
                     'average_polarity', average_polarity
                   ) ORDER BY comment_count DESC
                 ) AS pages
          FROM (
            SELECT
              p.page_id,
              COALESCE(pg.page_name, pg.page_url, 'Unknown Page') AS page_name,
              COUNT(DISTINCT c.id)::int AS comment_count,
              COUNT(DISTINCT c.id) FILTER (WHERE LOWER(s.sentiment_category) = 'positive')::int AS positive_comments,
              COUNT(DISTINCT c.id) FILTER (WHERE LOWER(s.sentiment_category) = 'neutral')::int AS neutral_comments,
              COUNT(DISTINCT c.id) FILTER (WHERE LOWER(s.sentiment_category) = 'negative')::int AS negative_comments,
              AVG(s.polarity) AS average_polarity
            FROM comments c
            JOIN posts p ON c.post_id = p.id
            LEFT JOIN pages pg ON p.page_id = pg.id
            LEFT JOIN sentiments s ON s.comment_id = c.id
            WHERE c.user_id = u.id
            GROUP BY p.page_id, pg.page_name, pg.page_url
            ORDER BY comment_count DESC
            LIMIT 3
          ) ranked
        ) stats_top_pages ON TRUE`
      );
    }

    const query = `
      SELECT ${selectFields.join(',\n        ')}
      FROM users u
      ${statsJoins.length > 0 ? statsJoins.join('\n      ') : ''}
      ${whereClause}
      ORDER BY u.${orderBy} ${orderDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    const users: UserWithDetails[] = result.rows.map((row) => {
      const {
        stats_total_comments,
        stats_posts_commented,
        stats_total_reactions,
        stats_positive_comments,
        stats_neutral_comments,
        stats_negative_comments,
        stats_average_polarity,
        stats_top_pages,
        ...rest
      } = row;

      const commentCount = rest.comment_count !== undefined && rest.comment_count !== null
        ? Number(rest.comment_count)
        : undefined;
      const reactionCount = rest.reaction_count !== undefined && rest.reaction_count !== null
        ? Number(rest.reaction_count)
        : undefined;

      let topPages: Array<{
        page_id: string | null;
        page_name: string | null;
        comment_count: number;
        sentiment_breakdown: {
          positive: number;
          neutral: number;
          negative: number;
          total: number;
          average_polarity: number | null;
        };
      }> = [];
      if (stats_top_pages) {
        let parsedPages: any = stats_top_pages;
        if (typeof parsedPages === 'string') {
          try {
            parsedPages = JSON.parse(parsedPages);
          } catch {
            parsedPages = [];
          }
        }
        if (Array.isArray(parsedPages)) {
          topPages = parsedPages.map((page) => {
            const positive = Number(page?.positive_comments ?? 0);
            const neutral = Number(page?.neutral_comments ?? 0);
            const negative = Number(page?.negative_comments ?? 0);
            const total = positive + neutral + negative;

            return {
              page_id: page?.page_id ?? null,
              page_name: page?.page_name ?? null,
              comment_count: Number(page?.comment_count ?? 0),
              sentiment_breakdown: {
                positive,
                neutral,
                negative,
                total,
                average_polarity:
                  page?.average_polarity !== null && page?.average_polarity !== undefined
                    ? Number(page.average_polarity)
                    : null,
              },
            };
          });
        }
      }

      const user: UserWithDetails = {
        ...(rest as UserWithDetails),
        comment_count: commentCount,
        reaction_count: reactionCount,
      };

      if (includeStats) {
        const positive = Number(stats_positive_comments ?? 0);
        const neutral = Number(stats_neutral_comments ?? 0);
        const negative = Number(stats_negative_comments ?? 0);
        const sentimentTotal = positive + neutral + negative;

        user.stats = {
          total_comments: Number(stats_total_comments ?? commentCount ?? 0),
          posts_commented: Number(stats_posts_commented ?? 0),
          total_reactions: Number(stats_total_reactions ?? reactionCount ?? 0),
          sentiment_breakdown: {
            positive,
            neutral,
            negative,
            total: sentimentTotal,
            average_polarity:
              stats_average_polarity !== null && stats_average_polarity !== undefined
                ? Number(stats_average_polarity)
                : null,
          },
          top_pages: topPages,
        };
      }

      return user;
    });

    // Fetch related data if requested
    if (users.length > 0) {
      const userIds = users.map((u) => u.id);

      if (includeComments) {
        const commentsQuery = `
          SELECT *
          FROM comments
          WHERE user_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const commentsResult = await pool.query(commentsQuery, [userIds]);

        const commentsByUserId: Record<string, Array<Comment & { sentiments?: Sentiment[] }>> = {};
        const commentIds: string[] = [];

        commentsResult.rows.forEach((row) => {
          const comment = { ...row } as Comment & { sentiments?: Sentiment[] };
          if (comment.user_id) {
            if (!commentsByUserId[comment.user_id]) {
              commentsByUserId[comment.user_id] = [];
            }
            commentsByUserId[comment.user_id].push(comment);
          }
          if (comment.id) {
            commentIds.push(comment.id);
          }
        });

        if (commentIds.length > 0) {
          const sentimentsQuery = `
            SELECT *
            FROM sentiments
            WHERE comment_id = ANY($1)
          `;
          const sentimentsResult = await pool.query(sentimentsQuery, [commentIds]);

          const sentimentsByCommentId = sentimentsResult.rows.reduce<Record<string, Sentiment[]>>((acc, row) => {
            if (!acc[row.comment_id]) {
              acc[row.comment_id] = [];
            }
            acc[row.comment_id].push(row);
            return acc;
          }, {});

          Object.values(commentsByUserId).forEach((userComments) => {
            userComments.forEach((comment) => {
              if (comment.id) {
                comment.sentiments = sentimentsByCommentId[comment.id] ?? [];
              }
            });
          });
        }

        users.forEach((user) => {
          user.comments = commentsByUserId[user.id] || [];
        });
      }

      if (includeReactions) {
        const reactionsQuery = `
          SELECT *
          FROM reactions
          WHERE user_id = ANY($1)
          ORDER BY inserted_at DESC
        `;
        const reactionsResult = await pool.query(reactionsQuery, [userIds]);

        const reactionsByUserId: Record<string, Reaction[]> = {};
        reactionsResult.rows.forEach((row) => {
          if (!reactionsByUserId[row.user_id]) {
            reactionsByUserId[row.user_id] = [];
          }
          reactionsByUserId[row.user_id].push(row);
        });

        users.forEach((user) => {
          user.reactions = reactionsByUserId[user.id] || [];
        });
      }
    }

    return users;
  }

  async findById(id: string, options: UserQueryOptions = {}): Promise<UserWithDetails | null> {
    const {
      includeComments,
      includeReactions,
      includeStats,
    } = options;

    const selectFields = ['u.*'];

    if (includeComments || includeStats) {
      selectFields.push('(SELECT COUNT(*)::int FROM comments WHERE user_id = u.id) AS comment_count');
    }

    if (includeReactions || includeStats) {
      selectFields.push('(SELECT COUNT(*)::int FROM reactions WHERE user_id = u.id) AS reaction_count');
    }

    // Try to find by UUID first, if that fails try fb_profile_id
    const query = `
      SELECT ${selectFields.join(',\n        ')}
      FROM users u
      WHERE u.id::text = $1 OR u.fb_profile_id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const user: UserWithDetails = {
      ...row,
      comment_count:
        row.comment_count !== undefined && row.comment_count !== null
          ? Number(row.comment_count)
          : undefined,
      reaction_count:
        row.reaction_count !== undefined && row.reaction_count !== null
          ? Number(row.reaction_count)
          : undefined,
    };

    if (includeComments) {
      const commentsQuery = `SELECT * FROM comments WHERE user_id = $1 ORDER BY inserted_at DESC`;
      const commentsResult = await pool.query(commentsQuery, [user.id]);
      const comments = commentsResult.rows.map((row) => ({ ...row } as Comment & { sentiments?: Sentiment[] }));

      const commentIds = comments
        .map((comment) => comment.id)
        .filter((id): id is string => Boolean(id));

      if (commentIds.length > 0) {
        const sentimentsQuery = `SELECT * FROM sentiments WHERE comment_id = ANY($1)`;
        const sentimentsResult = await pool.query(sentimentsQuery, [commentIds]);

        const sentimentsByCommentId = sentimentsResult.rows.reduce<Record<string, Sentiment[]>>((acc, row) => {
          if (!acc[row.comment_id]) {
            acc[row.comment_id] = [];
          }
          acc[row.comment_id].push(row);
          return acc;
        }, {});

        comments.forEach((comment) => {
          if (comment.id) {
            comment.sentiments = sentimentsByCommentId[comment.id] ?? [];
          }
        });
      }

      user.comments = comments;
    }

    if (includeReactions) {
      const reactionsQuery = `SELECT * FROM reactions WHERE user_id = $1 ORDER BY inserted_at DESC`;
      const reactionsResult = await pool.query(reactionsQuery, [user.id]);
      user.reactions = reactionsResult.rows;
    }

    if (includeStats) {
      const stats: UserWithDetails['stats'] = {
        total_comments: 0,
        posts_commented: 0,
        total_reactions: 0,
        sentiment_breakdown: {
          positive: 0,
          neutral: 0,
          negative: 0,
          total: 0,
          average_polarity: null,
        },
        top_pages: [],
      };

      const commentStatsQuery = `
        SELECT COUNT(*)::int AS total_comments,
               COUNT(DISTINCT post_id)::int AS posts_commented
        FROM comments
        WHERE user_id = $1
      `;
      const commentStatsResult = await pool.query(commentStatsQuery, [user.id]);
      if (commentStatsResult.rows[0]) {
        stats.total_comments = Number(commentStatsResult.rows[0].total_comments ?? 0);
        stats.posts_commented = Number(commentStatsResult.rows[0].posts_commented ?? 0);
      }

      const reactionStatsQuery = `
        SELECT COUNT(*)::int AS total_reactions
        FROM reactions
        WHERE user_id = $1
      `;
      const reactionStatsResult = await pool.query(reactionStatsQuery, [user.id]);
      if (reactionStatsResult.rows[0]) {
        stats.total_reactions = Number(reactionStatsResult.rows[0].total_reactions ?? 0);
      }

      const sentimentStatsQuery = `
        SELECT
          COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'positive')::int AS positive_comments,
          COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'neutral')::int AS neutral_comments,
          COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'negative')::int AS negative_comments,
          AVG(s.polarity) AS average_polarity
        FROM sentiments s
        JOIN comments c ON s.comment_id = c.id
        WHERE c.user_id = $1
      `;
      const sentimentStatsResult = await pool.query(sentimentStatsQuery, [user.id]);
      if (sentimentStatsResult.rows[0]) {
        const positive = Number(sentimentStatsResult.rows[0].positive_comments ?? 0);
        const neutral = Number(sentimentStatsResult.rows[0].neutral_comments ?? 0);
        const negative = Number(sentimentStatsResult.rows[0].negative_comments ?? 0);
        const total = positive + neutral + negative;
        stats.sentiment_breakdown = {
          positive,
          neutral,
          negative,
          total,
          average_polarity:
            sentimentStatsResult.rows[0].average_polarity !== null &&
            sentimentStatsResult.rows[0].average_polarity !== undefined
              ? Number(sentimentStatsResult.rows[0].average_polarity)
              : null,
        };
      }

      const topPagesQuery = `
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'page_id', page_id,
                   'page_name', page_name,
                   'comment_count', comment_count,
                   'positive_comments', positive_comments,
                   'neutral_comments', neutral_comments,
                   'negative_comments', negative_comments,
                   'average_polarity', average_polarity
                 )
                 ORDER BY comment_count DESC
               ) AS pages
        FROM (
          SELECT
            p.page_id,
            COALESCE(pg.page_name, pg.page_url, 'Unknown Page') AS page_name,
            COUNT(DISTINCT c.id)::int AS comment_count,
            COUNT(DISTINCT c.id) FILTER (WHERE LOWER(s.sentiment_category) = 'positive')::int AS positive_comments,
            COUNT(DISTINCT c.id) FILTER (WHERE LOWER(s.sentiment_category) = 'neutral')::int AS neutral_comments,
            COUNT(DISTINCT c.id) FILTER (WHERE LOWER(s.sentiment_category) = 'negative')::int AS negative_comments,
            AVG(s.polarity) AS average_polarity
          FROM comments c
          JOIN posts p ON c.post_id = p.id
          LEFT JOIN pages pg ON p.page_id = pg.id
          LEFT JOIN sentiments s ON s.comment_id = c.id
          WHERE c.user_id = $1
          GROUP BY p.page_id, pg.page_name, pg.page_url
          ORDER BY comment_count DESC
          LIMIT 3
        ) ranked
      `;
      const topPagesResult = await pool.query(topPagesQuery, [user.id]);
      const pagesValue = topPagesResult.rows[0]?.pages;
      if (pagesValue) {
        let parsedPages: any = pagesValue;
        if (typeof parsedPages === 'string') {
          try {
            parsedPages = JSON.parse(parsedPages);
          } catch {
            parsedPages = [];
          }
        }

        if (Array.isArray(parsedPages)) {
          stats.top_pages = parsedPages.map((page: any) => {
            const positive = Number(page?.positive_comments ?? 0);
            const neutral = Number(page?.neutral_comments ?? 0);
            const negative = Number(page?.negative_comments ?? 0);
            const total = positive + neutral + negative;

            return {
              page_id: page?.page_id ?? null,
              page_name: page?.page_name ?? null,
              comment_count: Number(page?.comment_count ?? 0),
              sentiment_breakdown: {
                positive,
                neutral,
                negative,
                total,
                average_polarity:
                  page?.average_polarity !== null && page?.average_polarity !== undefined
                    ? Number(page.average_polarity)
                    : null,
              },
            };
          });
        }
      }

      user.stats = stats;
    }

    return user;
  }
}




