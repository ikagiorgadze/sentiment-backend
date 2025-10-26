import { pool } from '../config/database';
import { UserPostAccess } from '../interfaces/auth';

export class AccessRepository {
  // Grant user access to a post
  async grantAccess(
    authUserId: string,
    postId: string,
    grantedBy: string
  ): Promise<UserPostAccess> {
    const query = `
      INSERT INTO user_post_access (auth_user_id, post_id, granted_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (auth_user_id, post_id) DO UPDATE
        SET granted_at = now(), granted_by = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [authUserId, postId, grantedBy]);
    return result.rows[0];
  }

  // Revoke user access to a post
  async revokeAccess(authUserId: string, postId: string): Promise<void> {
    const query = `
      DELETE FROM user_post_access
      WHERE auth_user_id = $1 AND post_id = $2
    `;
    
    await pool.query(query, [authUserId, postId]);
  }

  // Check if user has access to a post
  async hasAccess(authUserId: string, postId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM user_post_access
      WHERE auth_user_id = $1 AND post_id = $2
    `;
    
    const result = await pool.query(query, [authUserId, postId]);
    return result.rows.length > 0;
  }

  // Get all posts a user has access to
  async getUserPosts(authUserId: string): Promise<string[]> {
    const query = `
      SELECT post_id FROM user_post_access
      WHERE auth_user_id = $1
      ORDER BY granted_at DESC
    `;
    
    const result = await pool.query(query, [authUserId]);
    return result.rows.map(row => row.post_id);
  }

  // Get all users who have access to a post
  async getPostUsers(postId: string): Promise<UserPostAccess[]> {
    const query = `
      SELECT upa.*, au.username, au.email
      FROM user_post_access upa
      JOIN auth_users au ON upa.auth_user_id = au.id
      WHERE upa.post_id = $1
      ORDER BY upa.granted_at DESC
    `;
    
    const result = await pool.query(query, [postId]);
    return result.rows;
  }

  // Get access details for a specific user and post
  async getAccess(authUserId: string, postId: string): Promise<UserPostAccess | null> {
    const query = `
      SELECT * FROM user_post_access
      WHERE auth_user_id = $1 AND post_id = $2
    `;
    
    const result = await pool.query(query, [authUserId, postId]);
    return result.rows[0] || null;
  }
}

