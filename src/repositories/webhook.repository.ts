import { pool } from '../config/database';
import { WebhookNotification, ScrapeStatus } from '../interfaces/webhook';

export class WebhookRepository {
  /**
   * Store a webhook notification
   */
  async storeNotification(notification: WebhookNotification): Promise<void> {
    const query = `
      INSERT INTO scrape_notifications (request_id, auth_user_id, stage, post_count, comment_count, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    const metadata = {
      timestamp: notification.timestamp,
    };
    
    await pool.query(query, [
      notification.request_id,
      notification.auth_user_id,
      notification.stage,
      notification.post_count || null,
      notification.comment_count || null,
      JSON.stringify(metadata),
    ]);
  }

  /**
   * Get the latest status for a scrape request
   */
  async getLatestStatus(requestId: string): Promise<ScrapeStatus | null> {
    const query = `
      SELECT 
        request_id,
        auth_user_id,
        stage as latest_stage,
        created_at
      FROM scrape_notifications
      WHERE request_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [requestId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }

  /**
   * Get all notifications for a user's scrape request
   */
  async getNotificationsByRequestId(requestId: string, userId: string): Promise<WebhookNotification[]> {
    const query = `
      SELECT 
        request_id,
        auth_user_id,
        stage,
        post_count,
        comment_count,
        metadata->>'timestamp' as timestamp,
        created_at
      FROM scrape_notifications
      WHERE request_id = $1 AND auth_user_id = $2
      ORDER BY created_at ASC
    `;
    
    const result = await pool.query(query, [requestId, userId]);
    return result.rows;
  }

  /**
   * Get all scrape requests for a user with their latest status
   */
  async getAllUserScrapes(userId: string): Promise<any[]> {
    const query = `
      SELECT DISTINCT ON (request_id)
        request_id,
        stage,
        post_count,
        comment_count,
        created_at
      FROM scrape_notifications
      WHERE auth_user_id = $1
      ORDER BY request_id, created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  }
}

