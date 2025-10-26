import { pool } from '../config/database';
import { PageWithStats } from '../interfaces/models';
import { PageQueryOptions } from '../interfaces/query-options';

export class PageRepository {
  async findAllWithAccess(userId: string, role: string, options: PageQueryOptions = {}): Promise<PageWithStats[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'page_name',
      orderDirection = 'ASC',
      page_url,
      page_name,
      includePostStats = true,
      sentiment,
    } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    let userParamPosition: number | null = null;
    if (role !== 'admin') {
      userParamPosition = paramCount;
      params.push(userId);
      paramCount += 1;
    }

    if (page_url) {
      whereClauses.push(`pg.page_url = $${paramCount++}`);
      params.push(page_url);
    }

    if (page_name) {
      whereClauses.push(`pg.page_name = $${paramCount++}`);
      params.push(page_name);
    }

    if (sentiment && includePostStats) {
      const normalized = sentiment.toLowerCase();
      if (normalized === 'positive') {
        whereClauses.push(`COALESCE(ss.positive_sentiments, 0) > 0`);
        whereClauses.push(`COALESCE(ss.positive_sentiments, 0) >= COALESCE(ss.neutral_sentiments, 0)`);
        whereClauses.push(`COALESCE(ss.positive_sentiments, 0) >= COALESCE(ss.negative_sentiments, 0)`);
      } else if (normalized === 'negative') {
        whereClauses.push(`COALESCE(ss.negative_sentiments, 0) > 0`);
        whereClauses.push(`COALESCE(ss.negative_sentiments, 0) >= COALESCE(ss.positive_sentiments, 0)`);
        whereClauses.push(`COALESCE(ss.negative_sentiments, 0) >= COALESCE(ss.neutral_sentiments, 0)`);
      } else if (normalized === 'neutral') {
        whereClauses.push(`COALESCE(ss.neutral_sentiments, 0) > 0`);
        whereClauses.push(`COALESCE(ss.neutral_sentiments, 0) >= COALESCE(ss.positive_sentiments, 0)`);
        whereClauses.push(`COALESCE(ss.neutral_sentiments, 0) >= COALESCE(ss.negative_sentiments, 0)`);
      }
    }

