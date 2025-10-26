import { pool } from '../config/database';
import { AuthUser, AuthSession } from '../interfaces/auth';

export class AuthRepository {
  async createUser(username: string, email: string, passwordHash: string, role: string = 'user'): Promise<AuthUser> {
    try {
      console.log('[AuthRepository] createUser called with:', { username, email, role });
      
      const query = `
        INSERT INTO auth_users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      console.log('[AuthRepository] Executing INSERT query');
      const result = await pool.query(query, [username, email, passwordHash, role]);
      console.log('[AuthRepository] User created successfully:', result.rows[0]?.id);
      
      return result.rows[0];
    } catch (error) {
      console.error('[AuthRepository] Error creating user:', error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    try {
      console.log('[AuthRepository] findByEmail called:', email);
      const query = `SELECT * FROM auth_users WHERE email = $1`;
      const result = await pool.query(query, [email]);
      console.log('[AuthRepository] findByEmail result:', result.rows.length > 0 ? 'found' : 'not found');
      return result.rows[0] || null;
    } catch (error) {
      console.error('[AuthRepository] Error in findByEmail:', error);
      throw error;
    }
  }

  async findByUsername(username: string): Promise<AuthUser | null> {
    try {
      console.log('[AuthRepository] findByUsername called:', username);
      const query = `SELECT * FROM auth_users WHERE username = $1`;
      const result = await pool.query(query, [username]);
      console.log('[AuthRepository] findByUsername result:', result.rows.length > 0 ? 'found' : 'not found');
      return result.rows[0] || null;
    } catch (error) {
      console.error('[AuthRepository] Error in findByUsername:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<AuthUser | null> {
    const query = `SELECT * FROM auth_users WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async updateLastLogin(userId: string): Promise<void> {
    const query = `UPDATE auth_users SET last_login = NOW() WHERE id = $1`;
    await pool.query(query, [userId]);
  }

  async createSession(userId: string, token: string, expiresAt: Date): Promise<AuthSession> {
    const query = `
      INSERT INTO auth_sessions (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, token, expiresAt]);
    return result.rows[0];
  }

  async findSessionByToken(token: string): Promise<AuthSession | null> {
    const query = `
      SELECT * FROM auth_sessions 
      WHERE token = $1 AND expires_at > NOW()
    `;
    const result = await pool.query(query, [token]);
    return result.rows[0] || null;
  }

  async deleteSession(token: string): Promise<void> {
    const query = `DELETE FROM auth_sessions WHERE token = $1`;
    await pool.query(query, [token]);
  }

  async deleteExpiredSessions(): Promise<void> {
    const query = `DELETE FROM auth_sessions WHERE expires_at <= NOW()`;
    await pool.query(query);
  }
}