    if (role !== 'admin') {
      whereClauses.push('EXISTS (SELECT 1 FROM accessible_posts ap WHERE ap.page_id = pg.id)');
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const accessiblePostsCte = role === 'admin'
      ? `SELECT p.id, p.page_id, p.posted_at, p.inserted_at FROM posts p`
      : `
        SELECT p.id, p.page_id, p.posted_at, p.inserted_at
        FROM posts p
        INNER JOIN user_post_access upa
          ON upa.post_id = p.id
         AND upa.auth_user_id = $${userParamPosition}
      `;

    const selectFields = [
      'pg.id',
      'pg.page_url',
      'pg.page_name',
      'pg.inserted_at',
    ];

    const joinClauses: string[] = [];

    if (includePostStats) {
      selectFields.push(
        'COALESCE(ps.post_count, 0)::int AS post_count',
        'ps.last_post_at',
        'COALESCE(cs.comment_count, 0)::int AS comment_count',
        'COALESCE(rs.reaction_count, 0)::int AS reaction_count',
        '(COALESCE(cs.comment_count, 0) + COALESCE(rs.reaction_count, 0))::int AS engagement_score',
        'COALESCE(ss.total_sentiments, 0)::int AS total_sentiments',
        'COALESCE(ss.positive_sentiments, 0)::int AS positive_sentiments',
        'COALESCE(ss.neutral_sentiments, 0)::int AS neutral_sentiments',
        'COALESCE(ss.negative_sentiments, 0)::int AS negative_sentiments',
        'ss.avg_polarity'
      );

      joinClauses.push(
        `LEFT JOIN (
          SELECT
            ap.page_id,
            COUNT(DISTINCT ap.id)::int AS post_count,
            MAX(ap.posted_at) AS last_post_at
          FROM accessible_posts ap
          GROUP BY ap.page_id
        ) ps ON ps.page_id = pg.id`
      );

      joinClauses.push(
        `LEFT JOIN (
          SELECT
            ap.page_id,
            COUNT(c.id)::int AS comment_count
          FROM accessible_posts ap
          JOIN comments c ON c.post_id = ap.id
          GROUP BY ap.page_id
        ) cs ON cs.page_id = pg.id`
      );

      joinClauses.push(
        `LEFT JOIN (
          SELECT
            ap.page_id,
            COUNT(r.id)::int AS reaction_count
          FROM accessible_posts ap
          JOIN reactions r ON r.post_id = ap.id
          GROUP BY ap.page_id
        ) rs ON rs.page_id = pg.id`
      );

      joinClauses.push(
        `LEFT JOIN (
          SELECT
            ap.page_id,
            COUNT(s.id)::int AS total_sentiments,
            COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'positive')::int AS positive_sentiments,
            COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'neutral')::int AS neutral_sentiments,
            COUNT(*) FILTER (WHERE LOWER(s.sentiment_category) = 'negative')::int AS negative_sentiments,
            AVG(s.polarity) AS avg_polarity
          FROM accessible_posts ap
          JOIN sentiments s ON s.post_id = ap.id
          GROUP BY ap.page_id
        ) ss ON ss.page_id = pg.id`
      );
    }

    const allowedOrderColumns = ['page_name', 'page_url', 'inserted_at'];
    if (includePostStats) {
      allowedOrderColumns.push('post_count', 'last_post_at', 'comment_count', 'reaction_count', 'engagement_score', 'positive_sentiments', 'negative_sentiments', 'neutral_sentiments', 'avg_polarity');
    }

    let orderExpression: string;
    switch (orderBy) {
      case 'page_name':
      case 'page_url':
      case 'inserted_at':
        orderExpression = `pg.${orderBy}`;
        break;
      case 'post_count':
        orderExpression = includePostStats ? 'COALESCE(ps.post_count, 0)' : 'pg.page_name';
        break;
      case 'last_post_at':
        orderExpression = includePostStats ? 'ps.last_post_at' : 'pg.page_name';
        break;
      case 'comment_count':
        orderExpression = includePostStats ? 'COALESCE(cs.comment_count, 0)' : 'pg.page_name';
        break;
      case 'reaction_count':
        orderExpression = includePostStats ? 'COALESCE(rs.reaction_count, 0)' : 'pg.page_name';
        break;
      case 'engagement_score':
        orderExpression = includePostStats ? '(COALESCE(cs.comment_count, 0) + COALESCE(rs.reaction_count, 0))' : 'pg.page_name';
        break;
      case 'positive_sentiments':
        orderExpression = includePostStats ? 'COALESCE(ss.positive_sentiments, 0)' : 'pg.page_name';
        break;
      case 'neutral_sentiments':
        orderExpression = includePostStats ? 'COALESCE(ss.neutral_sentiments, 0)' : 'pg.page_name';
        break;
      case 'negative_sentiments':
        orderExpression = includePostStats ? 'COALESCE(ss.negative_sentiments, 0)' : 'pg.page_name';
        break;
      case 'avg_polarity':
        orderExpression = includePostStats ? 'ss.avg_polarity' : 'pg.page_name';
        break;
      default:
        orderExpression = allowedOrderColumns.includes(orderBy) ? `pg.${orderBy}` : 'pg.page_name';
        break;
    }

    const direction = orderDirection === 'DESC' ? 'DESC' : 'ASC';

    const query = `
      WITH accessible_posts AS (
        ${accessiblePostsCte}
      )
      SELECT
        ${selectFields.join(',\n        ')}
      FROM pages pg
      ${joinClauses.join('\n')}
      ${whereClause}
      ORDER BY ${orderExpression} ${direction}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map((row) => {
      const page: PageWithStats = {
        id: row.id,
        page_url: row.page_url,
        page_name: row.page_name,
        inserted_at: row.inserted_at,
      };

      if (includePostStats) {
        page.post_count = typeof row.post_count === 'number' ? row.post_count : Number(row.post_count ?? 0);
        page.last_post_at = row.last_post_at ?? null;
        page.comment_count = typeof row.comment_count === 'number' ? row.comment_count : Number(row.comment_count ?? 0);
        page.reaction_count = typeof row.reaction_count === 'number' ? row.reaction_count : Number(row.reaction_count ?? 0);
        page.engagement_score = typeof row.engagement_score === 'number' ? row.engagement_score : Number(row.engagement_score ?? 0);

        const totalSentiments = typeof row.total_sentiments === 'number'
          ? row.total_sentiments
          : Number(row.total_sentiments ?? 0);
        const positiveSentiments = typeof row.positive_sentiments === 'number'
          ? row.positive_sentiments
          : Number(row.positive_sentiments ?? 0);
        const neutralSentiments = typeof row.neutral_sentiments === 'number'
          ? row.neutral_sentiments
          : Number(row.neutral_sentiments ?? 0);
        const negativeSentiments = typeof row.negative_sentiments === 'number'
          ? row.negative_sentiments
          : Number(row.negative_sentiments ?? 0);

        page.sentiment_summary = {
          total: totalSentiments,
          positive: positiveSentiments,
          neutral: neutralSentiments,
          negative: negativeSentiments,
          average_polarity: row.avg_polarity !== null && row.avg_polarity !== undefined
            ? Number(row.avg_polarity)
            : null,
        };
      }

      return page;
    });
  }
}
